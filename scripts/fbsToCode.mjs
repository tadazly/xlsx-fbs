import { checkExist } from './utils/fsUtil.mjs'
import { getGenerateScriptPath, getOrganizedScriptPath, i18n } from './environment.mjs';
import path from 'path';
import fsAsync from 'fs/promises';
import { flatcAsync } from './utils/flatcUtil.mjs';
import { log, warn } from './utils/logUtil.mjs';
import { toKebabCase } from './utils/stringUtil.mjs';
import * as fsUtil from './utils/fsUtil.mjs';
import { getTsMainTemplate, getTsClassListTemplate, fillTemplate, getTsImportClassTemplate } from './template.mjs';

/**
 * 通过 .fbs 文件生成对应的代码
 * @param {string} fbsPath 
 * @param {string[]} flatcOptions 
 */
export async function fbsToCode(fbsPath, flatcOptions) {
    log(`fbsToCode: ${fbsPath}`);
    if (!await checkExist(fbsPath)) {
        throw new Error(`${i18n.errorFbsNotFound}: ${fbsPath}`);
    }

    await flatcAsync(flatcOptions, [fbsPath]);
    await organizeCodeFiles(getGenerateScriptPath(fbsPath), getOrganizedScriptPath());
}

/**
 * 根据 flatc 生成的 ts 代码和 ts模板, 生成 main.ts 文件用于 esbuild
 * @param {string} tsPath 
 * @param {string} namespace 
 * @returns {string} 生成的 main.ts 文件路径
 */
export async function generateTsMain(tsPath, namespace) {
    const { Project } = await import('ts-morph'); // 动态导入，加快运行时间

    const namespaceKebabCase = toKebabCase(namespace);
    const tsScriptsPath = path.join(tsPath, namespaceKebabCase, `**/*.ts`);

    const project = new Project();
    project.addSourceFilesAtPaths(tsScriptsPath);

    // 获取所有导出的类
    const exportedClasses = {};
    for (const sourceFile of project.getSourceFiles()) {
        sourceFile.getClasses()
            .forEach(cls => {
                if (cls.isExported() && cls.getName()) {
                    exportedClasses[cls.getName()] = path.relative(tsPath, sourceFile.getFilePath()).replace(/\.ts$/g, '.js');
                }
            });
    }

    const classList = Object
        .keys(exportedClasses)
        .map(className => fillTemplate(getTsClassListTemplate(), {
            CLASS_NAME: className,
        })).join('\n');

    const importClassList = Object
        .entries(exportedClasses)
        .map(([className, filePath]) => fillTemplate(getTsImportClassTemplate(), {
            CLASS_NAME: className,
            SOURCE_FILE_PATH: filePath,
        })).join('\n');

    const tsMainContent = fillTemplate(getTsMainTemplate(), {
        IMPORT_CLASS_LIST: importClassList,
        CLASS_LIST: classList,
        NAMESPACE: namespace,
    });

    const tsMainPath = path.join(tsPath, `${namespaceKebabCase}.ts`);
    await fsUtil.writeFile(tsMainPath, tsMainContent, 'utf-8');
    return tsMainPath;
}

const LANGUAGE_EXTENSIONS = {
    'cpp': ['.cpp', '.h', '.hpp'],
    'csharp': ['.cs'],
    'go': ['.go'],
    'java': ['.java'],
    'kotlin': ['.kt'],
    'js': ['.js', '.jsx'],
    'ts': ['.ts', '.tsx'],
    'python': ['.py'],
    'rust': ['.rs'],
    'swift': ['.swift']
};

/**
 * 根据文件扩展名返回对应的语言类型
 * @param {string} filePath - 文件路径
 * @returns {string} - 语言类型
 */
function getLanguageFromExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
        if (extensions.includes(ext)) {
            return lang;
        }
    }
    return 'other';
}

/**
 * 整理文件到对应的语言目录
 * @param {string} sourceDir - 源目录
 * @param {string} destDir - 目标目录
 */
async function organizeCodeFiles(sourceDir, destDir) {
    // 确保源目录存在
    if (!await checkExist(sourceDir)) {
        throw new Error(`${i18n.errorScriptNotFound}: ${sourceDir}`);
    }

    async function mkdirRecursive(dirPath) {
        if (!await checkExist(dirPath)) {
            const parentDir = path.dirname(dirPath);
            await mkdirRecursive(parentDir);
            try {
                await fsAsync.mkdir(dirPath);
            } catch (error) {
                warn(`WARN: Skip exist dir: ${dirPath}`);
            }
        }
    }

    // 递归遍历目录
    async function traverseDirectory(currentPath) {
        const items = await fsAsync.readdir(currentPath);

        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            const stats = await fsAsync.stat(itemPath);

            if (stats.isFile()) {
                // 获取相对路径
                const relPath = path.relative(sourceDir, currentPath);

                // 获取语言类型
                const lang = getLanguageFromExtension(itemPath);

                // 创建目标目录
                const targetDir = path.join(destDir, lang, relPath);
                await mkdirRecursive(targetDir);

                // 移动文件
                const targetPath = path.join(targetDir, item);
                await fsAsync.rename(itemPath, targetPath);
            } else if (stats.isDirectory()) {
                await traverseDirectory(itemPath);
            }
        }
    }

    await traverseDirectory(sourceDir);
    await fsAsync.rm(sourceDir, { recursive: true, force: true });
}
import { checkExist, writeFile, getRelativePath } from './utils/fsUtil.mjs'
import { getGenerateScriptPath, getOrganizedScriptPath, i18n, projectPath } from './environment.mjs';
import path from 'path';
import fsAsync from 'fs/promises';
import { flatcAsync } from './utils/flatcUtil.mjs';
import { log, warn } from './utils/logUtil.mjs';
import { toKebabCase, toUpperCamelCase, toSnakeCase, toTableConstantStyle } from './utils/stringUtil.mjs';
import { getTsMainTemplate, getTsClassListTemplate, fillTemplate, getTsImportClassTemplate, getTsConstFieldTemplate, getTsConstTemplate, getCSharpConstTemplate, getCSharpConstFieldTemplate } from './template.mjs';

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
                    exportedClasses[cls.getName()] = getRelativePath(tsPath, sourceFile.getFilePath()).replace(/\.ts$/g, '.js');
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
    await writeFile(tsMainPath, tsMainContent, 'utf-8');
    return tsMainPath;
}

/**
 * 生成任意语言的表格常量定义
 * @param {string} scriptRoot - 脚本根目录
 * @param {string} jsonPath - JSON 数据源路径
 * @param {string} namespace - 命名空间
 * @param {import('./xlsx-fbs.mjs').TableConfig[]} configs - 表格配置
 * @param {{
*   fileExt: string,
*   getFileName: (namespace: string) => string,
*   getClassName: (tableName: string) => string,
*   getFieldKey: (key: string) => string,
*   getFieldType: (value: any) => string,
*   getFieldValue: (value: any) => string,
*   getFieldDesc: (desc: any) => string,
*   getConstTemplate: () => string,
*   getFieldTemplate: () => string,
* }} langOptions - 语言相关模板配置
*/
export async function generateLangConst(scriptRoot, jsonPath, namespace, configs, langOptions) {
    const namespaceStyled = langOptions.getFileName(namespace);
    const scriptsPath = path.join(scriptRoot, ...namespaceStyled.split('.'));
    const outputList = [];

    for (const config of configs) {
        const { tableName, constFields } = config;

        const tableData = await fsAsync.readFile(path.join(jsonPath, `${tableName}.json`), 'utf-8');
        const tableDataObject = JSON.parse(tableData);
        /** @type {Record<string, any>[]} */
        const tableInfos = Object.values(tableDataObject)[0];

        /** @type {string[]} */
        const constFieldTemplateList = [];

        for (const constField of constFields) {
            let { key: keyField, value: valueField, desc: descField } = constField;
            keyField = toSnakeCase(keyField);
            valueField = toSnakeCase(valueField);
            descField = toSnakeCase(descField);

            const fieldMap = new Map();
            for (const info of tableInfos) {
                if (info[keyField] !== undefined) {
                    let desc = info[descField];
                    if (desc) {
                        desc = desc.replace(/[\r\n]+/g, ' ');   // 去除换行符
                    }
                    fieldMap.set(info[keyField], { value: info[valueField], desc });
                }
            }

            fieldMap.forEach(({ value, desc }, key) => {
                const rendered = fillTemplate(langOptions.getFieldTemplate(), {
                    CONST_KEY: langOptions.getFieldKey(key),
                    CONST_VALUE: langOptions.getFieldValue(value),
                    CONST_TYPE: langOptions.getFieldType(value),
                    CONST_DESC: langOptions.getFieldDesc(desc),
                });
                constFieldTemplateList.push(rendered);
            });
        }

        const fileContent = fillTemplate(langOptions.getConstTemplate(), {
            NAMESPACE: namespace,
            CLASS_NAME: langOptions.getClassName(tableName),
            CONST_FIELD_LIST: constFieldTemplateList.join('\n\n'),
        });

        const fileName = langOptions.getFileName(`${tableName}Const`);
        const filePath = path.join(scriptsPath, `${fileName}.${langOptions.fileExt}`);
        await writeFile(filePath, fileContent, 'utf-8');
        outputList.push(filePath);
    }

    return outputList;
}

/**
 * 生成 TypeScript 的表格常量定义
 * @param {string} tsPath 
 * @param {string} jsonPath 
 * @param {string} namespace 
 * @param {import('./xlsx-fbs.mjs').TableConfig[]} configs 
 */
export async function generateTsConst(tsPath, jsonPath, namespace, configs) {
    return generateLangConst(tsPath, jsonPath, namespace, configs, {
        fileExt: 'ts',
        getFileName: toKebabCase,
        getClassName: toUpperCamelCase,
        getFieldKey: toTableConstantStyle,
        getFieldType: () => '', // TS 不用显示写类型在 const 上
        getFieldValue: val => typeof val === 'string' ? `"${val}"` : val ?? 0,
        getFieldDesc: desc => desc || '',
        getConstTemplate: getTsConstTemplate,
        getFieldTemplate: getTsConstFieldTemplate,
    });
}

/**
 * 生成 C# 的表格常量定义
 * @param {string} csharpPath 
 * @param {string} jsonPath 
 * @param {string} namespace 
 * @param {import('./xlsx-fbs.mjs').TableConfig[]} configs 
 */
export async function generateCSharpConst(csharpPath, jsonPath, namespace, configs) {
    return generateLangConst(csharpPath, jsonPath, namespace, configs, {
        fileExt: 'cs',
        getFileName: toUpperCamelCase,
        getClassName: toUpperCamelCase,
        getFieldKey: toTableConstantStyle,
        getFieldType: val => typeof val === 'string' ? 'string' : 'int',
        getFieldValue: val => typeof val === 'string' ? `"${val}"` : val ?? 0,
        getFieldDesc: desc => desc || '',
        getConstTemplate: getCSharpConstTemplate,
        getFieldTemplate: getCSharpConstFieldTemplate,
    });
}

/**
 * @typedef JSBuildOptions
 * @property {string} namespace
 * @property {number} multiThread
 * @property {boolean} jsSourceMap
 * @property {boolean} jsExcludeFlatbuffers
 * @property {string[]} jsBrowserTarget
 * @property {string[]} jsNodeTarget
 */

/**
 * 根据 ts 代码生成对应的 js 代码
 * @param {string} tsPath 
 * @param {string} jsPath 
 * @param {JSBuildOptions} options 
 */
export async function generateJSBundle(tsPath, jsPath, options = {}) {
    const { build } = await import('esbuild');
    const pLimit = (await import('p-limit')).default;
    
    if (!await checkExist(jsPath)) {
        await fsAsync.mkdir(jsPath, { recursive: true });
    }
    
    const namespaceKebabCase = toKebabCase(options.namespace);
    const limit = pLimit(options.multiThread);

    /** @type {import('esbuild').BuildOptions} */
    const browserBuildOptions = {
        entryPoints: [ path.join(tsPath, `${namespaceKebabCase}.ts`) ],
        bundle: true,
        outfile: path.join(jsPath, `${namespaceKebabCase}.js`),
        platform: 'browser',
        target: options.jsBrowserTarget,
        sourcemap: options.jsSourceMap,
        format: 'iife',
        nodePaths: [ path.resolve(projectPath, 'node_modules') ],   // 在项目外的路径解析依赖的 flatbuffers
    }

    /** @type {import('esbuild').BuildOptions} */
    const nodeBuildOptions = {
        entryPoints: [ path.join(tsPath, `${namespaceKebabCase}.ts`) ],
        bundle: true,
        outfile: path.join(jsPath, `${namespaceKebabCase}.cjs.js`),
        platform: 'node',
        target: options.jsNodeTarget,
        sourcemap: options.jsSourceMap,
        format: 'cjs',
        nodePaths: [ path.resolve(projectPath, 'node_modules') ],
    }

    if (options.jsExcludeFlatbuffers) {
        browserBuildOptions.external = [ 'flatbuffers' ];
        nodeBuildOptions.external = [ 'flatbuffers' ];
    }

    const buildList = [];
    // browser
    buildList.push(limit(() => build(browserBuildOptions)));
    buildList.push(limit(() => build({
        ...browserBuildOptions,
        minify: true,
        outfile: browserBuildOptions.outfile.replace(/\.js$/, '.min.js'),
    })));
    // node
    buildList.push(limit(() => build(nodeBuildOptions)));
    buildList.push(limit(() => build({
        ...nodeBuildOptions,
        minify: true,
        outfile: nodeBuildOptions.outfile.replace(/\.cjs\.js$/, '.cjs.min.js'),
    })));
    buildList.push(limit(() => build({
        ...nodeBuildOptions,
        outfile: nodeBuildOptions.outfile.replace(/\.cjs\.js$/, '.esm.js'),
        format: 'esm',
    })));
    buildList.push(limit(() => build({
        ...nodeBuildOptions,
        minify: true,
        outfile: nodeBuildOptions.outfile.replace(/\.cjs\.js$/, '.esm.min.js'),
        format: 'esm',
    })));

    await Promise.all(buildList);
}

export const LANGUAGE_EXTENSIONS = {
    'cpp': ['.cpp', '.h', '.hpp'],
    'csharp': ['.cs'],
    'go': ['.go'],
    'java': ['.java'],
    'kotlin': ['.kt'],
    'js': ['.js', '.jsx'],
    'ts': ['.ts', '.tsx'],
    'python': ['.py'],
    'rust': ['.rs'],
    'swift': ['.swift'],
    'php': ['.php'],
    'dart': ['.dart'],
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
                try {
                    await fsAsync.rename(itemPath, targetPath);
                } catch (err) {
                    warn(`WARN: Skip exist rename: ${targetPath}`);
                }
            } else if (stats.isDirectory()) {
                await traverseDirectory(itemPath);
            }
        }
    }

    await traverseDirectory(sourceDir);
    await fsAsync.rm(sourceDir, { recursive: true, force: true });
}
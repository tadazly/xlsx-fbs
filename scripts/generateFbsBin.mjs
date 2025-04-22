import { flatcToBinaryAsync } from './utils/flatcUtil.mjs';
import * as logUtil from './utils/logUtil.mjs';
import { getBinPath, getFbsPath, getGenerateScriptPath, getJsonPath, i18n } from './environment.mjs';
import fsAsync from 'fs/promises';
import { toSnakeCase, toUpperCamelCase } from './utils/stringUtil.mjs';
import { fillTemplate, getFbsIncludeTemplate, getFbsMergeFieldTemplate, getFbsMergeTemplate } from './template.mjs';
import { fbsToCode } from './fbsToCode.mjs';
import { generateFbsHash } from './xlsxToFbs.mjs';

/**
 * 将 json 文件转换为二进制文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} jsonPath 输入的 json 文件
 * @param {string} binPath 输出的二进制文件
 */
export async function jsonToBin(fbsPath, jsonPath, binPath) {
    try {
        await flatcToBinaryAsync(fbsPath, jsonPath, binPath);
    } catch (err) {
        logUtil.error(`${i18n.errorFlatcGenerateFailed}: ${jsonPath}`);
        logUtil.error(err?.message || err);
        throw new Error(`Failed to generate binary for ${jsonPath}`);
    }
}

/**
 * 为要合并的表生成 fbs 文件并转换二进制
 * @param {import('./xlsx-fbs.mjs').TableConfig[]} tableConfigs 
 * @param {import('./xlsxToFbs.mjs').XlsxToFbsOptions} options 
 * @param {string[]} flatcArgs 
 */
export async function generateMergeFbsBin(tableConfigs, options, flatcArgs) {
    if (tableConfigs.length === 0) {
        return;
    }
    const mergeData = {};
    /** @type {string[]} */
    const includeList = [];
    /** @type {string[]} */
    const mergeFieldList = [];
    const namespace = options.namespace;
    const fileExtension = options.binaryExtension
        ? `file_extension "${options.binaryExtension}";`
        : '';
    for (const config of tableConfigs) {
        const { tableName } = config;
        const tableClassName = toUpperCamelCase(tableName);
        const tableNameSnakeCase = toSnakeCase(tableName);

        includeList.push(fillTemplate(getFbsIncludeTemplate(), {
            TABLE_NAME: tableName
        }));

        mergeFieldList.push(fillTemplate(getFbsMergeFieldTemplate(), {
            TABLE_CLASS: tableClassName,
            TABLE_CLASS_SNAKE_CASE: tableNameSnakeCase,
        }));

        const jsonPath = getJsonPath(tableName);
        const jsonContent = await fsAsync.readFile(jsonPath, 'utf-8');

        const jsonData = JSON.parse(jsonContent);
        mergeData[tableNameSnakeCase] = jsonData;
    }
    // 生成 fbs 文件
    const mergeFbsPath = getFbsPath('mergeTable');
    const templateArgs = {
        INCLUDE_LIST: includeList.join('\n'),
        FILE_EXTENSION: fileExtension,
        MERGE_FIELD_LIST: mergeFieldList.join('\n'),
        NAMESPACE: namespace,
    }
    const mergeFbsContentBase = fillTemplate(getFbsMergeTemplate(), templateArgs);
    const identifier = generateFbsHash(mergeFbsContentBase);
    const mergeFbsContent = fillTemplate(getFbsMergeTemplate(), {
        FILE_IDENTIFIER: identifier,
        ...templateArgs,
    });
    await fsAsync.writeFile(mergeFbsPath, mergeFbsContent, 'utf-8');
    // 生成 json 文件
    const jsonOutputPath = getJsonPath('mergeTable');
    await fsAsync.writeFile(jsonOutputPath, JSON.stringify(mergeData, null, 2), 'utf-8');
    // 生成代码
    flatcArgs.push(`-o ${getGenerateScriptPath('mergeTable')}`);
    await fbsToCode(mergeFbsPath, flatcArgs);
    // 生成二进制文件
    const includeFbsPath = getFbsPath();
    const binOutputPath = getBinPath();
    try {
        await flatcToBinaryAsync(mergeFbsPath, jsonOutputPath, binOutputPath, includeFbsPath);
    } catch (err) {
        logUtil.error(`${i18n.errorFlatcGenerateFailed}: ${jsonPath}`);
        logUtil.error(err?.message || err);
        throw new Error(`Failed to generate binary for ${jsonPath}`);
    }
}

/**
 * 通过脚本动态生成二进制文件
 * @param {string} binPath 输出的二进制文件
 */
export async function scriptToBin(binPath) {

}


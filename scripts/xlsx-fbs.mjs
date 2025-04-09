#!/usr/bin/env node
// 👆Help to Link to Global

import { i18n } from './environment.mjs'
import { program } from 'commander';
import fsAsync from 'fs/promises';
import * as fsUtil from './utils/fsUtil.mjs';
import path from 'path';
import { xlsxToFbs } from './xlsxToFbs.mjs';
import { xlsxToJson } from './xlsxToJson.mjs';
import { fbsToCode } from './fbsToCode.mjs';
import { xlsxFbsOptions, getFbsPath, getBinPath, getJsonPath, getGenerateScriptPath, getOrganizedScriptPath } from './environment.mjs';
import { jsonToBin } from './generateFbsBin.mjs';
import { encodeHtml } from './utils/stringUtil.mjs';

async function main() {
    program
        .name('xlsx-fbs')
        .usage('[input] [flatc options] [options]')
        .description(i18n.description)
        .allowUnknownOption() // 允许未知选项，直接传递给 flatc
        .allowExcessArguments() // 开启后，多余的选项不会报错
        .version('0.0.1', '-V, --version', i18n.versionOption + '\n');

    // input
    program
        .argument('[input]', i18n.input);

    // flatc options
    program
        .option('--👇[flatc options]', i18n.commonFlatcOptions)
        .option('--cpp', 'C++')
        .option('--csharp', 'C#')
        .option('--ts', 'TypeScript')
        .option('--rust', 'Rust')
        .option('--go', 'Golang')
        .option('--python', 'Python')
        .option('--...', '\n');

    // options
    program
        .option('--👇[options]', i18n.xlsxFbsOptions)
        .option('-o, --output <path>', i18n.output)
        .option('-n, --namespace <name>', i18n.namespace)
        .option('-k, --default-key <field>', i18n.defaultKey)
        .option('--binary-extension <ext>', i18n.binaryExtension)
        .option('--censored-fields <fields>', i18n.censoredFields, (value) => {
            return value.split(',').map(field => field.trim()).filter(Boolean);
        })
        .option('--empty-string', i18n.emptyString)
        .option('--enable-streaming-read', i18n.enableStreamingRead)
        .option('--delete-fbs', i18n.deleteFbs)
        .option('--generate-fbs-hash', i18n.generateFbsHash)
        .option('--generate-json', i18n.generateJson)
        .option('--legacy-mode', i18n.legacyMode)
        .option('--property-order <order>', i18n.propertyOrder, (value) => {
            if (!/^[A-Za-z]{5}$/.test(value)) {
                console.error(i18n.errorInvalidPropertyOrder);
                process.exit(1);
            }
            return value.toUpperCase().split('');
        })
        .helpOption('-h, --help', i18n.helpOption);

    program.parse();

    // 获取定义的参数
    const args = program.args;
    if (args.length > 1 && !args[1].startsWith('-')) {
        console.error(i18n.errorInvalidInput + `: ${args[0]} => ${args[1]} <=`);
        process.exit(1);
    }

    // 获取定义的选项
    const options = program.opts();
    Object.keys(xlsxFbsOptions)
        .forEach(key => xlsxFbsOptions[key] = options[key] || xlsxFbsOptions[key]);

    xlsxFbsOptions.output = path.resolve(xlsxFbsOptions.output);

    console.log('xlsx-fbs 参数：', xlsxFbsOptions);

    // 获取未定义的选项
    const parsed = program.parseOptions(process.argv);
    const unknownArgs = parsed.unknown;

    // 拼接 flatc 参数
    const flatcArgs = [
        ...Object.entries(options)
            .filter(([key]) => !Object.keys(xlsxFbsOptions).includes(key)) // 排除不传递给 flatc 的选项
            .map(([key, value]) => typeof value === 'boolean' ? `--${key}` : `--${key} ${value}`),
        ...unknownArgs,
    ];

    console.log(`flatc 参数：${flatcArgs}`);

    const input = !args[0] || args[0].startsWith('-') ? process.cwd() : args[0];
    
    let isFile = false;

    try {
        const stat = await fsAsync.stat(input);
        isFile = stat.isFile();
    } catch (err) {
        console.error(i18n.errorTableNotFound + `: ${input}`);
        process.exit(1);
    }
    if (isFile && xlsxFbsOptions.legacyMode) {
        // 传统打表，只输出原始的 JSON 文件
        async function generateLegacyOutput(input, xlsxData) {
            for (const content of xlsxData) {
                for (const key in content) {
                    if (typeof content[key] === 'string') {
                        content[key] = encodeHtml(content[key])
                    }
                }
            }
            const jsonOutputPath = getJsonPath(input);
            const output = JSON.stringify(xlsxData, null, '\t').replace(/: /g, ":")
            await fsUtil.writeFile(jsonOutputPath, output, 'utf-8');
            console.log(`${i18n.successGenerateJson}: ${jsonOutputPath}`);
        }
        const startTime = performance.now();
        const { xlsxData, xlsxDataCensored } = await xlsxToJson(input, xlsxFbsOptions);
        await generateLegacyOutput(input, xlsxData);

        if (xlsxDataCensored) {
            console.log('generate censored output ...');
            const outputDirname = path.basename(xlsxFbsOptions.output) + '_censored';
            xlsxFbsOptions.output = path.join(path.dirname(xlsxFbsOptions.output), outputDirname);
            await generateLegacyOutput(input, xlsxDataCensored);
        }
        const endTime = performance.now();
        console.log(`finished: ${input} 耗时: ${endTime - startTime}ms`);
    }
    else if (isFile) {
        // 单个 excel 文件
        async function generateOutput(input, fbs, xlsxData) {
            const fbsOutputPath = getFbsPath(input);
            await fsUtil.writeFile(fbsOutputPath, fbs);
            console.log(`${i18n.successGenerateFbs}: ${getFbsPath(input)}`);

            flatcArgs.push(`-o ${getGenerateScriptPath()}`);
            await fbsToCode(fbsOutputPath, flatcArgs);
            console.log(`${i18n.successGenerateCode}: ${getOrganizedScriptPath()}`);

            const jsonOutputPath = getJsonPath(input);
            await fsUtil.writeFile(jsonOutputPath, JSON.stringify(xlsxData, null, 2), 'utf-8');
            console.log(`${i18n.successGenerateJson}: ${jsonOutputPath}`);

            const binOutputPath = getBinPath();
            await jsonToBin(fbsOutputPath, jsonOutputPath, binOutputPath);
            console.log(`${i18n.successGenerateBinary}: ${binOutputPath}`);
        }
        try {
            const startTime = performance.now();
            const { fbs, xlsxData, fbsCensored, xlsxDataCensored } = await xlsxToFbs(input, xlsxFbsOptions);

            await generateOutput(input, fbs, xlsxData);

            if (fbsCensored) {
                // 由于修改了全局变量 xlsxFbsOptions.output，所以需要在最后执行
                console.log('generate censored output ...');
                const outputDirname = path.basename(xlsxFbsOptions.output) + '_censored';
                xlsxFbsOptions.output = path.join(path.dirname(xlsxFbsOptions.output), outputDirname);
                await generateOutput(input, fbsCensored, xlsxDataCensored);
            }

            const endTime = performance.now();
            console.log(`finished: ${input} 耗时: ${endTime - startTime}ms`);
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    } else {
        // 批量转换路径下的所有 excel 文件
        await batchConvert(input);
    }
}

async function batchConvert(filePath) {
    const tablesConfig = await getTablesConfig(filePath);
    console.log(tablesConfig);
}

/**
 * @typedef {Object} TableConfig
 * @property {string} tableName 表名
 * @property {string} filePath 表路径
 * @property {boolean} merge 是否将多张表合并到一个二进制文件
 * @property {boolean} censoredTable 是否在 output_censored 目录中剔除该表
 * @property {string[]} censoredFields 需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)
 * @property {{key: string, value: string, desc: string}[]} constFields 需要生产常量定义的字段
 */

/**
 * 若是批量转换表，读取根目录下的 $tables.xlsx 文件，获取打表配置（只打配置在该表中的表，是否将多张表合并到一个二进制文件方便预加载，需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)）
 * @param {string} rootDir 批量打表的根路径 
 * @returns {Promise<TableConfig[]>}
 */
async function getTablesConfig(rootDir) {
    if (!await fsUtil.checkExist(rootDir)) {
        // 如果根目录不存在，则抛出错误
        throw new Error(`${i18n.errorInvalidRootDir}: ${rootDir}`);
    }
    if (await fsUtil.isFile(rootDir)) {
        // 如果传入的是文件，则获取文件的根目录
        const rootDir = path.resolve(path.dirname(rootDir));
        return getTablesConfig(path.resolve(path.dirname(rootDir)));
    }

    /**
     * 返回的结果，包含路径，且剔除了不存在的表
     * @type {TableConfig[]}
     */
    let tablesConfig = [];

    /**
     *  $tables.xlsx 中的表配置，不包含路径
     * @type {Map<string, TableConfig>} 
     */
    let tablesConfigMap = new Map();

    // 遍历根目录中的文件，找到 $tables.xlsx
    const files = await fsAsync.readdir(rootDir, {withFileTypes: false, recursive: false});
    const matched = files.filter(name => 
        /^\$.*\.(xls|xlsx)$/i.test(name)
    );
    if (matched.length === 0) {
        // 找不到文件则默认打根目录中的所有表
        console.warn(i18n.errorTablesConfigNotFound);
    } else {
        const tablesXlsxPath = path.join(rootDir, matched[0]);
        const { xlsxData: tablesXlsxJson } = await xlsxToJson(tablesXlsxPath, xlsxFbsOptions);
        tablesXlsxJson.forEach(row => {
            // 一些魔法字段😜
            const tableName = (row.tableName || row.name).trim();
            const merge = row.merge == 1;
            const censoredTable = row.censoredTable == 1 || row.deleteTable == 1 || row.deletePublish == 1;
            const censoredFieldsStr = (row.censoredFields || row.censoredField || row.sensitiveField || '').trim();
            const censoredFields = censoredFieldsStr ? censoredFieldsStr.split(',').map(field => field.trim()).filter(Boolean) : [];
            const constFieldStr = (row.constFields || row.constField || '').trim();
            const constFields = constFieldStr ? JSON.parse(constFieldStr) : [];
            tablesConfigMap.set(tableName, {
                tableName,
                merge,
                censoredTable,
                censoredFields,
                constFields,
            });
        });
        console.log(`${i18n.successReadTablesConfig}: ${matched[0]}`);
    }

    const tables = await fsUtil.findFiles(rootDir, /\.xlsx|\.xls$/);

    for (const table of tables) {
        const name = path.basename(table, path.extname(table));
        if (!tablesConfigMap) {
            tablesConfig.push({
                name,
                filePath: table,
                merge: false,
                censoredTable: false,
                censoredFields: [],
                constFields: [],
            });
        } else if (tablesConfigMap.has(name)) {
            const tableConfig = tablesConfigMap.get(name);
            tableConfig.filePath = table;
            tablesConfig.push(tableConfig);
        }
    }

    return tablesConfig;
}

main().catch(console.error);

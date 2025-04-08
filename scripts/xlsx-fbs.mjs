#!/usr/bin/env node
// 👆Help to Link to Global

import { i18n } from './environment.mjs'
import { program } from 'commander';
import fsAsync from 'fs/promises';
import * as fsUtil from './utils/fsUtil.mjs';
import path from 'path';
import { xlsxToFbs } from './xlsxToFbs.mjs';
import { fbsToCode } from './fbsToCode.mjs';
import { xlsxFbsOptions, getFbsPath, getBinPath, getJsonPath, getGenerateScriptPath, getOrganizedScriptPath } from './environment.mjs';
import { jsonToBin } from './generateFbsBin.mjs';

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
        .option('--delete-fbs', i18n.deleteFbs)
        .option('--generate-fbs-hash', i18n.generateFbsHash)
        .option('--generate-json', i18n.generateJson)
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
    const stat = await fsAsync.stat(input);
    if (stat.isFile()) {
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
            const { fbs, xlsxData, fbsCensored, xlsxDataCensored } = await xlsxToFbs(input, xlsxFbsOptions);

            await generateOutput(input, fbs, xlsxData);

            if (fbsCensored) {
                // 由于修改了全局变量 xlsxFbsOptions.output，所以需要在最后执行
                console.log('generate censored output ...');
                const outputDirname = path.basename(xlsxFbsOptions.output) + '_censored';
                xlsxFbsOptions.output = path.join(path.dirname(xlsxFbsOptions.output), outputDirname);
                await generateOutput(input, fbsCensored, xlsxDataCensored);
            }

            console.log('finished ...');
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    } else {
        // 批量转换路径下的所有 excel 文件
        const tablesConfig = await getTablesConfig(input);
        console.log(tablesConfig);
    }
}

/**
 * @typedef {Object} TableConfig
 * @property {string} name 表名
 * @property {string} filePath 表路径
 * @property {boolean} isMerge 是否将多张表合并到一个二进制文件
 * @property {string[]} deleteFields 需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)
 */

/**
 * 若是批量转换表，读取根目录下的 $tables.xlsx 文件，获取打表配置（只打配置在该表中的表，是否将多张表合并到一个二进制文件方便预加载，需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)）
 * @param {string} filePath 
 * @returns {Promise<TableConfig[]>}
 */
async function getTablesConfig(filePath) {
    if (!filePath.endsWith('.xlsx') && !filePath.endsWith('.xls')) {
        filePath = path.join(filePath, '$tables.xlsx');
    }

    const tablesConfig = [];
    let tablesConfigMap;

    if (!await fsUtil.checkExist(filePath)) {
        console.warn(i18n.errorTablesConfigNotFound);
    } else {
        tablesConfigMap = new Map();
        const tablesConfigArray = [];
        tablesConfigArray.forEach(tableConfig => {
            tablesConfigMap.set(tableConfig.name, {
                name: tableConfig.name,
                filePath: tableConfig.filePath,
                isMerge: tableConfig.isMerge,
                deleteFields: tableConfig.deleteFields,
            });
        });
    }

    const rootDir = path.resolve(path.dirname(filePath));
    if (!await fsUtil.checkExist(rootDir)) {
        console.error(i18n.errorTablesRootNotFound + `: ${rootDir}`);
        return [];
    }
    const tables = await findAllTables(rootDir);
    for (const table of tables) {
        const name = path.basename(table, path.extname(table));
        if (!tablesConfigMap) {
            tablesConfig.push({
                name,
                filePath: table,
                isMerge: false,
                deleteFields: [],
            });
        } else if (tablesConfigMap.has(name)) {
            const tableConfig = tablesConfigMap.get(name);
            tablesConfig.push(tableConfig);
        }
    }

    return tablesConfig;
}

/**
 * 递归找出目录中的所有表
 * @param {string} filePath 
 * @returns 
 */
async function findAllTables(filePath) {
    const tables = [];
    const stat = await fsAsync.stat(filePath);
    if (stat.isDirectory()) {
        const files = await fsAsync.readdir(filePath);
        for (const file of files) {
            const fullPath = path.join(filePath, file);
            const subTables = await findAllTables(fullPath);
            tables.push(...subTables);
        }
    } else if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
        tables.push(filePath);
    }
    return tables;
}

main().catch(console.error);

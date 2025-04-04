#!/usr/bin/env node
// 👆Help to Link to Global

import { program } from 'commander';
import fsAsync from 'fs/promises';
import * as fsUtil from './utils/fsUtil.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { xlsxToFbs } from './xlsxToFbs.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const projectPath = path.dirname(path.dirname(scriptPath));

function getLocale() {
    const langEnv = Intl.DateTimeFormat().resolvedOptions().locale;
    if (langEnv.startsWith('zh')) {
        return 'zh';
    }
    return 'en';
}

async function loadLocaleStrings(locale) {
    const filePath = path.join(projectPath, 'locales', `${locale}.json`);
    try {
        const file = await fsAsync.readFile(filePath, 'utf-8');
        return JSON.parse(file);
    } catch (error) {
        console.error(`Failed to load locale file: ${filePath}`);
        if (locale === 'en') {
            process.exit(1);
        } else {
            return loadLocaleStrings('en');
        }
    }
}

async function main() {
    const locale = getLocale();
    global.i18n = await loadLocaleStrings(locale);

    program
        .name('xlsx-fbs')
        .description(i18n.description)
        .allowUnknownOption() // 允许未知选项，直接传递给 flatc
        .allowExcessArguments() // 开启后，多余的选项不会报错
        .version('0.0.1');

    program
        .argument('[input]', i18n.input)
        .option('--cpp', 'C++')
        .option('--csharp', 'C#')
        .option('--ts', 'TypeScript')
        .option('--rust', 'Rust')
        .option('--go', 'Golang')
        .option('--python', 'Python')
        .option('--allow-non-utf8', i18n.allowNonUtf8)
        .option('--natural-utf8', i18n.naturalUtf8)
        .option('--force-empty', i18n.forceEmpty)
        .option('--delete-fbs', i18n.deleteFbs)
        .option('--generate-fbs-hash', i18n.generateFbsHash)
        .option('--generate-json', i18n.generateJson)
        .option('-n, --namespace <name>', i18n.namespace)
        .option('-o, --output <path>', i18n.output)
        .parse();

    // 获取定义的选项
    const options = program.opts();
    // 获取定义的参数
    const args = program.args;
    if (args.length > 1 && !args[1].startsWith('-')) {
        console.error(i18n.errorInvalidInput + `: ${args[0]} => ${args[1]} <=`);
        process.exit(1);
    }

    // 获取未定义的选项
    const parsed = program.parseOptions(process.argv);
    const unknownArgs = parsed.unknown;

    // 排除不传递给 flatc 的选项
    const excludeOptions = ['namespace', 'output'];

    // 拼接 flatc 参数
    const flatcArgs = [
        ...Object.entries(options)
            .filter(([key]) => !excludeOptions.includes(key))
            .map(([key, value]) => typeof value === 'boolean' ? `--${key}` : `--${key} ${value}`),
        ...unknownArgs,
    ].join(' ');

    console.log(`传递给 flatc 的参数：${flatcArgs}`);

    const input = !args[0] || args[0].startsWith('-') ? process.cwd() : args[0];
    if (input.endsWith('.xlsx') || input.endsWith('.xls')) {
        // 单个 excel 文件
        xlsxToFbs(input);
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

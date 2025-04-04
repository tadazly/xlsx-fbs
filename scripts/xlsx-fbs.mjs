#!/usr/bin/env node
// 👆Help to Link to Global

import { program } from 'commander';
import fsAsync from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const i18n = await loadLocaleStrings(locale);

    program
        .name('xlsx-fbs')
        .description(i18n.description)
        .allowUnknownOption() // 允许未知选项，直接传递给 flatc
        .allowExcessArguments() // 开启后，多余的选项不会报错
        .version('0.0.1');

    program
        .argument('<input>', i18n.input)
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
        .option('-n, --namespace <name>', i18n.namespace)
        .option('-o, --output <path>', i18n.output)
        .parse();

    // 获取定义的选项
    const options = program.opts();
    // 获取定义的参数
    const args = program.args;
    if (args.length > 1 && !args[1].startsWith('-')) {
        console.error(i18n.errorInput + `: ${args[0]} => ${args[1]} <=`);
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

    const input = args[0];
    if (input.endsWith('.xlsx') || input.endsWith('.xls')) {
        // 单个 excel 文件
        xlsxToFbs(input);
    } else {
        // 批量转换路径下的所有 excel 文件
        const files = await fsAsync.readdir(input);
        for (const file of files) {
            if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
                xlsxToFbs(path.join(input, file));
            }
        }
    }
}

/**
 * @typedef {Object} TableConfig
 * @property {boolean} isMerge 是否将多张表合并到一个二进制文件
 * @property {string[]} deleteFields 需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)
 */

/**
 * 若是批量转换表，读取根目录下的 $tables.xlsx 文件，获取打表配置（是否打表，是否将多张表合并到一个二进制文件，需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)）
 * @param {string} filePath 
 * @returns {Promise<TableConfig[]>}
 */
async function getTablesConfig(filePath) {
    if (!filePath.endsWith('.xlsx') && !filePath.endsWith('.xls')) {
        filePath = path.join(filePath, '$tables.xlsx');
    }

    const tablesConfig = [];

    if (!await fsAsync.stat(filePath)) {
        console.warn(i18n.tablesConfigNotFound + `: ${filePath}`);
    }


}

main().catch(console.error);

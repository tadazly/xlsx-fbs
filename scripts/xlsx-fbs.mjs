#!/usr/bin/env node
// 👆Help to Link to Global

import { getCSharpPath, getFbsHashPath, getFbsHashTablePath, getJsPath, getTableHashPath, getTsPath, i18n } from './environment.mjs'
import { program, Option } from 'commander';
import fsAsync from 'fs/promises';
import * as fsUtil from './utils/fsUtil.mjs';
import path from 'path';
import { generateFbsHash, xlsxToFbs } from './xlsxToFbs.mjs';
import { xlsxToJson } from './xlsxToJson.mjs';
import { fbsToCode, generateCSharpConst, generateJSBundle, generateTsConst, generateTsMain } from './fbsToCode.mjs';
import { xlsxFbsOptions, getFbsPath, getBinPath, getJsonPath, getGenerateScriptPath, getOrganizedScriptPath } from './environment.mjs';
import { generateMergeFbsBin, jsonToBin } from './generateFbsBin.mjs';
import { encodeHtml, toUpperCamelCase } from './utils/stringUtil.mjs';
import { log, error, info, warn, setLogLevel } from './utils/logUtil.mjs';

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

    // TODO: 隐藏一些不对外的选项
    // program.addOption(new Option('--legacy-mode', i18n.legacyMode).hideHelp());

    // options
    program
        .option('--👇[options]', i18n.xlsxFbsOptions)
        .option('-o, --output <path>', i18n.output)
        .option('-n, --namespace <name>', i18n.namespace)
        .option('-k, --default-key <field>', i18n.defaultKey)
        .option('--binary-extension <ext>', i18n.binaryExtension)
        .option('--censored-fields <fields>', i18n.censoredFields, (value) => {
            return value.split(',').map(field => field.trim()).filter(Boolean);  // 在控制台直接调用的时候记得输入双引号，比如 "aa,bb,cc"
        })
        .option('--censored-table', i18n.censoredTable)
        .option('--censored-output <path>', i18n.censoredOutput)
        .option('--output-bin <path>', i18n.outputBin)
        .option('--output-csharp <path>', i18n.outputCsharp)
        .option('--censored-output-bin <path>', i18n.censoredOutputBin)
        .option('--censored-output-csharp <path>', i18n.censoredOutputCsharp)
        .option('--clean-output', i18n.cleanOutput)
        .option('--empty-string', i18n.emptyString)
        .option('--disable-merge-table', i18n.disableMergeTable)
        .option('--disable-incremental', i18n.disableIncremental)
        .option('--enable-streaming-read', i18n.enableStreamingRead)
        .option('--data-class-suffix <suffix>', i18n.dataClassSuffix, (value) => {
            return toUpperCamelCase(value.trim());
        }, 'Info')
        .option('--generate-fbs-hash', i18n.generateFbsHash)
        .option('--allow-wild-table', i18n.allowWildTable)
        .option('--multi-thread <number>', i18n.multiThread, (value) => {
            let num = parseInt(value);
            if (isNaN(num) || num < 1) {
                num = xlsxFbsOptions.multiThread;
            }
            return num;
        })
        .option('--minimal-info [level]', i18n.minimalInfo, (value) => {
            const levels = ['log', 'info', 'warn', 'error'];
            if (!levels.includes(value)) {
                warn(`[xlsx-fbs] 无效的日志等级: ${value}，可选值为: ${levels.join(', ')}`);
                value = 'log';
            }
            return value;
        }, 'info')
        .option('--legacy-mode', i18n.legacyMode)
        .option('--property-order <order>', i18n.propertyOrder, (value) => {
            if (!/^[A-Za-z]{5}$/.test(value)) {
                error(i18n.errorInvalidPropertyOrder);
                process.exit(1);
            }
            return value.toUpperCase().split('');
        })
        .option('--js', 'JavaScript')
        .option('--js-sourcemap', i18n.jsSourcemap)
        .option('--js-exclude-flatbuffers', i18n.jsExcludeFlatbuffers)
        .option('--js-browser-target <target>', i18n.jsBrowserTarget, (value) => {
            return value.split(',');
        })
        .option('--js-node-target <target>', i18n.jsNodeTarget, (value) => {
            return value.split(',');
        })
        .helpOption('-h, --help', i18n.helpOption);

    program.parse();

    // 获取定义的参数
    const args = program.args;

    if (args.length > 1 && !args[1].startsWith('-')) {
        error(i18n.errorInvalidInput + `: ${args[0]} => ${args[1]} <=`);
        process.exit(1);
    }

    // 获取定义的选项
    const options = program.opts();

    if (args.length === 0 && Object.keys(options).length <= 2) {
        program.outputHelp();
        process.exit(0);
    }

    Object.keys(xlsxFbsOptions)
        .forEach(key => xlsxFbsOptions[key] = options[key] || xlsxFbsOptions[key]);

    xlsxFbsOptions.output = path.resolve(xlsxFbsOptions.output);
    if ((xlsxFbsOptions.censoredTable || xlsxFbsOptions.censoredFields.length) && !xlsxFbsOptions.censoredOutput) {
        const censoredOutput = path.basename(xlsxFbsOptions.output) + '_censored';
        const dirname = path.dirname(xlsxFbsOptions.output);
        xlsxFbsOptions.censoredOutput = path.join(dirname, censoredOutput);
    }

    if (xlsxFbsOptions.minimalInfo) {
        setLogLevel(xlsxFbsOptions.minimalInfo);
    }

    log('xlsx-fbs 参数：', JSON.stringify(xlsxFbsOptions, null, 2));

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

    // 如果 js 选项为 true，则添加 ts 选项，由 ts 生成 js 代码
    if (xlsxFbsOptions.js && !flatcArgs.includes('--ts')) {
        flatcArgs.push('--ts');
    }

    log(`flatc 参数：${flatcArgs}`);

    const input = !args[0] || args[0].startsWith('-') ? process.cwd() : args[0];

    const isDirectory = await fsUtil.isDirectory(input);
    if (isDirectory) {
        // 批量转换路径下的所有 excel 文件
        await batchConvert(input, flatcArgs);
    } else if (xlsxFbsOptions.legacyMode) {
        // 传统打表，只输出原始的 JSON 文件
        await singleConvertLegacy(input);
    }
    else {
        // 单个 excel 文件
        await singleConvert(input, flatcArgs);
    }
}

/**
 * 打单张表
 */
async function singleConvert(input, flatcArgs) {
    async function generateOutput(input, fbs, xlsxData) {
        // 在生成的文件中添加 .fbs 文件的 hash 值，并在批量打表时生成 fbs_hash_table.json 文件用于运行时校验表的数据结构是否匹配
        if (xlsxFbsOptions.generateFbsHash) {
            const hash = await generateFbsHash(fbs);
            xlsxData['fbs_hash'] = Array.from(hash);
            const fbsHashPath = getFbsHashPath(input);
            await fsUtil.writeFile(fbsHashPath, hash.toString('hex'), 'utf-8');
        } else {
            fbs = fbs.replace('  fbs_hash:[uint8];\n', '');
        }

        const fbsOutputPath = getFbsPath(input);
        await fsUtil.writeFile(fbsOutputPath, fbs);
        log(`${i18n.successGenerateFbs}: ${getFbsPath(input)}`);

        if (flatcArgs.length === 0) {
            warn(i18n.warningMissingFlatcOptions);
            return;
        }

        const flatcArgsCopy = flatcArgs.concat();
        flatcArgsCopy.push(`-o ${getGenerateScriptPath(input)}`);
        await fbsToCode(fbsOutputPath, flatcArgsCopy);
        log(`${i18n.successGenerateCode}: ${getOrganizedScriptPath()}`);

        const jsonOutputPath = getJsonPath(input);
        await fsUtil.writeFile(jsonOutputPath, JSON.stringify(xlsxData, null, 2), 'utf-8');
        log(`${i18n.successGenerateJson}: ${jsonOutputPath}`);

        const binOutputPath = getBinPath();
        await jsonToBin(fbsOutputPath, jsonOutputPath, binOutputPath);
        log(`${i18n.successGenerateBinary}: ${binOutputPath}`);
    }
    try {
        const startTime = performance.now();
        const { fbs, xlsxData, fbsCensored, xlsxDataCensored } = await xlsxToFbs(input, xlsxFbsOptions);

        await generateOutput(input, fbs, xlsxData);

        if (fbsCensored) {
            // 由于修改了全局变量 xlsxFbsOptions.output，所以需要在最后执行
            log('generate censored output ...');
            xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
            await generateOutput(input, fbsCensored, xlsxDataCensored);
        }

        const endTime = performance.now();
        info(`Finished: ${input} cost: ${endTime - startTime}ms`);
    } catch (err) {
        error(err.stack);
        process.exit(1);
    }
}

/** 这个不用看，和 xlsx-fbs 逻辑无关 */
async function singleConvertLegacy(input) {
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
        log(`${i18n.successGenerateJson}: ${jsonOutputPath}`);
    }
    const startTime = performance.now();
    const { xlsxData, xlsxDataCensored } = await xlsxToJson(input, xlsxFbsOptions);
    await generateLegacyOutput(input, xlsxData);

    if (xlsxDataCensored) {
        log('generate censored output ...');
        xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
        await generateLegacyOutput(input, xlsxDataCensored);
    }
    const endTime = performance.now();
    info(`Finished: ${input} cost: ${endTime - startTime}ms`);
}

/**
 * 批量打表
 */
async function batchConvert(input, flatcArgs) {
    const os = await import('os');
    const { spawnAsync } = await import('./utils/processUtil.mjs');
    const pLimit = (await import('p-limit')).default;

    const startTime = performance.now();

    const fullTablesConfig = await getTablesConfig(input);
    /** @type {TableConfig[]} */
    const tablesConfig = [];

    let censoredTableCount = 0;
    let censoredFieldsCount = 0;
    /** @type {TableConfig[]} */
    const mergeTableConfigs = [];
    /** @type {TableConfig[]} */
    const constFieldsTableConfigs = [];

    // 使用文件修改时间来判断是否需要打表，最快
    let tableHash = {};
    const tableHashPath = getTableHashPath();
    // hash 文件仅存放在未删减目录
    if (!xlsxFbsOptions.cleanOutput && await fsUtil.checkExist(tableHashPath)) {
        const tableHashContent = await fsAsync.readFile(tableHashPath, 'utf-8');
        tableHash = JSON.parse(tableHashContent);
    }

    for (const config of fullTablesConfig) {
        if (!xlsxFbsOptions.disableIncremental) {
            const stat = await fsAsync.stat(config.filePath);
            if (stat.mtimeMs === tableHash[config.filePath]) {
                // 跳过未改变的表
                continue;
            }
            tableHash[config.filePath] = stat.mtimeMs;
        }
        tablesConfig.push(config);
        if (config.censoredTable) censoredTableCount++;
        if (config.censoredFields.length > 0) censoredFieldsCount++;
        if (config.merge) mergeTableConfigs.push(config);
        if (config.constFields.length > 0) constFieldsTableConfigs.push(config);
    }

    // 如果有删减表或者删减字段，则创建删减打表目录
    if ((censoredFieldsCount > 0 || censoredTableCount > 0) && !xlsxFbsOptions.censoredOutput) {
        const censoredOutput = path.basename(xlsxFbsOptions.output) + '_censored';
        const dirname = path.dirname(xlsxFbsOptions.output);
        xlsxFbsOptions.censoredOutput = path.join(dirname, censoredOutput);
    }

    if (xlsxFbsOptions.cleanOutput) {
        await fsUtil.deleteFile(xlsxFbsOptions.output);
        info(`clean output: ${xlsxFbsOptions.output}`);
        if (xlsxFbsOptions.censoredOutput) {
            await fsUtil.deleteFile(xlsxFbsOptions.censoredOutput);
            info(`clean censored output: ${xlsxFbsOptions.censoredOutput}`);
        }
    }

    const commonArgs = [];
    commonArgs.push('-o', xlsxFbsOptions.output);
    commonArgs.push('-n', xlsxFbsOptions.namespace);
    if (xlsxFbsOptions.defaultKey) {
        commonArgs.push('-k', xlsxFbsOptions.defaultKey);
    }
    if (xlsxFbsOptions.binaryExtension) {
        commonArgs.push('--binary-extension', xlsxFbsOptions.binaryExtension);
    }
    if (xlsxFbsOptions.censoredOutput) {
        commonArgs.push('--censored-output', xlsxFbsOptions.censoredOutput);
    }
    if (xlsxFbsOptions.emptyString) {
        commonArgs.push('--empty-string');
    }
    if (xlsxFbsOptions.enableStreamingRead) {
        commonArgs.push('--enable-streaming-read');
    }
    if (xlsxFbsOptions.legacyMode) {
        commonArgs.push('--legacy-mode');
    }
    if (xlsxFbsOptions.propertyOrder) {
        commonArgs.push('--property-order', xlsxFbsOptions.propertyOrder.join(''));
    }
    if (xlsxFbsOptions.minimalInfo) {
        commonArgs.push('--minimal-info', xlsxFbsOptions.minimalInfo);
    }
    if (xlsxFbsOptions.dataClassSuffix) {
        commonArgs.push('--data-class-suffix', xlsxFbsOptions.dataClassSuffix);
    }
    if (xlsxFbsOptions.generateFbsHash) {
        commonArgs.push('--generate-fbs-hash');
    }

    // 限制最大并发数
    const maxThreads = Math.min(os.cpus().length, xlsxFbsOptions.multiThread);
    const limit = pLimit(maxThreads);
    // 创建打表任务
    const convertPromises = tablesConfig.map(config => {
        const args = commonArgs.concat();

        if (config.censoredFields.length > 0) {
            args.push('--censored-fields', config.censoredFields.join(','));
        }
        if (config.censoredTable) {
            args.push('--censored-table');
        }

        return limit(async () => {
            try {
                await spawnAsync('xlsx-fbs', [config.filePath, ...args, ...flatcArgs], { shell: true });
                return { isSuccess: true, tableName: config.tableName };
            } catch (err) {
                return { isSuccess: false, tableName: config.tableName, error: err };
            }
        });
    });
    // 等待所有打表完成
    const results = await Promise.all(convertPromises);
    const failedTables = results.filter(result => !result.isSuccess).map(result => result.tableName);

    const endTime = performance.now();
    info(`Batch finished, Convert ${tablesConfig.length} tables, success: ${tablesConfig.length - failedTables.length}, failed: ${failedTables.length}, cost: ${endTime - startTime}ms`);
    if (failedTables.length > 0) {
        error(`Failed tables: ${failedTables.join(', ')}`);
        error(i18n.errorNeedAllSuccessToPostProcess);
        return;
    }

    // 如果 flatc 选项为空，则不生成任何代码
    if (flatcArgs.length === 0) {
        console.warn(`${i18n.warningMissingFlatcOptions}`);
        return;
    }

    // 生成合并表
    if (mergeTableConfigs.length > 0 && !xlsxFbsOptions.disableMergeTable) {
        await generateMergeFbsBin(mergeTableConfigs, xlsxFbsOptions, flatcArgs.concat());
        if (xlsxFbsOptions.censoredOutput) {
            console.log('generate censored merge table ...');
            const originalOutput = xlsxFbsOptions.output;
            xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
            const censoredMergeConfigs = mergeTableConfigs.filter(config => !config.censoredTable);
            await generateMergeFbsBin(censoredMergeConfigs, xlsxFbsOptions, flatcArgs.concat());
            xlsxFbsOptions.output = originalOutput;
        }
        info(`${i18n.successGenerateMergeTable}`);
    }

    // 生成 fbsHashTable.json
    if (xlsxFbsOptions.generateFbsHash) {
        async function generateFbsHashTable() {
            const fbsHashTablePath = getFbsHashTablePath();
            const fbsHashFiles = await fsUtil.findFiles(getFbsHashPath(), /\.hash$/);
            const fbsHashTable = {};
            for (const fbsHashFile of fbsHashFiles) {
                const tableName = path.basename(fbsHashFile, '.hash');
                const fbsHashContent = await fsAsync.readFile(fbsHashFile, 'utf-8');
                fbsHashTable[tableName] = fbsHashContent;
            }
            await fsUtil.writeFile(fbsHashTablePath, JSON.stringify(fbsHashTable, null, 2), 'utf-8');
            info(`${i18n.successGenerateFbsHashTable}: ${fbsHashTablePath}`);
        }
        await generateFbsHashTable();
        if (xlsxFbsOptions.censoredOutput) {
            console.log('generate censored fbs_hash_table.json ...');
            const originalOutput = xlsxFbsOptions.output;
            xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
            await generateFbsHashTable();
            xlsxFbsOptions.output = originalOutput;
        }
    }

    // 生成 C# 常量代码
    if (flatcArgs.includes('--csharp') && constFieldsTableConfigs.length > 0) {
        async function generateCSharp() {
            const namespace = xlsxFbsOptions.namespace;
            const csharpOutputPath = getCSharpPath();
            const jsonOutputPath = getJsonPath();
            const csharpConstPaths = await generateCSharpConst(csharpOutputPath, jsonOutputPath, namespace, constFieldsTableConfigs);
            info(`${i18n.successGenerateConst}: ${csharpConstPaths.join('\n')}`);
        }
        await generateCSharp();
        if (xlsxFbsOptions.censoredOutput) {
            console.log('generate censored csharp ...');
            const originalOutput = xlsxFbsOptions.output;
            xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
            await generateCSharp();
            xlsxFbsOptions.output = originalOutput;
        }
    }
    
    // 生成 ts 代码的入口文件 main.ts
    if (flatcArgs.includes('--ts')) {
        async function generateTsJs() {
            const namespace = xlsxFbsOptions.namespace;
            const tsOutputPath = getTsPath();
            const jsonOutputPath = getJsonPath();

            if (constFieldsTableConfigs.length > 0) {
                const tsConstPaths = await generateTsConst(tsOutputPath, jsonOutputPath, namespace, constFieldsTableConfigs);
                info(`${i18n.successGenerateConst}: ${tsConstPaths.join('\n')}`);
            }

            const tsMainPath = await generateTsMain(tsOutputPath, namespace);
            info(`${i18n.successGenerateTsMain}: ${tsMainPath}`);

            // 生成 js 代码
            if (xlsxFbsOptions.js) {
                const jsOutputPath = getJsPath();
                await generateJSBundle(tsOutputPath, jsOutputPath, xlsxFbsOptions);
                info(`${i18n.successGenerateJsBundle}: ${jsOutputPath}`);
            }
        }
        await generateTsJs();
        if (xlsxFbsOptions.censoredOutput) {
            console.log('generate censored ts/js ...');
            xlsxFbsOptions.output = xlsxFbsOptions.censoredOutput;
            await generateTsJs();
        }
    }

    // 所有后处理完成后，记录文件的修改日期，作为增量打表标志
    await fsUtil.writeFile(tableHashPath, JSON.stringify(tableHash, null, 2), 'utf-8');
}

/**
 * @typedef {Object} ConstField
 * @property {string} key 常量名
 * @property {string} value 常量值
 * @property {string} desc 常量描述
 */

/**
 * @typedef {Object} TableConfig
 * @property {string} tableName 表名
 * @property {string} filePath 表路径
 * @property {boolean} merge 是否将多张表合并到一个二进制文件
 * @property {boolean} censoredTable 是否在 output_censored 目录中剔除该表
 * @property {string[]} censoredFields 需要删除的敏感字段(会单独生成一份阉割版的到另一个文件夹)
 * @property {ConstField[]} constFields 需要生产常量定义的字段
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

    // 遍历根目录中的文件，找到 $tables.xlsx，这里加了兼容匹配，可以让 $items.xls 类似的命名也能匹配
    const files = await fsAsync.readdir(rootDir, { withFileTypes: false, recursive: false });
    const matched = files.filter(name =>
        /^\$.*\.(xls|xlsx|xlsm)$/i.test(name)
    );
    if (matched.length === 0) {
        // 找不到文件则默认打根目录中的所有表
        warn(i18n.warningTablesConfigNotFound);
    } else {
        const tablesXlsxPath = path.join(rootDir, matched[0]);
        const { xlsxData: tablesXlsxJson } = await xlsxToJson(tablesXlsxPath, xlsxFbsOptions);
        tablesXlsxJson.forEach(row => {
            if (tablesConfigMap.has(row.tableName)) {
                warn(`${i18n.warningDuplicateTable} => ${row.tableName}`);
                return;
            }
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
        log(`${i18n.successReadTablesConfig}: ${matched[0]}`);
    }

    /** 递归搜索目录下的所有 excel 文件（不包含 ~$ 和 $ 开头的文件） */
    const tables = await fsUtil.findFiles(rootDir, /^(?!~\$|\$).*\.(xls|xlsx|xlsm)$/i);
    // const tables = await fsUtil.findFiles(rootDir, /.*\.xlsx?$/);

    for (const table of tables) {
        const tableName = path.basename(table, path.extname(table));
        if (tableName.endsWith(xlsxFbsOptions.dataClassSuffix)) {
            error(`${i18n.errorTableNameDataClassSuffixConflict}: ${tableName}`);
            process.exit(1);
        }
        if (tablesConfigMap.has(tableName)) {
            const tableConfig = tablesConfigMap.get(tableName);
            tableConfig.filePath = table;
            tablesConfig.push(tableConfig);
        } else if (tablesConfigMap.size === 0 || xlsxFbsOptions.allowWildTable) {
            if (tablesConfigMap.size !== 0) {
                warn(`${i18n.warningWildTable}: ${tableName}`);
            }
            tablesConfig.push({
                tableName,
                filePath: table,
                merge: false,
                censoredTable: false,
                censoredFields: [],
                constFields: [],
            });
        }
    }

    return tablesConfig;
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

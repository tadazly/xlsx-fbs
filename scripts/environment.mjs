import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/** 脚本所在路径 */
const scriptPath = fileURLToPath(import.meta.url)
/** 工作区路径 */
export const projectPath = path.dirname(path.dirname(scriptPath))

function getLocale() {
    const langEnv = Intl.DateTimeFormat().resolvedOptions().locale;
    if (langEnv.startsWith('zh')) {
        return 'zh';
    }
    return 'en';
}

function loadLocaleStrings(locale) {
    const filePath = path.join(projectPath, 'locales', `${locale}.json`);
    try {
        const file = fs.readFileSync(filePath, 'utf-8');
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

/** 国际化 */
export const i18n = loadLocaleStrings(getLocale());

/** 
 * xlsx-fbs 输入选项，不传给 flatc
 */
export const xlsxFbsOptions = {
    output: path.join(process.cwd(), 'output'),
    censoredOutput: null,
    namespace: 'Xlsx',
    defaultKey: null,
    binaryExtension: null,
    censoredFields: [],
    censoredTable: false,
    cleanOutput: false,
    emptyString: false,
    disableMergeTable: false,
    enableStreamingRead: false,
    legacyMode: false,
    dataClassSuffix: 'Info',
    generateFbsHash: false,
    allowWildTable: false,
    propertyOrder: [ 'A', 'B', 'C', 'D', 'E' ],
    multiThread: 6,
    minimalInfo: 'info',
    js: false,
    jsSourceMap: false,
    jsExcludeFlatbuffers: false,
    jsBrowserTarget: [ 'es2017' ],
    jsNodeTarget: [ 'node20' ],
}

/** 获取表名 */
export const getTableName = (filePath) => {
    return path.basename(filePath, path.extname(filePath));
}
/** .fbs 输出路径 */
export const getFbsPath = (filePath) => {
    if (filePath) {
        return path.join(xlsxFbsOptions.output, 'fbs', `${getTableName(filePath)}.fbs`);
    }
    return path.join(xlsxFbsOptions.output, 'fbs');
}
/** .bin 输出路径 */
export const getBinPath = (filePath) => {
    if (filePath) {
        return path.join(xlsxFbsOptions.output, 'bin', `${getTableName(filePath)}.bin`);
    }
    return path.join(xlsxFbsOptions.output, 'bin');
}
/** .json 输出路径 */
export const getJsonPath = (filePath) => {
    if (filePath) {
        return path.join(xlsxFbsOptions.output, 'json', `${getTableName(filePath)}.json`);
    }
    return path.join(xlsxFbsOptions.output, 'json');
}
/** flatc 生成的脚本路径 */
export const getGenerateScriptPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, `generate-scripts-${getTableName(filePath)}`);
}
/** 根据语言组织后的脚本路径 */
export const getOrganizedScriptPath = () => {
    return path.join(xlsxFbsOptions.output, 'scripts');
}
/** ts 代码输出路径 */
export const getTsPath = () => {
    return path.join(getOrganizedScriptPath(), 'ts');
}
/** js 代码输出路径 */
export const getJsPath = () => {
    return path.join(getOrganizedScriptPath(), 'js');
}
/** csharp 代码输出路径 */
export const getCSharpPath = () => {
    return path.join(getOrganizedScriptPath(), 'csharp');
}
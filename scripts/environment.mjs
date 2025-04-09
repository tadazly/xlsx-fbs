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

/** xlsx-fbs 输入选项 */
export const xlsxFbsOptions = {
    output: path.join(process.cwd(), 'output'),
    censoredOutput: null,
    namespace: 'Xlsx',
    defaultKey: null,
    binaryExtension: null,
    censoredFields: [],
    censoredTable: false,
    emptyString: false,
    enableStreamingRead: false,
    generateJson: false,
    legacyMode: false,
    deleteFbs: false,
    generateFbsHash: false,
    allowWildTable: false,
    propertyOrder: [ 'A', 'B', 'C', 'D', 'E' ],
    multiThread: 4,
    minimalInfo: 'log',
}

/** 获取表名 */
export const getTableName = (filePath) => {
    return path.basename(filePath, path.extname(filePath));
}
/** .fbs 输出路径 */
export const getFbsPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, 'fbs', `${getTableName(filePath)}.fbs`);
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
    return path.join(xlsxFbsOptions.output, 'json', `${getTableName(filePath)}.json`);
}
/** flatc 生成的脚本路径 */
export const getGenerateScriptPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, `generate-scripts-${getTableName(filePath)}`);
}
/** 根据语言组织后的脚本路径 */
export const getOrganizedScriptPath = () => {
    return path.join(xlsxFbsOptions.output, 'scripts');
}
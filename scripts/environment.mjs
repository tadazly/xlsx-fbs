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

export const i18n = loadLocaleStrings(getLocale());

export const xlsxFbsOptions = {
    output: path.join(process.cwd(), 'output'),
    namespace: 'Xlsx',
    defaultKey: null,
    binaryExtension: null,
    emptyString: false,
    generateJson: false,
    deleteFbs: false,
    generateFbsHash: false,
    propertyOrder: [ 'A', 'B', 'C', 'D', 'E' ],
}

export const getTableName = (filePath) => {
    return path.basename(filePath, path.extname(filePath));
}
export const getFbsPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, 'fbs', `${getTableName(filePath)}.fbs`);
}
export const getBinPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, 'bin', `${getTableName(filePath)}.bin`);
}
export const getJsonPath = (filePath) => {
    return path.join(xlsxFbsOptions.output, 'json', `${getTableName(filePath)}.json`);
}
export const getGenerateScriptPath = () => {
    return path.join(xlsxFbsOptions.output, 'generate-scripts');
}
export const getOrganizedScriptPath = () => {
    return path.join(xlsxFbsOptions.output, 'scripts');
}
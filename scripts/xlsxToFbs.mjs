import xlsx from 'xlsx';
import { checkExist } from './utils/fsUtil.mjs';
import { projectPath } from './environment.mjs'
import { xlsxFbsOptions } from './xlsx-fbs.mjs';
import fsAsync from 'fs/promises';
import { toLowerCamelCase, toUpperCamelCase, toSnakeCase } from './utils/stringUtil.mjs';
import path from 'path';

const templatePath = path.join(projectPath, 'template');

/**
 * 通过 xlsx 文件生成 fbs 文件
 * @param {string} filePath 
 */
export async function xlsxToFbs(filePath) {
    console.log(`xlsxToFbs: ${filePath}`);
    if (!await checkExist(filePath)) {
        throw new Error(`${i18n.errorTableNotFound}: ${filePath}`);
    }
    const workbook = xlsx.readFile(filePath);

    const dataSheetName = workbook.SheetNames[0];
    const propertySheetName = workbook.SheetNames[1];

    const dataSheet = workbook.Sheets[dataSheetName];
    const propertySheet = workbook.Sheets[propertySheetName];

    if (!dataSheet || !propertySheet) {
        throw new Error(i18n.errorTableInvalid);
    }

    // var dataJson = xlsx.utils.sheet_to_json(dataSheet, {header: 1});
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, {header: 'A'});
    const properties = propertyJson.map(property => ({
        comment: property[xlsxFbsOptions.propertyOrder[0]],
        field: property[xlsxFbsOptions.propertyOrder[1]],
        type: property[xlsxFbsOptions.propertyOrder[2]],
        defaultValue: property[xlsxFbsOptions.propertyOrder[3]],
        attribute: property[xlsxFbsOptions.propertyOrder[4]],
    }))

    // console.log(dataJson);
    console.log(properties);

    const fbsTemplate = await fsAsync.readFile(path.join(templatePath, 'fbsTemplate.fbs'), 'utf-8');
    const fbsFieldTemplate = await fsAsync.readFile(path.join(templatePath, 'fbsFieldTemplate.fbs'), 'utf-8');

    function formatFbsField(property) {
        let { comment, field, type, defaultValue, attribute } = property;

        field = toSnakeCase(field);

        if (type === 'number') {
            // TODO: 此处需要根据表中的数据动态判断类型
            type = 'int';
        }

        if (type === 'string' || type.includes('[')) {
            // 非标量不能设置默认值
            defaultValue = '';
        } else {
            defaultValue = defaultValue ? ` = ${+defaultValue}` : '';
        }

        attribute = attribute ? ` ${attribute}` : '';

        return fbsFieldTemplate
            .replaceAll('{{{ COMMENT }}}', comment)
            .replaceAll('{{{ FIELD }}}', field)
            .replaceAll('{{{ TYPE }}}', type)
            .replaceAll('{{{ DEFAULT_VALUE }}}', defaultValue)
            .replaceAll('{{{ ATTRIBUTE }}}', attribute);
    }
    
    const fileName = path.basename(filePath);
    const tableName = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));
    const fields = properties.map(formatFbsField).join('\n');

    const fbs = fbsTemplate
        .replaceAll('{{{ FILE_NAME }}}', fileName)
        .replaceAll('{{{ NAMESPACE }}}', xlsxFbsOptions.namespace)
        .replaceAll('{{{ TABLE_NAME }}}', tableName)
        .replaceAll('{{{ TABLE_NAME.toLowerCamelCase() }}}', toLowerCamelCase(tableName))
        .replaceAll('{{{ FIELDS }}}', fields);

    console.log(fbs);
    return fbs;
}


/**
 * 在生成的文件中添加 .fbs 文件的 hash 值，并生成 TableHashConfig 类文件用于运行时校验表的数据结构是否匹配（仅支持 C# 和 TypeScript, 其他语言请自行扩展）
 * @param {*} filePath 
 */
export function generateFbsHash(filePath) {

}


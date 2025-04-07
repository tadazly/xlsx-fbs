import xlsx from 'xlsx';
import { checkExist } from './utils/fsUtil.mjs';
import { projectPath } from './environment.mjs'
import { xlsxFbsOptions } from './xlsx-fbs.mjs';
import fsAsync from 'fs/promises';
import { toLowerCamelCase, toUpperCamelCase, toSnakeCase } from './utils/stringUtil.mjs';
import path from 'path';
import { fbsFieldTemplate, fbsTemplate } from './template.mjs';

/**
 * @typedef {Object} FbsFieldProperty
 * @property {string} comment 字段注释（数据页的字段名）
 * @property {string} field 字段名
 * @property {string} type 字段类型
 * @property {string} defaultValue 默认值
 * @property {string} attribute 属性
 * @property {number[]|string[]} values 数据页的值
 */

/**
 * @typedef {Object} FbsProperty
 * @property {string} fileName 文件名
 * @property {string} namespace 命名空间
 * @property {string} tableName 表名
 * @property {FbsFieldProperty[]} fields 字段
 */

/**
 * 标量类型
 * @type {string[]}
 */
const scalarTypes = [
    'bool', 'byte', 'ubyte', 'int8', 'uint8',
    'short', 'ushort', 'int16', 'uint16',
    'int', 'uint', 'int32', 'uint32', 'float', 'float32',
    'long', 'ulong', 'int64', 'uint64', 'double', 'float64',
];

/**
 * 大范围标量类型
 * @type {string[]}
 */
const largeScalarTypes = [
    'long', 'ulong', 'int64', 'uint64', 'double', 'float64',
];

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

    const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 2 });
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, { header: 'A' });
    const properties = propertyJson.map(property => {
        const [comment, field, type, defaultValue, attribute] = xlsxFbsOptions.propertyOrder.map(order => property[order]);
        return {
            comment,
            field,
            type,
            defaultValue,
            attribute,
            values: dataJson.map(data => data[comment]).filter(value => value !== undefined),
        };
    });

    // console.log(dataJson);
    console.log(properties);

    const fileName = path.basename(filePath);
    const tableName = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));
    const namespace = xlsxFbsOptions.namespace;
    const fields = properties.map(formatFbsField).join('\n');

    const fbs = formatFbs({ fileName, namespace, tableName, fields });

    return fbs;
}

/**
 * 格式化 fbs 字段
 * @param {FbsFieldProperty} property 
 * @returns 
 */
function formatFbsField(property) {
    let { comment, field, type, defaultValue, attribute, values } = property;

    field = toSnakeCase(field);

    if (type === 'number') {
        // 根据表中的数据自动推导类型
        const uniqueValues = [...new Set(values)];
        const allIntegers = uniqueValues.every(Number.isInteger);

        if (allIntegers) {
            const maxValue = Math.max(...uniqueValues);
            const minValue = Math.min(...uniqueValues);
            type = inferNumberTypeRange(minValue, maxValue);
        } else {
            type = 'float'; // 'double' 类型请在表里配，我可不想背锅
        }
    }

    if (largeScalarTypes.includes(type)) { // 配表用这么大数据，确定 ok 吗？
        console.warn(`${i18n.warningNumberTypeRange} field: ${comment} => type: ${type}`);
    }

    if (defaultValue) {
        if (!scalarTypes.includes(type)) {
            // 非标量不能设置默认值
            defaultValue = '';
        } else {
            const parsedValue = +defaultValue;
            if (isNaN(parsedValue)) {
                throw new Error(`${i18n.errorInvalidDefaultValue} field: ${comment} => defaultValue: ${defaultValue}`);
            }
            defaultValue = ` = ${parsedValue}`;
        }
    } else {
        defaultValue = '';
    }

    attribute = attribute ? ` (${attribute})` : '';

    return fbsFieldTemplate
        .replaceAll('{{{ COMMENT }}}', comment)
        .replaceAll('{{{ FIELD }}}', field)
        .replaceAll('{{{ TYPE }}}', type)
        .replaceAll('{{{ DEFAULT_VALUE }}}', defaultValue)
        .replaceAll('{{{ ATTRIBUTE }}}', attribute);
}

/**
 * 格式化 fbs 文件
 * @param {FbsProperty} property 
 * @returns 
 */
function formatFbs(property) {
    const { fileName, namespace, tableName, fields } = property;

    return fbsTemplate
        .replaceAll('{{{ FILE_NAME }}}', fileName)
        .replaceAll('{{{ NAMESPACE }}}', namespace)
        .replaceAll('{{{ TABLE_NAME }}}', tableName)
        .replaceAll('{{{ TABLE_NAME.toLowerCamelCase() }}}', toLowerCamelCase(tableName))
        .replaceAll('{{{ FIELDS }}}', fields);
}

function inferNumberTypeRange(min, max) {
    if (min >= 0 && max <= 255) return 'ubyte';
    if (min >= -128 && max <= 127) return 'byte';
    if (min >= 0 && max <= 65535) return 'ushort';
    if (min >= -32768 && max <= 32767) return 'short';
    if (min >= 0 && max <= 4294967295) return 'uint';
    if (min >= -2147483648 && max <= 2147483647) return 'int';
    if (min >= 0 && max <= 18446744073709551615n) return 'ulong';
    return 'long';
}

/**
 * 在生成的文件中添加 .fbs 文件的 hash 值，并生成 TableHashConfig 类文件用于运行时校验表的数据结构是否匹配（仅支持 C# 和 TypeScript, 其他语言请自行扩展）
 * @param {*} filePath 
 */
export function generateFbsHash(filePath) {

}


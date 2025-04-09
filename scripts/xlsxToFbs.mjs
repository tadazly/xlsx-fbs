import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fsAsync from 'fs/promises';
import { i18n } from './environment.mjs';
import { checkExist } from './utils/fsUtil.mjs';
import { xlsxFbsOptions } from './environment.mjs';
import { toLowerCamelCase, toUpperCamelCase, toSnakeCase } from './utils/stringUtil.mjs';
import path from 'path';
import { fbsFieldTemplate, fbsTemplate, fillTemplate } from './template.mjs';
import { info, warn } from './utils/logUtil.mjs';

/**
 * @typedef {Object} XlsxToFbsOptions
 * @property {string[]} [propertyOrder] 属性顺序
 * @property {string[]} [censoredFields] 删减字段
 * @property {boolean} [censoredTable] 是否删减表
 * @property {string} [censoredOutput] 删减输出目录
 * @property {string} [namespace] 命名空间
 * @property {string} [defaultKey] 默认主键
 * @property {boolean} [enableStreamingRead] 是否开启流式读取，仅支持 xlsx 格式
 */

/**
 * @typedef {Object} XlsxToFbsResult
 * @property {string} fbs 生成的 fbs 文件内容
 * @property {Record<string, any>} xlsxData 生成的表格数据对象
 * @property {string} [fbsCensored] 生成的删减字段的 fbs 文件内容
 * @property {Record<string, any>} [xlsxDataCensored] 生成的删减字段的表格数据对象
 */

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
 * FlatBuffers 内置类型
 * @type {string[]}
 */
const builtinTypes = [ 'string', ...scalarTypes ];

const scalarTypeSize = {
    // 1 byte
    bool: 1, byte: 1, ubyte: 1, int8: 1, uint8: 1,

    // 2 bytes
    short: 2, ushort: 2, int16: 2, uint16: 2,

    // 4 bytes
    int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4,

    // 8 bytes
    long: 8, ulong: 8, int64: 8, uint64: 8, double: 8, float64: 8,
};

/**
 * 大范围标量类型
 * @type {string[]}
 */
const largeScalarTypes = [
    'long', 'ulong', 'int64', 'uint64', 'double', 'float64'
];


/**
 * 推导数字类型范围
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {string} 推导出的类型
 */
function inferNumberTypeRange(min, max) {
    if (min >= 0 && max <= 255) return 'uint8';
    if (min >= -128 && max <= 127) return 'int8';
    if (min >= 0 && max <= 65535) return 'uint16';
    if (min >= -32768 && max <= 32767) return 'int16';
    if (min >= 0 && max <= 4294967295) return 'uint32';
    if (min >= -2147483648 && max <= 2147483647) return 'int32';
    if (min >= 0 && max <= 18446744073709551615n) return 'uint64';
    return 'int64';
}

/**
 * 通过 xlsx 文件生成 fbs 文本和对应的表格数据对象
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToFbsOptions} options 选项
 * @returns {Promise<XlsxToFbsResult>}
 */
export async function xlsxToFbs(filePath, options = {}) {
    info(`xlsxToFbs: ${filePath}`);
    if (!await checkExist(filePath)) {
        throw new Error(`${i18n.errorTableNotFound}: ${filePath}`);
    }

    // 如果未指定选项，则使用默认选项
    if (!options.propertyOrder) {
        options.propertyOrder = xlsxFbsOptions.propertyOrder;
    }
    if (!options.censoredFields) {
        options.censoredFields = xlsxFbsOptions.censoredFields;
    }
    if (!options.namespace) {
        options.namespace = xlsxFbsOptions.namespace;
    }

    const extname = path.extname(filePath);
    if (extname !== '.xls' && extname !== '.xlsx') {
        throw new Error(`${i18n.errorTableNotSupport}: ${filePath}`);
    } else if (extname === '.xls' || !options.enableStreamingRead) {
        // 使用 xlsx 加载完整 .xls 文件，未开启流式加载时也使用 xlsx 加载完整的 .xlsx 文件
        return internalXlsToFbs(filePath, options);
    } else if (extname === '.xlsx') {
        // 使用 ExcelJS 流式加载 .xlsx 文件
        return internalXlsxToFbs(filePath, options);
    }
}

/**
 * 使用 xlsx 加载完整 xls 文件
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToFbsOptions} options 选项
 * @returns {Promise<XlsxToFbsResult>}
 */
async function internalXlsToFbs(filePath, options = {}) {
    const xlsxFileData = await fsAsync.readFile(filePath);
    const workbook = xlsx.read(xlsxFileData, { type: 'buffer' });

    const dataSheetName = workbook.SheetNames[0];
    const propertySheetName = workbook.SheetNames[1];

    const dataSheet = workbook.Sheets[dataSheetName];
    const propertySheet = workbook.Sheets[propertySheetName];

    if (!dataSheet || !propertySheet) {
        throw new Error(i18n.errorTableInvalid);
    }

    const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 2, raw: true });
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, { header: 'A' });
    /** @type {FbsFieldProperty[]} */
    const properties = [];
    propertyJson.forEach(property => {
        let [comment, field, type, defaultValue, attribute] = options.propertyOrder.map(order => property[order]);
        if (!comment || !field || !type) {
            return;
        }
        if (options.defaultKey === field) {
            if (attribute) {
                // 以逗号拆分后 trim，每项保留参数
                const parsed = attribute
                    .split(',')
                    .map(attr => attr.trim())
                    .filter(Boolean); // 避免空字符串

                attrs.push(...parsed);
                if (!attrs.includes('key')) {
                    attrs.unshift('key');
                }
                attribute = attrs.join(',');
            } else {
                attribute = 'key';
            }
        }
        if (builtinTypes.includes(type.toLowerCase())) {
            type = type.toLowerCase();
        }
        let values;
        if (type.toLowerCase() === 'number') {
            // 只有 number 类型需要根据表中的数据自动推导类型
            values = dataJson.map(data => data[comment]).filter(value => value !== undefined);
        }
        properties.push({
            comment,
            field,
            type,
            defaultValue,
            attribute,
            values,
        });
    });

    // console.log(dataJson);
    // console.log(properties);

    const fileName = path.basename(filePath);
    const tableName = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));
    const namespace = options.namespace;
    const fields = properties.map(formatFbsField).join('\n');

    const fbs = formatFbs({ fileName, namespace, tableName, fields });

    const tableInfosFiled = `${toLowerCamelCase(tableName)}_infos`;
    // 生成一份用于转换 bin 的 json 文件。
    const xlsxData = {};
    xlsxData[tableInfosFiled] = dataJson.map(row =>
        Object.fromEntries(
            properties
                .filter(({ comment }) => {
                    const value = row[comment];
                    return value !== undefined && !(typeof value === 'string' && value.trim() === '');
                })
                .map(({ comment, field, type }) => {
                    let value = row[comment];
                    if (type === 'string' && typeof value === 'number') {
                        value = value.toString();
                    } else if ((scalarTypes.includes(type) || type === 'number') && typeof value === 'string') {
                        value = +value;
                        if (isNaN(value)) {
                            value = 0;
                            warn(`${i18n.errorInvalidNumberValue} field: ${comment}[${field}]:[${type}] => value: ${row[comment]}`);
                        }
                    }
                    return [toSnakeCase(field), value];
                })
        )
    );

    if (options.censoredFields.length && !options.censoredTable) {
        const propertiesCensored = properties.filter(({ field }) => !options.censoredFields.includes(field));
        const fieldsCensored = propertiesCensored.map(formatFbsField).join('\n');
        const fbsCensored = formatFbs({ fileName, namespace, tableName, fields: fieldsCensored });

        const xlsxDataCensored = {};
        xlsxDataCensored[tableInfosFiled] = xlsxData[tableInfosFiled].map(row => {
            const censoredRow = { ...row };
            options.censoredFields.map(field => toSnakeCase(field)).forEach(field => {
                delete censoredRow[field];
            });
            return censoredRow;
        });

        return {
            fbs, xlsxData,
            fbsCensored, xlsxDataCensored,
        }
    }

    if (options.censoredOutput && !options.censoredTable) {
        return {
            fbs, xlsxData,
            fbsCensored: fbs, xlsxDataCensored: xlsxData,
        };
    }

    return {
        fbs,
        xlsxData,
    };
}

/**
 * 使用 exceljs 流式加载 xlsx 文件
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToFbsOptions} options 选项
 * @returns {Promise<XlsxToFbsResult>}
 */
async function internalXlsxToFbs(filePath, options = {}) {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
    const sheetData = {};
    const sheetNames = [];

    for await (const worksheetReader of workbookReader) {
        const sheetName = worksheetReader.name;
        sheetNames.push(sheetName);
        const rows = [];

        for await (const row of worksheetReader) {
            rows.push(row.values.slice(1)); // 注意：row.values[0] 是 undefined
        }

        sheetData[sheetName] = rows;

        if (sheetNames.length === 2) {
            break; // 只读取前两页
        }
    }

    // 有可能出现 sheetNames 的顺序是乱的情况，则需要排序
    // sheetNames.sort();
    // console.log(sheetNames);

    const dataRows = sheetData[sheetNames[0]]; // 数据页
    const propertyRows = sheetData[sheetNames[1]]; // 属性页

    if (!dataRows || !propertyRows) {
        throw new Error(i18n.errorTableInvalid);
    }

    const header = dataRows[0];
    const dataJson = dataRows.slice(1).map(row => {
        const obj = {};
        row.forEach((val, i) => {
            obj[header[i]] = val;
        });
        return obj;
    });

    const propertyJson = propertyRows.map(row => {
        const obj = {};
        row.forEach((val, i) => {
            obj[String.fromCharCode(65 + i)] = val;
        });
        return obj;
    });

    /** @type {FbsFieldProperty[]} */
    const properties = [];
    propertyJson.forEach(property => {
        let [comment, field, type, defaultValue, attribute] = options.propertyOrder.map(order => property[order]);
        if (!comment || !field || !type) {
            return;
        }
        if (options.defaultKey === field) {
            const attrs = [];
            if (attribute) {
                const parsed = attribute
                    .split(',')
                    .map(attr => attr.trim())
                    .filter(Boolean);
                attrs.push(...parsed);
                if (!attrs.includes('key')) {
                    attrs.unshift('key');
                }
                attribute = attrs.join(',');
            } else {
                attribute = 'key';
            }
        }
        if (builtinTypes.includes(type.toLowerCase())) {
            type = type.toLowerCase();
        }
        let values;
        if (type.toLowerCase() === 'number') {
            // 只有 number 类型需要根据表中的数据自动推导类型
            values = dataJson.map(data => data[comment]).filter(value => value !== undefined);
        }
        properties.push({
            comment,
            field,
            type,
            defaultValue,
            attribute,
            values,
        });
    });

    const fileName = path.basename(filePath);
    const tableName = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));
    const namespace = options.namespace;
    const fields = properties.map(formatFbsField).join('\n');
    const fbs = formatFbs({ fileName, namespace, tableName, fields });
    const tableInfosFiled = `${toLowerCamelCase(tableName)}_infos`;

    const xlsxData = {};
    xlsxData[tableInfosFiled] = dataJson.map(row =>
        Object.fromEntries(
            properties
                .filter(({ comment }) => {
                    const value = row[comment];
                    return value !== undefined && !(typeof value === 'string' && value.trim() === '');
                })
                .map(({ comment, field, type }) => {
                    let value = row[comment];
                    if (typeof value === 'object') {
                        value = extractCellText(value);
                    }
                    if (type === 'string' && typeof value === 'number') {
                        value = value.toString();
                    } else if ((scalarTypes.includes(type) || type === 'number') && typeof value === 'string') {
                        value = +value;
                        if (isNaN(value)) {
                            value = 0;
                            warn(`${i18n.errorInvalidNumberValue} field: ${comment}[${field}]:[${type}] => value: ${row[comment]}`);
                        }
                    }
                    return [toSnakeCase(field), value];
                })
        )
    );

    if (options.censoredFields.length && !options.censoredTable) {
        const propertiesCensored = properties.filter(({ field }) => !options.censoredFields.includes(field));
        const fieldsCensored = propertiesCensored.map(formatFbsField).join('\n');
        const fbsCensored = formatFbs({ fileName, namespace, tableName, fields: fieldsCensored });

        const xlsxDataCensored = {};
        xlsxDataCensored[tableInfosFiled] = xlsxData[tableInfosFiled].map(row => {
            const censoredRow = { ...row };
            options.censoredFields.map(field => toSnakeCase(field)).forEach(field => {
                delete censoredRow[field];
            });
            return censoredRow;
        });

        return {
            fbs, xlsxData,
            fbsCensored, xlsxDataCensored,
        }
    }

    if (options.censoredOutput && !options.censoredTable) {
        return {
            fbs, xlsxData,
            fbsCensored: fbs, xlsxDataCensored: xlsxData,
        };
    }

    return {
        fbs,
        xlsxData,
    };
}

function extractCellText(cell) {
    if (cell && typeof cell === 'object' && Array.isArray(cell.richText)) {
        return cell.richText.map(part => part.text).join('');
    }
    return cell?.toString?.() ?? '';
}

/**
 * 格式化 fbs 字段
 * @param {FbsFieldProperty} property 
 * @returns 
 */
function formatFbsField(property) {
    let { comment, field, type, defaultValue, attribute, values } = property;

    // 将字段名转换为蛇形命名
    field = toSnakeCase(field);

    if (type === 'number') {
        // 根据表中的数据自动推导类型
        // 过滤掉无法转换为数字的值
        values = values.map(value => +value)
            .filter(value => !isNaN(value));
        const uniqueValues = [...new Set(values)];
        const allIntegers = uniqueValues.every(Number.isInteger);

        if (allIntegers) {
            const maxValue = Math.max(...uniqueValues);
            const minValue = Math.min(...uniqueValues);
            type = inferNumberTypeRange(minValue, maxValue * 2); // 最大值乘以2，避免未来配表溢出
            // console.log(`${comment} => type: ${type} min: ${minValue} max: ${maxValue}`);
        } else {
            type = 'float32'; // 'double' 类型请在表里配，我可不想背锅
        }

        // 如果是自动推导的 id 字段，且类型小于 uint，则强制预留为 uint
        if (field === 'id' && scalarTypeSize[type] < scalarTypeSize['uint32']) {
            type = 'uint32';
        }
        property.type = type; // 更新类型，用于构造 json 时的判断
    }

    if (largeScalarTypes.includes(type)) { // 配表用这么大数据，确定 ok 吗？
        warn(`${i18n.warningNumberTypeRange} field: ${comment} => type: ${type}`);
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

    attribute = formatAttribute(attribute);

    return fillTemplate(fbsFieldTemplate, {
        COMMENT: comment,
        FIELD: field,
        TYPE: type,
        DEFAULT_VALUE: defaultValue,
        ATTRIBUTE: attribute,
    });
}

/**
 * 格式化 fbs 文件
 * @param {FbsProperty} property 
 * @returns 
 */
function formatFbs(property) {
    const { fileName, namespace, tableName, fields } = property;

    return fillTemplate(fbsTemplate, {
        FILE_NAME: fileName,
        NAMESPACE: namespace,
        TABLE_NAME: tableName,
        TABLE_NAME_LOWER_CAMEL_CASE: toLowerCamelCase(tableName),
        FIELDS: fields,
    });
}

/**
 * 格式化字段的属性
 * @param {string} attributeStr 属性字符串
 * @returns 
 */
function formatAttribute(attributeStr) {
    const attrs = [];

    if (attributeStr) {
        // 以逗号拆分后 trim，每项保留参数
        const parsed = attributeStr
            .split(',')
            .map(attr => attr.trim())
            .filter(Boolean); // 避免空字符串

        attrs.push(...parsed);
    }

    return attrs.length ? ` (${attrs.join(', ')})` : '';
}

/**
 * 在生成的文件中添加 .fbs 文件的 hash 值，并生成 TableHashConfig 类文件用于运行时校验表的数据结构是否匹配（仅支持 C# 和 TypeScript, 其他语言请自行扩展）
 * @param {*} filePath 
 */
export function generateFbsHash(filePath) {

}


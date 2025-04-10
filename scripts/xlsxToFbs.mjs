import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fsAsync from 'fs/promises';
import { i18n } from './environment.mjs';
import { checkExist } from './utils/fsUtil.mjs';
import { xlsxFbsOptions } from './environment.mjs';
import { toUpperCamelCase, toSnakeCase, checkReservedKeyword } from './utils/stringUtil.mjs';
import path from 'path';
import { fbsFieldTemplate, fbsTemplate, fillTemplate } from './template.mjs';
import { log, warn } from './utils/logUtil.mjs';

/**
 * @typedef {Object} XlsxToFbsOptions
 * @property {string[]} [propertyOrder] 属性顺序
 * @property {string[]} [censoredFields] 删减字段
 * @property {boolean} [censoredTable] 是否删减表
 * @property {string} [censoredOutput] 删减输出目录
 * @property {string} [namespace] 命名空间
 * @property {string} [defaultKey] 默认主键
 * @property {boolean} [enableStreamingRead] 是否开启流式读取，仅支持 xlsx 格式
 * @property {boolean} [emptyString] 是否生成空字符串
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
 * @property {string} fbsField 生成的 fbs 字段
 * @property {string} type 字段类型
 * @property {string} defaultValue 默认值
 * @property {string} attribute 属性
 */

/**
 * @typedef {Object} FbsProperty
 * @property {string} fileName 文件名
 * @property {string} namespace 命名空间
 * @property {string} tableName 表名
 * @property {FbsFieldProperty[]} fields 字段
 * @property {string} fileExtension 文件扩展名
 */

const scalarTypeDefs = {
    int8:    { min: -128, max: 127, size: 1 },
    uint8:   { min: 0, max: 255, size: 1 },
    int16:   { min: -32768, max: 32767, size: 2 },
    uint16:  { min: 0, max: 65535, size: 2 },
    int32:   { min: -2147483648, max: 2147483647, size: 4 },
    uint32:  { min: 0, max: 4294967295, size: 4 },
    float32: { min: -3.4028235e38, max: 3.4028235e38, size: 4 },
    int64:   { min: -9223372036854775808n, max: 9223372036854775807n, size: 8 },
    uint64:  { min: 0n, max: 18446744073709551615n, size: 8 },
    float64: { min: -Number.MAX_VALUE, max: Number.MAX_VALUE, size: 8 },
    bool:    { min: 0, max: 1, size: 1 },
};

/**
 * 标量类型
 */
const scalarTypes = {
    // 1 byte
    bool:   scalarTypeDefs.bool,
    byte:   scalarTypeDefs.int8,
    ubyte:  scalarTypeDefs.uint8,
    int8:   scalarTypeDefs.int8,
    uint8:  scalarTypeDefs.uint8,
  
    // 2 bytes
    short:   scalarTypeDefs.int16,
    ushort:  scalarTypeDefs.uint16,
    int16:   scalarTypeDefs.int16,
    uint16:  scalarTypeDefs.uint16,
  
    // 4 bytes
    int:     scalarTypeDefs.int32,
    uint:    scalarTypeDefs.uint32,
    int32:   scalarTypeDefs.int32,
    uint32:  scalarTypeDefs.uint32,
    float:   scalarTypeDefs.float32,
    float32: scalarTypeDefs.float32,
  
    // 8 bytes
    long:    scalarTypeDefs.int64,
    ulong:   scalarTypeDefs.uint64,
    int64:   scalarTypeDefs.int64,
    uint64:  scalarTypeDefs.uint64,
    double:  scalarTypeDefs.float64,
    float64: scalarTypeDefs.float64,
};

const floatTypes = ['float', 'float32', 'double', 'float64'];

/**
 * 内置类型，非自定义类型的类型
 * @type {string[]}
 */
const builtinTypes = ['string', 'number', ...Object.keys(scalarTypes)];

/**
 * 是否是大范围标量类型
 * @param {string} type 类型
 * @returns {boolean}
 */
const isLargeScalarType = (type) => scalarTypes[type] && scalarTypes[type].size > scalarTypes.uint32.size;

const scalarTypeOrder = [
    'bool',
    'uint8', 'int8',
    'uint16', 'int16',
    'uint32', 'int32',
    'uint64', 'int64',
  ];
/**
 * 推导数字类型范围，不考虑浮点数，所以需要在外部判断是否所有数字是整数
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {string} 推导出的类型
 */
function inferNumberTypeRange(min, max) {
    for (const type of scalarTypeOrder) {
        const def = scalarTypeDefs[type];
        const minVal = typeof def.min === 'bigint' ? BigInt(min) : Number(min);
        const maxVal = typeof def.max === 'bigint' ? BigInt(max) : Number(max);
    
        if (minVal >= def.min && maxVal <= def.max) {
            return type;
        }
    }
    return 'int64'; // 没匹配到，你可能在做核弹计算
}

/**
 * 根据数组推断类型，仅推断整数类型
 * @param {number[]} values 
 * @returns 
 */
function inferNumberType(values) {
    const uniqueValues = [...new Set(values)];
    const allIntegers = uniqueValues.every(Number.isInteger);

    let type;
    if (allIntegers) {
        const maxValue = Math.max(...uniqueValues);
        const minValue = Math.min(...uniqueValues);
        type = inferNumberTypeRange(minValue, maxValue * 2); // 最大值乘以2，避免未来配表溢出
    } else {
        type = 'float32'; // 'float64' 类型请手配
    }
    return type;
}

/**
 * 校验数据是否符合指定标量类型
 * @param {string} type FlatBuffers 标量类型
 * @param {number[]} values 数值数组
 * @returns {boolean} 是否符合类型限制
 */
function validateNumberType(type, values) {
    const def = scalarTypes[type];
    if (!def) {
        throw new Error(`未知类型：${type}。你是不是手滑了？`);
    }

    const isFloatType = type.includes('float') || type === 'double';

    const min = def.min;
    const max = def.max;

    // 特殊处理 BigInt 范围的 uint64/int64
    if (typeof min === 'bigint' || typeof max === 'bigint') {
        return values.every(v => {
            try {
                const bv = BigInt(v);
                return bv >= min && bv <= max;
            } catch {
                return false;
            }
        });
    }

    return values.every(v =>
        typeof v === 'number' &&
        Number.isFinite(v) &&
        v >= min &&
        v <= max &&
        (isFloatType || Number.isInteger(v))
    );
}

/**
 * 通过 xlsx 文件生成 fbs 文本和对应的表格数据对象
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToFbsOptions} options 选项
 * @returns {Promise<XlsxToFbsResult>}
 */
export async function xlsxToFbs(filePath, options = {}) {
    log(`xlsxToFbs: ${filePath}`);
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

    let parsedResult;
    const extname = path.extname(filePath);
    if (extname !== '.xls' && extname !== '.xlsx') {
        throw new Error(`${i18n.errorTableNotSupport}: ${filePath}`);
    } else if (extname === '.xls' || !options.enableStreamingRead) {
        // 使用 xlsx 加载完整 .xls 文件，未开启流式加载时也使用 xlsx 加载完整的 .xlsx 文件
        parsedResult = await parseWithXlsx(filePath);
    } else if (extname === '.xlsx') {
        // 使用 ExcelJS 流式加载 .xlsx 文件
        parsedResult = await parseWithExcelJS(filePath, options);
    }

    const tableName = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));

    const properties = formatProperties(parsedResult.propertyJson, parsedResult.dataJson, options, tableName);
    const fullDataJson = formatDataJson(parsedResult.dataJson, properties, options, tableName); // 生成一份用于转换 bin 的 json 文件。

    if (options.defaultKey) {
        // 使用 key 关键字必须对数据进行排序
        const keyField = toSnakeCase(options.defaultKey);
        fullDataJson.sort((a, b) => {
            const valA = a[keyField] ?? '';
            const valB = b[keyField] ?? '';

            const isNumberA = typeof valA === 'number';
            const isNumberB = typeof valB === 'number';

            if (isNumberA && isNumberB) {
                return valA - valB;
            }

            return String(valA).localeCompare(
                String(valB),
                'en',
                { sensitivity: 'base', numeric: true } // 数字感知
            );
        });
    }

    const fileExtension = options.binaryExtension
        ? `file_extension "${options.binaryExtension.replace(/^\./, '')}";`
        : undefined;
    const fileName = path.basename(filePath);
    const namespace = options.namespace;

    if (checkReservedKeyword(tableName)) {
        warn(`${i18n.warningReservedKeyword} => tableName: ${tableName}`);
    }
    if (checkReservedKeyword(namespace)) {
        warn(`${i18n.warningReservedKeyword} => namespace: ${namespace}`);
    }

    const fields = properties.map(formatFbsField).join('\n');
    const fbs = formatFbs({ fileName, namespace, tableName, fields, fileExtension });
    const tableInfosFiled = `${toSnakeCase(tableName)}_infos`;
    const xlsxData = {};
    xlsxData[tableInfosFiled] = fullDataJson;

    if (options.censoredFields.length && !options.censoredTable) {
        const propertiesCensored = properties.filter(({ field }) => !options.censoredFields.includes(field));
        const fieldsCensored = propertiesCensored.map(formatFbsField).join('\n');
        const fbsCensored = formatFbs({ fileName, namespace, tableName, fields: fieldsCensored, fileExtension });

        const xlsxDataCensored = {};
        xlsxDataCensored[tableInfosFiled] = fullDataJson.map(row => {
            const censoredRow = { ...row };
            options.censoredFields
                .map(field => toSnakeCase(field))   // 转换为 fbs 字段名
                .forEach(fbsField => {
                    delete censoredRow[fbsField];
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
 * 使用 xlsx 加载完整 xls 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<XlsxToFbsResult>}
 */
async function parseWithXlsx(filePath) {
    const xlsxFileData = await fsAsync.readFile(filePath);
    const workbook = xlsx.read(xlsxFileData, { type: 'buffer' });

    const dataSheetName = workbook.SheetNames[0];
    const propertySheetName = workbook.SheetNames[1];

    const dataSheet = workbook.Sheets[dataSheetName];
    const propertySheet = workbook.Sheets[propertySheetName];

    if (!dataSheet || !propertySheet) {
        throw new Error(i18n.errorTableInvalid);
    }

    const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 2 });
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, { header: 'A' });

    return {
        dataJson,
        propertyJson,
    }
}

/**
 * 使用 exceljs 流式加载 xlsx 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<XlsxToFbsResult>}
 */
async function parseWithExcelJS(filePath) {
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

    return {
        dataJson,
        propertyJson,
    }
}

/**
 * 获取属性页的属性数据，并在这里就预处理好错误数据
 * @param {any} propertyJson 
 * @param {any} dataJson 
 * @param {XlsxToFbsOptions} options 
 * @param {string} tableName 表名
 * @returns {FbsFieldProperty[]}
 */
function formatProperties(propertyJson, dataJson, options, tableName) {
    const properties = [];
    propertyJson.forEach(property => {
        let [comment, field, type, defaultValue, attribute] = options.propertyOrder.map(order => property[order]);
        if (!comment || !field || !type) {
            return;
        }
        
        // 都 trim 一下
        comment = comment.trim();
        field = field.trim();
        type = type.trim();

        // field: 直接处理好 fbs 使用的 蛇形命名
        const fbsField = toSnakeCase(field);

        // type: 预防大小写错误
        if (builtinTypes.includes(type.toLowerCase())) {
            type = type.toLowerCase();
        }

        // type: 动态推断类型
        if (type === 'number') {
            // 根据表中的数据自动推导类型
            // 过滤掉无法转换为数字的值
            const values = dataJson
                .map(data => +data[comment])
                .filter(value => !isNaN(value));

            type = inferNumberType(values);

            // 如果是自动推导的 id 字段，且类型小于 uint，则强制预留为 uint
            if (field.toLowerCase() === 'id' && scalarTypes[type].size < scalarTypes.uint32.size) {
                type = 'uint32';
            }
        } else if (scalarTypes[type]) {
            // 根据表中的数值验证类型，若溢出则报错
            const values = dataJson
                .map(data => +data[comment])
                .filter(value => !isNaN(value));
            let validateResult = validateNumberType(type, values);
            if (!validateResult) {
                warn(`${i18n.warningNumberTypeOverflow}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
            }
        }

        if (isLargeScalarType(type)) { // 配表用这么大数据，确定 ok 吗？
            warn(`${i18n.warningNumberTypeRange}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
        }

        // defaultValue: 预防非数字
        if (defaultValue && scalarTypes[type]) {
            const parsedValue = +defaultValue;
            if (isNaN(parsedValue)) {
                if (typeof defaultValue === 'string') {
                    warn(`${i18n.errorInvalidDefaultValue}. table: ${tableName}, field: ${comment}[${field}] => defaultValue: ${defaultValue.slice(0, 10)}...`);
                } else {
                    warn(`${i18n.errorInvalidDefaultValue}. table: ${tableName}, field: ${comment}[${field}] => defaultValue: ${defaultValue}`);
                }
                defaultValue = 0;
            }
        } else {
            defaultValue = null;
        }

        const attrs = [];
        // attribute: 预防非英文字符
        if (attribute) {
            // 正则表达式：仅允许英文字符、空格、下划线和等号
            const regex = /^[A-Za-z _=]+$/;
            attribute = regex.test(attribute) ? attribute : '';
            const parsed = attribute
                .split(',')
                .map(attr => attr.trim())
                .filter(Boolean);
            attrs.push(...parsed);
        }
        // attribute 填充命令行传入的默认主键
        if (options.defaultKey === field && !attrs.includes('key')) {
            attrs.unshift('key');
        }
        attribute = attrs.join(', ');

        properties.push({
            comment,
            field,
            fbsField,
            type,
            defaultValue,
            attribute,
        });
    });
    return properties;
}

/**
 * 格式化数据页的数据
 * @param {any} dataJson 
 * @param {FbsFieldProperty[]} properties 
 * @param {XlsxToFbsOptions} options 
 * @param {string} tableName 表名
 * @returns 
 */
function formatDataJson(dataJson, properties, options, tableName) {
    return dataJson.map(row =>
        Object.fromEntries(
            properties
                .filter(({ comment, type }) => {
                    const value = row[comment];
                    if (options.emptyString && type === 'string' && (!value || (typeof value === 'string' && value.trim() === ''))) {
                        row[comment] = '';
                        return true;
                    }
                    return value !== undefined && !(typeof value === 'string' && value.trim() === '');
                })
                .map(({ comment, field, fbsField, type }) => {
                    let value = row[comment];
                    // 如果单元格是对象，则提取文本（ExcelJS特有处理）
                    if (typeof value === 'object') {
                        if (value && typeof value === 'object' && Array.isArray(value.richText)) {
                            value = value.richText.map(part => part.text).join('');
                        } else {
                            value = value?.toString?.() ?? '';
                        }
                    }
                    // 字符串类型必须保证为字符串，否则 flatc 会报错
                    // 标量类型的不需要转换成数字，只需要验证是否能转换为数字。如 int64 类型 "9007199254740993" 存储字符串让 flatc 转换以保留精度
                    // 其他类型（如数组和结构）暂未处理
                    if (type === 'string' && typeof value === 'number') {
                        value = value.toString();
                    } else if ((scalarTypes[type] || type === 'number') && typeof value === 'string') {
                        const parsedValue = +value;
                        if (isNaN(parsedValue)) {
                            warn(`${i18n.errorInvalidNumberValue}. table: ${tableName}, field: ${comment}[${field}]:[${type}] => value: ${value}`);
                            value = 0; // 转换失败，则设置为 0，否则保留原字符串以保留精度
                        }
                    }
                    return [fbsField, value];
                })
        )
    );
}

/**
 * 格式化 fbs 字段
 * @param {FbsFieldProperty} property 
 * @returns 
 */
function formatFbsField(property) {
    let { comment, fbsField, type, defaultValue, attribute } = property;

    defaultValue = defaultValue ? ` = ${defaultValue}` : '';

    attribute = attribute ? ` (${attribute})` : '';

    return fillTemplate(fbsFieldTemplate, {
        COMMENT: comment,
        FIELD: fbsField,
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
    const { fileName, namespace, tableName, fields, fileExtension } = property;

    return fillTemplate(fbsTemplate, {
        FILE_NAME: fileName,
        NAMESPACE: namespace,
        TABLE_NAME: tableName,
        TABLE_NAME_SNAKE_CASE: toSnakeCase(tableName),
        FIELDS: fields,
        FILE_EXTENSION: fileExtension,
    });
}

/**
 * 在生成的文件中添加 .fbs 文件的 hash 值，并生成 TableHashConfig 类文件用于运行时校验表的数据结构是否匹配（仅支持 C# 和 TypeScript, 其他语言请自行扩展）
 * @param {*} filePath 
 */
export function generateFbsHash(filePath) {

}


import fsAsync from 'fs/promises';
import { i18n } from './environment.mjs';
import { checkExist } from './utils/fsUtil.mjs';
import { xlsxFbsOptions } from './environment.mjs';
import { toUpperCamelCase, toSnakeCase, checkReservedKeyword, cleanAtTag, parseAtTag, parsePseudoJSON } from './utils/stringUtil.mjs';
import path from 'path';
import { getFbsFieldTemplate, getFbsTemplate, fillTemplate, getFbsEnumTemplate, getFbsStructTemplate, getFbsTableTemplate, getFbsStructFieldTemplate } from './template.mjs';
import { error, log, warn } from './utils/logUtil.mjs';
import { createHash } from 'crypto';
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
 * @property {string} [dataClassSuffix] 数据类后缀
 * @property {boolean} [csharpUnityLoader] 是否生成 Unity 的表格加载类
 * @property {string} [csharpUnityLoaderSuffix] 表格加载类后缀
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
 * @property {string} tagType 字段类型若配置了 \@ 则返回标签类型，比如 table, enum, struct
 * @property {string} defaultValue 默认值
 * @property {string} attribute 属性
 */

/**
 * @typedef {Object} FbsEnumProperty
 * @property {string} name 枚举名 UpperCamelCase
 * @property {string} type 枚举值的类型，scalarTypes 中的类型 byte, ubyte, short ushort, int, uint, long and ulong
 * @property {Record<string, number>} values 枚举值
 */

/**
 * @typedef {Object} FbsStructProperty
 * @property {string} name 结构体名 UpperCamelCase
 * @property {Record<string, string>} fields 字段, 字段名 => 字段类型
 */

/**
 * @typedef {Object} FbsSubTableProperty
 * @property {string} name 子表名 UpperCamelCase
 * @property {boolean} formatted 是否格式化过（字段映射）
 * @property {Record<string, any>[]} dataJson 数据
 * @property {FbsFieldProperty[]} fieldProperties 字段属性
 */

/**
 * @typedef {Object} FbsProperty
 * @property {string} fileName 文件名
 * @property {string} namespace 命名空间
 * @property {string} tableClass 表类
 * @property {string} dataClass 数据类
 * @property {string} fileExtension 文件扩展名
 * @property {FbsFieldProperty[]} fieldProperties 字段
 * @property {FbsEnumProperty[]} enumProperties 枚举
 * @property {FbsStructProperty[]} structProperties 结构体
 * @property {FbsSubTableProperty[]} subTableProperties 子表
 */

const scalarTypeDefs = {
    int8: { min: -128, max: 127, size: 1 },
    uint8: { min: 0, max: 255, size: 1 },
    int16: { min: -32768, max: 32767, size: 2 },
    uint16: { min: 0, max: 65535, size: 2 },
    int32: { min: -2147483648, max: 2147483647, size: 4 },
    uint32: { min: 0, max: 4294967295, size: 4 },
    float32: { min: -3.4028235e38, max: 3.4028235e38, size: 4 },
    int64: { min: -9223372036854775808n, max: 9223372036854775807n, size: 8 },
    uint64: { min: 0n, max: 18446744073709551615n, size: 8 },
    float64: { min: -Number.MAX_VALUE, max: Number.MAX_VALUE, size: 8 },
    bool: { min: 0, max: 1, size: 1 },
};

/**
 * 标量类型
 */
const scalarTypes = {
    // 1 byte
    bool: scalarTypeDefs.bool,
    byte: scalarTypeDefs.int8,
    ubyte: scalarTypeDefs.uint8,
    int8: scalarTypeDefs.int8,
    uint8: scalarTypeDefs.uint8,

    // 2 bytes
    short: scalarTypeDefs.int16,
    ushort: scalarTypeDefs.uint16,
    int16: scalarTypeDefs.int16,
    uint16: scalarTypeDefs.uint16,

    // 4 bytes
    int: scalarTypeDefs.int32,
    uint: scalarTypeDefs.uint32,
    int32: scalarTypeDefs.int32,
    uint32: scalarTypeDefs.uint32,
    float: scalarTypeDefs.float32,
    float32: scalarTypeDefs.float32,

    // 8 bytes
    long: scalarTypeDefs.int64,
    ulong: scalarTypeDefs.uint64,
    int64: scalarTypeDefs.int64,
    uint64: scalarTypeDefs.uint64,
    double: scalarTypeDefs.float64,
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
    'int8', 'uint8',
    'int16', 'uint16',
    'int32', 'uint32',
    'int64', 'uint64',
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
    if (values.length === 0) {
        return 'int16'; // 空数组，默认 int16
    }

    const uniqueValues = [...new Set(values)];
    const allIntegers = uniqueValues.every(Number.isInteger);

    let type;
    if (allIntegers) {
        const maxValue = Math.max(...uniqueValues);
        const minValue = Math.min(...uniqueValues);
        type = inferNumberTypeRange(minValue, maxValue * 2); // 最大值乘以2，避免未来配表溢出
        // console.log(`inferNumberTypeRange: ${minValue} ~ ${maxValue} => ${type}`);
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
    if (!options.dataClassSuffix) {
        options.dataClassSuffix = xlsxFbsOptions.dataClassSuffix;
    }

    /** @type {ParseResult} */
    let parsedResult;
    const extname = path.extname(filePath);
    if (extname !== '.xls' && extname !== '.xlsx' && extname !== '.xlsm') {
        throw new Error(`${i18n.errorTableNotSupport}: ${filePath}`);
    } else if (extname === '.xls' || extname === '.xlsm' || !options.enableStreamingRead) {
        // 使用 xlsx 加载完整 .xls 文件，未开启流式加载时也使用 xlsx 加载完整的 .xlsx 文件
        parsedResult = await parseWithXlsx(filePath);
    } else if (extname === '.xlsx') {
        // 使用 ExcelJS 流式加载 .xlsx 文件
        parsedResult = await parseWithExcelJS(filePath, options);
    }

    // 先构造子表、枚举、结构体
    const subTableProperties = Array.from(parsedResult.subTableMap.values());
    const enumProperties = Array.from(parsedResult.enumMap.values());
    const structProperties = Array.from(parsedResult.structMap.values());

    const fileName = path.basename(filePath);
    const namespace = options.namespace;
    const tableClass = toUpperCamelCase(path.basename(filePath, path.extname(filePath)));
    const dataClass = tableClass + options.dataClassSuffix;

    const fieldProperties = formatProperties(parsedResult.propertyJson, parsedResult.dataJson, options, tableClass);

    /** @type {FbsProperty} */
    const fbsProperty = {
        fileName,
        namespace,
        tableClass,
        dataClass,
        fileExtension: options.binaryExtension,
        fieldProperties,
        enumProperties,
        structProperties,
        subTableProperties,
    }

    const fullDataJson = formatDataJson(parsedResult.dataJson, fbsProperty, options, tableClass); // 生成一份用于转换 bin 的 json 文件。

    if (checkReservedKeyword(tableClass)) {
        warn(`${i18n.warningReservedKeyword} => tableName: ${tableClass}`);
    }
    if (checkReservedKeyword(namespace)) {
        warn(`${i18n.warningReservedKeyword} => namespace: ${namespace}`);
    }

    const fbs = formatFbs(fbsProperty);
    const tableInfosFiled = `${toSnakeCase(dataClass)}s`;
    const xlsxData = {};
    xlsxData[tableInfosFiled] = fullDataJson;

    if (options.censoredFields.length && !options.censoredTable) {
        const propertiesCensored = fieldProperties.filter(({ field }) => !options.censoredFields.includes(field));
        const fbsCensored = formatFbs({
            ...fbsProperty,
            fieldProperties: propertiesCensored,
        });

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
 * @typedef {Object} ParseResult
 * @property {any} dataJson 数据页
 * @property {any} propertyJson 属性页
 * @property {Map<string, FbsSubTableProperty>} subTableMap 子表
 * @property {Map<string, FbsEnumProperty>} enumMap 枚举
 * @property {Map<string, FbsStructProperty>} structMap 结构体
 */

/**
 * 使用 xlsx 加载完整 xls 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<ParseResult>}
 */
async function parseWithXlsx(filePath) {
    const xlsx = (await import('xlsx')).default;

    const xlsxFileData = await fsAsync.readFile(filePath);
    const workbook = xlsx.read(xlsxFileData, { type: 'buffer' });

    const tableName = path.basename(filePath, path.extname(filePath));

    /** @type {Map<string, FbsSubTableProperty>} */
    const subTableMap = new Map();
    /** @type {Map<string, FbsEnumProperty>} */
    const enumMap = new Map();
    /** @type {Map<string, FbsStructProperty>} */
    const structMap = new Map();

    const subTableDataSheetNames = [];
    const enumSheetNames = [];
    const structSheetNames = [];

    let dataSheetName = 'Sheet1';
    let propertySheetName = 'Sheet2';

    // 使用 表名 作为数据页名，使用 属性 作为属性页名
    for (const sheetName of workbook.SheetNames) {
        const sheetNameLower = sheetName.toLowerCase();
        if (sheetNameLower === tableName.toLowerCase()) {
            dataSheetName = sheetName;
        } else if (sheetNameLower === 'property' || sheetNameLower === '属性') {
            propertySheetName = sheetName;
        } else if (sheetNameLower.startsWith('table@')) {
            subTableDataSheetNames.push(sheetName);
        } else if (sheetNameLower.startsWith('enum@')) {
            enumSheetNames.push(sheetName);
        } else if (sheetNameLower.startsWith('struct@')) {
            structSheetNames.push(sheetName);
        }
    }

    const dataSheet = workbook.Sheets[dataSheetName] || workbook.Sheets[workbook.SheetNames[0]];
    const propertySheet = workbook.Sheets[propertySheetName] || workbook.Sheets[workbook.SheetNames[1]];

    if (!dataSheet || !propertySheet) {
        throw new Error(i18n.errorTableInvalid + ` => ${tableName}`);
    }

    const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 2 });
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, { header: 'A' });

    // 处理好主表数据后，接下来分析各种杂七杂八的 table, struct, enum

    // subTable
    for (const sheetName of subTableDataSheetNames) {
        const subTableName = sheetName.slice(6);
        const subTablePropertySheetName = `property@${subTableName}`;
        const subTableDataSheet = workbook.Sheets[sheetName];
        const subTablePropertySheet = workbook.Sheets[subTablePropertySheetName];

        if (!subTableDataSheet || !subTablePropertySheet) {
            throw new Error(i18n.errorSubTableSheetMissing + ` => ${tableName}.${subTableName}`);
        }

        const subTableDataJson = xlsx.utils.sheet_to_json(subTableDataSheet, { header: 2 });
        const subTablePropertyJson = xlsx.utils.sheet_to_json(subTablePropertySheet, { header: 'A' });

        subTableMap.set(subTableName, {
            name: subTableName,
            dataJson: subTableDataJson,
            fieldProperties: formatProperties(
                subTablePropertyJson, 
                subTableDataJson, 
                { propertyOrder: ['A', 'B', 'C', 'D', 'E'] }, 
                `${tableName}.${subTableName}`
            ),
        });
    }

    // enum
    for (const sheetName of enumSheetNames) {
        const enumName = sheetName.slice(5);
        const enumSheet = workbook.Sheets[sheetName];
        const enumJson = xlsx.utils.sheet_to_json(enumSheet, { header: 1 });
        const enumType = enumJson[0][1]; // 取第一行的类型
        const enumValues = Object.fromEntries(enumJson.map(row => [row[0], row[2]]));

        enumMap.set(enumName, {
            name: enumName,
            type: enumType,
            values: enumValues,
        });
    }

    // struct
    for (const sheetName of structSheetNames) {
        const structName = sheetName.slice(7);
        const structSheet = workbook.Sheets[sheetName];
        const structJson = xlsx.utils.sheet_to_json(structSheet, { header: 1 });
        const structFields = Object.fromEntries(structJson.map(row => [row[0], row[1]]));

        structMap.set(structName, {
            name: structName,
            fields: structFields,
        });
    }

    return {
        dataJson,
        propertyJson,
        subTableMap,
        enumMap,
        structMap,
    }
}

/**
 * 使用 exceljs 流式加载 xlsx 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<XlsxToFbsResult>}
 */
async function parseWithExcelJS(filePath) {
    const ExcelJS = (await import('exceljs')).default;

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
    }

    const tableName = path.basename(filePath, path.extname(filePath));
    /** @type {Map<string, FbsSubTableProperty>} */
    const subTableMap = new Map();
    /** @type {Map<string, FbsEnumProperty>} */
    const enumMap = new Map();
    /** @type {Map<string, FbsStructProperty>} */
    const structMap = new Map();

    const subTableDataSheetNames = [];
    const enumSheetNames = [];
    const structSheetNames = [];

    // 流式加载由于是异步的，会出现 sheetNames 的顺序是乱的情况，则需要排序
    // 所以必须强制命名正确，才能保证数据正确
    let dataSheetName = 'Sheet1';
    let propertySheetName = 'Sheet2';

    // 使用 表名 作为数据页名，使用 属性 作为属性页名
    for (const sheetName of sheetNames) {
        const sheetNameLower = sheetName.toLowerCase();
        if (sheetNameLower === tableName.toLowerCase()) {
            dataSheetName = sheetName;
        } else if (sheetNameLower === 'property' || sheetNameLower === '属性') {
            propertySheetName = sheetName;
        } else if (sheetNameLower.startsWith('table@')) {
            subTableDataSheetNames.push(sheetName);
        } else if (sheetNameLower.startsWith('enum@')) {
            enumSheetNames.push(sheetName);
        } else if (sheetNameLower.startsWith('struct@')) {
            structSheetNames.push(sheetName);
        }
    }

    const dataRows = sheetData[dataSheetName]; // 数据页
    const propertyRows = sheetData[propertySheetName]; // 属性页

    if (!dataRows || !propertyRows) {
        throw new Error(i18n.errorTableInvalid + ` => ${tableName}`);
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

    // subTable
    for (const sheetName of subTableDataSheetNames) {
        const subTableName = sheetName.slice(6);
        const subTablePropertySheetName = `property@${subTableName}`;
        const subTableData = sheetData[sheetName];
        const subTableProperty = sheetData[subTablePropertySheetName];

        if (!subTableData || !subTableProperty) {
            throw new Error(i18n.errorSubTableSheetMissing + ` => ${tableName}.${subTableName}`);
        }

        const subHeader = subTableData[0];
        const subTableDataJson = subTableData.slice(1).map(row => {
            const obj = {};
            row.forEach((val, i) => {
                obj[subHeader[i]] = val;
            });
            return obj;
        });

        const subTablePropertyJson = subTableProperty.map(row => {
            const obj = {};
            row.forEach((val, i) => {
                obj[String.fromCharCode(65 + i)] = val;
            });
            return obj;
        });

        subTableMap.set(subTableName, {
            name: subTableName,
            dataJson: subTableDataJson,
            fieldProperties: formatProperties(
                subTablePropertyJson,
                subTableDataJson,
                { propertyOrder: ['A', 'B', 'C', 'D', 'E'] },
                `${tableName}.${subTableName}`
            )
        });
    }

    // enum
    for (const sheetName of enumSheetNames) {
        const enumName = sheetName.slice(5);
        const enumRows = sheetData[sheetName];

        const enumType = enumRows[0]?.[1];
        const enumValues = Object.fromEntries(enumRows.map(row => [row[0], row[2]]));

        enumMap.set(enumName, {
            name: enumName,
            type: enumType,
            values: enumValues,
        });
    }

    // struct
    for (const sheetName of structSheetNames) {
        const structName = sheetName.slice(7);
        const structRows = sheetData[sheetName];

        const fields = Object.fromEntries(structRows.map(row => [row[0], row[1]]));

        structMap.set(structName, {
            name: structName,
            fields,
        });
    }

    return {
        dataJson,
        propertyJson,
        subTableMap,
        enumMap,
        structMap,
    }
}

/**
 * 获取属性页的属性数据，并在这里预处理数据
 * @param {Record<string, any>[]} propertyJson 
 * @param {Record<string, any>[]} dataJson 
 * @param {XlsxToFbsOptions} options 
 * @param {string} tableName 表名
 * @returns {FbsFieldProperty[]}
 */
function formatProperties(propertyJson, dataJson, options, tableName) {
    const properties = [];
    // 获取标记 key 的字段
    const keyFieldList = propertyJson.map(property => {
        let [comment, field, type, defaultValue, attribute] = options.propertyOrder.map(order => property[order]);
        return attribute && attribute.includes('key') ? field : null;
    }).filter(Boolean);
    if (keyFieldList.length > 1) {
        error(`${i18n.errorMultipleKeyField}. table: ${tableName}, keyField: ${keyFieldList.join(', ')}`);
    }   
    const keyField = keyFieldList[0] || options.defaultKey;
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
        if (field.startsWith('add')) { // 避免与代码中的 addField 接口冲突
            warn(`${i18n.warningInvalidField}. table: ${tableName}, field: ${comment}[${field}] => field: ${field}`);
            field = 'addFix' + field.slice(3);
        } else if (field === 'getType') { // 避免与 C# 的 GetType 方法冲突
            warn(`${i18n.warningInvalidField}. table: ${tableName}, field: ${comment}[${field}] => field: ${field}`);
            field = 'getTypeFix';
        }

        const fbsField = toSnakeCase(field);

        const { tagType, tagName, formatted } = parseAtTag(type);

        // type: 预防大小写错误
        if (builtinTypes.includes(type.toLowerCase())) {
            type = type.toLowerCase();
        } else {
            type = formatted;
        }

        // type: 动态推断类型
        if (type === 'number') {
            // 根据表中的数据自动推导类型
            // 过滤掉无法转换为数字的值
            const values = dataJson
                .map(data => +data[comment])
                .filter(value => !isNaN(value));

            type = inferNumberType(values);

            // 如果是自动推导的 id 字段，且类型小于 int，则强制预留为 int
            if (field.toLowerCase() === 'id' && scalarTypes[type].size < scalarTypes.int.size) {
                type = 'int';
            }

            if (type === 'bool') {
                // 警告一下，万一配表数据不足导致的错误推断
                warn(`${i18n.warningInferNumberTypeBool}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
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

        if (fbsField === 'id' && type !== 'int' && type !== 'int32' && options.csharpUnityLoader) { // 使用 csharpUnityLoader 时，基础 id 字段必须为 int 类型
            warn(`${i18n.warningUnityIdType}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
            type = 'int';
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
        } else if (tagType === 'enum') {
            if (!defaultValue) {
                error(`${i18n.errorEnumDefaultValueMissing}. table: ${tableName}, field: ${comment}[${field}] => defaultValue: ${defaultValue}`);
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
        if (keyField === field && !attrs.includes('key')) {
            attrs.unshift('key');
        }
        if (attrs.includes('key')) {
            dataJson.sort((a, b) => {
                const valA = a[comment] ?? '';
                const valB = b[comment] ?? '';
    
                const isNumberA = typeof valA === 'number';
                const isNumberB = typeof valB === 'number';
    
                if (isNumberA && isNumberB) {
                    return valA - valB;
                }
                
                // FlatBuffers 的排序是按照 字节顺序（UTF-8）进行的比较，使用代码构建可以用 Monster.CreateSortedVectorOfMonster
                // JS 默认的 < / > 字符串比较方式，其实就是按照字符码位逐个比较，等价于 FlatBuffers 的行为（UTF-8 → 转成 JS string → 按码位比）
                const strA = String(valA);
                const strB = String(valB);
                return strA < strB ? -1 : strA > strB ? 1 : 0;
            });
        }
        attribute = attrs.join(', ');

        properties.push({
            comment,
            field,
            fbsField,
            type,
            tagType,
            defaultValue,
            attribute,
        });
    });
    return properties;
}

/**
 * 格式化数据页的数据
 * @param {any} dataJson 
 * @param {FbsProperty} fbsProperty 
 * @param {XlsxToFbsOptions} options 
 * @param {string} tableName 表名
 * @returns 
 */
function formatDataJson(dataJson, fbsProperty, options, tableName) {
    function formatValue(value, type, tagType, comment, field) {
        if (typeof value === 'object') {
            // 如果单元格是对象，则提取文本（ExcelJS特有处理）
            if (value && typeof value === 'object' && Array.isArray(value.richText)) {
                return value.richText.map(part => part.text).join('');
            } else {
                return value?.toString?.() ?? '';
            }
        } else if (typeof value === 'number' && type === 'string') {
            // 字符串类型必须保证为字符串，否则 flatc 会报错
            return value.toString();
        } else if (typeof value === 'string' && (scalarTypes[type] || type === 'number')) {
             // 标量类型的不需要转换成数字，只需要验证是否能转换为数字。如 int64 类型 "9007199254740993" 存储字符串让 flatc 转换以保留精度
            const parsedValue = +value;
            if (isNaN(parsedValue)) {
                warn(`${i18n.errorInvalidNumberValue}. table: ${tableName}, field: ${comment}[${field}]:[${type}] => value: ${value}`);
                return 0; // 转换失败，则设置为 0，否则保留原字符串以保留精度
            }
        } else if (type.startsWith('[')) {
            const valueType = type.slice(1, -1);
            if (tagType === 'struct') {
                // 结构体直接转换对象
                return parsePseudoJSON(value);
            }
            // 其余当作数组处理
            return value.toString().split(',').map(val => formatValue(val, valueType, tagType, comment, field));
        } else if (tagType === 'enum') {
            // 枚举只检查是否存在，不转换值的类型
            const enumProperty = fbsProperty.enumProperties.find(({ name }) => name === type);
            if (!enumProperty) {
                warn(`${i18n.errorEnumNotFound}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
                return null;
            }
        } else if (tagType === 'struct') {
            // 结构体只检查是否存在，不转换值的类型
            const structProperty = fbsProperty.structProperties.find(({ name }) => name === type);
            if (!structProperty) {
                warn(`${i18n.errorStructNotFound}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
                return null;
            }
            return parsePseudoJSON(value);
        } else if (tagType === 'table') {
            const tableProperty = fbsProperty.subTableProperties.find(({ name }) => name === type);
            if (!tableProperty) {
                warn(`${i18n.errorSubTableNotFound}. table: ${tableName}, field: ${comment}[${field}] => type: ${type}`);
                return null;
            }
            if (!tableProperty.formatted) {
                tableProperty.dataJson = formatDataJson(tableProperty.dataJson, {
                    ...fbsProperty,
                    fieldProperties: tableProperty.fieldProperties,
                }, options, `${tableName}.${type}`);
                tableProperty.formatted = true;
            }
            const data = tableProperty.dataJson.find(item => item.id === +value);
            if (!data) {
                warn(`${i18n.errorSubTableDataNotFound}. table: ${tableName}, field: ${comment}[${field}] => type: ${type} => id: ${value}`);
                return null;
            }
            return data;
        }
        return value;
    }

    return dataJson.map(row =>
        Object.fromEntries(
            fbsProperty.fieldProperties
                .filter(({ comment, type }) => {
                    const value = row[comment];
                    if (options.emptyString && type === 'string' && (!value || (typeof value === 'string' && value.trim() === ''))) {
                        row[comment] = '';
                        return true;
                    }
                    return value !== undefined && !(typeof value === 'string' && value.trim() === '');
                })
                .map(({ comment, field, fbsField, type, tagType }) => {
                    try {
                        const value = formatValue(row[comment], type, tagType, comment, field);
                        return [fbsField, value];
                    } catch (err) {
                        error(`Format Value Error! table: ${tableName}, field: ${comment}[${field}] => value: ${row[comment]}`);
                        // error(err.stack);
                        return [fbsField, null];
                    }
                })
        )
    );
}

/**
 * 格式化枚举
 * @param {FbsEnumProperty} property 
 * @returns 
 */
function formatFbsEnum(property) {
    const { name, type, values } = property;

    return fillTemplate(getFbsEnumTemplate(), {
        ENUM_NAME: toUpperCamelCase(name),
        ENUM_TYPE: type,
        ENUM_VALUES: Object.entries(values).map(([key, value]) => {
            const keyUpperCamelCase = toUpperCamelCase(key);
            if (value === undefined) {
                return `${keyUpperCamelCase}`;
            } else if (typeof value !== 'number') {
                const parsedValue = +value;
                if (isNaN(parsedValue)) {
                    return `${keyUpperCamelCase}`;
                }
                return `${keyUpperCamelCase} = ${parsedValue}`;
            }
            return `${keyUpperCamelCase} = ${value}`;
        }).join(', '),
    });
}

/**
 * 格式化结构体
 * @param {FbsStructProperty} property 
 * @returns 
 */
function formatFbsStruct(property) {
    const { name, fields } = property;

    return fillTemplate(getFbsStructTemplate(), {
        STRUCT_CLASS: toUpperCamelCase(name),
        FIELD_LIST: Object.entries(fields).map(([key, value]) =>
            fillTemplate(getFbsStructFieldTemplate(), {
                FIELD: toSnakeCase(key),
                TYPE: value,
            })
        ).join('\n'),
    });
}

/**
 * 格式化子表
 * @param {FbsSubTableProperty} property 
 * @returns 
 */
function formatFbsSubTable(property) {
    const { name, fieldProperties } = property;
    const formattedFields = fieldProperties.map(formatFbsField).join('\n');

    return fillTemplate(getFbsTableTemplate(), {
        TABLE_CLASS: toUpperCamelCase(name),
        FIELD_LIST: formattedFields,
    });
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

    return fillTemplate(getFbsFieldTemplate(), {
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
    const {
        fileName, namespace, tableClass, dataClass, fileExtension,
        fieldProperties, enumProperties, structProperties, subTableProperties,
    } = property;

    const fileExtensionString = fileExtension
        ? `file_extension "${fileExtension}";\n\n`
        : '';
    const enums = enumProperties.length ? enumProperties.map(formatFbsEnum).join('\n\n') + '\n\n' : '';
    const structs = structProperties.length ? structProperties.map(formatFbsStruct).join('\n\n') + '\n\n' : '';
    const subTables = subTableProperties.length ? subTableProperties.map(formatFbsSubTable).join('\n\n') + '\n\n' : '';
    const fields = fieldProperties.map(formatFbsField).join('\n');

    const templateArgs = {
        FILE_NAME: fileName,
        FILE_EXTENSION: fileExtensionString,
        NAMESPACE: namespace,
        ENUM_LIST: enums,
        STRUCT_LIST: structs,
        SUB_TABLE_LIST: subTables,
        TABLE_CLASS: tableClass,
        TABLE_CLASS_SNAKE_CASE: toSnakeCase(tableClass),
        DATA_CLASS: dataClass,
        DATA_CLASS_SNAKE_CASE: toSnakeCase(dataClass),
        FIELD_LIST: fields,
    }

    const fbsContentBase = fillTemplate(getFbsTemplate(), templateArgs);

    const identifier = generateFbsHash(fbsContentBase);

    return fillTemplate(getFbsTemplate(), {
        FILE_IDENTIFIER: identifier,
        ...templateArgs,
    });
}

/**
 * 获取 fbs 文件的 hash 值
 * @param {string} fbsContent
 */
export function generateFbsHash(fbsContent) {
    const hash = createHash('sha256').update(fbsContent).digest();
    return [...hash.subarray(0, 2)]
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');
}

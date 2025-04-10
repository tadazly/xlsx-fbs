import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fsAsync from 'fs/promises';
import { i18n } from './environment.mjs';
import { checkExist } from './utils/fsUtil.mjs';
import { xlsxFbsOptions } from './environment.mjs';
import path from 'path';
import { info, warn } from './utils/logUtil.mjs';

/**
 * @typedef {Object} XlsxToJsonOptions
 * @property {string[]} [propertyOrder] 属性顺序
 * @property {string[]} [censoredFields] 删减字段
 * @property {boolean} [censoredTable] 是否删减表
 * @property {string} [censoredOutput] 删减输出目录
 * @property {string} [namespace] 命名空间
 * @property {string} [defaultKey] 默认主键
 * @property {boolean} [enableStreamingRead] 是否开启流式读取，仅支持 xlsx 格式
 */

/**
 * @typedef {Object} XlsxToJsonResult
 * @property {Array<any>} xlsxData 生成的表格数据对象
 * @property {Array<any>} [xlsxDataCensored] 生成的删减字段的表格数据对象
 */

/**
 * 通过 xlsx 文件生成原始 json 对象，注意不是 fbs 用的 json 对象哦，所有字段都保留表格中的字段名，不会转换成 snake_case 哦
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToJsonOptions} options 选项
 * @returns {Promise<XlsxToJsonResult>} `{xlsxData: Array<any>, xlsxDataCensored: Array<any>}` 返回的 xlsxData 是原始表格数据对象，xlsxDataCensored 是删减字段的表格数据对象
 */
export async function xlsxToJson(filePath, options = {}) {
    info(`xlsxToJson: ${filePath}`);
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
        parsedResult = await parseWithXlsx(filePath, options);
    } else if (extname === '.xlsx') {
        // 使用 ExcelJS 流式加载 .xlsx 文件
        parsedResult = await parseWithExcelJS(filePath, options);
    }

    const properties = formatProperties(parsedResult.propertyJson, options);
    const xlsxData = formatDataJson(parsedResult.dataJson, properties);

    if (options.censoredFields.length && !options.censoredTable) {
        const xlsxDataCensored = xlsxData.map(row => {
            const censoredRow = { ...row };
            options.censoredFields.forEach(field => {
                delete censoredRow[field];
            });
            return censoredRow;
        });

        return {
            xlsxData, xlsxDataCensored,
        }
    }

    if (options.censoredOutput && !options.censoredTable) {
        return {
            xlsxData,
            xlsxDataCensored: xlsxData,
        };
    }

    return {
        xlsxData,
    };
}

/**
 * 使用 xlsx 加载完整 xls 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<XlsxToJsonResult>}
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

    const dataJson = xlsx.utils.sheet_to_json(dataSheet, { header: 2, raw: true });
    const propertyJson = xlsx.utils.sheet_to_json(propertySheet, { header: 'A' });

    return {
        dataJson,
        propertyJson,
    }
}

/**
 * 使用 exceljs 流式加载 xlsx 文件
 * @param {string} filePath xlsx 文件路径
 * @returns {Promise<XlsxToJsonResult>}
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

function extractCellText(cell) {
    if (cell && typeof cell === 'object' && Array.isArray(cell.richText)) {
        return cell.richText.map(part => part.text).join('');
    }
    return cell?.toString?.() ?? '';
}

function formatProperties(propertyJson, options) {
    const properties = [];
    propertyJson.forEach(property => {
        let [comment, field, type] = options.propertyOrder.map(order => property[order]);
        if (!comment || !field || !type) {
            return;
        }
        properties.push({
            comment,
            field,
            type,
        });
    });
    return properties;
}

function formatDataJson(dataJson, properties) {
    return dataJson.map(row =>
        Object.fromEntries(
            properties
                .map(({ comment, field, type }) => {
                    let value = row[comment];
                    if (typeof value === 'object') {
                        value = extractCellText(value);
                    }
                    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
                        value = type === 'string' ? '' : 0;
                    }
                    if (type === 'string' && typeof value === 'number') {
                        value = value.toString();
                    } else if (type === 'number' && typeof value === 'string') {
                        value = +value;
                        if (isNaN(value)) {
                            value = 0;
                            warn(`${i18n.errorInvalidNumberValue} field: ${comment}[${field}]:[${type}] => value: ${row[comment]}`);
                        }
                    }
                    return [field, value];
                })
        )
    );
}
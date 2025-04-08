import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fsAsync from 'fs/promises';
import { i18n } from './environment.mjs';
import { checkExist } from './utils/fsUtil.mjs';
import { xlsxFbsOptions } from './environment.mjs';
import path from 'path';

/**
 * @typedef {Object} XlsxToJsonOptions
 * @property {string[]} [propertyOrder] 属性顺序
 * @property {string[]} [censoredFields] 删减字段
 * @property {string} [namespace] 命名空间
 * @property {string} [defaultKey] 默认主键
 * @property {boolean} [enableStreamingRead] 是否开启流式读取，仅支持 xlsx 格式
 */

/**
 * @typedef {Object} XlsxToJsonResult
 * @property {Record<string, any>} xlsxData 生成的表格数据对象
 * @property {Record<string, any>} [xlsxDataCensored] 生成的删减字段的表格数据对象
 */

/**
 * 通过 xlsx 文件生成 fbs 文本和对应的表格数据对象
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToJsonOptions} options 选项
 * @returns {Promise<XlsxToJsonResult>}
 */
export async function xlsxToJson(filePath, options = {}) {
    console.log(`xlsxToJson: ${filePath}`);
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
    if (extname === '.xls' || !options.enableStreamingRead) {
        // 使用 xlsx 加载完整 .xls 文件，未开启流式加载时也使用 xlsx 加载完整的 .xlsx 文件
        return internalXlsToJson(filePath, options);
    } else if (extname === '.xlsx') {
        // 使用 ExcelJS 流式加载 .xlsx 文件
        return internalXlsxToJson(filePath, options);
    } else {
        throw new Error(`${i18n.errorTableNotSupport}: ${filePath}`);
    }
}

/**
 * 使用 xlsx 加载完整 xls 文件
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToJsonOptions} options 选项
 * @returns {Promise<XlsxToJsonResult>}
 */
async function internalXlsToJson(filePath, options = {}) {
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
    const properties = propertyJson.map(property => {
        let [comment, field, type] = options.propertyOrder.map(order => property[order]);
        return {
            comment,
            field,
            type,
        };
    });

    // 生成一份用于转换 bin 的 json 文件。
    const xlsxData = dataJson.map(row =>
        Object.fromEntries(
            properties
                .map(({ comment, field, type }) => {
                    let value = row[comment];
                    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
                        value = type === 'string' ? '' : 0;
                    }
                    if (type === 'string' && typeof value === 'number') {
                        value = value.toString();
                    } else if (type === 'number' && typeof value === 'string') {
                        value = +value;
                        if (isNaN(value)) {
                            value = 0;
                            console.warn(`${i18n.errorInvalidNumberValue} field: ${comment}[${field}]:[${type}] => value: ${row[comment]}`);
                        }
                    }
                    return [field, value];
                })
        )
    );

    if (options.censoredFields.length) {
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

    return {
        xlsxData,
    };
}

/**
 * 使用 exceljs 流式加载 xlsx 文件
 * @param {string} filePath xlsx 文件路径
 * @param {XlsxToJsonOptions} options 选项
 * @returns {Promise<XlsxToJsonResult>}
 */
async function internalXlsxToJson(filePath, options = {}) {
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

    const properties = propertyJson.map(property => {
        let [comment, field, type] = options.propertyOrder.map(order => property[order]);
        return {
            comment,
            field,
            type,
        };
    });

    const xlsxData = dataJson.map(row =>
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
                            console.warn(`${i18n.errorInvalidNumberValue} field: ${comment}[${field}]:[${type}] => value: ${row[comment]}`);
                        }
                    }
                    return [field, value];
                })
        )
    );

    if (options.censoredFields.length) {
        const xlsxDataCensored = xlsxData.map(row => {
            const censoredRow = { ...row };
            options.censoredFields.forEach(field => {
                delete censoredRow[field];
            });
            return censoredRow;
        });

        return {
            xlsxData,
            xlsxDataCensored,
        }
    }

    return {
        xlsxData,
    };
}

function extractCellText(cell) {
    if (cell && typeof cell === 'object' && Array.isArray(cell.richText)) {
        return cell.richText.map(part => part.text).join('');
    }
    return cell?.toString?.() ?? '';
}
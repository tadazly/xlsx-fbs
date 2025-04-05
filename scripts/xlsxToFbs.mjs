import xlsx from 'xlsx';

/**
 * 通过 xlsx 文件生成 fbs 文件
 * @param {string} filePath 
 */
export function xlsxToFbs(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    console.log(workbook.SheetNames);
}

/**
 * 在生成的文件中添加 .fbs 文件的 hash 值，并生成 TableHashConfig 类文件用于运行时校验表的数据结构是否匹配（仅支持 C# 和 TypeScript, 其他语言请自行扩展）
 * @param {*} filePath 
 */
export function generateFbsHash(filePath) {

}

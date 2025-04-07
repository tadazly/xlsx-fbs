import fsAsync from 'fs/promises';
import path from 'path';
import * as fsUtil from './utils/fsUtil.mjs';
import { flatcToBinaryAsync } from './utils/flatcUtil.mjs';
import { xlsxFbsOptions, getBinPath, getTableName } from './environment.mjs';

/**
 * 将 json 文件转换为二进制文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} jsonPath 输入的 json 文件
 * @param {string} binPath 输出的二进制文件
 */
export async function jsonToBin(fbsPath, jsonPath, binPath) {
    await flatcToBinaryAsync(fbsPath, jsonPath, binPath);
    if (xlsxFbsOptions.binaryExtension) {
        const srcPath = getBinPath(fbsPath);
        const baseName = path.basename(srcPath, path.extname(srcPath));
        const dir = path.dirname(srcPath);
        const destPath = path.join(dir, `${baseName}${xlsxFbsOptions.binaryExtension}`);
        await fsUtil.moveFile(srcPath, destPath);
    }
}

/**
 * 通过脚本动态生成二进制文件
 * @param {string} binPath 输出的二进制文件
 */
export async function scriptToBin(binPath) {

}


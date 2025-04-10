import { flatcToBinaryAsync } from './utils/flatcUtil.mjs';
import * as logUtil from './utils/logUtil.mjs';
import { i18n } from './environment.mjs';

/**
 * 将 json 文件转换为二进制文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} jsonPath 输入的 json 文件
 * @param {string} binPath 输出的二进制文件
 */
export async function jsonToBin(fbsPath, jsonPath, binPath) {
    try {
        await flatcToBinaryAsync(fbsPath, jsonPath, binPath);
    } catch (err) {
        logUtil.error(`${i18n.errorFlatcGenerateFailed}: ${jsonPath}`);
        logUtil.error(err?.message || err);
        throw new Error(`Failed to generate binary for ${jsonPath}`);
    }
}

/**
 * 通过脚本动态生成二进制文件
 * @param {string} binPath 输出的二进制文件
 */
export async function scriptToBin(binPath) {

}


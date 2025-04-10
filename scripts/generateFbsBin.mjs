import { flatcToBinaryAsync } from './utils/flatcUtil.mjs';

/**
 * 将 json 文件转换为二进制文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} jsonPath 输入的 json 文件
 * @param {string} binPath 输出的二进制文件
 */
export async function jsonToBin(fbsPath, jsonPath, binPath) {
    await flatcToBinaryAsync(fbsPath, jsonPath, binPath);
}

/**
 * 通过脚本动态生成二进制文件
 * @param {string} binPath 输出的二进制文件
 */
export async function scriptToBin(binPath) {

}


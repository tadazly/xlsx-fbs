import path from 'path';
import { execAsync } from "./processUtil.mjs";
import { projectPath, i18n } from "../environment.mjs";

/**
 * 执行 flatc 命令
 * @param {string[]} flatcOptions flatc 选项 https://flatbuffers.dev/flatc/
 * @param {string[]} files 输入文件
 * @param {string[]} [binaryFiles] 输入的二进制文件，转换 json 时需要
 */
export async function flatcAsync(flatcOptions, files, binaryFiles) {
    let flatcBin;
    if (process.platform === 'win32') {
        flatcBin = path.join(projectPath, 'bin', 'flatc.exe');
    } else if (process.platform === 'darwin') {
        flatcBin = path.join(projectPath, 'bin', 'flatc');
    } else {
        throw new Error(`${i18n.errorUnsupportedPlatform}: ${process.platform}`);
    }
    await execAsync(`${flatcBin} ${flatcOptions.join(' ')} ${files.join(' ')}${binaryFiles ? ` -- ${binaryFiles.join(' ')}` : ''}`, null, false);
}

/**
 * 将 json 文件转换为二进制文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} jsonPath 输入的 json 文件
 * @param {string} binPath 输出的二进制文件
 */
export async function flatcToBinaryAsync(fbsPath, jsonPath, binPath) {
    await flatcAsync(['--binary', '-o', binPath], [fbsPath, jsonPath]);
}

/**
 * 将二进制文件转换为 json 文件
 * @param {string} fbsPath 输入的 fbs 文件
 * @param {string} binPath 输入的二进制文件
 * @param {string} jsonPath 输出的 json 文件
 */
export async function flatcToJsonAsync(fbsPath, binPath, jsonPath) {
    await flatcAsync([
        '--json', '--natural-utf8', '--strict-json', '--raw-binary',
        '-o', jsonPath,
    ], [fbsPath], [binPath]);  
}
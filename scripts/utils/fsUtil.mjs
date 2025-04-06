import * as fsAsync from 'fs/promises'
import { join, dirname } from 'path';
import os from 'os'

/**
 * 创建目录链接
 * @param {string} source 源文件夹
 * @param {string} target 目标文件夹
 */
export async function linkDir(source, target) {
    if (!await checkExist(source)) {
        console.error(`源目录不存在：${source}`)
        throw new Error('LinkDir Error: Source Not Exist !')
    }
    if (await checkExist(target)) {
        console.info('移除原有链接')
        await fsAsync.unlink(target)
    }
    await fsAsync.symlink(source, target, os.platform() === 'win32' ? 'junction' : 'dir')
    console.log(`已链接 ${source} <=> ${target}`)
}

/**
 * 递归列出所有文件
 * @template {boolean} T
 * @param {string} dir 
 * @param {{withFileTypes: T}} options withFileTypes 是否返回文件类型
 * @returns {Promise<T extends true ? import('fs').Dirent[] : string[]>}
 */
export async function listAllFiles(dir, options) {
    let files = []
    const entries = await fsAsync.readdir(dir, { withFileTypes: true })

    for (let entry of entries) {
        const fullPath = join(dir, entry.name)
        
        if (entry.isDirectory()) {
            files = files.concat(await listAllFiles(fullPath, options))
        } else {
            if (options && options.withFileTypes) {
                entry.parentPath = dir
                files.push(entry)
            } else {
                files.push(fullPath)
            }
        }
    }

    return files
}

/**
 * 移动文件
 */
export async function moveFile(src, dest) {
    try {
        await fsAsync.mkdir(dirname(dest), {recursive: true})
        await fsAsync.copyFile(src, dest)
        await fsAsync.rm(src)

        console.info(`移动文件：${src} => ${dest}`)
    } catch (err) {
        console.error(`移动失败：${src} => ${dest}`)
    }
}

/**
 * 移动文件夹
 */
export async function moveDir(src, dest) {
    try {
        await fsAsync.mkdir(dest, { recursive: true })
        const entries = await fsAsync.readdir(src, { withFileTypes: true })
        const waitList = []
        for (const entry of entries) {
            const srcPath = join(src, entry.name)
            const destPath = join(dest, entry.name)
            if (entry.isDirectory()) {
                waitList.push(moveDir(srcPath. destPath))
            } else {
                waitList.push(fsAsync.copyFile(srcPath, destPath))
            }
        }
        await Promise.all(waitList)
        await fsAsync.rm(src, {recursive: true, force: true})
        console.info(`移动文件夹：${src} => ${dest}`)
    } catch (err) {
        console.error(`移动失败：${src} => ${dest}`)
    }
}

/**
 * 递归删除，同 rm -rf
 * @param {string} filePath 
 */
export async function deleteFile(filePath) {
    if (filePath === '/' || filePath === '.') {
        throw new Error('Error Delete Path')
    }
    if (await checkExist(filePath)) {
        await fsAsync.rm(filePath, { recursive: true, force: true })
    }
}

/**
 * 递归删除空文件夹
 * @param {string} folderPath 
 */
export async function deleteEmptyFolders(folderPath) {
    if (!await checkExist(folderPath)) {
        console.error(`路径不存在：${folderPath}`)
        return false
    }

    const items = await fsAsync.readdir(folderPath, {withFileTypes: true, recursive: false})
    if (items.length === 0) {
        console.info(`删除空文件夹：${folderPath}`)
        await deleteFile(folderPath)
    } else {
        for (const item of items) {
            if (item.isDirectory()) {
                const fullPath = join(folderPath, item.name)
                await deleteEmptyFolders(fullPath)
            }
        }
    }
    return true
}

/**
 * 递归获取所有文件（不包括文件夹）,返回文件路径
 * @param {string} folderPath 
 */
export async function findAllFiles(folderPath) {
    const items = await fsAsync.readdir(folderPath, {withFileTypes: true, recursive: true})
    return items.filter(item => item.isFile())
        .map(item => join(item.parentPath, item.name))
}

/** 异步检查文件夹是否存在 */
export async function checkExist(dirPath) {
    try {
        // 使用 fs.promises.access() 方法来检查文件夹是否存在
        await fsAsync.access(dirPath);
        // 如果没有抛出异常，说明文件夹存在
        // console.log(`文件夹 ${dirPath} 存在。`);
        return true;
    } catch (error) {
        // 如果抛出异常，说明文件夹不存在
        if (error.code === 'ENOENT') {
            // console.log(`${dirPath} 不存在。`);
            return false;
        } else {
            // 其他错误，打印错误信息
            console.error(`发生错误: ${error.message}`);
            throw error;
        }
    }
}

/**
 * 递归寻找文件夹中的所有图片，返回路径数组
 * @param {string} filePath 
 */
export async function findAllImages(filePath) {
    // 正则表达式末尾的 i 表名匹配是忽略大小写
    const isImageFile = filename => /\.(jpg|jpeg|png|gif)$/i.test(filename);
    return findFiles(filePath, isImageFile)
}

/**
 * 递归寻找所有匹配的文件，返回路径数组
 * @param {string} filePath
 * @param {(filename: string) => boolean | RegExp} matchFunc 匹配函数 或者 正则表达式
 */
export async function findFiles(filePath, matchFunc) {
    try {
        const stats = await fsAsync.stat(filePath)
        if (!stats.isDirectory()) {
            throw new Error(`findFiles 参数不是合法的文件夹 filePath ：${filePath}`)
        }
    } catch (error) {
        throw new Error(`findFiles 参数不是合法的文件夹 filePath ：${filePath}\n` + error.message)
    }

    // 正则表达式末尾的 i 表名匹配是忽略大小写
    /**
     * 匹配函数
     * @type {(filename: string) => boolean}
     */
    let match
    if (matchFunc instanceof RegExp) {
        match = filename => matchFunc.test(filename);
    } else if (typeof matchFunc === 'function') {
        match = matchFunc
    } else {
        throw new Error(`findFiles 错误的匹配规则`)
    }

    /**
     * @type {string[]}
     */
    const images = []

    const find = async currentDir => {
        const entries = await fsAsync.readdir(currentDir, { withFileTypes: true })
        const promises = [];

        for (const entry of entries) {
            const entryPath = join(currentDir, entry.name)
            if (entry.isDirectory()) {
                promises.push(find(entryPath))
            } else if (entry.isFile() && match(entry.name)) {
                images.push(entryPath)
            }
        }

        await Promise.all(promises)
    }

    await find(filePath)
    return images;
}

/**
 * 返回文件大小字符串
 * @param {Uint8Array | string} file 
 */
export async function getSizeString(file) {
    const bytes = await getSize(file)
    return sizeToString(bytes);
}

/**
 * 返回文件的体积, 可传入文件路径或者buffer, 返回字节
 * @param {Uint8Array | string} file 
 * @returns {number}
 */
export async function getSize(file) {
    if (typeof file === 'string') {
        file = await fsAsync.readFile(file)
    }
    return file.length;
}

/**
 * 将字节转换成文件大小字符串
 * @param {number} bytes 
 * @returns 
 */
export function sizeToString(bytes) {
    if (bytes < 0) {
        bytes = Math.abs(bytes)
    }
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) {
        return `${kilobytes.toFixed(2)} KB`
    }
    const megabytes = kilobytes / 1024;
    return `${megabytes.toFixed(2)} MB`
}

/**
 * 写入文件，自动创建路径
 * @param {string} filePath 
 * @param {string} content 
 * @param {string} encoding 
 */
export async function writeFile(filePath, content, encoding = 'utf-8') {
    if (!await checkExist(filePath)) {
        await fsAsync.mkdir(dirname(filePath), { recursive: true });
    }
    await fsAsync.writeFile(filePath, content, encoding);
}


import { exec, spawn } from 'child_process'

/**
 * 异步执行命令行
 * @param {string} command 命令
 * @param {string} cwd 命令执行路径，选填
 * @param {boolean} showLog 显示command，默认true
 * @returns {Promise<string>} 输出文本
 */
export function execAsync(command, cwd, showLog) {
    console.info(`% ${command} (cwd: ${cwd})`)
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                console.error(stderr)
                reject(stderr)
            } else {
                if (showLog !== false) {
                    console.log(stdout)
                }
                resolve(stdout)
            }
        })
    })
}

/**
 * 异步执行命令行, spawn 版 \
 * 若报错 ENOENT，可以再 cmd 中使用 `where 命令` 来查看可执行文件后缀是不是 exe，请补全后缀，或者设置 `options.shell` true
 * @param {string} command 命令
 * @param {string[]} args 参数数组
 * @param {import('child_process').SpawnOptionsWithoutStdio} options 命令执行参数，可配置 cwd、shell等
 * @param {boolean} showLog 显示命令行输出，默认true
 * @returns {Promise<string>} 输出文本
 */
export function spawnAsync(command, args, options, showLog) {
    console.info(`% ${command} ${args ? args.join(' ') : ''}`)
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, options)
        process.on("error", (err) => {
            console.error(`Error 无法执行 ${command}: ${err.message}`);
        });
        process.stdout.on('data', msg => {
            if (showLog !== false) {
                console.log(`${msg.toString().trim()}`)
            }
        })
        process.stderr.on('data', msg => {
            console.error(`${msg}`)
        })
        process.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                const errorMessage = `ERROR：${command} 执行失败 code:${code}`
                console.error(errorMessage)
                reject(errorMessage)
            }
        })
    })
}

const terminateCallbacks = []

const onTerminate = async () => {
    for (const callback of terminateCallbacks) {
        await callback()
    }
    process.exit()
}

/**
 * 添加进程结束时执行的回调函数
 * @param {() => Promise<any>} func 
 */
export function addTerminateCallback(func) {
    terminateCallbacks.push(func)
}

process
    .on('SIGINT', () => onTerminate())
    .on('SIGTERM', () => onTerminate())
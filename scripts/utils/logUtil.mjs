import chalk from "chalk"
import readline from 'node:readline/promises'
import { formatDate } from "./dateUtil.mjs"
/**
 * 当前日志等级
 * 可选值：debug < log < info < warn < error
 */
let currentLogLevel = 'log'

const logLevels = {
    debug: 0,
    log: 1,
    info: 2,
    warn: 3,
    error: 4
}

/**
 * 设置日志等级
 * @param {'debug'|'log'|'info'|'warn'|'error'} level 
 */
const setLogLevel = (level) => {
    if (logLevels[level] !== undefined) {
        currentLogLevel = level
    } else {
        console.warn(`[logger] Unknown log level: ${level}`)
    }
}

/**
 * 判断当前等级是否允许打印
 * @param {'debug'|'log'|'info'|'warn'|'error'} level 
 */
const shouldLog = (level) => {
    return logLevels[level] >= logLevels[currentLogLevel]
}

let logTimeFlag = false
/**
 * 是否启用日志时间
 * @param {boolean} value 
 */
const enableLogTime = (value) => {
    logTimeFlag = true
}
const addLogTime = (msgs) => {
    if (logTimeFlag) {
        msgs.unshift(formatDate(new Date()))
    }
}

const log = (...msgs) => {
    if (!shouldLog('log')) return
    addLogTime(msgs)
    console.log(...msgs.map(msg => chalk.white(msg)))
}
const info = (...msgs) => {
    if (!shouldLog('info')) return
    addLogTime(msgs)
    console.log(...msgs.map(msg => chalk.bold.green(msg)))
}
const error = (...msgs) => {
    if (!shouldLog('error')) return
    addLogTime(msgs)
    console.log(...msgs.map(msg => chalk.hex('#ff0000').bold(msg)))
}
const warn = (...msgs) => {
    if (!shouldLog('warn')) return
    addLogTime(msgs)
    console.log(...msgs.map(msg => chalk.hex('#ffcc00').bold(msg)))
}
const debug = (...msgs) => {
    if (!shouldLog('debug')) return
    addLogTime(msgs)
    console.log(...msgs.map(msg => chalk.blueBright(msg)))
}


/**
 * 命令行确认提示
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
const confirm = async (msg) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    const answer = await rl.question(chalk.hex('#ffcc00').bold(`${msg} (Y/N): `))
    const normalizedAnswer = answer.trim().toLowerCase()
    rl.close()
    if (normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
        return true
    } else if (normalizedAnswer === 'n' || normalizedAnswer === 'no') {
        return false
    } else {
        error("Invalid input. Please enter 'Y' or 'N'.")
        return confirm(msg)
    }
}

const logger = {
    log,
    warn,
    error,
    debug,
    info,
    confirm,
    enableLogTime,
    setLogLevel,
}

export default logger
export {
    log,
    warn,
    error,
    debug,
    info,
    confirm,
    enableLogTime,
    setLogLevel,
}

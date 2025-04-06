import { dirname } from 'path'
import { fileURLToPath } from 'url'

/** 脚本所在路径 */
const scriptPath = fileURLToPath(import.meta.url)
/** 工作区路径 */
const projectPath = dirname(dirname(scriptPath))

export {
    projectPath
}
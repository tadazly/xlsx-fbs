import fs from 'fs'
import { projectPath } from './environment.mjs'
import path from 'path'

const templatePath = path.join(projectPath, 'template');
const fbsPath = path.join(templatePath, 'fbs');

const readTemplate = filePath => fs.readFileSync(filePath, 'utf-8');

export const fbsTemplate = readTemplate(path.join(fbsPath, 'fbsTemplate.fbs'));
export const fbsFieldTemplate = readTemplate(path.join(fbsPath, 'fbsFieldTemplate.fbs'));

/**
 * 填充模板
 * @param {string} template 模板
 * @param {Object} data 数据
 * @returns {string} 填充后的模板
 */
export function fillTemplate(template, data) {
    return template.replace(/{{{\s*(\w+)\s*}}}/g, (_, key) => data[key] ?? '');
}

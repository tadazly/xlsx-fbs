import fs from 'fs'
import { projectPath } from './environment.mjs'
import path from 'path'

const templatePath = path.join(projectPath, 'template');
const fbsTemplatePath = path.join(templatePath, 'fbs');

const readTemplate = filePath => fs.readFileSync(filePath, 'utf-8');

export const fbsTemplate = readTemplate(path.join(fbsTemplatePath, 'fbsTemplate.fbs'));
export const fbsFieldTemplate = readTemplate(path.join(fbsTemplatePath, 'fbsFieldTemplate.fbs'));

/**
 * 填充模板
 * @param {string} template 模板
 * @param {Object} data 数据
 * @returns {string} 填充后的模板
 */
export function fillTemplate(template, data) {
    return template.replace(/{{{\s*(\w+)\s*}}}/g, (_, key) => data[key] ?? '');
}

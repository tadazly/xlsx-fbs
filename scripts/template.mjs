import fs from 'fs'
import { projectPath } from './environment.mjs'
import path from 'path'

const templatePath = path.join(projectPath, 'template');
const fbsTemplatePath = path.join(templatePath, 'fbs');
const tsTemplatePath = path.join(templatePath, 'ts');

const templateMap = new Map();
const readTemplate = filePath => {
    if (templateMap.has(filePath)) {
        return templateMap.get(filePath);
    }
    const template = fs.readFileSync(filePath, 'utf-8');
    templateMap.set(filePath, template);
    return template;
}

export const getFbsTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsTemplate.fbs'));
export const getFbsFieldTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsFieldTemplate.fbs'));
export const getTsMainTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsMainTemplate.ts'));
export const getTsImportClassTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsImportClassTemplate.ts'));
export const getTsClassListTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsClassListTemplate.ts'));

/**
 * 填充模板
 * @param {string} template 模板
 * @param {Object} data 数据
 * @returns {string} 填充后的模板
 */
export function fillTemplate(template, data) {
    return template.replace(/{{{\s*(\w+)\s*}}}/g, (_, key) => data[key] ?? '');
}

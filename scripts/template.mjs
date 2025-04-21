import fs from 'fs'
import { projectPath } from './environment.mjs'
import path from 'path'

const templatePath = path.join(projectPath, 'template');
const fbsTemplatePath = path.join(templatePath, 'fbs');
const tsTemplatePath = path.join(templatePath, 'ts');
const csharpTemplatePath = path.join(templatePath, 'csharp');
const unityTemplatePath = path.join(templatePath, 'unity');
const templateMap = new Map();
const readTemplate = filePath => {
    if (templateMap.has(filePath)) {
        return templateMap.get(filePath);
    }
    const template = fs.readFileSync(filePath, 'utf-8');
    templateMap.set(filePath, template);
    return template;
}

//#region fbs
export const getFbsTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsTemplate.fbs'));
export const getFbsFieldTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsFieldTemplate.fbs'));
export const getFbsIncludeTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsIncludeTemplate.fbs'));
export const getFbsMergeTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsMergeTemplate.fbs'));
export const getFbsMergeFieldTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsMergeFieldTemplate.fbs'));
export const getFbsStructTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsStructTemplate.fbs'));
export const getFbsStructFieldTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsStructFieldTemplate.fbs'));
export const getFbsEnumTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsEnumTemplate.fbs'));
export const getFbsTableTemplate = () => readTemplate(path.join(fbsTemplatePath, 'fbsTableTemplate.fbs'));
//#endregion

//#region ts
export const getTsMainTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsMainTemplate.ts'));
export const getTsImportClassTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsImportClassTemplate.ts'));
export const getTsClassListTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsClassListTemplate.ts'));
export const getTsConstTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsConstTemplate.ts'));
export const getTsConstFieldTemplate = () => readTemplate(path.join(tsTemplatePath, 'tsConstFieldTemplate.ts'));
//#endregion

//#region csharp
export const getCSharpConstTemplate = () => readTemplate(path.join(csharpTemplatePath, 'csharpConstTemplate.cs'));
export const getCSharpConstFieldTemplate = () => readTemplate(path.join(csharpTemplatePath, 'csharpConstFieldTemplate.cs'));
//#endregion

//#region unity
export const getUnityTableLoaderBaseTemplate = () => readTemplate(path.join(unityTemplatePath, 'unityTableLoaderBaseTemplate.cs'));
export const getUnityTableTemplate = () => readTemplate(path.join(unityTemplatePath, 'unityTableTemplate.cs'));
export const getUnityMergeTableTemplate = () => readTemplate(path.join(unityTemplatePath, 'unityMergeTableTemplate.cs'));
export const getUnityMergeTableLoadTemplate = () => readTemplate(path.join(unityTemplatePath, 'unityMergeTableLoadTemplate.cs'));
export const getUnityMergeTableUnloadTemplate = () => readTemplate(path.join(unityTemplatePath, 'unityMergeTableUnloadTemplate.cs'));
//#endregion

/**
 * 填充模板
 * @param {string} template 模板
 * @param {Object} data 数据
 * @returns {string} 填充后的模板
 */
export function fillTemplate(template, data) {
    return template.replace(/{{{\s*(\w+)\s*}}}/g, (_, key) => data[key] ?? '');
}

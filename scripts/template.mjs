import fs from 'fs'
import { projectPath } from './environment.mjs'
import path from 'path'

const templatePath = path.join(projectPath, 'template');
const fbsPath = path.join(templatePath, 'fbs');

const readTemplate = filePath => fs.readFileSync(filePath, 'utf-8');

export const fbsTemplate = readTemplate(path.join(fbsPath, 'fbsTemplate.fbs'));
export const fbsFieldTemplate = readTemplate(path.join(fbsPath, 'fbsFieldTemplate.fbs'));
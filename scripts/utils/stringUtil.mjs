/**
 * 转换成 lowerCamelCase
 * @param {string} str 
 * @returns {string}
 */
export function toLowerCamelCase(str) {
    return toCamelCase(str);
    // return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * 转换成 UpperCamelCase
 * @param {string} str
 * @returns {string}
 */
export function toUpperCamelCase(str) {
    return toPascalCase(str);
    // return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toCamelCase(input) {
    return input
        .replace(/[-_]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (_, c) => c.toLowerCase());
}

export function toPascalCase(input) {
    return input
        .replace(/[-_]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/**
 * 转换成 snake_case，如 PresentID 会转换成 present_id
 * @param {string} str
 * @returns {string} 
 */
export function toSnakeCase(input) {
    return input
        .replace(/-/g, '_') // kebab-case → snake_case
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase → snake_case
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // HTMLParser → html_parser
        .toLowerCase()
        .replace(/__+/g, '_') // collapse __
        .replace(/^_+|_+$/g, ''); // trim
}

/**
 * 转换成 snake_case 保守版，如 PresentID 会转换成 present_i_d
 * @param {string} str
 * @returns {string} 
 */
export function toSnakeCaseStuffy(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

/**
 * 转换成 kebab-case
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(input) {
    return input
        .replace(/_/g, '-')                              // snake_case → kebab-case
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')          // camelCase → kebab-case
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')        // XMLParser → xml-parser
        .toLowerCase()
        .replace(/--+/g, '-')                            // collapse double dashes
        .replace(/^-|-$/g, '');                          // trim leading/trailing dashes
}

/**
 * 转换成常量风格
 * @param {string} input
 * @returns {string}
 */
export function toConstantStyle(input) {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')  // camelCase → camel_Case
        .replace(/[-\s]+/g, '_')                 // kebab-case / spaces → _
        .replace(/__+/g, '_')                    // 合并多个下划线
        .replace(/[^a-zA-Z0-9_]/g, '')           // 移除非字母数字下划线字符
        .toUpperCase();                          // 转大写
}

export function encodeHtml(str = "") {
    return str.replace(/[&<>\"]/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;"
    })[char]);
}

const RESERVED_KEYWORDS = new Set([
    // JavaScript & TypeScript (ECMAScript)
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
    'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield', 'await', 'let', 'static',

    // C# keywords
    'abstract', 'as', 'base', 'bool', 'byte', 'case', 'catch', 'char', 'checked',
    'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do',
    'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally',
    'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int',
    'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null',
    'object', 'operator', 'out', 'override', 'params', 'private', 'protected',
    'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof',
    'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using',
    'virtual', 'void', 'volatile', 'while',

    // Reserved in FlatBuffers?
    'table', 'struct', 'union', 'namespace', 'attribute', 'include', 'rpc'
]);

/**
 * 检查是否是保留关键字
 * @param {string} name 
 * @param {string} type 
 */
export function checkReservedKeyword(name) {
    if (!name) return false;
    const normalized = name.toLowerCase();
    return RESERVED_KEYWORDS.has(normalized);
}

/**
 * 去掉字符串中的特殊字符
 * @param {string} input 
 * @returns {string}
 * @example
 * normalizeString("狂气⚔️无序✨字段名称") => "狂气_无序_字段名称"
 */
export function normalizeString(input) {
    return input
        .trim()                           // 去掉头尾空格（你那些复制来的字段都带着）
        .replace(/[^\w]+/g, '_')         // 把非字母数字下划线的字符统统换成 _
        .replace(/^_+|_+$/g, '')         // 去掉开头和结尾多余的下划线（你不想看着恶心）
        .replace(/_+/g, '_');            // 连续的 _ 合并成一个
}

/**
 * 规范化字符串为 ASCII 字符
 * @param {string} input 
 * @returns {string}
 * @example
 * normalizeStringToAscii("狂气⚔️无序✨字段名称") => ""
 */
export function normalizeStringToAscii(input) {
    return input
        .normalize("NFKD")                 // 先 Unicode 正规化（处理变音符号那些）
        .replace(/[^\x00-\x7F]/g, '')      // 干掉所有非 ASCII 字符
        .replace(/[^\w]+/g, '_')           // 非字母数字下划线变成 _
        .replace(/^_+|_+$/g, '')           // 去掉开头结尾的 _
        .replace(/_+/g, '_');              // 连续下划线合并
}
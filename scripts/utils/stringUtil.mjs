/**
 * 将 lowerCamelCase 转换成 UpperCamelCase
 * @param {string} str 
 * @returns {string}
 */
export function toLowerCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * 将 UpperCamelCase 转换成 lowerCamelCase 
 * @param {string} str
 * @returns {string}
 */
export function toUpperCamelCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 将 camelCase 转换成 snake_case
 * @param {string} str
 * @returns {string} 
 */
export function toSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
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

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

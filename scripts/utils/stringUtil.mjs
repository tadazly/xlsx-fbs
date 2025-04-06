
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
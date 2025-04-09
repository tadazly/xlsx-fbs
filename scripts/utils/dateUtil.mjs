/**
 * 格式化时间戳为倒计时，日期格式的剩余时间
 * @param {number} timeFlag 
 * @param {string} format 'hh:mm:ss'
 * @returns 
 */
export function countdownFormat(timeFlag, format = 'hh:mm:ss') {
    const s = ~~(timeFlag / 1000);
    const m = ~~(s / 60);
    const h = ~~(m / 60);
    const d = ~~(h / 24);
    const M = ~~(d / 30);
    const y = ~~(d / 360);
    const o = {
        "M+": M % 12, //月份
        "d+": d % 30, //日
        "h+": h % 24, //小时
        "m+": m % 60, //分
        "s+": s % 60, //秒
        "q+": Math.floor((M + 2) / 3), //季度
        "S": timeFlag % 1000 //毫秒
    };
    let Y = (10000 + y) + '';
    Y = Y.slice(1);
    if (/(y+)/.test(format)) format = format.replace(RegExp.$1, Y.substr(4 - RegExp.$1.length));
    for (const k in o)
        if (new RegExp("(" + k + ")").test(format)) format = format.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return format;
}

/**
 * 将字符串格式化成 YYYY-MM-DD hh:mm:ss:SSS
 * @param {Date} date 
 * @returns 
 */
export function formatDate(date) {
    const pad = (num, size = 2) => String(num).padStart(size, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}:${milliseconds}`;
}
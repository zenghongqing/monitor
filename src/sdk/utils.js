import { ERROR_RUNTIME, LOAD_ERROR_TYPE, ERROR_REJECTION } from './monitor/constant'
/**
 * merge
 *
 * @param  {Object} src
 * @param  {Object} dest
 * @return {Object}
 */
export function merge (dest, src) {
    for (var item in src) {
        dest[item] = src[item]
    }

    return dest
}

export function isOBJ (obj) {
    var type = typeof obj;
    return type === "object" && !!obj;
}
  
export function formatRuntimerError (message, filename, lineno, colno, error) {
    return {
        type: ERROR_RUNTIME,
        msg: message + 'at ' + filename + ':' + lineno + ':' + colno,
        stack: error && error.stack ? error.stack : 'no stack'
    }
}
/**
 * 生成 load 错误日志
 *
 * @param  {Object} errorTarget
 * @return {Object}
 */
export function formatLoadError (errorTarget) {
    return {
        type: LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()],
        msg: errorTarget.baseURI + '@' + (errorTarget.src || errorTarget.href),
        stack: 'no stack'
    }
}

export function formatRejectionError (event) {
    return {
        type: ERROR_REJECTION,
        msg: `Unhandled Rejection at:' + ${event.promise}, +'reason: + ${event.reason}`,
        stack: 'no stack'
    }
}


/* eslint-disable */
// 定义的错误类型码
var ERROR_RUNTIME = 1
var ERROR_SCRIPT = 2
var ERROR_STYLE = 3
var ERROR_IMAGE = 4
var ERROR_AUDIO = 5
var ERROR_VIDEO = 6
var ERROR_CONSOLE = 7
var ERROR_TRY_CATHC = 8

exports.ERROR_RUNTIME = 1
exports.ERROR_SCRIPT = 2
exports.ERROR_STYLE = 3
exports.ERROR_IMAGE = 4
exports.ERROR_AUDIO = 5
exports.ERROR_VIDEO = 6
exports.ERROR_CONSOLE = 7
exports.ERROR_TRY_CATHC = 8

exports.ERROR_REJECTION = 9

exports.LOAD_ERROR_TYPE = {
  SCRIPT: ERROR_SCRIPT,
  LINK: ERROR_STYLE,
  IMG: ERROR_IMAGE,
  AUDIO: ERROR_AUDIO,
  VIDEO: ERROR_VIDEO
}

exports.ERROR_AJAX = 10

exports.PERFORMANCE_BLANK = 11

exports.PERFORMANCE_LONGTASK = 12

exports.PERFORMANCE_TIMING = 13

exports.MAX_LONG_TASK_PER_PAGE = 50
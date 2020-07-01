// import _ from 'lodash'
import { merge, isOBJ,
  formatRuntimerError,
  formatLoadError,
  formatRejectionError
} from './utils'
import { LOAD_ERROR_TYPE,
  ERROR_AJAX,
  PERFORMANCE_BLANK,
  PERFORMANCE_LONGTASK,
  PERFORMANCE_TIMING,
  MAX_LONG_TASK_PER_PAGE } from './monitor/constant'
import getLastAction from './monitor/getLastAction'
import genSelector from './monitor/genSelector'
import onload from './monitor/onload'
import requestIdleCallback from './monitor/requestIdleCallback'
// 定义JS_TRACKER错误类型码
// const JS_TRACKER_ERROR_CONSTANT_MAP = {
//   1: 'ERROR_RUNTIME',
//   2: 'ERROR_SCRIPT',
//   3: 'ERROR_STYLE',
//   4: 'ERROR_IMAGE',
//   5: 'ERROR_AUDIO',
//   6: 'ERROR_VIDEO',
//   7: 'ERROR_CONSOLE',
//   8: 'ERROR_TRY_CATCH'
// }
// 上传服务器地址
const userId = 1543200280;
const userName = 'mason'
// function report (logInfo) {
//   const img = new window.Image()
//   img.src = `${feeTarget}?d=${encodeURIComponent(JSON.stringify(logInfo))}`
// }
/**
 * 设置一个采样率，决定是否上报
 *
 * @param  {Number} sampling 0 - 1
 * @return {Boolean}
 */
function needReport (sampling) {
  return Math.random() < (sampling || 1)
}

class MONITOR {
  constructor (opts) {
    this.config = merge({
        concat: true,
        // 异常报错数量限制
        maxError: 5,
        sampling: 1, // 采样率
        repeat: 5, // 重复上报次数(对于同一个错误超过多少次不上报)
        ti: document.title.replace(/(^\s+)|(\s+$)/g, ""),
        url: location.href,
        ts: Date.now(),
        user: userId + '@' + userName,
        env: process.env.NODE_ENV || 'production',
        reportUrl: 'cn-hangzhou.log.aliyuncs.com'
    }, opts)
    this.errorList = []
    this._log_map = {}
    this._lastLongTaskSelList = []
    this.injectJsError()
    this.injectHandleReject()
    this.injectXhrHook()
    this.injectBlankHook()
    this.injectLongTaskHook()
    this.injectTimingHook()
  }
  report () {
    if (this.errorList.length === 0) return
    let temp = {}
    let data = this.errorList.map(item => {
      temp = {
        ...item
      }
      Object.keys(temp).forEach(k => {
        temp[k] = String(temp[k])
      })
      return temp
    })
    console.log(this.errorList.length, '错误队列长度')
    // 图片打点
    const img = new window.Image()
    img.src = `${this.config.reportUrl}?d=${encodeURIComponent(JSON.stringify(data))}`
    this.errorList = []
  }
  injectJsError () {
    let that = this
    window.addEventListener('error', function (event) {
      // 过滤 target 为 window 的异常，避免与上面的 onerror 重复
      var errorTarget = event.target
      console.log(event.target, errorTarget.nodeName, '---------')
      if (errorTarget !== window && errorTarget.nodeName && LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()]) {
        that.handleError(formatLoadError(errorTarget))
      } else {
        // onerror会被覆盖, 因此转为使用Listener进行监控
        let { message, filename, lineno, colno, error } = event
        that.handleError(formatRuntimerError(message, filename, lineno, colno, error))
      }
    }, true)
  }
  injectHandleReject () {
    let that = this
      //监听开发中浏览器中捕获到未处理的Promise错误
      window.addEventListener('unhandledrejection', function (event) {
        console.log('Unhandled Rejection at:', event.promise, 'reason:', event.reason);
        that.handleError(formatRejectionError(event))
      }, true)
  }
  isRepeat (error) {
    if (!isOBJ(error)) return true;
    var msg = error.msg;
    var times = this._log_map[msg] = (parseInt(this._log_map[msg], 10) || 0) + 1;
    return times > this.config.repeat;
}
  /**
 * 往异常信息数组里面添加一条记录
 *
 * @param  {Object} errorLog 错误日志
 */
  pushError (errorLog) {
    if (needReport(this.config.sampling) && this.errorList.length < this.config.maxError) {
      this.errorList.push(errorLog)
    }
  }
  handleError (errorLog) {
    if (this.isRepeat(errorLog)) return
    // 是否延时处理
    if (!this.config.concat) {
      !needReport(this.config.sampling) || this.report([errorLog])
    } else {
      this.pushError(errorLog)
      this.report(this.errorList)
    }
  }
  injectXhrHook () {
    if (!window.XMLHttpRequest || !window.addEventListener) return
      let send = XMLHttpRequest.prototype.send,
      open = XMLHttpRequest.prototype.open,
      that = this,
      url
      XMLHttpRequest.prototype.open = function (method, url0, ...args) {
        url = url0 || ''
        return open.apply(this, [method, url].concat(args))
      }
      XMLHttpRequest.prototype.send = function (...args) {
        let xhr = this
        this.addEventListener('error', function (e) {
          let errorObj = {
            type: ERROR_AJAX,
            msg: 'ajax failed',
            stack: JSON.stringify({
              status: e.target.status,
              statusText: e.target.statusText
            }),
            native: e
          }
          that.handleError(errorObj)
        })
        this.addEventListener('readystatechange', function (e) {
          if (xhr.readyState === 4) {
            if (xhr.status >= 400) {
              let errorObj = {
                type: ERROR_AJAX,
                msg: JSON.stringify({
                  code: xhr.status,
                  msg: xhr.statusText,
                  url
                }),
                stack: 'no stack',
                native: e
              }
              that.handleError(errorObj)
            }
          }
        })
        return send.apply(xhr, args)
      }
  }
  /**
   * 检查页面白屏，横向，纵向18个点， > 17/18就认为白屏上报
   */
  injectBlankHook () {
    if (!document.elementFromPoint) {
      return
    }
    const wrapperCls = ['body', 'html']
    let nothingCnt = 0, totalCnt = 0
    const getSel = (el) => {
      if (!el) return ''
      return (el.classList && el.classList[0]) || el.id || el.localName
    }
    const isWrap = (el) => {
      if (!el) return
      totalCnt++
      if (wrapperCls.indexOf(getSel(el)) >= 0) {
        nothingCnt++
      }
    }
    let elementsX, elementsY
    for (let i = 1; i < 10; i++) {
        elementsX = document.elementsFromPoint(window.innerWidth * i / 10, window.innerHeight / 2)
        elementsY = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight * i / 10)
        isWrap(elementsX[0])
        isWrap(elementsY[0])
    }
    if (totalCnt - nothingCnt < 2 && !this._sendBlank) {
      let centerEl = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2)
      this.handleError({
        type: PERFORMANCE_BLANK,
        msg: `blank ratio is ${nothingCnt}/${totalCnt}`,
        elem: getSel(centerEl[0]),
        screen: `${window.screen.width}x${window.screen.height}`,
        inner: `${window.innerWidth}x${window.innerHeight}`
      })
    }
  }
  injectLongTaskHook () {
    if (!window.PerformanceLongTaskTiming) {
      return
    }
    this._lastLongTaskSelList = []
    let observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.duration > 100 && this._lastLongTaskSelList.length < MAX_LONG_TASK_PER_PAGE) {
          let e = getLastAction()
          requestIdleCallback(() => {
            // 最后操作的节点的CSS选择器
            let sel = e ? genSelector(e.path || e.target) : ''
            // 页面同一个sel 只发送一次
            if (this._lastLongTaskSelList.indexOf(sel) < 0) {
              this.handleError({
                type: PERFORMANCE_LONGTASK,
                elem: sel,
                msg: `start time is ${entry.startTime}, duration is ${entry.duration}`
              })
            }
          })
        }
      })
      if (this._lastLongTaskSelList.length >= MAX_LONG_TASK_PER_PAGE) {
        observer.disconnect()
      }
    })
    observer.observe({entryTypes: ['longtask']})
  }
  /**
   * performance.timing 
    DNS查询耗时: domainLookupEnd - domainLookupStart
    t3 - TCP建连耗时: connectEnd - connectStart
    d1 - Request请求耗时: responseStart - requestStart
    d2 - Response响应耗时: responseEnd - responseStart
    d3 - DOM解析渲染耗时:（双击可下钻查看细分阶段耗时）domComplete(loadEventStart) - domLoading
    DOM解析耗时: domComplete(loadEventStart) - domContentLoaded
    d4: domready事件回调耗时: domContentLoadedEventEnd-domContentLoadedEventStart
    d5: onload时间: loadEventStart-fetchStart

    element timing: https://chromestatus.com/features/6230814637424640, env: chrome>= 77
    first-input: https://www.chromestatus.com/features/5149663191629824, env: chrome>= 77
    first-paint, env: chrome>= 60
  */
  injectTimingHook () {
    let that = this
    onload(function () {
      let timer = setTimeout(() => {
        const { fetchStart, connectEnd, connectStart, requestStart, responseEnd, responseStart,
          loadEventStart, domLoading, domContentLoadedEventEnd,
          domContentLoadedEventStart } = performance.timing
          const FP = performance.getEntriesByName('first-paint')[0]
          const FCP = performance.getEntriesByName('first-contentful-paint')[0]
          that.handleError({
            type: PERFORMANCE_TIMING,
            msg: JSON.stringify({
              connect: connectEnd - connectStart,
              response: responseEnd - responseStart,
              request: responseStart - requestStart,
              renderTime: loadEventStart - domLoading,
              domReady: domContentLoadedEventEnd - domContentLoadedEventStart,
              loadTime: loadEventStart - fetchStart,
              FCPTime: FCP.startTime || 0,
              FPTime: FP.startTime || 0
            }),
            stack: 'no stack'
          })
        clearTimeout(timer)
      }, 3000)
    })
  }
}

export default MONITOR
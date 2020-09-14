# monitor
1. 什么要做前端监控系统？
* 为了能在用户侧发现问题前解决问题
* 监控前端异常，获得异常日志信息
* 获得前端性能参数，对前端性能进行分析，并进行优化
* 获取用户的行为数据并进行分析

2. 前端监控系统的设计方案 （主要是前端SDK的设计）
经验：先写使用文档或者入门技巧的教程，再去通过编码实现对应的API
* 使用开源框架sentry的sdk(raven.js)，进行二次封装，后台自己开发

* 重开开发一套自己的sdk
(1) 运行时JS异常以及资源加载错误
```
// 监听 JavaScript 报错异常(JavaScript runtime error)
  // window.onerror = function () {
  //   if (window.ignoreError) {
  //     window.ignoreError = false
  //     return
  //   }
  //   handleError(formatRuntimerError.apply(null, arguments))
  // }
// 监听资源加载错误(JavaScript Scource failed to load)
  window.addEventListener('error', function (event) {
    // 过滤 target 为 window 的异常，避免与上面的 onerror 重复
    var errorTarget = event.target;

    if (errorTarget !== window && errorTarget.nodeName && LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()]) {
      handleError(formatLoadError(errorTarget));
    } else {
      // onerror会被覆盖, 因此转为使用Listener进行监控
      var message = event.message,
          filename = event.filename,
          lineno = event.lineno,
          colno = event.colno,
          error = event.error;
      handleError(formatRuntimerError(message, filename, lineno, colno, error));
    }
  }, true); //监听开发中浏览器中捕获到未处理的Promise错误
```
跨域的问题无法拦截错误，在载入的时候对标签做特殊限制就行了，这个不强制，很多人会遇到这个坑，解决办法就是加入crossorigin属性，大部分的公司CDN也都支持配置Access-Control-Allow-Origin，所以问题并不大，默认配置跨域获取不到详细错误信息的错误，会直接忽略。
(2) 捕获未处理的promise reject错误
```
 window.addEventListener('unhandledrejection', function (event) {
    console.log('Unhandled Rejection at:', event.promise, 'reason:', event.reason);
    handleError(event);
  }, true);
```
(3) 网络请求异常监控
```
var oldXMLHttpRequest = window.XMLHttpRequest;

window.XMLHttpRequest = function XMLHttpRequest(props) {
    var xhr = new oldXMLHttpRequest(props)
    var send = xhr.send,
        open = xhr.open,
        begin,
        url;
    var isFEDLOG;

    xhr.open = function (method0, url0) {
        var args = (arguments.length === 1) ? [arguments[0]] : Array.apply(null, arguments);
        open.apply(xhr, args);
        url = url0 || '';

        if (url.match('logstores')) {
            isFEDLOG = true;
        }
    };

    xhr.send = function (data) {
        begin = Date.now();
        send.apply(xhr, arguments);
    };

    xhr.addEventListener('readystatechange', function (e) {
        // FEDLOG请求排除
        if (isFEDLOG) {
            return;
        }
        if (!url || xhr.readyState !== 4) return;
        var time = Date.now() - begin;
        var status = xhr.status;
        var res = {};
        // getResponseHeader只能拿到部分w3c认为安全的响应头(Cache-Control、Content-Language、Content-Type、Expires、Last-Modified、Pragma)，或者由业务在响应头里增加“Access-Control-Expose-Headers: x-eagleeye-id”
        var traceId;
        try {
            // 不判断浏览器会报Refused to get unsafe header "eagleeye-traceid"
            var resHeaders = xhr.getAllResponseHeaders();
            if (resHeaders.indexOf('traceId') !== -1) {
                traceId = xhr.getResponseHeader('traceId');
            }
        } catch (ex) { }
        if (!xhr.responseType || xhr.responseType === 'text') {
            res = parseResponse.parseResponse(xhr.responseText, status);
            responseData(res, url, time, status, traceId);
        } else if (xhr.responseType === 'blob') {
            var reader = new FileReader()
            reader.readAsText.apply(reader, [xhr.response]);
            reader.onloadend = function () {
                res = parseResponse.parseResponse(reader.result, status);
                responseData(res, url, time, status, traceId);
            }
        }
    });

    return xhr;
};
```
(4) 代理监控
先保存已有函数，然后对函数的参数做检测，再递归调用拦截方法，最后执行的时候，try catch住这个函数执行的过程，再自动上报
```
console.error = function (origin) {
    return function (info) {
      var errorLog = {
        type: ERROR_CONSOLE,
        desc: info
      };
      handleError(errorLog);
      origin.call(console, info);
    };
  }(console.error);
```
(5) 上报策略
* 通过GET/HEAD/POST请求方式把数据传输到服务器
存在的问题：跨域
优点：方法通用，能上传较大的数据量

* 加载图片资源GIF（非JS和CSS，会阻塞页面渲染）的方式
优点：不存在跨域，也不会阻塞页面渲染
缺点：上报数据量较小，有可能会被插入到正在忙碌工作的事件循环中，从而抢占了其他高优先级的任务的资源
```
var logInfo = {
    type: type,
    code: code,
    detail: detailAdapter(code, detail),
    extra: extra,
    common: _objectSpread({}, commonConfig, {
      timestamp: Date.now(),
      runtime_version: commonConfig.version,
      sdk_version: _config.default.version,
      page_type: pageType
    }) // 图片打点

  };
  var img = new window.Image();
  img.src = "".concat(feeTarget, "?d=").concat(encodeURIComponent(JSON.stringify(logInfo)));
```
* 使用信标beacon
```
var data = JSON.stringify({
  name: 'Berwin'
});
navigator.sendBeacon('/haopv', data)
```
参数

url：上报的目标地址
data：被上报的数据
返回值（Return Value）：sendBeacon方法被执行后返回一个布尔值，true代表用户代理成功地将信标请求加入到队列中，否则返回false。
用户代理对通过信标发送的数据量进行限制，以确保请求被成功传递到服务端，并且对浏览器活动的影响降到最小。如果要排队的数据量超出了用户代理的限制，sendBeacon方法将返回false，返回true代表浏览器已将数据排队等待传递。然而，由于实际数据传输是异步的，所以此方法不提供任何关于数据传输是否成功的信息。
虽然信标得到了很高的支持度，但还是无法在所有浏览器中使用，所以如果您想使用信标上报前端日志，一些特征检测是必要的。

还有一个需要注意的是，通过信标发送的请求，请求方法均为POST，且不支持修改。
上报时同时触发多个错误时，把错误进行合并上报
```
/**
 * 往异常信息数组里面添加一条记录, 异常上报数量限制
 *
 * @param  {Object} errorLog 错误日志
 */
function pushError(errorLog) {
  if (needReport(config.sampling) && errorList.length < config.maxError) {
    errorList.push(errorLog);
  }
}
```
对于重复上报的处理
```
// _config.repeat: 重复上报次数(对于同一个错误超过多少次不上报)
isRepeat: function(error) {
    if (!T.isOBJ(error)) return true;
    var msg = error.msg;
    var times = _log_map[msg] = (parseInt(_log_map[msg], 10) || 0) + 1;
    return times > _config.repeat;
}
```
是否进行延时处理错误,或者在浏览器空闲时进行上报
```
// 防抖处理
report = (0, _util.debounce)(config.report, config.delay, function () {
    errorList = [];
  });
function handleError(errorLog) {
  // 是否延时处理
  if (!config.concat) {
    !needReport(config.sampling) || config.report([errorLog]);
  } else {
    pushError(errorLog);
    report(errorList);
  }
}
/**
 * 宏任务或者空闲时掉用，低优先级
 * @param {*} callback 
 * @param {*} timeout 
 */
export default function(callback, timeout){
    if(window.requestIdleCallback){
        requestIdleCallback(callback, {
            timeout: timeout || 1000
        })   
    }else{
        setTimeout(callback, 0);
    }
}
```
上报采样的频率
```
/**
 * 设置一个采样率，决定是否上报
 *
 * @param  {Number} sampling 0 - 1
 * @return {Boolean}
 */
function needReport(sampling) {
  return Math.random() < (sampling || 1);
}
```
(6) 性能上报
* 卡顿，监控浏览器主进程持续执行时间大于50ms的情况
```
FEDLOG._lastLongtaskSelList = []
    var observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
            if (entry.duration > 100 && FEDLOG._lastLongtaskSelList.length < MAX_LONG_TASK_PER_PAGE) {
                let e = getLastAction();
                requestIdleCallback(() => {
                    // 最后操作的节点的CSS选择器
                    let sel = e ? genSelector(e.path || e.target) : ''
                    // 页面同一个sel 只发送一次
                    if (FEDLOG._lastLongtaskSelList.indexOf(sel) < 0) {
                        FEDLOG.send({
                            t1: 'exp',
                            t2: 'longtask',
                            d1: formatTime(entry.startTime),// 开始时间
                            d2: formatTime(entry.duration),// 持续时间
                            d3: sel
                        });
                        FEDLOG._lastLongtaskSelList.push(sel)
                    }
                });
            }
        });
        if (FEDLOG._lastLongtaskSelList.length >= MAX_LONG_TASK_PER_PAGE) {
            observer.disconnect();
        }
    });
    observer.observe({ entryTypes: ["longtask"] });
```
* 检查页面白屏，横向，纵向18个点， > 17/18就认为白屏上报
```
if (!document.elementsFromPoint) {
    return;
}
const wrapperCls = ['body', 'html']
let nothingCnt = 0
let totalCnt = 0
const getSel = (el) => {
    if (!el) return ''
    return (el.classList && el.classList[0]) || el.id || el.localName
}
const isWrap = (el) => {
    if (!el) return;
    totalCnt++
    if (wrapperCls.indexOf(getSel(el)) >= 0) {
        nothingCnt++
    }
}
let elementsX, elementsY;
for (let i = 1; i < 10; i++) {
    elementsX = document.elementsFromPoint(window.innerWidth * i / 10, window.innerHeight / 2)
    elementsY = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight * i / 10)
    isWrap(elementsX[0])
    isWrap(elementsY[0])
}
if (totalCnt - nothingCnt < 2 && !this._sendBlank) {
    let centerEl = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    this.send({
        t1: 'monitor',
        t2: 'blank',
        d1: getSel(centerEl[0]),
        d2: `${totalCnt}-${nothingCnt}`,
        d3: `${window.screen.width}x${window.screen.height}`,
        d4: `${window.innerWidth}x${window.innerHeight}`
    });
    this._sendBlank = true
}
```
* performance.timing性能参数上报
```
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
function onload (cb) {
    if(document.readyState === 'complete'){
        callback();
    }else{
        window.addEventListener('load', callback);
    }
}
onload(function () {
    let fcpTimer = setTimeout(function () {
        const { fetchStart, connectEnd, connectStart, requestStart, responseEnd, responseStart,
            loadEventStart, domLoading, domContentLoadedEventEnd,
            domContentLoadedEventStart } = performance.timing
        FEDLOG.send({
            t1: 'exp',
            t2: 'timing',
            t3: connectEnd - connectStart,
            d1: responseStart - requestStart,
            d2: responseEnd - responseStart,
            d3: loadEventStart - domLoading,
            d4: domContentLoadedEventEnd - domContentLoadedEventStart,
            d5: loadEventStart - fetchStart
        });

        const FP = performance.getEntriesByName('first-paint')[0]
        const FCP = performance.getEntriesByName('first-contentful-paint')[0]

        FEDLOG.send({
            t1: 'exp',
            t2: 'fp',
            d1: FP ? formatTime(FP.startTime) : 0,
            d2: FCP ? formatTime(FCP.startTime) : 0,
            d3: FMP ? formatTime(FMP.startTime) : 0
        });

        clearTimeout(fcpTimer)
    }, 3e3);
```
* 发送pv埋点
```
let nrtt = 0, net = 0;
var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (connection) {
    nrtt = connection.rtt || 0; // 估算的往返时间
    net = connection.effectiveType || ''; // effectiveType 可取值有 'slow-2g'、'2g'、'3g' 或者 '4g'
}

this.send({
    t1: 'bu',
    t2: 'pv',
    d1: net,
    d2: nrtt,
    d3: `${window.screen.width}x${window.screen.height}`,
    d4: `${window.innerWidth}x${window.innerHeight}`
});
```
(7) 压缩后的单行文件如何定位源码错误
通过在后台上传你的sourceMap，甚至上传你的源代码，选择压缩方式，平台本身就可以帮你产生对应的sourceMap，再通过转换，把单行的行和列转换成源码的行和列就可以了
```
var fs = require('fs');
var sourcemap = require('source-map');
var smc = new sourcemap.SourceMapConsumer(fs.readFileSync('./test.js.map','utf8'));
var ret = smc.originalPositionFor({line:1,column:105});
console.log(ret);
```

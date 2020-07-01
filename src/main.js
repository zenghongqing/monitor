import Vue from 'vue'
import App from './App.vue'
import axios from 'axios'
// import * as Sentry from '@sentry/browser'
Vue.prototype.$http = axios
import './sdk/index'
Vue.config.productionTip = false

// 运行时错误
// setInterval(() => {
//   console.log(a)
// }, 2000)

// reject处理
// Promise.reject(2)
new Vue({
  render: h => h(App),
}).$mount('#app')

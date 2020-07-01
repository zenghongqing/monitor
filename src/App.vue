<template>
  <div id="app">
    <img alt="Vue logo" :src="imgSrc">
    <img src="/static/logo.png" alt="">
    <HelloWorld msg="Welcome to Your Vue.js App"/>
  </div>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'
import imgSrc from './assets/logo.png'
export default {
  name: 'App',
  components: {
    HelloWorld
  },
  created () {
    // 测试检测接口异常
    this.$http.get('https://cnodejs.org/api/v1/topics').then(res => {
      console.log(res, '--------')
    })
  },
  data () {
    return {
      imgSrc
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

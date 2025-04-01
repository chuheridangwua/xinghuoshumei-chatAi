<script setup lang="ts">
import axios from 'axios';
import HelloWorld from '../components/HelloWorld.vue'
var header = {
  'Authorization': 'Bearer app-NnQlkYp2Wb9AQ05zvQPjGcWn'
}
function startToDify(){
  axios.post('http://192.168.79.122:8083/v1/chat-messages',{
    query:"帮我查询一下金钟这个客户的信息",
    user:"ldq",
     "response_mode": "streaming",
     "inputs": {},
  },{headers:{'Authorization': 'Bearer app-NnQlkYp2Wb9AQ05zvQPjGcWn'}})
}
</script>

<template>
  <div>
    <button class="button" @click="startToDify">Dify</button>
    <div class="chatBox">
      <HelloWorld></HelloWorld>
    </div>
  </div>
</template>

<style scoped>
  .button {
    background-color: red;
    color:#fff;
    font-size:26px;
    font-weight:600;
  }
  .chatBox {
    position:absolute;
    bottom:40px;
    left:50%;
    transform:translate(-50%);
    width:80%;

  }
  :deep(.ant-bubble-list) {
    height:700px;
    overflow-y: scroll;
  }
</style> 
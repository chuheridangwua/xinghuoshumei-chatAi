<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'

</script>

<template>
  <div>
    <div class="chatBox">
      <HelloWorld></HelloWorld>
    
    </div>
  </div>
</template>

<style scoped>

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

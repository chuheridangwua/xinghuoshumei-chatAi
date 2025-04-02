<template>
  <div class="chat-sender">
    <t-chat-input v-model="query" :stop-disabled="loading" :textarea-props="{
      placeholder: '请输入消息...',
    }" @send="handleSend" @stop="handleStop">
    </t-chat-input>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop']);

const query = ref('');

const handleSend = (value: string) => {
  if (!value.trim()) return;
  emit('send', value);
};

const handleStop = () => {
  emit('stop');
};
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.chat-sender {
  padding: 0 $comp-margin-xs;
}

.btn {
  color: $font-gray-4;
  border: none;

  &:hover {
    color: $brand-color-6;
    border: none;
    background: none;
  }
}

.btn.t-button {
  height: 32px;
  padding: 0;
}
</style>

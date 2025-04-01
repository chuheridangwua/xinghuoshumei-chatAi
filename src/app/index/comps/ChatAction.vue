<template>
  <t-chat-action class="chat-action" :is-good="isGood" :is-bad="isBad" :content="content"
    :operation-btn="['good', 'bad', 'replay', 'copy']" @operation="handleOperation" />
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isGood: {
    type: Boolean,
    default: false
  },
  isBad: {
    type: Boolean,
    default: false
  },
  content: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['operation']);

const isGood = ref(props.isGood);
const isBad = ref(props.isBad);

const handleOperation = (type, options) => {
  if (type === 'good') {
    isGood.value = !isGood.value;
    isBad.value = false;
    console.log("good");
  } else if (type === 'bad') {
    isBad.value = !isBad.value;
    isGood.value = false;
    console.log("bad");
  } else if (type === 'replay') {
    console.log("replay");
    emit('operation', type, options);
  } else if (type === 'copy') {
    console.log("copy");
  }
};
</script>

<style lang="scss" scoped>

</style>
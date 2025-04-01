<template>
  <Flex vertical gap="middle">
    <Bubble.List
      :roles="roles"
      :style="{ maxHeight: 300 }"
      :items="
        messages.map(({ id, message, status }) => ({
          key: id,
          role: status === 'local' ? 'local' : 'ai',
          content: message,
        }))
      "
    />
    <Sender
      :loading="senderLoading"
      :value="content"
      :onChange="(v) => (content = v)"
      :onSubmit="
        (nextContent) => {
          onRequest(nextContent);
          content = '';
        }
      "
    />
  </Flex>
</template>

<script setup lang="tsx">
import { UserOutlined } from "@ant-design/icons-vue";
import { Flex } from "ant-design-vue";
import { Bubble, Sender, useXAgent, useXChat } from "ant-design-x-vue";
import { ref } from "vue";
import axios from "axios";
defineOptions({ name: "AXUseXChatStream" });

const roles: typeof Bubble.List["roles"] = {
  ai: {
    placement: "start",
    avatar: { icon: <UserOutlined />, style: { background: "#fde3cf" } },
  },
  local: {
    placement: "end",
    avatar: { icon: <UserOutlined />, style: { background: "#87d068" } },
  },
};

const content = ref("");
const senderLoading = ref(false);

// Agent for request
const [agent] = useXAgent({
  request: async ({ message }, { onSuccess, onUpdate }) => {
    senderLoading.value = true;
    axios
      .post(
        "http://192.168.79.122:8083/v1/chat-messages",
        {
          query: message,
          user: "ldq",
          response_mode: "streaming",
          inputs: {"user_token":"bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOiI2NzAzMDY4Njk4MzA0ODUyNTMiLCJyblN0ciI6InJtdUhyeHdaTlFDZ2FkeUJrWE5QekxNNGwzbXBwclpkIiwidXNlcl9pZCI6IjY3MDMwNjg2OTgzMDQ4NTI1MyIsInVzZXJfbmFtZSI6ImxpdWRlcWkiLCJzaW5nbGVMb2dpbiI6MiwiZXhwIjoxNzQzNDU0ODE2Nzg5LCJ0b2tlbiI6ImxvZ2luX3Rva2VuXzY2MDUzOTA0Mjk4NDAwNSJ9.0bfDkDIkJjpp0zuIzJNzRKBBCdQD1hCphXOcpYzlMhI"},
        },
        { headers: { Authorization: "Bearer app-NnQlkYp2Wb9AQ05zvQPjGcWn" } }
      )
      .then((res) => {
        senderLoading.value = false;
        console.log(res);
      });
  },
});

// Chat messages
const { onRequest, messages } = useXChat({
  agent: agent.value,
});

</script>

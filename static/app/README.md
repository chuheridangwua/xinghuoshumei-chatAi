# 聊天应用API使用说明

## 基本流程

1. **初始化会话**
   - 使用`getCurrentConversation()`获取默认会话ID
   - 如果有会话ID，加载历史消息；如果没有，则创建新会话

2. **获取历史消息**
   - 使用`getChatHistory(conversationId)`从服务器获取历史消息
   - 历史消息不再使用本地缓存，每次都从服务器获取最新数据

3. **发送消息**
   - 使用`chatWithModel(messages, callbacks, options)`发送消息
   - 通过`options.conversation_id`参数指定会话ID
   - 通过回调函数`callbacks.onConversationIdChange`获取新创建的会话ID

4. **清空历史记录**
   - 使用`clearChatHistory(conversationId)`清空会话历史
   - 如果提供了会话ID，该函数会删除服务器上的会话
   - 如果没有提供会话ID，则只是重置当前状态

5. **自动重命名**
   - 系统会在对话过程中自动为会话生成名称
   - 在前三轮对话后及之后每5轮对话会自动执行重命名
   - 只有会话名称为空或默认名称时才执行重命名

## 兼容性函数

以下函数仅为保持API兼容性而存在，建议更新代码不再使用这些函数：

1. **saveChatHistory**
   - 不再执行实际操作，始终返回成功
   - 聊天历史现在存储在服务器端，不再需要本地保存

## 示例用法

```javascript
// 页面初始化
async function initChat() {
  // 获取默认会话ID（会话列表第一个或创建新会话）
  this.conversationId = await getCurrentConversation();
  
  // 如果有会话ID，加载历史消息
  if (this.conversationId) {
    const messages = await getChatHistory(this.conversationId);
    this.chatMessages = messages;
  }
}

// 发送消息
async function sendMessage(message) {
  // 创建用户消息并添加到列表
  const userMessage = createUserMessage(message);
  this.chatMessages.push(userMessage);
  
  // 创建AI消息(空的)并添加到列表
  const aiMessage = createAssistantMessage();
  this.chatMessages.push(aiMessage);
  
  // 构建消息历史
  const messages = buildMessageHistory(this.chatMessages, message, this.systemPrompt);
  
  // 回调函数
  const callbacks = {
    // 接收流式消息内容
    onMessage: (text) => {
      aiMessage.content += text;
    },
    
    // 接收思考过程内容
    onReasoning: (text) => {
      aiMessage.reasoning = text;
    },
    
    // 消息接收完成
    onComplete: (success) => {
      // 消息接收完成后的处理
    },
    
    // 接收新创建的会话ID
    onConversationIdChange: (newId) => {
      this.conversationId = newId;
    }
  };
  
  // 发送消息，传入当前会话ID
  await chatWithModel(messages, callbacks, { 
    conversation_id: this.conversationId 
  });
}

// 切换会话
async function switchConversation(conversationId) {
  this.conversationId = conversationId;
  const messages = await getChatHistory(conversationId);
  this.chatMessages = messages;
}

// 创建新会话
function createNewConversation() {
  this.conversationId = '';
  this.chatMessages = [];
}

// 清空历史记录
async function clearHistory() {
  // 删除当前会话
  await clearChatHistory(this.conversationId);
  
  // 重置状态
  this.conversationId = '';
  this.chatMessages = [];
}
```

## 注意事项

1. 不再使用本地存储缓存会话ID和聊天历史
2. 用户ID仍然存储在本地存储中
3. 会话数据完全从服务器获取
4. 通过回调函数和组件状态管理会话ID
5. 清空历史记录会删除服务器上的会话数据
6. `saveChatHistory`函数仅作为兼容层保留，不再实际保存数据 
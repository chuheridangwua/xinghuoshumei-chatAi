// 导入chat.js中的函数
import { 
    ensureUserId, 
    getServerConversations as getConversationList,
    getServerConversationHistory as getConversationHistory 
} from './chat.js';

/**
 * 模型配置
 */
export const modelConfig = {
    'dify-api': {
        instance: {
            baseURL: 'http://192.168.79.122:8083/v1',
            apiKey: 'app-JUQYZhaSvAhw9YtuhOCo66A6',
            dangerouslyAllowBrowser: true
        },
        description: 'Dify API 模型'
    }
};

/**
 * 获取模型实例
 * @returns {Object} 模型实例
 */
export const getModelInstance = () => {
    return modelConfig['dify-api'].instance;
};

/**
 * 发送聊天请求
 * @param {Array} messages - 消息数组
 * @param {Object} options - 其他选项
 * @returns {Promise} 请求Promise
 */
export const sendChatRequest = async (messages, options = {}) => {
    const model = getModelInstance();
    const userId = ensureUserId();

    // 从messages中提取最后一条用户消息作为query
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    const query = lastUserMessage ? lastUserMessage.content : '';
    
    // 获取conversation_id（如果存在）
    const conversation_id = options.conversation_id || '';

    // 创建请求对象
    const requestBody = {
        inputs: {},
        query: query,
        response_mode: "streaming",
        user: userId
    };
    
    // 只有当conversation_id存在时才添加到请求中
    if (conversation_id) {
        requestBody.conversation_id = conversation_id;
    }

    // 创建请求
    const promise = fetch(`${model.baseURL}/chat-messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${model.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: options.signal
    });

    // 如果存在signal，将其附加到promise对象以便后续检查
    if (options.signal) {
        promise.signal = options.signal;
    }

    return promise;
};

/**
 * 处理流式响应
 * @param {Promise} responsePromise - 响应Promise
 * @param {Object} callbacks - 回调函数对象
 */
export const handleStreamResponse = async (responsePromise, callbacks = {}) => {
    const { onMessage, onError, onComplete, onReasoning } = callbacks;

    try {
        const response = await responsePromise;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isInThinkingMode = false; // 追踪是否在思考模式中
        let conversation_id = null; // 存储会话ID

        while (true) {
            // 检查是否请求已被中断（AbortController信号）
            if (responsePromise.signal && responsePromise.signal.aborted) {
                onComplete?.(false, '请求已中断');
                return;
            }

            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }

            // 解码接收到的数据
            buffer += decoder.decode(value, { stream: true });
            
            // 处理缓冲区中的数据行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 最后一行可能不完整，保留到下一次

            for (const line of lines) {
                if (!line.trim() || !line.startsWith('data: ')) continue;
                
                try {
                    const data = JSON.parse(line.substring(6));
                    
                    // 保存会话ID，不使用localStorage
                    if (data.conversation_id && !conversation_id) {
                        conversation_id = data.conversation_id;
                        // 使用回调通知上层组件
                        if (callbacks.onConversationIdChange) {
                            callbacks.onConversationIdChange(conversation_id);
                        }
                    }
                    
                    // 处理Dify API返回格式
                    if (data.event === 'message') {
                        const answer = data.answer || '';
                        
                        // 检查是否包含思考过程
                        if (answer.includes('<think>')) {
                            isInThinkingMode = true;
                            const thinkContent = answer.replace('<think>', '');
                            if (thinkContent.trim()) {
                                onReasoning?.(thinkContent);
                            }
                        } else if (answer.includes('</think>')) {
                            const parts = answer.split('</think>');
                            if (parts[0].trim()) {
                                onReasoning?.(parts[0]);
                            }
                            
                            isInThinkingMode = false;
                            
                            if (parts.length > 1 && parts[1].trim()) {
                                onMessage?.(parts[1]);
                            }
                        } else if (isInThinkingMode) {
                            // 在思考模式中
                            onReasoning?.(answer);
                        } else {
                            // 普通消息内容
                            onMessage?.(answer);
                        }
                    } else if (data.event === 'message_end') {
                        // 消息结束时，只保存消息ID，不直接获取建议问题
                        if (data.message_id && callbacks.onMessageIdChange) {
                            // 通知消息ID变更
                            callbacks.onMessageIdChange(data.message_id);
                        }
                        
                        // 保存任务ID
                        if (data.task_id && callbacks.onTaskIdChange) {
                            callbacks.onTaskIdChange(data.task_id);
                        }
                    }
                } catch (e) {
                    console.error('解析流数据失败:', e);
                }
            }
        }

        onComplete?.(true);
    } catch (error) {
        console.error('流式请求错误:', error);

        // 判断是否是AbortError（请求被中断）
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
            onComplete?.(false, '请求已中断');
        } else {
            onError?.(error.message || '请求失败');
            onComplete?.(false, error.message);
        }
    }
};

/**
 * 封装的请求方法
 * @param {Array} messages - 消息数组
 * @param {Object} callbacks - 回调函数
 * @param {Object} options - 其他选项
 * @returns {Object} 请求结果
 */
export const chatWithModel = async (messages, callbacks = {}, options = {}) => {
    try {
        // 直接使用传入的会话ID
        const conversationId = options.conversation_id || '';
        const requestOptions = {
            ...options,
            conversation_id: conversationId
        };
        
        // 发送请求
        const responsePromise = sendChatRequest(messages, requestOptions);
        await handleStreamResponse(responsePromise, callbacks);
        
        return { success: true };
    } catch (error) {
        console.error('聊天请求错误:', error);
        callbacks.onError?.(error.message || '请求失败');
        callbacks.onComplete?.(false, error.message);
        return { success: false, error };
    }
};

/**
 * 加载系统提示词
 */
export const loadSystemPrompt = async () => {
    try {
        // 使用标准Fetch API替代uni.request
        const response = await fetch('/static/files/prompt-copy.json');
        if (response.ok) {
            const data = await response.json();
            return JSON.stringify(data);
        } else {
            console.error(`加载系统提示词失败: ${response.status}`);
            return {
                role: "您是一个助手",
                tools: { description: "" },
                rules: []
            };
        }
    } catch (error) {
        console.error('加载系统提示词失败:', error);
        return {
            role: "您是一个助手",
            tools: { description: "" },
            rules: []
        };
    }
};

/**
 * 重置对话
 */
export const resetConversation = () => {
    try {
        return true;
    } catch (e) {
        console.error('重置会话出错:', e);
        return false;
    }
};
/**
 * 聊天历史管理和消息处理的公共函数
 */

// 统一的API配置
const MODEL_CONFIG = {
    baseURL: 'http://192.168.79.122:8083/v1',
    apiKey: 'app-JUQYZhaSvAhw9YtuhOCo66A6'
};

/**
 * 确保用户ID存在
 * @returns {String} 用户ID
 */
const ensureUserId = () => {
    let userId = localStorage.getItem('dify_user_id');
    if (!userId) {
        // 生成随机用户ID
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('dify_user_id', userId);
    }
    return userId;
};

/**
 * 获取服务器会话列表
 * @param {Object} options - 选项参数
 * @param {String} options.last_id - 当前页最后面一条记录的ID
 * @param {Number} options.limit - 一次请求返回多少条记录
 * @param {String} options.sort_by - 排序字段
 * @returns {Promise<Array>} 会话列表数组
 */
export const getServerConversations = async (options = {}) => {
    console.log('获取服务器会话列表');
    try {
        const userId = ensureUserId();
        console.log('获取会话列表，用户ID:', userId);
        
        // 构建URL参数
        const url = new URL(`${MODEL_CONFIG.baseURL}/conversations`);
        
        // 添加用户ID，必选参数
        url.searchParams.append('user', userId);
        
        // 添加可选参数
        if (options.last_id) {
            url.searchParams.append('last_id', options.last_id);
        }
        
        if (options.limit) {
            url.searchParams.append('limit', options.limit);
        }
        
        if (options.sort_by) {
            url.searchParams.append('sort_by', options.sort_by);
        }
        
        console.log('请求URL:', url.toString());
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MODEL_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取会话列表失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('会话列表数据:', data);
        
        // 按时间顺序排序会话，最新的在前面
        if (data && Array.isArray(data.data)) {
            data.data.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA;
            });
        }
        
        return data.data || [];
    } catch (error) {
        console.error('获取会话列表失败:', error);
        return [];
    }
};

/**
 * 分析和提取思考内容
 * @param {string} content - 原始消息内容
 * @returns {Object} 包含处理后的内容和思考内容
 */
const extractThinkingContent = (content) => {
    if (!content) return { content: '', reasoning: '' };
    
    // 思考内容标签
    const THINK_START_TAG = '<think>';
    const THINK_END_TAG = '</think>';
    let reasoning = '';
    let processedContent = content;
    
    if (content.includes(THINK_START_TAG) && content.includes(THINK_END_TAG)) {
        try {
            // 尝试提取<think>标签中的内容
            const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch && thinkMatch[1]) {
                reasoning = thinkMatch[1].trim();
            }
            
            // 移除<think>标签及其内容
            processedContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        } catch (error) {
            console.error('提取思考内容时出错:', error);
            // 出错时回退到原始内容
            processedContent = content;
        }
    }
    
    return {
        content: processedContent,
        reasoning: reasoning
    };
};

/**
 * 获取服务器会话历史消息
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 分页选项
 * @returns {Promise<Array>} 会话历史消息数组
 */
export const getServerConversationHistory = async (conversationId, options = {}) => {
    console.log('获取服务器会话历史', conversationId, options);
    try {
        const userId = ensureUserId();
        console.log('获取会话历史, 会话ID:', conversationId, '用户ID:', userId);
        
        const { page = 1, pageSize = 20 } = options;
        
        const url = new URL(`${MODEL_CONFIG.baseURL}/messages`);
        url.searchParams.append('conversation_id', conversationId);
        url.searchParams.append('user', userId);
        url.searchParams.append('page', page);
        url.searchParams.append('page_size', pageSize);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MODEL_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取会话历史失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('会话历史数据:', data);
        
        if (data && data.data && Array.isArray(data.data)) {
            console.log('获取会话历史成功，消息数量:', data.data.length);
            
            // 结果数组，将包含格式化后的消息
            const formattedMessages = [];
            
            // 分析服务器返回的每条消息
            for (const msg of data.data) {
                // 如果有query字段，创建用户消息
                if (msg.query) {
                    formattedMessages.push({
                        avatar: 'https://tdesign.gtimg.com/site/avatar.jpg', // 用户头像
                        name: '自己',
                        datetime: new Date(msg.created_at * 1000).toLocaleString(),
                        content: msg.query,
                        role: 'user',
                        id: msg.id + '_user'
                    });
                }
                
                // 如果有answer字段，创建助手消息
                if (msg.answer) {
                    // 提取思考内容
                    const { content, reasoning } = extractThinkingContent(msg.answer);
                    
                    formattedMessages.push({
                        avatar: 'https://tdesign.gtimg.com/site/chat-avatar.png', // 助手头像
                        name: 'TDesignAI',
                        datetime: new Date(msg.created_at * 1000).toLocaleString(),
                        content: content || '',
                        role: 'assistant',
                        ...(reasoning ? { reasoning } : {}), // 只有有思考内容时才添加
                        id: msg.id + '_assistant'
                    });
                }
            }
            
            // 日志输出消息统计信息
            const userCount = formattedMessages.filter(msg => msg.role === 'user').length;
            const assistantCount = formattedMessages.filter(msg => msg.role === 'assistant').length;
            console.log(`消息统计: 用户消息=${userCount}, 助手消息=${assistantCount}, 总计=${formattedMessages.length}`);
            
            // 后端API是倒序返回的(最新的在前面)，但前端显示需要正序，所以需要反转
            formattedMessages.reverse();
            
            console.log('格式化后的消息:', formattedMessages);
            
            return formattedMessages;
        } else {
            console.log('会话历史为空或格式不正确');
            return [];
        }
    } catch (error) {
        console.error('获取会话历史失败:', error);
        return [];
    }
};

/**
 * 获取聊天历史
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 分页选项
 * @returns {Promise<Array>} 聊天历史数组
 */
export const getChatHistory = async (conversationId, options = {}) => {
    console.log('获取聊天记录');
    
    if (!conversationId) {
        console.log('没有有效的会话ID，无法获取聊天记录');
        return [];
    }
    
    try {
        // 从服务器获取会话历史
        const messages = await getServerConversationHistory(conversationId, options);
        if (messages && messages.length > 0) {
            console.log('获取聊天记录成功', messages.length);
            return messages;
        } else {
            console.log('聊天记录为空');
            return [];
        }
    } catch (err) {
        console.error('获取聊天记录失败:', err);
        return [];
    }
};

/**
 * 构建消息历史用于API请求
 * @param {Array} chatList - 聊天记录
 * @param {string} currentMessage - 当前用户输入的消息
 * @param {string} systemPrompt - 系统提示词
 * @param {number} [messageLimit=10] - 消息数量限制
 * @returns {Array} 格式化后的消息历史
 */
export const buildMessageHistory = (chatList, currentMessage, systemPrompt, messageLimit = 10) => {
    console.log('构建消息历史');
    // 构建消息历史
    let hasSystemPrompt = false;
    let messagesToSend = [];

    // 遍历聊天记录，只添加用户和助手的消息，过滤掉空消息
    for (const item of chatList) {
        // 只考虑角色是用户、助手或系统且内容不为空的消息
        if ((item.role === 'user' || item.role === 'assistant' || item.role === 'system') && item.content.trim() !== '') {
            // 检查是否已经包含系统提示词
            if (item.role === 'system') {
                hasSystemPrompt = true;
            }
            
            messagesToSend.push({
                role: item.role,
                content: item.content
            });
        }
    }

    // 添加当前的用户消息（只添加一次，避免重复）
    if (currentMessage && currentMessage.trim() !== '') {
        // 先检查是否已经添加过当前用户消息
        const lastUserMessageIndex = messagesToSend.findIndex(msg => 
            msg.role === 'user' && msg.content === currentMessage);
        
        if (lastUserMessageIndex === -1) { // 如果没有添加过，才添加
            messagesToSend.push({
                role: 'user',
                content: currentMessage
            });
        }
    }

    // 限制只取最近指定数量条消息
    messagesToSend = messagesToSend.slice(-messageLimit);

    // 如果消息中没有系统提示词，且系统提示词存在，则添加到最前面
    if (!hasSystemPrompt && systemPrompt) {
        messagesToSend.unshift({
            role: 'system',
            content: systemPrompt
        });
    }

    return messagesToSend;
};

/**
 * 滚动聊天窗口到底部
 * @param {Object} chatRef - 聊天容器的引用
 */
export const scrollToBottom = (chatRef) => {
    console.log('执行滚动到底部操作');
    if (chatRef) {
        chatRef.scrollToBottom({
            behavior: 'smooth',
        });
    }
};

/**
 * 创建用户消息对象
 * @param {string} content - 消息内容
 * @returns {Object} 用户消息对象
 */
export const createUserMessage = (content) => {
    return {
        avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
        name: '自己',
        datetime: new Date().toLocaleString(),
        content: content || '',
        role: 'user',
    };
};

/**
 * 创建助手消息对象
 * @param {boolean} isDeepThinking - 是否为深度思考模式
 * @returns {Object} 助手消息对象
 */
export const createAssistantMessage = (isDeepThinking = false) => {
    const baseMessage = {
        avatar: 'https://tdesign.gtimg.com/site/chat-avatar.png',
        name: 'TDesignAI',
        datetime: new Date().toLocaleString(),
        content: '',
        role: 'assistant',
    };

    if (isDeepThinking) {
        return {
            ...baseMessage,
            reasoning: '思考中...'
        };
    }

    return baseMessage;
};

/**
 * 发送聊天请求到 Dify API
 * @param {Array} messages - 消息数组 
 * @param {Object} options - 选项
 * @returns {Promise} 请求结果
 */
export const sendChatRequest = async (messages, options = {}) => {
    const userId = ensureUserId();

    // 从messages中提取最后一条用户消息作为query
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    const query = lastUserMessage ? lastUserMessage.content : '';
    
    // 获取conversation_id（如果存在）
    const conversation_id = options.conversation_id || '';
    
    console.log('发送到Dify API的请求:', {
        query,
        conversation_id,
        user: userId,
        response_mode: "streaming"
    });

    // 创建请求对象
    const requestBody = {
        inputs: {},
        query: query,
        response_mode: "streaming",
        user: userId,
        auto_generate_name: false
    };
    
    // 只有当conversation_id存在时才添加到请求中
    if (conversation_id) {
        requestBody.conversation_id = conversation_id;
    }

    // 创建请求
    const promise = fetch(`${MODEL_CONFIG.baseURL}/chat-messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MODEL_CONFIG.apiKey}`
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
                console.log('请求已被用户中断，停止处理流');
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
                    console.log('收到数据:', data);
                    
                    // 保存会话ID，不使用localStorage缓存
                    if (data.conversation_id && !conversation_id) {
                        conversation_id = data.conversation_id;
                        console.log('捕获到对话ID:', conversation_id);
                        // 触发回调通知上层组件（如果存在）
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
                        console.log('消息完成:', data);
                        
                        // 如果有会话ID，在消息结束时执行自动重命名的检查
                        if (conversation_id) {
                            autoRenameConversationIfNeeded(conversation_id);
                        }
                    }
                } catch (e) {
                    console.error('解析流数据失败:', e, line);
                }
            }
        }

        onComplete?.(true);
    } catch (error) {
        console.error('流式请求错误:', error);

        // 判断是否是AbortError（请求被中断）
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
            console.log('流式请求被用户中断');
            onComplete?.(false, '请求已中断');
        } else {
            onError?.(error.message || '请求失败');
            onComplete?.(false, error.message);
        }
    }
};

/**
 * 自动重命名会话（如果需要）
 * 会在以下情况触发自动重命名：
 * 1. 新对话的前三次对话后
 * 2. 对话消息数量为5、10、15等（每5条消息）时
 * @param {String} conversationId - 会话ID
 */
export const autoRenameConversationIfNeeded = async (conversationId) => {
    try {
        // 获取当前会话的消息数量
        const messages = await getServerConversationHistory(conversationId);
        const messageCount = messages.length;
        
        // 计算用户和助手消息对的数量（一问一答算一轮对话）
        // 由于每个消息都会创建用户和助手两条记录，所以总消息数除以2就是对话轮数
        const conversationTurns = Math.floor(messageCount / 2);
        
        console.log(`当前会话消息数: ${messageCount}, 对话轮数: ${conversationTurns}`);
        
        // 获取当前会话信息，以检查是否已经有自定义名称
        const conversations = await getServerConversations();
        const currentConversation = conversations.find(conv => conv.id === conversationId);
        
        // 判断是否需要执行自动重命名
        // 条件：
        // 1. 会话在前三轮对话后
        // 2. 对话轮数为5、10、15等（每5轮执行一次）
        // 3. 当前会话名称为空或是默认生成的名称
        const needRename = (
            // 新对话的前三轮，或者每5轮对话
            (conversationTurns <= 3 || (conversationTurns >= 5 && conversationTurns % 5 === 0)) &&
            // 会话没有名称或有默认名称
            (!currentConversation || !currentConversation.name || currentConversation.name.startsWith('新对话') || currentConversation.name === 'New conversation')
        );
        
        if (needRename) {
            console.log(`执行自动重命名，当前对话轮数: ${conversationTurns}`);
            
            // 调用重命名API
            await renameConversation(conversationId, { auto_generate: true });
            
            console.log(`自动重命名成功，对话轮数: ${conversationTurns}`);
        } else {
            console.log(`不需要执行自动重命名，当前轮数: ${conversationTurns}`);
            if (currentConversation) {
                console.log(`当前会话名称: "${currentConversation.name}"`);
            }
        }
    } catch (error) {
        console.error('自动重命名失败:', error);
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
        // 使用传入的conversation_id，不再从localStorage获取
        const conversationId = options.conversation_id || '';
        const requestOptions = {
            ...options,
            conversation_id: conversationId
        };
        
        console.log('使用会话ID:', conversationId);
        
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
            // 确保返回的是字符串
            if (typeof data === 'object') {
                return JSON.stringify(data);
            } else if (typeof data === 'string') {
                return data;
            } else {
                console.error(`加载系统提示词失败: 无效的数据格式`);
                return JSON.stringify({
                    role: "您是一个助手",
                    tools: { description: "" },
                    rules: []
                });
            }
        } else {
            console.error(`加载系统提示词失败: ${response.status}`);
            return JSON.stringify({
                role: "您是一个助手",
                tools: { description: "" },
                rules: []
            });
        }
    } catch (error) {
        console.error('加载系统提示词失败:', error);
        return JSON.stringify({
            role: "您是一个助手",
            tools: { description: "" },
            rules: []
        });
    }
};

/**
 * 重置对话
 * 不再需要清除localStorage
 */
export const resetConversation = () => {
    try {
        console.log('会话已重置');
        return true;
    } catch (e) {
        console.error('重置会话出错:', e);
        return false;
    }
};

/**
 * 重命名会话
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 选项
 * @param {String} options.name - 名称，若auto_generate为true时可不传
 * @param {Boolean} options.auto_generate - 是否自动生成标题，默认false
 * @returns {Promise<Object>} 请求结果
 */
export const renameConversation = async (conversationId, options = {}) => {
    const model = MODEL_CONFIG;
    const userId = ensureUserId();
    
    try {
        // 创建请求体
        const requestBody = {
            user: userId
        };
        
        // 添加name或auto_generate
        if (options.auto_generate) {
            requestBody.auto_generate = true;
        } else if (options.name) {
            requestBody.name = options.name;
        }
        
        console.log('重命名会话，请求体:', requestBody);
        
        const response = await fetch(`${model.baseURL}/conversations/${conversationId}/name`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${model.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`重命名会话失败: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('重命名会话成功:', data);
        return data;
    } catch (error) {
        console.error('重命名会话错误:', error);
        throw error;
    }
};

/**
 * 删除会话
 * @param {String} conversationId - 会话ID
 * @returns {Promise<Object>} 请求结果
 */
export const deleteConversation = async (conversationId) => {
    const model = MODEL_CONFIG;
    const userId = ensureUserId();
    
    try {
        // 创建请求体
        const requestBody = {
            user: userId
        };
        
        console.log('删除会话，请求体:', requestBody);
        
        const response = await fetch(`${model.baseURL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${model.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`删除会话失败: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('删除会话成功:', data);
        return data;
    } catch (error) {
        console.error('删除会话错误:', error);
        throw error;
    }
};

/**
 * 获取当前会话或创建新会话
 * 返回会话列表中的第一个会话，如果没有则返回空字符串
 * @returns {Promise<String>} 会话ID
 */
export const getCurrentConversation = async () => {
    try {
        // 获取会话列表
        const conversations = await getServerConversations({ limit: 1 });
        
        // 如果有会话，返回第一个会话的ID
        if (conversations && conversations.length > 0) {
            console.log('使用会话列表中的第一个会话:', conversations[0].id);
            return conversations[0].id;
        }
        
        // 如果没有会话，返回空字符串，表示创建新会话
        console.log('没有现有会话，将创建新会话');
        return '';
    } catch (error) {
        console.error('获取当前会话失败:', error);
        return '';
    }
};

/**
 * 清空聊天历史
 * 在服务端没有直接清空历史的API，此函数仅重置当前状态
 * @param {String} conversationId - 会话ID
 * @returns {Promise<boolean>} 是否清空成功
 */
export const clearChatHistory = async (conversationId) => {
    console.log('清空聊天记录');
    try {
        if (conversationId) {
            // 如果有会话ID，删除该会话
            await deleteConversation(conversationId);
            console.log('已删除会话:', conversationId);
        }
        console.log('聊天记录已清空');
        return true;
    } catch (err) {
        console.error('清空聊天记录失败:', err);
        return false;
    }
};

/**
 * 保存聊天历史到本地（兼容性实现，不再执行实际操作）
 * @param {Array} chatList - 聊天记录数组
 * @returns {Promise<boolean>} 始终返回true
 */
export const saveChatHistory = (chatList) => {
    console.log('保存聊天记录请求已忽略，聊天历史数据现已从服务器获取');
    return Promise.resolve(true);
};
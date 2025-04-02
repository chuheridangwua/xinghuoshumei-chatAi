/**
 * 请求状态管理和中断处理的公共函数
 */

/**
 * 创建请求控制器
 * @returns {Object} 请求控制对象，包含控制器和中断函数
 */
export const createRequestController = () => {
    const controller = new AbortController();
    const signal = controller.signal;
    
    // 创建中断函数
    const abortRequest = () => {
        controller.abort();
    };
    
    return {
        controller,
        signal,
        abortRequest
    };
};

/**
 * 创建超时保护
 * @param {Function} abortFunction - 中断函数
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {number} 超时计时器ID
 */
export const createTimeoutProtection = (abortFunction, timeout = 30000) => {
    return setTimeout(() => {
        if (typeof abortFunction === 'function') {
            abortFunction();
        }
    }, timeout);
};

/**
 * 处理请求中断后的UI状态更新
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象，包含loading和isStreamLoad
 */
export const handleRequestAbort = (lastMessage, stateControls) => {
    const { loading, isStreamLoad } = stateControls;
    
    // 重置加载状态
    if (loading && typeof loading.value !== 'undefined') {
        loading.value = false;
    }
    
    if (isStreamLoad && typeof isStreamLoad.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    // 处理消息状态
    if (lastMessage && lastMessage.role === 'assistant') {
        // 如果消息为空，添加一个提示
        if (!lastMessage.content || lastMessage.content.trim() === '') {
            lastMessage.content = '回复已中断';
        } else if (!lastMessage.content.includes('[已中断]')) {
            lastMessage.content += ' [已中断]';
        }

        // 如果有思考内容并且是"思考中..."，则更新为已中断
        if (lastMessage.reasoning === '思考中...') {
            lastMessage.reasoning = '思考过程已中断';
        } else if (lastMessage.reasoning && !lastMessage.reasoning.includes('已中断')) {
            lastMessage.reasoning += ' [已中断]';
        }
    }
};

/**
 * 处理请求错误
 * @param {Object} error - 错误对象
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象
 * @returns {boolean} 是否为中断错误
 */
export const handleRequestError = (error, lastMessage, stateControls) => {
    const { loading, isStreamLoad } = stateControls;
    const errorMessage = error?.message || error || '请求失败';
    
    // 重置加载状态
    if (loading && typeof loading.value !== 'undefined') {
        loading.value = false;
    }
    
    if (isStreamLoad && typeof isStreamLoad.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    // 检查是否是中断导致的错误
    const isAborted = 
        errorMessage.includes('abort') || 
        errorMessage.includes('中断') || 
        errorMessage.includes('cancel');
    
    if (isAborted) {
        // 处理中断状态
        if (lastMessage) {
            if (!lastMessage.content || lastMessage.content.trim() === '') {
                lastMessage.content = '回复已中断';
            } else if (!lastMessage.content.includes('[已中断]')) {
                lastMessage.content += ' [已中断]';
            }
        }
    } else if (lastMessage) {
        // 处理错误状态
        lastMessage.role = 'error';
        lastMessage.content = errorMessage;
    }
    
    return isAborted;
};

/**
 * 处理请求完成
 * @param {boolean} isOk - 请求是否成功
 * @param {string} msg - 完成消息
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象
 * @param {Object} controllers - 控制器对象
 */
export const handleRequestComplete = (isOk, msg, lastMessage, stateControls, controllers) => {
    const { loading, isStreamLoad } = stateControls || {};
    const { timeoutId, fetchCancel } = controllers || {};
    
    // 清除超时保护
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    // 检查是否是中断导致的完成
    const isAborted = !isOk && (msg && (msg.includes('abort') || msg.includes('中断') || msg.includes('cancel')));
    
    // 确保lastMessage存在再进行操作
    if (lastMessage) {
        if (isAborted) {
            if (!lastMessage.content || lastMessage.content.trim() === '') {
                lastMessage.content = '回复已中断';
            } else if (!lastMessage.content.includes('[已中断]')) {
                lastMessage.content += ' [已中断]';
            }
        } else if (!isOk || !lastMessage.content) {
            lastMessage.role = 'error';
            lastMessage.content = msg || '请求失败';
        } else {
            // 确保最终内容格式正确
            if (lastMessage.reasoning) {
                lastMessage.reasoning = lastMessage.reasoning.trim();
            }
            if (lastMessage.content) {
                lastMessage.content = lastMessage.content.trim();
            }
        }
    }
    
    // 重置状态
    if (isStreamLoad && typeof isStreamLoad?.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    if (loading && typeof loading?.value !== 'undefined') {
        loading.value = false;
    }
    
    // 清空中断函数，防止内存泄漏
    if (fetchCancel && typeof fetchCancel?.value !== 'undefined') {
        fetchCancel.value = null;
    }
};

/**
 * 向服务器发送停止流式响应的请求
 * @param {String} taskId - 任务ID
 * @param {String} userId - 用户ID
 * @returns {Promise<boolean>} 是否成功停止
 */
export const stopStreamResponse = async (taskId, userId) => {
    if (!taskId || !userId) {
        console.error('停止响应失败: taskId或userId不能为空');
        return false;
    }

    try {
        // 使用统一的API配置
        const baseURL = 'http://192.168.79.122:8083/v1';
        const apiKey = 'app-JUQYZhaSvAhw9YtuhOCo66A6';
        
        const response = await fetch(`${baseURL}/chat-messages/${taskId}/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                user: userId
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return true;
        } else {
            console.error('停止响应请求失败:', result);
            return false;
        }
    } catch (error) {
        console.error('停止响应请求错误:', error);
        return false;
    }
}; 
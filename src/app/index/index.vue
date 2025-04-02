<template>
    <div class="app-container">
        <HeaderNav :title="currentConversationTitle" @open-drawer="showConversationDrawer = true"
            @new-conversation="handleNewConversation" />

        <ConversationDrawer v-model:visible="showConversationDrawer" :current-conversation-id="currentConversationId"
            :grouped-conversations="groupedConversations" :has-more-conversations="hasMoreConversations"
            :loading-more-conversations="loadingMoreConversations" @select="handleConversationSelect"
            @new-conversation="handleNewConversation" @load-more="loadMoreConversations" />

        <t-chat class="chat-container" ref="chatRef" layout="both" :clear-history="false" @clear="clearConfirm"
            @scroll="handleScroll">
            <template v-for="(item, index) in chatList" :key="index">
                <chat-item :avatar="item.avatar" :name="item.name" :role="item.role" :datetime="item.datetime"
                    :content="item.content" :reasoning="item.reasoning" :is-first-message="index === 0"
                    :loading="loading" :first-token-received="firstTokenReceived" :is-stream-load="isStreamLoad"
                    :is-good="isGood" :is-bad="isBad"
                    @reasoning-expand-change="(expandValue) => handleChange(expandValue, { index })"
                    @operation="(type, e) => handleOperation(type, { index, e })" />
            </template>
            <template #footer>
                <chat-sender :loading="loading" @send="inputEnter" @stop="onStop" />
            </template>
        </t-chat>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { chatWithModel, loadSystemPrompt, resetConversation } from '/static/app/api/model.js'
import ChatAction from './comps/ChatAction.vue';
import ChatSender from './comps/ChatSender.vue';
import HeaderNav from './comps/HeaderNav.vue';
import ConversationDrawer from './comps/ConversationDrawer.vue';
import ChatItem from './comps/ChatItem.vue';
import {
    getChatHistory,
    saveChatHistory,
    clearChatHistory,
    buildMessageHistory,
    scrollToBottom as scrollChatToBottom,
    createUserMessage,
    createAssistantMessage,
    getServerConversations,
    getServerConversationHistory
} from '/static/app/api/chat.js';
import {
    createRequestController,
    createTimeoutProtection,
    handleRequestAbort,
    handleRequestError,
    handleRequestComplete
} from '/static/app/api/request.js';
import { initTheme, setThemeMode, ThemeMode } from '/static/app/api/theme.js';

// 获取对话显示标题的方法
const getConversationTitle = (conversation, maxLength = 20) => {
    if (!conversation) return '新对话';

    // 尝试使用最近的用户消息作为标题
    if (conversation.last_message && conversation.last_message.trim()) {
        return conversation.last_message.length > maxLength
            ? conversation.last_message.substring(0, maxLength) + '...'
            : conversation.last_message;
    }

    // 如果没有last_message但有name且不是默认名称
    if (conversation.name && conversation.name !== 'New conversation') {
        return conversation.name.length > maxLength
            ? conversation.name.substring(0, maxLength) + '...'
            : conversation.name;
    }

    // 如果没有最近消息，使用ID的一部分
    return `对话 ${conversation.id.substring(0, 8)}...`;
};

const fetchCancel = ref(null); // 用于取消请求的AbortController
const loading = ref(false); // 是否正在加载中
const isStreamLoad = ref(false); // 是否正在流式加载
const isGood = ref(false); // 用户是否点击了"好"评价
const isBad = ref(false); // 用户是否点击了"差"评价
const chatRef = ref(null); // 聊天容器的引用
const firstTokenReceived = ref(false); // 是否已收到第一个token
const chatList = ref([]);
const systemPrompt = ref('');

// 新增变量：会话列表
const conversationList = ref([]);
const currentConversationId = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreMessages = ref(true);
const loadingMore = ref(false);
const scrollTopThreshold = 50; // 滚动到顶部触发阈值

// 添加新的状态变量
const hasMoreConversations = ref(true); // 是否有更多会话可加载
const loadingMoreConversations = ref(false); // 是否正在加载更多会话
const showConversationDrawer = ref(false); // 是否显示对话列表抽屉

onMounted(() => {
    // 初始化主题（默认或者根据系统偏好）
    initTheme();
    // document.documentElement.setAttribute('theme-mode', 'light');
    console.log('页面加载');
    initChatData();
});


// 当前会话标题，优先显示最近一次的用户消息，如果没有则显示会话ID的前8位
const currentConversationTitle = computed(() => {
    const conversation = conversationList.value.find(c => c.id === currentConversationId.value);
    return getConversationTitle(conversation, 15);
});

// 将对话按日期分组：今天、昨天、过去7天、更早
const groupedConversations = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // 初始化分组
    const groups = {
        today: [],
        yesterday: [],
        lastWeek: [],
        older: []
    };

    // 分类每个对话
    conversationList.value.forEach(conversation => {
        // 解析更新时间 - 服务器返回的是Unix时间戳（秒级）
        let updateTime;
        if (conversation.updated_at) {
            // 将秒级时间戳转换为毫秒级
            updateTime = new Date(conversation.updated_at * 1000);
        } else {
            updateTime = new Date(); // 如果没有更新时间，默认为当前时间
        }

        // 只比较日期，不比较时间
        const updateDate = new Date(updateTime);
        updateDate.setHours(0, 0, 0, 0);

        // 调试输出
        console.log(`对话ID: ${conversation.id}, 时间戳: ${conversation.updated_at}, 日期: ${updateDate.toISOString()}`);

        if (updateDate.getTime() === today.getTime()) {
            groups.today.push(conversation);
        } else if (updateDate.getTime() === yesterday.getTime()) {
            groups.yesterday.push(conversation);
        } else if (updateDate.getTime() >= lastWeekStart.getTime()) {
            groups.lastWeek.push(conversation);
        } else {
            groups.older.push(conversation);
        }
    });

    // 调试输出
    console.log('分组结果:', {
        today: groups.today.length,
        yesterday: groups.yesterday.length,
        lastWeek: groups.lastWeek.length,
        older: groups.older.length
    });

    return groups;
});

// 初始化聊天数据
const initChatData = async () => {
    // 获取系统提示词
    try {
        systemPrompt.value = await loadSystemPrompt();
        console.log('系统提示词加载成功');
    } catch (error) {
        console.error('系统提示词加载失败:', error);
    }

    // 获取服务器会话列表
    try {
        // 使用新参数调用，每次加载20条对话
        const serverConversations = await getServerConversations({
            limit: 20,
            sort_by: '-updated_at'
        });
        // 确保返回的数据是数组
        if (serverConversations && Array.isArray(serverConversations)) {
            conversationList.value = serverConversations;
            console.log('服务器会话列表获取成功:', serverConversations);

            // 判断是否还有更多对话可加载
            hasMoreConversations.value = serverConversations.length >= 20;

            // 如果存在会话，加载最近的一个会话
            if (serverConversations.length > 0) {
                currentConversationId.value = serverConversations[0].id;
                await loadConversationHistory(currentConversationId.value);
            } else {
                // 如果没有会话，尝试获取本地聊天记录
                chatList.value = await getChatHistory();
            }
        } else {
            console.error('服务器返回的会话列表数据格式不正确:', serverConversations);
            // 获取本地聊天记录作为备用
            chatList.value = await getChatHistory();
        }
    } catch (error) {
        console.error('获取服务器会话列表失败:', error);
        // 获取本地聊天记录作为备用
        chatList.value = await getChatHistory();
    }
};

// 加载特定对话的历史消息
const loadConversationHistory = async (conversationId, resetPage = true) => {
    console.log('加载对话历史消息:', conversationId);
    if (!conversationId) {
        console.error('会话ID为空，无法加载历史消息');
        return false;
    }

    try {
        // 显示加载状态
        loadingMore.value = resetPage ? false : true;

        // 重置分页或使用现有分页
        if (resetPage) {
            currentPage.value = 1;
            hasMoreMessages.value = true;
            chatList.value = []; // 清空现有消息
        }

        const options = {
            page: currentPage.value,
            pageSize: pageSize.value
        };

        console.log('请求服务器历史消息，参数:', options);
        const historyMessages = await getServerConversationHistory(conversationId, options);
        console.log('获取历史消息成功，消息数量:', historyMessages.length);

        // 检查每条消息的角色
        historyMessages.forEach((msg, idx) => {
            console.log(`消息 ${idx + 1}: 角色=${msg.role}, 内容=${msg.content && msg.content.substring(0, 30)}...`);
        });

        if (historyMessages.length > 0) {
            // 如果是重置，直接设置为新消息
            if (resetPage) {
                chatList.value = historyMessages;
                console.log('重置聊天列表，设置为新消息');
            } else {
                // 否则追加到现有消息的前面
                chatList.value = [...historyMessages, ...chatList.value];
                console.log('追加历史消息到现有列表前面');
            }

            // 判断是否还有更多消息
            hasMoreMessages.value = historyMessages.length >= pageSize.value;
            console.log('是否还有更多消息:', hasMoreMessages.value);
        } else {
            if (resetPage) {
                chatList.value = []; // 没有消息，清空列表
                console.log('没有历史消息，清空列表');
            }
            hasMoreMessages.value = false;
            console.log('没有更多消息可加载');
        }

        // 存储当前会话ID到缓存
        localStorage.setItem('dify_conversation_id', conversationId);

        // 保存到本地缓存
        if (chatList.value && Array.isArray(chatList.value) && chatList.value.length > 0) {
            await saveChatHistory(chatList.value);
            console.log('历史消息已保存到本地');
        }

        return true;
    } catch (error) {
        console.error('加载对话历史消息失败:', error);
        // 出错时重置加载状态
        hasMoreMessages.value = false;
        if (resetPage) {
            chatList.value = []; // 出错时清空列表
        }
        return false;
    } finally {
        // 无论成功失败都重置加载状态
        loadingMore.value = false;
    }
};

// 处理对话选择
const handleConversationSelect = async (option) => {
    console.log('选择对话:', option);
    const value = option.value;

    // 处理删除选项
    if (typeof value === 'string' && value.startsWith('delete-')) {
        const conversationId = value.substring(7); // 去掉"delete-"前缀
        console.log('删除对话:', conversationId);

        // TODO: 调用API删除对话
        // 暂时从列表中移除
        conversationList.value = conversationList.value.filter(c => c.id !== conversationId);

        // 如果删除的是当前对话，切换到新对话
        if (currentConversationId.value === conversationId) {
            resetConversation();
            chatList.value = [];
            currentConversationId.value = '';
        }

        // 不关闭抽屉，让用户可以继续操作
        return;
    }

    // 处理新对话选项
    if (value === 'new') {
        console.log('创建新对话');
        // 重置会话状态
        resetConversation();
        currentConversationId.value = '';
        chatList.value = [];
        // 关闭抽屉
        showConversationDrawer.value = false;
        return;
    }

    // 处理切换对话
    if (value !== currentConversationId.value) {
        currentConversationId.value = value;
        await loadConversationHistory(value);
        // 关闭抽屉
        showConversationDrawer.value = false;
    }
};

// 滚动加载更多历史消息 - 可在页面滚动到顶部时触发
const loadMoreHistory = async () => {
    if (!hasMoreMessages.value || !currentConversationId.value || loadingMore.value) return;

    try {
        loadingMore.value = true;
        currentPage.value += 1;
        await loadConversationHistory(currentConversationId.value, false);
    } finally {
        loadingMore.value = false;
    }
};

// 处理滚动事件，当滚动到顶部时加载更多历史消息

const handleScroll = (e) => {
    // 确保e.detail存在，否则使用默认值
    const scrollTop = e.detail?.scrollTop || 0;
    if (scrollTop <= scrollTopThreshold && hasMoreMessages.value && currentConversationId.value && !loadingMore.value) {
        loadMoreHistory();
    }
};

// 滚动到底部
const backBottom = () => {
    scrollChatToBottom(chatRef.value);
};

// 处理思考内容
const handleChange = (value, { index }) => {
    console.log('handleChange', value, index);
};

// 清空聊天记录
const clearConfirm = async function () {
    console.log('清空聊天记录');
    // 清除本地存储
    await clearChatHistory();
    // 清空聊天记录
    chatList.value = [];
    // 重置当前会话
    if (currentConversationId.value) {
        resetConversation();
        currentConversationId.value = '';
    }
};

// 停止请求
const onStop = function () {
    console.log('停止请求');
    try {
        // 立即重置状态 - 先更新UI再中断请求
        loading.value = false;
        isStreamLoad.value = false;
        firstTokenReceived.value = true; // 设为true防止显示加载动画

        // 获取最后一条助手消息并添加停止标记
        const lastItem = chatList.value[0];

        // 处理中断UI更新
        handleRequestAbort(lastItem, { loading, isStreamLoad });

        // 保存聊天记录
        saveChatHistory(chatList.value);

        // 尝试取消请求 - 这一步放在状态更新之后
        if (fetchCancel.value) {
            try {
                console.log('执行中断请求');
                fetchCancel.value();
            } catch (abortError) {
                console.error('中断请求时出错:', abortError);
            } finally {
                // 不论中断成功与否，都清空中断函数
                fetchCancel.value = null;
            }
        }
    } catch (error) {
        console.error('停止请求时发生错误:', error);
        // 出错时也要确保重置状态
        loading.value = false;
        isStreamLoad.value = false;
        fetchCancel.value = null;
    }
};

// 用户操作
const handleOperation = function (type, options) {
    console.log('执行操作:', type, options);
    // 确保options存在并提取index
    const index = options.index;

    if (type === 'good') {
        isGood.value = !isGood.value;
        isBad.value = false;
    } else if (type === 'bad') {
        isBad.value = !isBad.value;
        isGood.value = false;
    } else if (type === 'replay') {
        const userQuery = chatList.value[index + 1].content;
        inputEnter(userQuery);
    }
};

// 用户输入
const inputEnter = function (inputValue) {
    console.log('用户输入:', inputValue);
    if (isStreamLoad.value) {
        console.log('当前正在流式加载中，忽略输入');
        return;
    }
    if (!inputValue) {
        console.log('输入为空，忽略');
        return;
    }

    // 添加用户消息
    const userMessage = createUserMessage(inputValue);
    console.log('添加用户消息:', userMessage);
    chatList.value.unshift(userMessage);

    // 添加助手消息（空消息占位）
    // 默认启用推理展示功能，如果API不返回推理内容，也不会显示
    const assistantMessage = createAssistantMessage(true);
    console.log('添加占位消息:', assistantMessage);
    chatList.value.unshift(assistantMessage);

    // 发送请求
    console.log('开始处理模型请求');
    handleModelRequest(inputValue);
};

// 处理模型请求
const handleModelRequest = async (inputValue) => {
    console.log('处理模型请求，输入值:', inputValue);
    loading.value = true;
    isStreamLoad.value = true;
    firstTokenReceived.value = false;
    const lastItem = chatList.value[0];
    console.log('最后一条消息:', lastItem);

    // 构建消息历史
    const messages = buildMessageHistory(chatList.value, inputValue, systemPrompt.value);
    console.log('最终发送的消息历史:', messages);

    // 创建请求控制器和超时保护
    const { controller, signal, abortRequest } = createRequestController();
    fetchCancel.value = abortRequest;
    console.log('创建AbortController');

    // 设置超时保护，防止请求无响应
    const timeoutId = createTimeoutProtection(abortRequest);

    try {
        // 准备请求选项，如果有当前会话ID则使用，否则创建新会话
        const requestOptions = {
            signal: signal,
            conversation_id: currentConversationId.value || ''
        };

        console.log('使用会话ID:', requestOptions.conversation_id);

        await chatWithModel(
            messages,
            {
                // 思考内容
                onReasoning: (reasoningText) => {
                    // 检查是否已中断 - 通过检查loading状态替代直接检查signal
                    if (!loading.value || !isStreamLoad.value) {
                        console.log('请求已中断或已完成，不再处理思考内容');
                        return;
                    }

                    console.log('收到思考内容:', reasoningText);
                    if (!firstTokenReceived.value) {
                        console.log('首次收到token');
                        firstTokenReceived.value = true;
                    }

                    // 处理思考内容，不再依赖于特定模型
                    try {
                        // 如果是首次收到思考内容，则替换"思考中..."
                        if (!lastItem.reasoning || lastItem.reasoning === '思考中...') {
                            console.log('首次收到思考内容，替换"思考中..."');
                            lastItem.reasoning = reasoningText || '';
                        } else {
                            console.log('追加思考内容');
                            // 否则追加思考内容
                            lastItem.reasoning = (lastItem.reasoning || '') + (reasoningText || '');
                        }
                        // 确保尾部没有不必要的空格或符号
                        if (lastItem.reasoning) {
                            lastItem.reasoning = lastItem.reasoning.trim();
                        }
                        // 滚动到底部
                        backBottom();
                    } catch (error) {
                        console.error('处理思考内容时出错:', error);
                    }
                },
                // 消息内容
                onMessage: (content) => {
                    // 检查是否已中断 - 通过检查loading状态替代直接检查signal
                    if (!loading.value || !isStreamLoad.value) {
                        console.log('请求已中断或已完成，不再处理消息内容');
                        return;
                    }

                    console.log('收到消息内容:', content);
                    if (!firstTokenReceived.value) {
                        console.log('首次收到token');
                        firstTokenReceived.value = true;
                    }
                    try {
                        lastItem.content = (lastItem.content || '') + (content || '');
                        // 确保内容尾部没有不必要的空格或符号
                        if (lastItem.content) {
                            lastItem.content = lastItem.content.trim();
                        }
                        // 滚动到底部
                        backBottom();
                    } catch (error) {
                        console.error('处理消息内容时出错:', error);
                    }
                },
                // 请求出错
                onError: (error) => {
                    console.error('请求出错:', error);

                    // 处理请求错误
                    const isAborted = handleRequestError(error, lastItem, { loading, isStreamLoad });

                    // 保存聊天记录
                    saveChatHistory(chatList.value);

                    // 清除中断函数
                    fetchCancel.value = null;
                },
                // 请求完成
                onComplete: async (isOk, msg) => {
                    console.log('请求完成，状态:', isOk, '消息:', msg);

                    // 处理请求完成
                    handleRequestComplete(isOk, msg, lastItem,
                        { loading, isStreamLoad },
                        { timeoutId, fetchCancel }
                    );

                    // 保存聊天记录（添加防护措施）
                    if (chatList.value && Array.isArray(chatList.value)) {
                        await saveChatHistory(chatList.value);
                    } else {
                        console.error('保存聊天记录失败：chatList.value 无效');
                    }

                    // 如果是新会话，需要更新当前会话ID并刷新会话列表
                    if (!currentConversationId.value && isOk) {
                        // 从存储中获取新生成的会话ID
                        const newConversationId = localStorage.getItem('dify_conversation_id');
                        if (newConversationId) {
                            currentConversationId.value = newConversationId;

                            // 刷新会话列表
                            try {
                                const serverConversations = await getServerConversations({
                                    limit: 20,
                                    sort_by: '-updated_at'
                                });
                                if (serverConversations && Array.isArray(serverConversations)) {
                                    conversationList.value = serverConversations;
                                    console.log('更新会话列表成功');
                                }
                            } catch (error) {
                                console.error('更新会话列表失败:', error);
                            }
                        }
                    }
                }
            },
            requestOptions
        );
    } catch (error) {
        console.error('处理模型请求时发生错误:', error);
        // 清除超时保护
        clearTimeout(timeoutId);

        // 处理请求错误
        handleRequestError(error, lastItem, { loading, isStreamLoad });

        // 保存聊天记录
        saveChatHistory(chatList.value);

        // 清空中断函数，防止内存泄漏
        fetchCancel.value = null;
    }
};

// 加载更多会话
const loadMoreConversations = async () => {
    if (!hasMoreConversations.value || loadingMoreConversations.value) return;

    try {
        loadingMoreConversations.value = true;

        // 获取最后一个会话的ID作为last_id
        const lastId = conversationList.value.length > 0
            ? conversationList.value[conversationList.value.length - 1].id
            : null;

        if (!lastId) {
            hasMoreConversations.value = false;
            return;
        }

        // 获取更多会话，每次固定加载20条
        const moreConversations = await getServerConversations({
            last_id: lastId,
            limit: 20,
            sort_by: '-updated_at'
        });

        if (moreConversations && Array.isArray(moreConversations) && moreConversations.length > 0) {
            // 合并会话列表
            conversationList.value = [...conversationList.value, ...moreConversations];
            console.log('加载更多会话成功，数量:', moreConversations.length);

            // 判断是否还有更多对话可加载
            hasMoreConversations.value = moreConversations.length >= 20;
        } else {
            hasMoreConversations.value = false;
            console.log('没有更多会话可加载');
        }
    } catch (error) {
        console.error('加载更多会话失败:', error);
    } finally {
        loadingMoreConversations.value = false;
    }
};

// 处理新建对话
const handleNewConversation = () => {
    console.log('创建新对话');
    // 重置会话状态
    resetConversation();
    currentConversationId.value = '';
    chatList.value = [];
    // 关闭抽屉
    showConversationDrawer.value = false;
};
</script>

<style lang="scss">
@use '/static/app/styles/index.scss';
@import '/static/app/styles/variables.scss';

.app-container {
    position: relative;
    width: 100%;
    height: 100vh;
    transition: all 0.3s ease;
}

.chat-container {
    height: 100vh;
    width: 100vw;
    padding: $comp-size-xxl $size-2 $comp-margin-l;
    transition: padding 0.3s ease;
    // background-color: $bg-color-page;

    .t-space {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .t-chat-item {
        transition: transform 0.2s ease, box-shadow 0.3s ease;
        border-radius: $radius-medium;

        &:hover {
            transform: translateY(-$size-1);
            box-shadow: $shadow-2;
        }
    }
}

.loading-space {
    margin-top: $size-3;
    margin-left: $size-4;
    transition: all 0.3s ease;
}
</style>
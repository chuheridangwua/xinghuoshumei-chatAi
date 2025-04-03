<template>
    <div class="app-container">
        <HeaderNav :title="currentConversationTitle" @open-drawer="showConversationDrawer = true"
            @new-conversation="handleNewConversation" />

        <ConversationDrawer v-model:visible="showConversationDrawer" :current-conversation-id="currentConversationId"
            :grouped-conversations="groupedConversations" :has-more-conversations="hasMoreConversations"
            :loading-more-conversations="loadingMoreConversations" @select="handleConversationSelect"
            @new-conversation="handleNewConversation" @load-more="loadMoreConversations"
            @rename-conversation="showRenameDialogFor" @pin-conversation="handlePinConversation" />

        <t-chat class="chat-container" ref="chatRef" layout="both" :clear-history="false" @clear="clearConfirm"
            @scroll="handleScroll">
            <template v-for="(item, index) in chatList" :key="index">
                <chat-item :avatar="item.avatar" :name="item.name" :role="item.role" :datetime="item.datetime"
                    :content="item.content" :reasoning="item.reasoning" :is-first-message="index === 0"
                    :loading="loading" :first-token-received="firstTokenReceived" :is-stream-load="isStreamLoad"
                    :is-good="isGood" :is-bad="isBad" :files="item.files"
                    @reasoning-expand-change="(expandValue) => handleChange(expandValue, { index })"
                    @operation="(type, e) => handleOperation(type, { index, e })" />
            </template>
            <template #footer>
                <!-- 建议问题标签 -->
                <div v-if="suggestedQuestions.length > 0" class="suggested-questions-container">
                    <div class="suggested-questions">
                        <t-tag v-for="(question, qIndex) in suggestedQuestions" :key="qIndex" theme="primary"
                            variant="light" class="question-tag" size="medium"
                            @click="handleSuggestedQuestion(question)">
                            {{ question }}
                        </t-tag>
                    </div>
                </div>
                <chat-sender :loading="loading" @send="inputEnter" @stop="onStop" />
            </template>
        </t-chat>

        <!-- 重命名对话弹窗 - 基于整个页面 -->
        <t-dialog width="80%" v-model:visible="showRenameDialog" header="重命名对话"
            :confirm-btn="{ content: '确定', theme: 'primary' }" :cancel-btn="{ content: '取消', theme: 'default' }"
            @confirm="confirmRename" @close="cancelRename">
            <t-input v-model="renameInput" type="text" :maxlength="100" placeholder="请输入新名称" clearable autofocus
                @enter="confirmRename" />
        </t-dialog>

        <!-- 删除对话确认框 - 基于整个页面 -->
        <t-dialog width="80%" v-model:visible="showDeleteDialog" header="删除对话"
            :confirm-btn="{ content: '确定', theme: 'danger' }" :cancel-btn="{ content: '取消', theme: 'default' }"
            @confirm="confirmDelete" @close="cancelDelete">
            <p class="dialog-content">确定要删除该对话吗？此操作不可恢复。</p>
        </t-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
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
    getServerConversationHistory,
    renameConversation,
    deleteConversation,
    getCurrentConversation,
    autoRenameConversationIfNeeded,
    getSuggestedQuestions
} from '/static/app/api/chat.js';
import {
    createRequestController,
    createTimeoutProtection,
    handleRequestAbort,
    handleRequestError,
    handleRequestComplete,
    stopStreamResponse
} from '/static/app/api/request.js';
import { initTheme, setThemeMode, ThemeMode } from '/static/app/api/theme.js';

// 获取对话显示标题的方法
const getConversationTitle = (conversation, maxLength = 20) => {
    if (!conversation) return '新对话';

    // 优先使用name字段
    if (conversation.name) {
        return conversation.name.length > maxLength
            ? conversation.name.substring(0, maxLength) + '...'
            : conversation.name;
    }

    // 其次尝试使用最近的用户消息作为标题
    if (conversation.last_message && conversation.last_message.trim()) {
        return conversation.last_message.length > maxLength
            ? conversation.last_message.substring(0, maxLength) + '...'
            : conversation.last_message;
    }

    // 如果没有名称和最近消息，使用ID的一部分
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
const isScrolling = ref(false); // 是否正在滚动，用于控制自动滚动行为

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

// 重命名对话相关状态
const showRenameDialog = ref(false);
const renameInput = ref('');
const currentEditingId = ref('');

// 删除对话相关状态
const showDeleteDialog = ref(false);
const currentDeletingId = ref('');

// 添加变量保存当前任务ID
const currentTaskId = ref(null);
// 添加变量保存当前消息ID
const currentMessageId = ref('');
// 添加变量保存建议问题列表
const suggestedQuestions = ref([]);
// 添加变量保存建议问题关联的会话ID
const suggestedQuestionsConversationId = ref('');

onMounted(() => {
    // 初始化主题（默认或者根据系统偏好）
    initTheme();
    // document.documentElement.setAttribute('theme-mode', 'light');
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

    return groups;
});

// 初始化聊天数据
const initChatData = async () => {
    // 获取系统提示词
    try {
        systemPrompt.value = await loadSystemPrompt();
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

            // 判断是否还有更多对话可加载
            hasMoreConversations.value = serverConversations.length >= 20;

            // 获取默认会话ID
            const defaultConversationId = await getCurrentConversation();
            if (defaultConversationId) {
                currentConversationId.value = defaultConversationId;
                await loadConversationHistory(defaultConversationId);
            } else {
                // 如果没有会话，创建新对话
                currentConversationId.value = '';
                chatList.value = [];
            }
        } else {
            console.error('服务器返回的会话列表数据格式不正确:', serverConversations);
            // 创建新会话
            currentConversationId.value = '';
            chatList.value = [];
        }
    } catch (error) {
        console.error('获取服务器会话列表失败:', error);
        // 创建新会话
        currentConversationId.value = '';
        chatList.value = [];
    }
};

// 加载特定对话的历史消息
const loadConversationHistory = async (conversationId, resetPage = true) => {
    if (!conversationId) {
        console.error('会话ID为空，无法加载历史消息');
        return false;
    }

    try {
        // 显示加载状态
        loadingMore.value = resetPage ? false : true;

        // 切换对话时清空建议问题列表
        if (resetPage) {
            suggestedQuestions.value = [];
        }

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

        const historyMessages = await getServerConversationHistory(conversationId, options);

        if (historyMessages.length > 0) {
            // 如果是重置，直接设置为新消息
            if (resetPage) {
                chatList.value = historyMessages;
            } else {
                // 否则追加到现有消息的前面
                chatList.value = [...historyMessages, ...chatList.value];
            }

            // 判断是否还有更多消息
            hasMoreMessages.value = historyMessages.length >= pageSize.value;

            // 获取最后一条AI回复的消息ID，用于获取建议问题
            if (resetPage && historyMessages.length > 0) {
                // 找出最后一条AI回复的消息
                const assistantMessages = historyMessages.filter(msg => msg.role === 'assistant' && msg.id);
                if (assistantMessages.length > 0) {
                    // 获取最后一条AI消息的ID (移除_assistant后缀)
                    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
                    const messageId = lastAssistantMessage.id.replace('_assistant', '');

                    // 获取建议问题
                    fetchSuggestedQuestions(messageId);
                }
            }
        } else {
            if (resetPage) {
                chatList.value = []; // 没有消息，清空列表
            }
            hasMoreMessages.value = false;
        }

        // 保存到本地缓存
        if (chatList.value && Array.isArray(chatList.value) && chatList.value.length > 0) {
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
    const value = option.value;

    // 处理删除选项
    if (typeof value === 'string' && value.startsWith('delete-')) {
        const conversationId = value.substring(7); // 去掉"delete-"前缀

        // 显示删除确认框
        currentDeletingId.value = conversationId;
        showDeleteDialog.value = true;

        return;
    }

    // 处理新对话选项
    if (value === 'new') {
        // 重置会话状态
        resetConversation();
        currentConversationId.value = '';
        chatList.value = [];
        // 清空建议问题列表
        suggestedQuestions.value = [];
        suggestedQuestionsConversationId.value = '';
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
};

// 清空聊天记录
const clearConfirm = async function () {
    // 清除本地存储
    await clearChatHistory();
    // 清空聊天记录
    chatList.value = [];
    // 清空建议问题列表
    suggestedQuestions.value = [];
    suggestedQuestionsConversationId.value = '';
    // 重置当前会话
    if (currentConversationId.value) {
        resetConversation();
        currentConversationId.value = '';
    }
};

// 停止请求
const onStop = async function () {
    try {
        // 防止重复中断
        if (!loading.value && !isStreamLoad.value) {
            console.log('请求已经停止，不再执行中断操作');
            return;
        }

        // 立即重置状态 - 先更新UI再中断请求
        loading.value = false;
        isStreamLoad.value = false;
        firstTokenReceived.value = true; // 设为true防止显示加载动画

        // 获取最后一条助手消息并添加停止标记
        const lastItem = chatList.value[0];

        // 处理中断UI更新
        handleRequestAbort(lastItem, { loading, isStreamLoad });

        // 备份中断函数并立即清空，避免重复调用
        const abortFunction = fetchCancel.value;
        fetchCancel.value = null;

        // 备份任务ID并立即清空
        const taskId = currentTaskId.value;
        currentTaskId.value = null;

        // 如果有任务ID，优先使用新的API停止流式响应
        if (taskId) {
            try {
                const userId = localStorage.getItem('dify_user_id');
                await stopStreamResponse(taskId, userId);
            } catch (stopError) {
                console.error('API停止请求失败:', stopError);
            }
        }

        // 最后尝试使用AbortController中断
        if (abortFunction) {
            try {
                abortFunction();
            } catch (abortError) {
                console.error('中断请求时出错:', abortError);
            }
        }
    } catch (error) {
        console.error('停止请求时发生错误:', error);
        // 出错时也要确保重置状态
        loading.value = false;
        isStreamLoad.value = false;
        fetchCancel.value = null;
        currentTaskId.value = null;
    }
};

// 用户操作
const handleOperation = function (type, options) {
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
    if (isStreamLoad.value) {
        return;
    }
    
    // 处理消息格式，支持包含文件的复合消息
    let messageText = '';
    let files = [];
    
    if (typeof inputValue === 'string') {
        messageText = inputValue;
    } else if (typeof inputValue === 'object') {
        messageText = inputValue.message || '';
        files = inputValue.files || [];
    }
    
    if (!messageText && files.length === 0) {
        return;
    }

    // 添加用户消息
    const userMessage = createUserMessage(messageText);
    chatList.value.unshift(userMessage);

    // 添加助手消息（空消息占位）
    // 默认启用推理展示功能，如果API不返回推理内容，也不会显示
    const assistantMessage = createAssistantMessage(true);
    chatList.value.unshift(assistantMessage);

    // 发送请求
    handleModelRequest(messageText, files);
};

// 处理模型请求
const handleModelRequest = async (inputValue, files = []) => {
    loading.value = true;
    isStreamLoad.value = true;
    firstTokenReceived.value = false;
    currentTaskId.value = null; // 重置任务ID
    currentMessageId.value = null; // 重置消息ID
    const lastItem = chatList.value[0];

    // 构建消息历史，确保使用正确的当前消息
    const currentUserMessage = chatList.value[1]?.role === 'user' ? chatList.value[1].content : inputValue;

    const messages = buildMessageHistory(chatList.value, currentUserMessage, systemPrompt.value);

    // 创建请求控制器和超时保护
    const { controller, signal, abortRequest } = createRequestController();
    fetchCancel.value = abortRequest;

    try {
        // 准备请求选项，如果有当前会话ID则使用，否则创建新会话
        const requestOptions = {
            signal: signal,
            conversation_id: currentConversationId.value || '',
            files: files.length > 0 ? files : undefined
        };

        await chatWithModel(
            messages,
            {
                // 思考内容
                onReasoning: (reasoningText) => {
                    // 检查是否已中断 - 通过检查loading状态替代直接检查signal
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    if (!firstTokenReceived.value) {
                        firstTokenReceived.value = true;
                    }

                    // 处理思考内容，不再依赖于特定模型
                    try {
                        // 如果是首次收到思考内容，则替换"思考中..."
                        if (!lastItem.reasoning || lastItem.reasoning === '思考中...') {
                            lastItem.reasoning = reasoningText || '';
                        } else {
                            // 否则，追加思考内容
                            lastItem.reasoning += reasoningText || '';
                        }
                    } catch (e) {
                        console.error('处理思考内容出错:', e);
                    }
                },

                // 回复内容
                onMessage: (text) => {
                    // 检查是否已中断
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    if (!firstTokenReceived.value) {
                        firstTokenReceived.value = true;
                    }

                    try {
                        // 设置或追加内容
                        if (!lastItem.content) {
                            lastItem.content = text || '';
                        } else {
                            lastItem.content += text || '';
                        }

                        if (text && !isScrolling.value) {
                            // 添加一些延迟以确保更新后滚动
                            setTimeout(() => {
                                if (chatRef.value) {
                                    scrollChatToBottom(chatRef.value, true);
                                }
                            }, 10);
                        }
                    } catch (e) {
                        console.error('处理消息内容出错:', e);
                    }
                },

                // 文件事件处理
                onFileEvent: (fileData) => {
                    // 检查是否已中断
                    if (!loading.value || !isStreamLoad.value) {
                        return;
                    }

                    try {
                        // 确保lastItem.files是一个数组
                        if (!lastItem.files) {
                            lastItem.files = [];
                        }

                        // 添加文件到助手消息的文件列表
                        lastItem.files.push(fileData);
                    } catch (e) {
                        console.error('处理文件事件出错:', e);
                    }
                },

                // 错误处理
                onError: (errorMessage) => {
                    console.error('API请求出错:', errorMessage);
                    MessagePlugin.error(errorMessage || '请求出错');

                    // 更新UI状态
                    loading.value = false;
                    isStreamLoad.value = false;
                    lastItem.loading = false;
                    lastItem.isStreamLoad = false;
                    lastItem.content = `请求失败: ${errorMessage}`;
                },

                // 完成事件
                onComplete: (success, message) => {
                    console.log('请求完成, 成功:', success, message);
                    
                    // 更新UI状态
                    loading.value = false;
                    isStreamLoad.value = false;
                    
                    if (lastItem) {
                        lastItem.loading = false;
                        lastItem.isStreamLoad = false;
                    }

                    if (!success) {
                        console.warn('请求未成功完成:', message);
                        if (lastItem) {
                            if (!lastItem.content) {
                                lastItem.content = `请求未完成: ${message || '未知原因'}`;
                            }
                        }
                    } else {
                        // 请求成功完成，考虑自动重命名对话
                        // 只有当有会话ID时才尝试重命名
                        if (currentConversationId.value) {
                            // 使用改进的自动重命名函数，带上当前消息列表
                            autoRenameConversationIfNeeded(currentConversationId.value, {
                                messages: chatList.value,
                                onComplete: (newTitle) => {
                                    if (!newTitle) {
                                        console.log('自动重命名完成，但未返回标题');
                                        return;
                                    }
                                    
                                    console.log('自动重命名完成，新标题:', newTitle);
                                    
                                    // 更新本地会话列表中的名称
                                    conversationList.value = conversationList.value.map(conversation => {
                                        if (conversation.id === currentConversationId.value) {
                                            return {
                                                ...conversation,
                                                name: newTitle
                                            };
                                        }
                                        return conversation;
                                    });
                                }
                            }).catch(error => {
                                console.error('自动重命名过程出错:', error);
                            });
                        }
                    }

                    // 刷新UI
                    nextTick(() => {
                        if (chatRef.value) {
                            scrollChatToBottom(chatRef.value, true);
                        }
                    });
                },

                // 会话ID变更
                onConversationIdChange: (id) => {
                    console.log('会话ID更新:', id);
                    if (id && id !== currentConversationId.value) {
                        currentConversationId.value = id;
                        // 确保会话列表是最新的
                        loadConversationListDebounce();
                    }
                },

                // 消息ID变更
                onMessageIdChange: (id) => {
                    currentMessageId.value = id;
                    // 在消息完成后获取建议问题
                    if (id && lastItem && lastItem.role === 'assistant') {
                        getSuggestedQuestionsDebounce(id);
                    }
                },

                // 任务ID变更
                onTaskIdChange: (id) => {
                    currentTaskId.value = id;
                }
            },
            requestOptions
        );
    } catch (err) {
        console.error('聊天请求失败:', err);
        loading.value = false;
        isStreamLoad.value = false;

        // 更新最后一条消息为错误信息
        if (lastItem) {
            lastItem.loading = false;
            lastItem.isStreamLoad = false;
            lastItem.content = `聊天请求失败: ${err.message || '未知错误'}`;
        }

        // 显示错误提示
        MessagePlugin.error('聊天请求失败: ' + (err.message || '未知错误'));
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

            // 判断是否还有更多对话可加载
            hasMoreConversations.value = moreConversations.length >= 20;
        } else {
            hasMoreConversations.value = false;
        }
    } catch (error) {
        console.error('加载更多会话失败:', error);
    } finally {
        loadingMoreConversations.value = false;
    }
};

// 处理新建对话
const handleNewConversation = () => {
    // 重置会话状态
    resetConversation();
    currentConversationId.value = '';
    chatList.value = [];
    // 清空建议问题列表
    suggestedQuestions.value = [];
    suggestedQuestionsConversationId.value = '';
    // 关闭抽屉
    showConversationDrawer.value = false;
};

// 处理对话重命名
const handleRenameConversation = async ({ conversationId, name }) => {
    try {
        // 调用重命名API
        const result = await renameConversation(conversationId, { name });

        // 更新本地会话列表中的名称
        conversationList.value = conversationList.value.map(conversation => {
            if (conversation.id === conversationId) {
                return {
                    ...conversation,
                    name: result.name || name
                };
            }
            return conversation;
        });

    } catch (error) {
        console.error('重命名对话失败:', error);
        // 显示错误消息
    }
};

// 处理对话置顶
const handlePinConversation = ({ conversationId }) => {
    // 查找要置顶的对话
    const conversation = conversationList.value.find(c => c.id === conversationId);
    if (!conversation) return;

    // 从列表中移除
    conversationList.value = conversationList.value.filter(c => c.id !== conversationId);

    // 添加到列表开头
    conversationList.value.unshift(conversation);

    // 关闭抽屉
    showConversationDrawer.value = false;

};

// 显示重命名对话框
const showRenameDialogFor = ({ conversationId }) => {
    currentEditingId.value = conversationId;

    // 找到当前对话
    const conversation = conversationList.value.find(c => c.id === conversationId);
    if (conversation) {
        renameInput.value = conversation.name || getConversationTitle(conversation, 100);
    }

    showRenameDialog.value = true;
};

// 确认重命名
const confirmRename = () => {
    if (currentEditingId.value && renameInput.value.trim()) {
        handleRenameConversation({
            conversationId: currentEditingId.value,
            name: renameInput.value.trim()
        });
    }
    showRenameDialog.value = false;
    renameInput.value = '';
    currentEditingId.value = '';
};

// 取消重命名
const cancelRename = () => {
    showRenameDialog.value = false;
    renameInput.value = '';
    currentEditingId.value = '';
};

// 确认删除对话
const confirmDelete = async () => {
    if (!currentDeletingId.value) {
        showDeleteDialog.value = false;
        return;
    }

    try {
        // 调用API删除对话
        const result = await deleteConversation(currentDeletingId.value);

        // 从本地列表中移除
        conversationList.value = conversationList.value.filter(c => c.id !== currentDeletingId.value);

        // 如果删除的是当前对话，切换到新对话
        if (currentConversationId.value === currentDeletingId.value) {
            resetConversation();
            chatList.value = [];
            currentConversationId.value = '';
            // 清空建议问题列表
            suggestedQuestions.value = [];
            suggestedQuestionsConversationId.value = '';
        }
    } catch (error) {
        console.error('删除对话失败:', error);
        // 可以在这里添加错误提示
    } finally {
        // 关闭对话框并清除状态
        showDeleteDialog.value = false;
        currentDeletingId.value = '';
    }
};

// 取消删除对话
const cancelDelete = () => {
    showDeleteDialog.value = false;
    currentDeletingId.value = '';
};

// 处理点击建议问题
const handleSuggestedQuestion = (question) => {
    // 使用选择的建议问题
    inputEnter(question);
    // 清空建议问题列表
    suggestedQuestions.value = [];
    suggestedQuestionsConversationId.value = '';
};

// 获取AI建议问题
const fetchSuggestedQuestions = async (messageId) => {
    if (!messageId) return;
    
    try {
        const questions = await getSuggestedQuestions(messageId);
        if (questions && Array.isArray(questions) && questions.length > 0) {
            suggestedQuestions.value = questions;
            suggestedQuestionsConversationId.value = currentConversationId.value;
        } else {
            suggestedQuestions.value = [];
        }
    } catch (error) {
        console.error('获取建议问题失败:', error);
        suggestedQuestions.value = [];
    }
};

// 防抖函数，减少API调用频率
const getSuggestedQuestionsDebounce = (messageId) => {
    setTimeout(() => {
        fetchSuggestedQuestions(messageId);
    }, 300);
};

// 用于会话列表加载的防抖函数
const loadConversationListDebounce = () => {
    setTimeout(async () => {
        try {
            const conversations = await getServerConversations({
                limit: 20,
                sort_by: '-updated_at'
            });
            if (conversations && Array.isArray(conversations)) {
                conversationList.value = conversations;
                hasMoreConversations.value = conversations.length >= 20;
            }
        } catch (error) {
            console.error('刷新会话列表失败:', error);
        }
    }, 500);
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
    padding: $comp-size-xxxl $size-2 $comp-margin-l;
    transition: padding 0.3s ease;

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

    /* 确保Markdown标题没有边距 */
    :deep(.t-chat-content),
    :deep(.t-chat__content) {

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
            margin-top: 0 !important;
            margin-bottom: 8px !important;
            padding: 0 !important;
            line-height: 1.2 !important;
        }
    }
}

.dialog-content {
    font-size: $font-size-body-medium;
}

/* 聊天输入框高度自定义 */
.t-chat-input {
    .t-textarea__inner {
        min-height: 40px !important;
        height: 40px !important;
        line-height: 20px !important;
    }
}

.loading-space {
    margin-top: $size-3;
    margin-left: $size-4;
    transition: all 0.3s ease;
}

/* 建议问题样式 */
.suggested-questions-container {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    /* 提升在iOS上的滚动体验 */
    margin-bottom: $comp-margin-xs;
    padding: 0 $comp-margin-s;
    /* 隐藏滚动条但保留功能 */
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;

    /* IE and Edge */
    &::-webkit-scrollbar {
        display: none;
        /* Chrome, Safari, Opera */
    }
}

.suggested-questions {
    display: flex;
    flex-wrap: nowrap;
    /* 不换行，允许水平滚动 */
    padding: $comp-margin-xs 0;
    gap: $comp-margin-xs;
    justify-content: flex-start;
    /* 左对齐 */
    white-space: nowrap;
    /* 防止内容换行 */
    width: max-content;
    /* 内容宽度决定容器宽度 */
}

.question-tag {
    cursor: pointer;
    margin-bottom: 0;
    transition: all 0.2s ease;

    &:hover {
        transform: translateY(-2px);
    }
}
</style>
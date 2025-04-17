<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content cla>

            <t-collapse :expand-icon="null" :borderless="true" :default-expand-all="isWorkflowCompleted"
                class="transparent-collapse" v-if="role === 'assistant' && workflowSteps && workflowSteps.length > 0">
                <t-collapse-panel value="0" :header="getCollapseHeader(workflowSteps)">
                    <t-timeline mode="same" :theme="dot" class="workflow-timeline">
                        <t-timeline-item v-for="(step, stepIndex) in workflowSteps" :key="stepIndex" :content="step.title"
                            :dot="getNodeDot(step.node_type, step.loading)" :dot-color="getNodeColor(step.node_type)">
                            <div v-if="step.loading" class="step-loading">
                                <span>{{ step.title }}</span><span class="loading-dots">{{ getLoadingDots() }}</span>
                            </div>
                            <div v-else-if="step.content">{{ step.content }}</div>
                        </t-timeline-item>
                    </t-timeline>
                </t-collapse-panel>
            </t-collapse>


            <!-- 只有助手消息且有思考内容才显示思考框 -->
            <t-chat-reasoning v-if="reasoning && reasoning.trim() && role === 'assistant' && reasoning !== '思考中...'"
                expand-icon-placement="right"
                @expand-change="(expandValue) => $emit('reasoning-expand-change', expandValue)">
                <template #header>
                    <t-chat-loading v-if="isFirstMessage && loading" text="思考中..." indicator />
                    <div v-else class="reasoning-header">
                        <t-icon name="dart-board"></t-icon>
                        <span>思考过程</span>
                    </div>
                </template>
                <t-chat-content :content="reasoning || ''" />
            </t-chat-reasoning>
            <!-- 显示消息内容，如果没有则显示占位 -->
            <t-chat-content v-if="content && content.trim().length > 0" :content="content" class="zero-margins" />

            <div class="message-files" v-if="files && files.length > 0">
                <div class="files-scroll-container">
                    <t-tag v-for="(file, index) in files" :key="index" theme="default" variant="light" shape="round"
                        size="medium" class="file-tag">
                        <t-icon :name="getFileIcon(file.type)" class="file-icon" size="240" />
                        <span class="file-name">{{ formatFileName(file.filename) }}</span>
                    </t-tag>
                </div>
            </div>

        </template>

        <!-- 第一条消息且正在加载时显示加载动画 -->
        <template v-if="isFirstMessage && loading && !firstTokenReceived" #content>
            <div class="loading-space">
                <t-space>
                    <t-chat-loading animation="moving" text="思考中..." />
                </t-space>
            </div>
        </template>


        <!-- 操作按钮，只对助手消息显示 -->
        <template #actions>
            <chat-action class="chat-actions-container" v-if="!isStreamLoad && role === 'assistant'" :is-good="isGood" :is-bad="isBad"
                :content="content || ''" @operation="handleOperation" />    
        </template>
    </t-chat-item>
</template>

<script setup lang="jsx">
import { defineProps, defineEmits, ref, onMounted, onUnmounted, computed } from 'vue';
import ChatAction from './ChatAction.vue';

// 组件属性
const props = defineProps({
    avatar: {
        type: String,
        default: ''
    },
    name: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        default: 'user'
    },
    datetime: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        default: ''
    },
    reasoning: {
        type: String,
        default: ''
    },
    isFirstMessage: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    },
    firstTokenReceived: {
        type: Boolean,
        default: false
    },
    isStreamLoad: {
        type: Boolean,
        default: false
    },
    isGood: {
        type: Boolean,
        default: false
    },
    isBad: {
        type: Boolean,
        default: false
    },
    files: {
        type: Array,
        default: () => []
    },
    workflowSteps: {
        type: Array,
        default: () => []
    }
});

// 定义事件
const emit = defineEmits(['reasoning-expand-change', 'operation']);

// 处理操作事件，确保正确传递参数
const handleOperation = (type, options) => {
    emit('operation', type, options);
};

// 默认时间轴样式
const dot = ref('default');

// 动态省略号状态
const dotsCount = ref(1);
let dotsInterval = null;

// 创建动态省略号动画
onMounted(() => {
    dotsInterval = setInterval(() => {
        dotsCount.value = (dotsCount.value % 6) + 1;
    }, 100);
});

// 清理定时器
onUnmounted(() => {
    if (dotsInterval) {
        clearInterval(dotsInterval);
    }
});

// 计算属性：判断工作流是否已完成
const isWorkflowCompleted = computed(() => {
    return props.workflowSteps && props.workflowSteps.length > 0 && !props.workflowSteps.some(step => step.loading);
});

// 文件图标映射
const fileIconMap = {
    'document': 'file-excel',
    'image': 'photo',
    'audio': 'play-circle',
    'video': 'play-circle-stroke',
    'custom': 'file'
};

// 获取文件图标
const getFileIcon = (type) => {
    return fileIconMap[type] || 'file';
};

// 添加：节点类型到图标的映射
const nodeTypeToIcon = {
    'default': 'check-circle-filled', // 默认节点
    'start': 'play-circle-filled',    // 开始节点
    'http': 'link',                   // HTTP请求节点
    'condition': 'swap',              // 条件分支节点
    'time': 'time',                   // 时间相关节点
    'search': 'search',               // 搜索节点
    'extract': 'filter',              // 参数提取节点
    'web': 'internet',                // Web搜索节点
    'file': 'file',                   // 文件节点
    'model': 'root-list',             // 模型节点
    'reply': 'chat',                  // 回复节点
    'error': 'error-circle',          // 错误节点
};

// 添加：节点类型到颜色的映射
const nodeTypeToColor = {
    'default': 'primary',            // 默认节点颜色
    'start': 'primary',              // 开始节点颜色
    'error': 'error',                // 错误节点颜色
    'condition': 'warning',          // 条件分支节点颜色
    'model': 'success',              // 模型节点颜色
    'reply': 'success',              // 回复节点颜色
};

// 添加：获取节点图标函数 - 使用JSX方式
const getNodeIcon = (nodeType) => {
    const iconName = nodeTypeToIcon[nodeType] || nodeTypeToIcon.default;
    return iconName;
};

// 添加：获取节点颜色函数
const getNodeColor = (nodeType) => {
    return nodeTypeToColor[nodeType] || 'primary';
};

// 使用JSX创建自定义dot
const getNodeDot = (nodeType, isLoading) => {
    const color = `var(--td-${getNodeColor(nodeType)}-color)`;
    const iconName = getNodeIcon(nodeType);

    return () => (
        <t-icon name={iconName} size="medium" color={color} />
    );
};

// 添加：获取动态省略号函数
const getLoadingDots = () => {
    const fullDots = '......'; // 6个点
    return fullDots.substring(0, dotsCount.value);
};

// 格式化文件名
const formatFileName = (fileName) => {
    if (!fileName) return '';
    if (fileName.length <= 10) return fileName;

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName.slice(0, 7) + '...';

    const extension = fileName.slice(lastDotIndex);
    const name = fileName.slice(0, lastDotIndex);
    if (name.length <= 7) return fileName; // 如果名称部分已经很短，保留全名
    return name.slice(0, 7) + '...' + extension;
};

// 添加：获取折叠面板标题函数
const getCollapseHeader = (steps) => {
    const lastStep = steps[steps.length - 1];
    // 检查是否所有步骤都已完成（没有正在加载的步骤）
    const isCompleted = !steps.some(step => step.loading);

    if (isCompleted) {
        // 流程完成后显示"执行过程"
        return (
            <div class="workflow-header">
                <t-icon name={getNodeIcon(lastStep.node_type)} color={`var(--td-${getNodeColor(lastStep.node_type)}-color)`} />
                <span>执行过程</span>
            </div>
        );
    } else {
        // 流程未完成，显示最后一步的标题和加载动画
        return (
            <div class="workflow-header">
                <t-icon name={getNodeIcon(lastStep.node_type)} color={`var(--td-${getNodeColor(lastStep.node_type)}-color)`} />
                <span>{lastStep.title + getLoadingDots()}</span>
            </div>
        );
    }
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

/* 添加基础过渡效果 */
.t-chat-item {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease, transform 0.3s ease;
}

/* 消息内容容器 */
:deep(.t-chat__bubble) {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease;
}

/* 透明折叠面板 */
.transparent-collapse {
    background-color: transparent;
    transition: all 0.3s ease;

    :deep(.t-collapse-panel__header) {
        background-color: transparent;
        transition: all 0.3s ease;
    }

    :deep(.t-collapse-panel__content) {
        background-color: transparent;
        transition: all 0.3s ease;
    }
}

/* 工作流时间线 */
.workflow-timeline {
    width: 100%;
    margin-top: 8px;
    transition: all 0.3s ease;

    .t-timeline-item {
        transition: all 0.3s ease;
    }
}

/* 思考框样式 */
:deep(.t-chat-reasoning) {
    transition: all 0.3s ease, max-width 0.3s ease, width 0.3s ease;
    
    .t-chat-reasoning__header, 
    .t-chat-reasoning__content {
        transition: all 0.3s ease;
    }
}

/* 思考框头部样式 */
.reasoning-header {
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;

    .t-icon {
        font-size: 16px;
        color: var(--td-brand-color);
    }
}

/* 消息内容无边距 */
.zero-margins {
    margin: 0 !important;
    transition: all 0.3s ease;
}

/* 文件展示区域 */
.message-files {
    margin-top: 12px;
    transition: all 0.3s ease;
}

/* 文件滚动容器 */
.files-scroll-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 4px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    transition: all 0.3s ease;

    &::-webkit-scrollbar {
        display: none;
    }
}

/* 文件标签 */
.file-tag {
    display: flex;
    align-items: center;
    transition: all 0.3s ease, transform 0.2s ease;
    
    // &:hover {
    //     transform: translateY(-2px);
    // }
}

/* 文件图标 */
.file-icon {
    transition: all 0.3s ease;
    transform: translate(0px,-1px);
}

/* 文件名称 */
.file-name {
    transition: all 0.3s ease;
    white-space: nowrap;
    margin-right: 3px;
}

/* 步骤加载中 */
.step-loading {
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.3s ease;
}

/* 加载点动画 */
.loading-dots {
    width: 24px;
    display: inline-block;
    transition: all 0.3s ease;
}

/* 加载空间 */
.loading-space {
    transition: all 0.3s ease;
    width: 100%;
}

.t-tag .t-icon{
    width: 12px;
    height: 12px;
}

</style>
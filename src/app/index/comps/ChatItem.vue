<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content>

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
                        <t-icon :name="getFileIcon(file.type)" class="file-icon" />
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

            <chat-action v-if="!isStreamLoad && role === 'assistant'" :is-good="isGood" :is-bad="isBad"
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

<style lang="scss" scoped>
@import '/static/app/styles/variables.scss';

.loading-space {
    margin-top: $size-3;
    margin-left: $size-4;
    transition: all 0.3s ease;
}

:deep(.t-chat__detail-reasoning) {
    padding-top: 0px !important;
}

.reasoning-header {
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-color-primary;
    transition: color 0.3s ease;

    .t-icon {
        margin-right: $size-2;
        transition: all 0.3s ease;
    }
}

/* 工作流时间轴样式 */
.workflow-timeline {
    margin-top: $size-3;

    :deep(.t-timeline__item) {
        padding-bottom: $size-4;
    }

    :deep(.t-timeline__item-dot) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :deep(.t-timeline-item__label) {
        transition: all 0.3s ease;
    }

    .dot-loading-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    .dot-loading-wrapper {
        :deep(.t-loading__spin) {
            font-size: 16px;
        }
    }

    .step-loading {
        display: inline-flex;
        align-items: center;
        color: var(--td-text-color-secondary);

        .loading-dots {
            display: inline-block;
            min-width: 30px;
            overflow: hidden;
            text-overflow: clip;
            white-space: nowrap;
        }
    }
}

/* 消息文件展示样式 */
.message-files {
    width: 100%;
}

.files-scroll-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    /* Firefox */
    -webkit-overflow-scrolling: touch;
    padding: 4px 0;
    white-space: nowrap;
    -ms-overflow-style: none;
    /* IE and Edge */
}

/* 隐藏滚动条但保留功能 */
.files-scroll-container::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari, Opera */
}

.files-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}

.file-tag {
    display: inline-flex;
    align-items: center;
    margin: 0 4px;
    padding: 2px 6px 2px 10px;
    background-color: var(--td-bg-color-container, $gray-color-1);
    border-color: var(--td-component-border, $gray-color-3);
    flex-shrink: 0;

    .file-icon {
        color: $success-color-7;
        font-size: 16px;
        margin-right: 6px;
        flex-shrink: 0;
    }

    .file-name {
        color: var(--td-text-color-primary, $font-gray-1);
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

/* 确保Markdown内容中的元素没有边距 */
:deep(.zero-margins) {

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin-top: 0 !important;
        margin-bottom: 8px !important;
        padding: 0 !important;
        line-height: normal !important;
    }
}

:deep(.t-chat__text--user) {
    text-align: right !important;
}

/* 透明折叠面板样式 */
.transparent-collapse {
    .workflow-header {
        display: flex;
        align-items: center;
        gap: 8px;

        .t-icon {
            font-size: 16px;
        }
    }
}

.t-collapse {
    background-color: transparent !important;
}

:deep(.t-collapse.t--border-less .t-collapse-panel__body) {
    background-color: transparent !important;
}

:deep(.t-collapse-panel__wrapper .t-collapse-panel__content) {
    padding: 0px 10px !important;
    margin-top: 10px !important;
}
</style>
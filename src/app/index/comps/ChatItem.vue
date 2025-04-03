<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content>
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

<script setup>
import { defineProps, defineEmits } from 'vue';
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
    }
});

// 定义事件
const emit = defineEmits(['reasoning-expand-change', 'operation']);

// 处理操作事件，确保正确传递参数
const handleOperation = (type, options) => {
    emit('operation', type, options);
};

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
</script>

<style lang="scss" scoped>
@import '/static/app/styles/variables.scss';

.loading-space {
    margin-top: $size-3;
    margin-left: $size-4;
    transition: all 0.3s ease;
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

/* 消息文件展示样式 */
.message-files {
    width: 100%;
}

.files-scroll-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    -webkit-overflow-scrolling: touch;
    padding: 4px 0;
    white-space: nowrap;
    -ms-overflow-style: none; /* IE and Edge */
}

/* 隐藏滚动条但保留功能 */
.files-scroll-container::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
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
</style>
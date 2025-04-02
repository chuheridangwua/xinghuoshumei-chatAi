<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content>
            <!-- 只有助手消息且有思考内容才显示思考框 -->
            <t-chat-reasoning v-if="reasoning && reasoning.trim() && role === 'assistant'" expand-icon-placement="right"
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
        <template v-if="!isStreamLoad && role === 'assistant'" #actions>
            <chat-action :is-good="isGood" :is-bad="isBad" :content="content || ''" @operation="handleOperation" />
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
    }
});

// 定义事件
const emit = defineEmits(['reasoning-expand-change', 'operation']);

// 处理操作事件，确保正确传递参数
const handleOperation = (type, options) => {
    emit('operation', type, options);
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

/* 确保Markdown内容中的元素没有边距 */
:deep(.zero-margins) {
    h1, h2, h3, h4, h5, h6 {
        margin-top: 0 !important;
        margin-bottom: 8px !important;
        padding: 0 !important;
        line-height: normal !important;
    }
}
</style>
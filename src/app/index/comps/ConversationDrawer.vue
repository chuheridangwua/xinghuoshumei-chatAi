<template>
    <!-- 侧边抽屉 - 对话列表 -->
    <t-drawer :visible="visible" @update:visible="$emit('update:visible', $event)" placement="left"
        :close-on-overlay-click="true" :footer="false" title="对话列表">
        <t-list>
            <!-- 新对话选项 -->
            <t-list-item @click="$emit('new-conversation')" class="conversation-item"
                :class="{ 'active': currentConversationId === '' }">
                <t-icon name="add" class="conversation-icon" />
                <span class="conversation-text">新对话</span>
            </t-list-item>

            <!-- 使用抽取的组件来显示不同组的对话 -->
            <conversation-group 
                v-if="groupedConversations.today.length > 0"
                title="今日"
                :conversations="groupedConversations.today"
                :current-conversation-id="currentConversationId"
                @select="(value) => $emit('select', { value })"
                @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
                @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
                @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
            />
            
            <conversation-group 
                v-if="groupedConversations.yesterday.length > 0"
                title="昨日"
                :conversations="groupedConversations.yesterday"
                :current-conversation-id="currentConversationId"
                @select="(value) => $emit('select', { value })"
                @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
                @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
                @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
            />
            
            <conversation-group 
                v-if="groupedConversations.lastWeek.length > 0"
                title="过去7天"
                :conversations="groupedConversations.lastWeek"
                :current-conversation-id="currentConversationId"
                @select="(value) => $emit('select', { value })"
                @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
                @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
                @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
            />
            
            <conversation-group 
                v-if="groupedConversations.older.length > 0"
                title="更早"
                :conversations="groupedConversations.older"
                :current-conversation-id="currentConversationId"
                @select="(value) => $emit('select', { value })"
                @pin-conversation="(id) => $emit('pin-conversation', { conversationId: id })"
                @rename-conversation="(id) => $emit('rename-conversation', { conversationId: id })"
                @delete-conversation="(id) => $emit('select', { value: `delete-${id}` })"
            />

            <!-- 加载更多选项 -->
            <div v-if="hasMoreConversations" class="load-more-container">
                <t-button size="small" variant="text" :loading="loadingMoreConversations" @click="$emit('load-more')">
                    加载更多会话
                </t-button>
            </div>
            
            <!-- 主题切换按钮 -->
            <div class="theme-toggle-container">
                <t-button variant="text" size="small" class="theme-toggle-btn" @click="toggleTheme">
                    <t-icon :name="currentTheme === 'dark' ? 'sunny' : 'moon'" />
                    <span class="theme-text">{{ currentTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式' }}</span>
                </t-button>
            </div>
        </t-list>
    </t-drawer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ConversationGroup from './ConversationGroup.vue';
import { getThemeMode, toggleThemeMode, ThemeMode } from '/static/app/api/theme.js';

// 组件属性
const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    currentConversationId: {
        type: String,
        default: ''
    },
    groupedConversations: {
        type: Object,
        default: () => ({
            today: [],
            yesterday: [],
            lastWeek: [],
            older: []
        })
    },
    hasMoreConversations: {
        type: Boolean,
        default: false
    },
    loadingMoreConversations: {
        type: Boolean,
        default: false
    }
});

// 添加主题相关状态
const currentTheme = ref(getThemeMode());

// 主题切换方法
const toggleTheme = () => {
    toggleThemeMode();
    currentTheme.value = getThemeMode();
};

// 在组件挂载时获取当前主题
onMounted(() => {
    currentTheme.value = getThemeMode();
});

// 定义事件
const emit = defineEmits(['update:visible', 'select', 'new-conversation', 'load-more', 'rename-conversation', 'pin-conversation']);
</script>

<style lang="scss" scoped>
@import '/static/app/styles/variables.scss';

.conversation-item {
    display: flex;
    align-items: center;
    padding: $comp-paddingTB-s $comp-paddingLR-m;
    margin-bottom: $size-1;
    border-radius: $radius-default;
    transition: all 0.3s ease;
    position: relative;

    &:hover {
        background-color: $bg-color-container-hover;
    }

    &.active {
        background-color: $brand-color-light;
        color: $brand-color;

        .conversation-icon {
            color: $brand-color;
        }
    }

    .conversation-icon {
        margin-right: $size-2;
        color: $text-color-secondary;
    }

    .conversation-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.load-more-container {
    display: flex;
    justify-content: center;
    padding: $comp-paddingTB-s 0;
    margin-top: $comp-margin-s;
    border-top: 1px solid $component-stroke;
}

.theme-toggle-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    padding: $comp-paddingTB-s 0;
    border-top: 1px solid $component-stroke;
}

.theme-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-color-secondary;
    transition: color 0.3s ease;
    
    &:hover {
        color: $brand-color;
    }
    
    .t-icon {
        margin-right: $size-2;
        font-size: 16px;
    }
    
    .theme-text {
        font-size: $font-size-body-small;
        line-height: 1.2;
    }
}
</style>
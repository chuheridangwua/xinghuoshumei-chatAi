<template>
    <!-- 侧边抽屉 - 对话列表 -->
    <t-drawer
        :visible="visible"
        @update:visible="$emit('update:visible', $event)"
        placement="left"
        :close-on-overlay-click="true"
        :footer="false"
        title="对话列表"
    >
        <t-list>
            <!-- 新对话选项 -->
            <t-list-item 
                @click="$emit('new-conversation')"
                class="conversation-item"
                :class="{ 'active': currentConversationId === '' }"
            >
                <t-icon name="add" class="conversation-icon" />
                <span class="conversation-text">新对话</span>
            </t-list-item>
            
            <!-- 今日对话 -->
            <div v-if="groupedConversations.today.length > 0" class="conversation-group">
                <div class="group-title">今日</div>
                <t-list-item 
                    v-for="conversation in groupedConversations.today" 
                    :key="conversation.id"
                    @click="$emit('select', { value: conversation.id })"
                    class="conversation-item"
                    :class="{ 'active': conversation.id === currentConversationId }"
                >
                    <t-icon name="chat" class="conversation-icon" />
                    <span class="conversation-text">{{ getConversationTitle(conversation) }}</span>
                    
                    <!-- 删除按钮 -->
                    <t-button 
                        variant="text" 
                        shape="circle" 
                        size="small" 
                        class="delete-btn"
                        @click.stop="$emit('select', { value: `delete-${conversation.id}` })"
                    >
                        <t-icon name="delete" />
                    </t-button>
                </t-list-item>
            </div>
            
            <!-- 昨日对话 -->
            <div v-if="groupedConversations.yesterday.length > 0" class="conversation-group">
                <div class="group-title">昨日</div>
                <t-list-item 
                    v-for="conversation in groupedConversations.yesterday" 
                    :key="conversation.id"
                    @click="$emit('select', { value: conversation.id })"
                    class="conversation-item"
                    :class="{ 'active': conversation.id === currentConversationId }"
                >
                    <t-icon name="chat" class="conversation-icon" />
                    <span class="conversation-text">{{ getConversationTitle(conversation) }}</span>
                    
                    <!-- 删除按钮 -->
                    <t-button 
                        variant="text" 
                        shape="circle" 
                        size="small" 
                        class="delete-btn"
                        @click.stop="$emit('select', { value: `delete-${conversation.id}` })"
                    >
                        <t-icon name="delete" />
                    </t-button>
                </t-list-item>
            </div>
            
            <!-- 过去7天对话 -->
            <div v-if="groupedConversations.lastWeek.length > 0" class="conversation-group">
                <div class="group-title">过去7天</div>
                <t-list-item 
                    v-for="conversation in groupedConversations.lastWeek" 
                    :key="conversation.id"
                    @click="$emit('select', { value: conversation.id })"
                    class="conversation-item"
                    :class="{ 'active': conversation.id === currentConversationId }"
                >
                    <t-icon name="chat" class="conversation-icon" />
                    <span class="conversation-text">{{ getConversationTitle(conversation) }}</span>
                    
                    <!-- 删除按钮 -->
                    <t-button 
                        variant="text" 
                        shape="circle" 
                        size="small" 
                        class="delete-btn"
                        @click.stop="$emit('select', { value: `delete-${conversation.id}` })"
                    >
                        <t-icon name="delete" />
                    </t-button>
                </t-list-item>
            </div>
            
            <!-- 更早的对话 -->
            <div v-if="groupedConversations.older.length > 0" class="conversation-group">
                <div class="group-title">更早</div>
                <t-list-item 
                    v-for="conversation in groupedConversations.older" 
                    :key="conversation.id"
                    @click="$emit('select', { value: conversation.id })"
                    class="conversation-item"
                    :class="{ 'active': conversation.id === currentConversationId }"
                >
                    <t-icon name="chat" class="conversation-icon" />
                    <span class="conversation-text">{{ getConversationTitle(conversation) }}</span>
                    
                    <!-- 删除按钮 -->
                    <t-button 
                        variant="text" 
                        shape="circle" 
                        size="small" 
                        class="delete-btn"
                        @click.stop="$emit('select', { value: `delete-${conversation.id}` })"
                    >
                        <t-icon name="delete" />
                    </t-button>
                </t-list-item>
            </div>
            
            <!-- 加载更多选项 -->
            <div v-if="hasMoreConversations" class="load-more-container">
                <t-button size="small" variant="text" :loading="loadingMoreConversations" @click="$emit('load-more')">
                    加载更多会话
                </t-button>
            </div>
        </t-list>
    </t-drawer>
</template>

<script setup lang="ts">
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

// 定义事件
defineEmits(['update:visible', 'select', 'new-conversation', 'load-more']);

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
</script>

<style lang="scss" scoped>
@import '/static/app/styles/variables.scss';

/* 对话列表抽屉样式 */
.conversation-group {
    margin-bottom: $comp-margin-m;
    
    .group-title {
        font-size: $font-size-body-small;
        color: $text-color-secondary;
        padding: $comp-paddingTB-xs $comp-paddingLR-m;
        margin-bottom: $size-1;
        font-weight: 500;
        position: sticky;
        top: 0;
        background-color: $bg-color-container;
        z-index: 10;
        backdrop-filter: blur(5px);
        border-bottom: 1px solid $component-stroke;
    }
}

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
    
    .delete-btn {
        /* 移除透明度，使按钮始终可见 */
        opacity: 1;
        color: $text-color-secondary;
        transition: all 0.3s ease;
        
        &:hover {
            color: $error-color;
            background-color: $error-color-light;
        }

        /* 活跃状态样式 */
        &:active {
            color: $error-color;
            background-color: $error-color-light;
            transform: scale(0.95);
        }
    }
}

.load-more-container {
    display: flex;
    justify-content: center;
    padding: $comp-paddingTB-s 0;
    margin-top: $comp-margin-s;
    border-top: 1px solid $component-stroke;
}
</style> 
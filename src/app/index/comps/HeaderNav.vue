<template>
    <!-- 固定的头部导航栏 -->
    <div class="fixed-header">
        <!-- 左侧菜单图标，点击打开抽屉 -->
        <t-button variant="text" class="header-icon" @click="$emit('open-drawer')">
            <t-icon name="menu" />
        </t-button>

        <!-- 中间标题 -->
        <div class="header-title">
            {{ title }}
        </div>

        <!-- 右侧新建对话按钮 -->
        <t-button variant="text" class="header-icon" @click="$emit('new-conversation')">
            <t-icon name="add" />
        </t-button>
    </div>
</template>

<script setup lang="ts">
defineProps({
    title: {
        type: String,
        default: '新对话'
    }
});

defineEmits(['open-drawer', 'new-conversation']);
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.fixed-header {
    box-sizing: border-box;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: $comp-paddingLR-s $comp-paddingLR-m;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid $component-stroke;
    transition: all 0.3s ease;

    .t-button {
        transition: all 0.25s ease;

        &:hover {
            transform: translateY(-1px);
        }
    }

    .header-icon {
        color: $text-color-secondary;

        &:hover {
            color: $brand-color;
        }
    }

    .header-title {
        font-size: $font-size-body-medium;
        color: $text-color-primary;
        font-weight: 500;
        text-align: center;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        @media (max-width: 768px) {
            font-size: $font-size-body-small;
            max-width: 50%;
        }
    }
}

:root[theme-mode="light"] {
    .fixed-header {
        background-color: $gray-color-1 !important;
    }
}

:root[theme-mode="dark"] {
    .fixed-header {
        background-color: $bg-color-container !important;
    }
}
</style>
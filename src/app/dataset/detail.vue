<template>
    <div class="dataset-detail-container">
        <t-breadcrumb class="breadcrumb">
            <t-breadcrumb-item @click="backToList">知识库列表</t-breadcrumb-item>
            <t-breadcrumb-item>知识库文档</t-breadcrumb-item>
        </t-breadcrumb>

        <t-card title="文档列表" class="document-list-card">
            <template #actions>
                <t-button theme="primary" @click="uploadDocument">上传文档</t-button>
            </template>

            <t-loading :loading="loading">
                <div v-if="documentList.length > 0" class="debug-info">
                    已加载 {{ documentList.length }} 条记录
                </div>
                
                <t-table 
                    :data="documentList" 
                    :columns="columns" 
                    row-key="id"
                    stripe
                    hover
                    :pagination="pagination"
                    @page-change="onPaginationChange" 
                    empty="暂无文档"
                >
                    <template #statusCol="{ row }">
                        <t-tag :theme="getStatusTag(row.display_status).theme">
                            {{ getStatusTag(row.display_status).text }}
                        </t-tag>
                    </template>
                    <template #createdAtCol="{ row }">
                        {{ formatDate(row.created_at) }}
                    </template>
                </t-table>
            </t-loading>
        </t-card>
    </div>
</template>



<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDocumentList } from '/static/app/api/dataset.js';

const route = useRoute();
const router = useRouter();
const datasetId = ref(route.params.id);
const loading = ref(true);
const documentList = ref([]);
const pagination = ref({
    current: 1,
    pageSize: 10,
    total: 0
});

// 格式化日期
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
};

// 定义表格列
const columns = [
    { colKey: 'index', title: '序号', width: '80', cell: (h, { rowIndex }) => (pagination.value.current - 1) * pagination.value.pageSize + rowIndex + 1 },
    { colKey: 'name', title: '文档名称' },
    { colKey: 'display_status', title: '状态', cell: 'statusCol' },
    { colKey: 'word_count', title: '字数' },
    { colKey: 'created_at', title: '创建时间', cell: 'createdAtCol' }
];

// 获取文档列表
const fetchDocumentList = async () => {
    loading.value = true;
    try {
        const response = await getDocumentList(datasetId.value, {
            page: pagination.value.current,
            limit: pagination.value.pageSize
        });

        // 确保数据是数组
        if (Array.isArray(response.data)) {
            documentList.value = response.data;
        } else if (response.data) {
            documentList.value = [response.data];
        } else {
            documentList.value = [];
        }

        pagination.value.total = response.total || 0;
        console.log('获取到文档列表:', documentList.value);
    } catch (error) {
        console.error('获取文档列表失败:', error);
        MessagePlugin.error('获取文档列表失败');
        documentList.value = [];
    } finally {
        loading.value = false;
    }
};

// 分页变化
const onPaginationChange = (pageInfo) => {
    pagination.value.current = pageInfo.current;
    pagination.value.pageSize = pageInfo.pageSize;
    fetchDocumentList();
};

// 上传文档
const uploadDocument = () => {
    router.push(`/app/dataset/upload/${datasetId.value}`);
};

// 返回列表
const backToList = () => {
    router.push('/app/dataset');
};

// 获取文档状态标签
const getStatusTag = (status) => {
    const statusMap = {
        waiting: { text: '等待中', theme: 'warning' },
        indexing: { text: '处理中', theme: 'primary' },
        completed: { text: '已完成', theme: 'success' },
        error: { text: '错误', theme: 'danger' },
        queuing: { text: '排队中', theme: 'warning' }
    };

    return statusMap[status] || { text: status, theme: 'default' };
};

// 初始化加载
onMounted(() => {
    fetchDocumentList();
});
</script>



<style lang="scss">
@import '/static/app/styles/variables.scss';

.dataset-detail-container {
    padding: $comp-paddingTB-l $comp-paddingLR-l;
}

.breadcrumb {
    margin-bottom: $comp-margin-m;
}

.document-list-card {
    margin-bottom: $comp-margin-m;
}

.debug-info {
    margin-bottom: 10px;
    color: #999;
    font-size: 12px;
}
</style>
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
                        <div class="status-wrapper">
                            <t-loading v-if="isProcessingStatus(row.display_status)" size="small" :loading="true" />
                            <t-tag :theme="getStatusTag(row.display_status).theme">
                                {{ getStatusTag(row.display_status).text }}
                            </t-tag>
                            <t-progress 
                                v-if="isProcessingStatus(row.display_status) && processingDocuments[row.id] && processingDocuments[row.id].total_segments > 0"
                                theme="line"
                                size="small"
                                :percentage="calculateProgress(processingDocuments[row.id])"
                                :label="false"
                                class="status-progress"
                            />
                        </div>
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
import { onMounted, ref, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDocumentList, getDocumentIndexingStatus } from '/static/app/api/dataset.js';

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

// 处理中文档的状态
const processingDocuments = ref({});
const statusCheckInterval = ref(null);

// 格式化日期
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
};

// 判断是否为处理中状态
const isProcessingStatus = (status) => {
    return ['waiting', 'queuing', 'indexing'].includes(status);
};

// 定义表格列
const columns = [
    { colKey: 'index', title: '序号', width: '80', cell: (h, { rowIndex }) => (pagination.value.current - 1) * pagination.value.pageSize + rowIndex + 1 },
    { colKey: 'name', title: '文档名称' },
    { colKey: 'display_status', title: '状态', cell: 'statusCol', width: '180' },
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
        
        // 检查处理中的文档
        checkProcessingDocuments();
    } catch (error) {
        console.error('获取文档列表失败:', error);
        MessagePlugin.error('获取文档列表失败');
        documentList.value = [];
    } finally {
        loading.value = false;
    }
};

// 检查处理中的文档
const checkProcessingDocuments = () => {
    // 清理之前的状态检查
    if (statusCheckInterval.value) {
        clearInterval(statusCheckInterval.value);
    }
    
    // 筛选出处理中的文档
    const processingDocs = documentList.value.filter(doc => isProcessingStatus(doc.display_status));
    
    if (processingDocs.length > 0) {
        // 立即检查一次
        processingDocs.forEach(doc => {
            if (doc.batch) {
                checkDocumentStatus(doc.id, doc.batch);
            }
        });
        
        // 设置定时检查
        statusCheckInterval.value = setInterval(() => {
            let hasProcessing = false;
            
            documentList.value.forEach(doc => {
                if (isProcessingStatus(doc.display_status) && doc.batch) {
                    checkDocumentStatus(doc.id, doc.batch);
                    hasProcessing = true;
                }
            });
            
            // 如果没有正在处理的文档，停止检查
            if (!hasProcessing) {
                clearInterval(statusCheckInterval.value);
            }
        }, 500); // 更新间隔为0.5秒
    }
};

// 检查单个文档状态
const checkDocumentStatus = async (docId, batch) => {
    try {
        const response = await getDocumentIndexingStatus(datasetId.value, batch);
        if (response && response.data && response.data.length > 0) {
            const status = response.data[0];
            
            // 更新处理状态
            processingDocuments.value[docId] = status;
            
            // 如果状态已变化，刷新列表
            if (status.indexing_status === 'completed' || status.indexing_status === 'error') {
                // 给状态变化一点延迟，确保后端状态已更新
                setTimeout(() => {
                    fetchDocumentList();
                }, 1000);
            }
        }
    } catch (error) {
        console.error('获取文档处理状态失败:', error);
    }
};

// 计算进度百分比
const calculateProgress = (statusData) => {
    if (!statusData || !statusData.total_segments || statusData.total_segments === 0) {
        return 0;
    }
    return Math.floor((statusData.completed_segments / statusData.total_segments) * 100);
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

// 初始化加载
onMounted(() => {
    fetchDocumentList();
});

// 组件卸载时清理
onUnmounted(() => {
    if (statusCheckInterval.value) {
        clearInterval(statusCheckInterval.value);
    }
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

.status-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 150px; // 确保有足够空间显示进度条
    
    .t-tag {
        flex-shrink: 0; // 防止标签被压缩
    }

    .status-progress {
        flex-grow: 1; // 让进度条填充剩余空间
    }
}
</style>
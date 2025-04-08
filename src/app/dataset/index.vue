<template>
    <div class="dataset-container">
        <t-card title="知识库管理" class="dataset-card">
            <t-loading :loading="loading">
                <div v-if="datasetList.length > 0" class="debug-info">
                    已加载 {{ datasetList.length }} 条记录
                </div>
                
                <t-table 
                    :data="datasetList" 
                    :columns="columns" 
                    :pagination="pagination" 
                    row-key="id"
                    stripe
                    hover
                    @page-change="onPaginationChange"
                    empty="暂无数据"
                >
                    <template #operationCol="{ row }">
                        <t-space>
                            <t-button theme="primary" variant="text" @click="viewDatasetDetail(row)">查看</t-button>
                        </t-space>
                    </template>
                </t-table>
            </t-loading>
        </t-card>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDatasetList } from '/static/app/api/dataset.js';

const router = useRouter();
const loading = ref(true);
const datasetList = ref([]);
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
    { colKey: 'name', title: '知识库名称' },
    { colKey: 'description', title: '描述', cell: (h, { row }) => row?.description || '暂无描述' },
    { colKey: 'document_count', title: '文档数量' },
    { colKey: 'created_at', title: '创建时间', cell: (h, { row }) => formatDate(row?.created_at) },
    { colKey: 'operation', title: '操作', width: '160', fixed: 'right', cell: 'operationCol' }
];

// 获取知识库列表
const fetchDatasetList = async () => {
    loading.value = true;
    try {
        const response = await getDatasetList({
            page: pagination.value.current,
            limit: pagination.value.pageSize
        });
        
        // 确保数据是数组
        if (Array.isArray(response.data)) {
            datasetList.value = response.data;
        } else if (response.data) {
            datasetList.value = [response.data];
        } else {
            datasetList.value = [];
        }
        
        pagination.value.total = response.total || 0;
        console.log('获取到知识库列表:', datasetList.value);
    } catch (error) {
        console.error('获取知识库列表失败:', error);
        MessagePlugin.error('获取知识库列表失败');
        datasetList.value = [];
    } finally {
        loading.value = false;
    }
};

// 查看知识库详情
const viewDatasetDetail = (dataset) => {
    router.push(`/app/dataset/detail/${dataset.id}`);
};

// 分页变化
const onPaginationChange = (pageInfo) => {
    pagination.value.current = pageInfo.current;
    pagination.value.pageSize = pageInfo.pageSize;
    fetchDatasetList();
};

// 初始化加载
onMounted(() => {
    fetchDatasetList();
});
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.dataset-container {
    padding: $comp-paddingTB-l $comp-paddingLR-l;
}

.dataset-card {
    margin-bottom: $comp-margin-m;
}

.debug-info {
    margin-bottom: 10px;
    color: #999;
    font-size: 12px;
}
</style>
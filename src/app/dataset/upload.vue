<template>
    <div class="dataset-upload-container">
      <t-breadcrumb class="breadcrumb">
        <t-breadcrumb-item @click="backToDetail">知识库文档</t-breadcrumb-item>
        <t-breadcrumb-item>上传文档</t-breadcrumb-item>
      </t-breadcrumb>
      
      <t-card title="上传文档">
        <t-loading :loading="loading">
          <t-form class="upload-form" label-width="120px">
            <t-form-item label="文档文件" name="file">
              <t-input v-if="selectedFileName" :value="selectedFileName" readonly placeholder="已选择文件" :style="{ marginBottom: '8px' }">
                <template #suffix>
                  <t-icon name="close-circle-filled" @click="clearSelectedFile" style="cursor: pointer;" />
                </template>
              </t-input>
              <t-button v-if="!selectedFileName" @click="openFileSelector">
                选择文件
              </t-button>
              <input type="file" ref="fileInput" style="display: none;" accept=".txt,.md,.mdx,.pdf,.html,.htm,.xlsx,.xls,.docx,.csv" @change="onFileSelected" />
            </t-form-item>
            
            <t-form-item>
              <div class="file-limits">
                支持的文件类型：TXT、MD、MDX、PDF、HTML、XLSX、XLS、DOCX、CSV、HTM，单个文件不超过15MB
              </div>
            </t-form-item>
            
            <t-form-item v-if="isUploading">
              <t-progress :percentage="uploadProgress" :color="{ from: '#0052D9', to: '#00A870' }" />
              <div class="upload-status">
                <span>状态: {{ uploadStatusText }}</span>
                <span v-if="indexingStatus">已处理: {{ indexingStatus.completed_segments || 0 }}/{{ indexingStatus.total_segments || 0 }} 段</span>
              </div>
            </t-form-item>
            
            <t-form-item>
              <t-space>
                <t-button theme="primary" @click="uploadSelectedFile" :loading="loading" :disabled="!selectedFile || isUploading">上传</t-button>
                <t-button theme="default" @click="backToDetail">取消</t-button>
              </t-space>
            </t-form-item>
          </t-form>
        </t-loading>
      </t-card>

      <div class="form-actions">
        <t-button theme="default" @click="backToDetail">返回文档列表</t-button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { createDocumentByFile, getDocumentIndexingStatus } from '/static/app/api/dataset.js';

const route = useRoute();
const router = useRouter();
const datasetId = ref(route.params.id);
const loading = ref(false);

// 文件选择相关
const fileInput = ref(null);
const selectedFile = ref(null);
const selectedFileName = ref('');

// 上传状态相关
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadStatusText = ref('准备中');
const indexingStatus = ref(null);
const batchId = ref('');
const statusCheckInterval = ref(null);

// 文件表单默认配置
const fileForm = ref({
  indexing_technique: 'high_quality',
  doc_form: 'hierarchical_model',
  doc_language: 'Chinese',
  embedding_model: 'bge-m3:latest',
  embedding_model_provider: 'langgenius/ollama/ollama',
  retrieval_model: {
    search_method: 'hybrid_search',
    reranking_enable: true,
    reranking_model: {
      reranking_provider_name: 'langgenius/xinference/xinference',
      reranking_model_name: 'bge-reranker-v2-m3'
    },
    top_k: 8,
    score_threshold_enabled: true,
    score_threshold: 0.15,
    reranking_mode: 'reranking_model',
    weights: {
      weight_type: 'customized',
      vector_setting: {
        vector_weight: 0.7,
        embedding_provider_name: '',
        embedding_model_name: ''
      },
      keyword_setting: {
        keyword_weight: 0.3
      }
    }
  },
  process_rule: {
    mode: 'hierarchical',
    rules: {
      pre_processing_rules: [
        { id: 'remove_extra_spaces', enabled: true },
        { id: 'remove_urls_emails', enabled: false }
      ],
      segmentation: {
        separator: '\n\n',
        max_tokens: 500
      },
      parent_mode: 'paragraph',
      subchunk_segmentation: {
        separator: '\n',
        max_tokens: 200
      }
    }
  }
});

// 打开文件选择器
const openFileSelector = () => {
  fileInput.value.click();
};

// 处理文件选择
const onFileSelected = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
    selectedFileName.value = files[0].name;
  }
};

// 清除已选择文件
const clearSelectedFile = () => {
  selectedFile.value = null;
  selectedFileName.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// 检查上传状态
const checkUploadStatus = async () => {
  if (!batchId.value) return;
  
  try {
    const response = await getDocumentIndexingStatus(datasetId.value, batchId.value);
    if (response && response.data && response.data.length > 0) {
      indexingStatus.value = response.data[0];
      
      // 更新进度信息
      const status = indexingStatus.value.indexing_status;
      uploadStatusText.value = getStatusText(status);
      
      // 计算进度百分比
      if (indexingStatus.value.total_segments > 0) {
        uploadProgress.value = Math.floor((indexingStatus.value.completed_segments / indexingStatus.value.total_segments) * 100);
      }
      
      // 如果已完成或出错，停止检查
      if (status === 'completed' || status === 'error') {
        clearInterval(statusCheckInterval.value);
        isUploading.value = false;
        
        if (status === 'completed') {
          MessagePlugin.success('文档处理完成');
          setTimeout(() => {
            router.push(`/app/dataset/detail/${datasetId.value}`);
          }, 1500);
        } else if (status === 'error') {
          MessagePlugin.error(`处理失败: ${indexingStatus.value.error || '未知错误'}`);
        }
      }
    }
  } catch (error) {
    console.error('获取上传状态失败:', error);
  }
};

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'waiting': '等待中',
    'queuing': '排队中',
    'indexing': '处理中',
    'completed': '已完成',
    'error': '错误'
  };
  return statusMap[status] || status;
};

// 上传选中的文件
const uploadSelectedFile = async () => {
  if (!selectedFile.value) {
    MessagePlugin.warning('请先选择一个文件');
    return;
  }
  
  // 检查文件大小，限制为15MB
  if (selectedFile.value.size > 15 * 1024 * 1024) {
    MessagePlugin.error('文件大小不能超过15MB');
    return;
  }
  
  try {
    loading.value = true;
    isUploading.value = true;
    uploadProgress.value = 0;
    uploadStatusText.value = '上传中';
    
    const formData = new FormData();
    
    // 添加文件
    formData.append('file', selectedFile.value);
    
    // 准备数据对象
    const dataObj = {...fileForm.value};
    
    console.log('准备上传文件:', selectedFile.value.name, '配置:', dataObj);
    formData.append('data', JSON.stringify(dataObj));
    
    // 上传文件
    const result = await createDocumentByFile(datasetId.value, formData);
    console.log('文件上传成功:', result);
    
    // 提示成功并返回列表页
    MessagePlugin.success('文件已上传，正在处理中');
    router.push(`/app/dataset/detail/${datasetId.value}`);
  } catch (error) {
    console.error('文件上传失败:', error);
    MessagePlugin.error('文件上传失败');
    isUploading.value = false;
  } finally {
    loading.value = false;
  }
};

// 返回详情页
const backToDetail = () => {
  // 如果正在上传，确认是否取消
  if (isUploading.value) {
    if (confirm('文件正在处理中，确定要离开吗？')) {
      clearInterval(statusCheckInterval.value);
      router.push(`/app/dataset/detail/${datasetId.value}`);
    }
  } else {
    router.push(`/app/dataset/detail/${datasetId.value}`);
  }
};

// 组件卸载时清理
onUnmounted(() => {
  if (statusCheckInterval.value) {
    clearInterval(statusCheckInterval.value);
  }
});
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.dataset-upload-container {
  padding: $comp-paddingTB-l $comp-paddingLR-l;
}

.breadcrumb {
  margin-bottom: $comp-margin-m;
}

.upload-form {
  max-width: 800px;
  margin: 0 auto;
}

.file-limits {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  line-height: 1.5;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.upload-status {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
}
</style> 
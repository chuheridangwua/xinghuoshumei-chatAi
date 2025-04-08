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
              <input type="file" ref="fileInput" style="display: none;" accept=".pdf,.docx,.pptx,.txt,.md" @change="onFileSelected" />
            </t-form-item>
            
            <t-form-item>
              <t-space>
                <t-button theme="primary" @click="uploadSelectedFile" :loading="loading" :disabled="!selectedFile">上传</t-button>
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
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { createDocumentByFile } from '/static/app/api/dataset.js';

const route = useRoute();
const router = useRouter();
const datasetId = ref(route.params.id);
const loading = ref(false);

// 文件选择相关
const fileInput = ref(null);
const selectedFile = ref(null);
const selectedFileName = ref('');

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

// 上传选中的文件
const uploadSelectedFile = async () => {
  if (!selectedFile.value) {
    MessagePlugin.warning('请先选择一个文件');
    return;
  }
  
  try {
    loading.value = true;
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
    
    // 处理成功
    MessagePlugin.success('文件上传成功');
    router.push(`/app/dataset/detail/${datasetId.value}`);
  } catch (error) {
    console.error('文件上传失败:', error);
    MessagePlugin.error('文件上传失败');
  } finally {
    loading.value = false;
  }
};

// 返回详情页
const backToDetail = () => {
  router.push(`/app/dataset/detail/${datasetId.value}`);
};
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

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style> 
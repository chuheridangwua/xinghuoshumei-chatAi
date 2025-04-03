<template>
  <div class="chat-sender">
    <!-- 上传文件项展示 -->
    <div class="uploaded-files" v-if="uploadedFiles.length > 0">
      <t-space size="small" break-line>
        <t-tag v-for="(file, index) in uploadedFiles" 
               :key="index"
               theme="default"
               variant="light"
               shape="round"
               size="medium"
               class="file-tag">
          <t-icon name="file-excel" class="file-icon" />
          <span class="file-name">{{ file.name }}</span>
          <t-button theme="default" variant="text" size="small" class="close-btn" @click="removeFile(index)">
            <t-icon name="close" />
          </t-button>
        </t-tag>
      </t-space>
    </div>
    
    <div class="input-container">
      <div class="attach-button-wrapper">
        <input type="file" ref="fileInput" @change="handleFileSelected" class="file-input" accept=".xlsx,.xls" />
        <t-button v-if="!isUploading" theme="default" variant="text" class="attachment-btn" @click="triggerFileInput">
          <template #icon><t-icon name="attach" size="22px" /></template>
        </t-button>
        <div v-else class="loading-container">
          <t-progress theme="circle" size="40" :percentage="uploadProgress" :color="{ from: '#108ee9', to: '#87d068' }" />
        </div>
      </div>
      <t-chat-input v-model="query" :stop-disabled="loading" :textarea-props="{
        placeholder: '请输入消息...',
        class: 'custom-textarea'
      }" @send="handleSend" @stop="handleStop" autosize>
      </t-chat-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { MessagePlugin, DialogPlugin, Progress as TProgress, Tag as TTag, Space as TSpace, Button as TButton } from 'tdesign-vue-next';
import { parseExcelFile, logExcelData, splitDataIntoBlocks, destroyWorker } from '../../../utils/excelHandler';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send', 'stop']);

const query = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadedFiles = ref<Array<{name: string, size: number, data: any}>>([]);

// 分块配置
const blockOptions = {
  maxBlocks: 100,        // 最大分块数量
  minBlockSize: 1000,    // 最小块大小
  overlapRows: 10        // 重叠行数
};

const handleSend = (value: string) => {
  if (!value.trim()) return;
  emit('send', value);
};

const handleStop = () => {
  emit('stop');
};

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const removeFile = (index: number) => {
  uploadedFiles.value = uploadedFiles.value.filter((_, i) => i !== index);
};

const isExcelFile = (file: File): boolean => {
  const excelExtensions = ['.xlsx', '.xls'];
  const fileName = file.name.toLowerCase();
  return excelExtensions.some(ext => fileName.endsWith(ext));
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const updateProgress = (data: any) => {
  uploadProgress.value = data.progress || 0;
  
  // 控制台输出处理进度
  switch (data.phase) {
    case 'start':
      console.log('开始处理Excel文件...');
      break;
    case 'sheetInfo':
      console.log(`发现 ${data.totalSheets} 个工作表:`, data.sheetNames);
      break;
    case 'loading':
      console.log(`加载Excel数据: ${uploadProgress.value}%`);
      break;
    case 'parsing':
      console.log(`解析Excel数据: ${uploadProgress.value}%`);
      break;
    case 'sheetProcessed':
      console.log(`工作表 "${data.sheetName}" 已处理: ${data.totalRows} 行, ${data.blockCount} 数据块`);
      break;
  }
};

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  
  if (!files || files.length === 0) {
    return;
  }
  
  const file = files[0];
  
  // 检查是否为Excel文件
  if (!isExcelFile(file)) {
    MessagePlugin.info('附件上传功能暂未实现，仅支持Excel文件(.xlsx, .xls)');
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }
  
  // 检查文件大小
  if (file.size > 100 * 1024 * 1024) { // 大于100MB给予警告
    const confirmResult = await DialogPlugin.confirm({
      header: '文件过大',
      body: `文件大小为 ${formatFileSize(file.size)}，处理可能需要较长时间，确定继续吗？`,
      confirmBtn: { theme: 'primary', content: '继续' },
      cancelBtn: { theme: 'default', content: '取消' },
    }).catch(() => false);
    
    if (!confirmResult) {
      // 用户取消，重置文件输入框
      if (fileInput.value) {
        fileInput.value.value = '';
      }
      return;
    }
  }
  
  // 设置上传状态
  isUploading.value = true;
  uploadProgress.value = 0;
  
  try {
    console.log(`开始处理Excel文件: "${file.name}" (${formatFileSize(file.size)})`);
    
    // 使用excelHandler解析Excel文件
    const excelData = await parseExcelFile(file, updateProgress);
    
    // 获取分块信息
    let blocks = [];
    if (excelData.blocks) {
      // 直接使用Worker返回的分块信息
      blocks = excelData.blocks;
    } else if (excelData.data && excelData.data.length > 0) {
      // 执行数据分块
      blocks = splitDataIntoBlocks(excelData.data, blockOptions);
    }
    
    // 仅输出到控制台，不在页面显示
    console.group(`===== Excel文件 "${file.name}" 解析结果 =====`);
    console.log(`文件大小: ${formatFileSize(file.size)}`);
    console.log(`工作表数量: ${excelData.totalSheets}`);
    console.log(`工作表列表: ${excelData.sheetNames.join(', ')}`);
    console.log(`总行数: ${excelData.totalRows}`);
    console.log(`数据块数量: ${blocks.length}`);
    console.groupEnd();
    
    // 输出详细数据到控制台
    logExcelData(excelData, { 
      showAllSheets: true,
      useBlocks: true,
      blockOptions
    });
    
    // 添加到上传文件列表
    uploadedFiles.value.push({
      name: file.name,
      size: file.size,
      data: excelData
    });
    
    // 显示成功消息
    MessagePlugin.success(`Excel文件 "${file.name}" 已成功处理，输出结果请查看控制台`);
    
    // 大文件处理完成后提示用户可以释放内存
    if (file.size > 50 * 1024 * 1024) {
      setTimeout(() => {
        destroyWorker();
        console.log('已释放Worker资源');
      }, 3000);
    }
  } catch (error: any) {
    console.error('处理Excel文件出错:', error);
    MessagePlugin.error(error.message || '处理Excel文件失败');
  } finally {
    // 重置上传状态
    isUploading.value = false;
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};

// 组件卸载时清理资源
onUnmounted(() => {
  destroyWorker();
});
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.chat-sender {
  padding: 0 $comp-margin-xs;
  display: flex;
  flex-direction: column;
}

.uploaded-files {
  padding: 4px 8px;
}

.file-tag {
  display: inline-flex;
  align-items: center;
  margin: 4px;
  padding: 2px 6px 2px 10px;
  background-color: var(--td-bg-color-container, $gray-color-1);
  border-color: var(--td-component-border, $gray-color-3);
  
  .file-icon {
    color: $success-color-7;
    font-size: 16px;
    margin-right: 6px;
  }
  
  .file-name {
    color: var(--td-text-color-primary, $font-gray-1);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .close-btn {
    width: 16px;
    height: 16px;
    margin-left: 8px;
    padding: 0;
    line-height: 1;
    color: var(--td-text-color-secondary, $font-gray-3);
    
    .t-icon {
      font-size: 14px;
    }
    
    &:hover {
      color: $error-color-6;
      background: none;
    }
  }
}

.input-container {
  display: flex;
  align-items: center;
  position: relative;
}

.attach-button-wrapper {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  z-index: -1;
}

.attachment-btn {
  color: var(--td-text-color-placeholder, $font-gray-4);
  font-size: 22px;
  padding: 2px 4px;
  
  &:hover {
    color: $brand-color-6;
  }
}

.loading-container {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn {
  color: var(--td-text-color-placeholder, $font-gray-4);
  border: none;

  &:hover {
    color: $brand-color-6;
    border: none;
    background: none;
  }
}

.t-chat__footer .t-chat__footer__content {
  margin-top: 0 !important;
}

/* 增加左侧内边距，为附件按钮腾出空间 */
.t-textarea__inner {
  padding-left: 55px !important;
}
</style>

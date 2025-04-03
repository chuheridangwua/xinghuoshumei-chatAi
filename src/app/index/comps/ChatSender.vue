<template>
  <div class="chat-sender">
    <!-- 上传文件项展示 -->
    <div class="uploaded-files" v-if="uploadedFiles.length > 0">
      <div class="files-scroll-container">
        <t-tag v-for="(file, index) in uploadedFiles" :key="index" theme="default" variant="light" shape="round"
          size="medium" class="file-tag">
          <t-icon :name="getFileIcon(file.extension)" class="file-icon" />
          <span class="file-name">{{ formatFileName(file.name) }}</span>
          <t-button theme="default" variant="text" size="small" class="close-btn" @click="removeFile(index)">
            <t-icon name="close" />
          </t-button>
        </t-tag>
      </div>
    </div>

    <div class="input-container">
      <div class="attach-button-wrapper">
        <input type="file" ref="fileInput" @change="handleFileSelected" class="file-input"
          accept=".txt,.md,.mdx,.pdf,.html,.xlsx,.xls,.docx,.csv,.htm,.markdown" />
        <t-button v-if="!isUploading" theme="default" variant="text" class="attachment-btn" @click="triggerFileInput">
          <template #icon><t-icon name="attach" size="22px" /></template>
        </t-button>
        <div v-else class="loading-container">
          <t-progress theme="circle" size="40" :percentage="uploadProgress"
            :color="{ from: '#108ee9', to: '#87d068' }" />
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
import { API_CONFIG } from '/static/app/api/config.js';

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
const uploadedFiles = ref<Array<{ id: string, name: string, size: number, extension: string, mime_type: string }>>([]);

// 支持的文件类型
const supportedExtensions = ['txt', 'md', 'mdx', 'pdf', 'html', 'xlsx', 'xls', 'docx', 'csv', 'htm', 'markdown'];

// 最大文件大小(字节)
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// 最大文件数量
const MAX_FILES = 3;

// 文件类型映射
const fileTypeMap = {
  // 文档
  'txt': 'document',
  'md': 'document',
  'mdx': 'document',
  'markdown': 'document',
  'pdf': 'document',
  'html': 'document',
  'htm': 'document',
  'xlsx': 'document',
  'xls': 'document',
  'docx': 'document',
  'csv': 'document'
};

// 文件图标映射
const fileIconMap = {
  'document': 'file-excel',
  'default': 'file'
};

const getFileIcon = (extension: string) => {
  const fileType = fileTypeMap[extension.toLowerCase()] || 'default';
  return fileIconMap[fileType] || 'file';
};

const handleSend = (value: string) => {
  if (!value.trim() && uploadedFiles.value.length === 0) return;

  let message = value;
  const files = uploadedFiles.value.map(file => ({
    type: 'document', // 所有支持的类型都是文档类型
    transfer_method: 'local_file',
    upload_file_id: file.id
  }));

  emit('send', { message, files });

  // 清空已上传文件列表
  uploadedFiles.value = [];
};

const handleStop = () => {
  emit('stop');
};

const triggerFileInput = () => {
  if (uploadedFiles.value.length >= MAX_FILES) {
    MessagePlugin.warning(`最多只能上传${MAX_FILES}个附件`);
    return;
  }

  if (fileInput.value) {
    fileInput.value.click();
  }
};

const removeFile = (index: number) => {
  uploadedFiles.value = uploadedFiles.value.filter((_, i) => i !== index);
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatFileName = (fileName: string): string => {
  if (fileName.length <= 10) return fileName;
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  const name = fileName.slice(0, fileName.lastIndexOf('.'));
  if (name.length <= 7) return fileName; // 如果名称部分已经很短，保留全名
  return name.slice(0, 7) + '...' + extension;
};

const isFileTypeSupported = (filename: string): boolean => {
  const extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  return supportedExtensions.includes(extension);
};

// 检查文件是否已存在
const isFileDuplicate = (fileName: string): boolean => {
  return uploadedFiles.value.some(file => file.name === fileName);
};

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;

  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];

  // 检查是否已达到最大文件数量
  if (uploadedFiles.value.length >= MAX_FILES) {
    MessagePlugin.warning(`最多只能上传${MAX_FILES}个附件`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查是否重复文件
  if (isFileDuplicate(file.name)) {
    MessagePlugin.warning(`文件"${file.name}"已存在`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查文件类型
  if (!isFileTypeSupported(file.name)) {
    MessagePlugin.warning('暂不支持此类型的文件');
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    MessagePlugin.warning(`文件大小不能超过${formatFileSize(MAX_FILE_SIZE)}`);
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    return;
  }

  // 设置上传状态
  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    // 准备FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', localStorage.getItem('dify_user_id') || 'anonymous');

    // 模拟进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 5;
      }
    }, 100);

    // 发送上传请求
    const response = await fetch(`${API_CONFIG.baseURL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: formData
    });

    clearInterval(progressInterval);
    uploadProgress.value = 100;

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // 添加到上传文件列表
    uploadedFiles.value.push({
      id: result.id,
      name: result.name,
      size: result.size,
      extension: result.extension,
      mime_type: result.mime_type
    });

    // 显示成功消息
    MessagePlugin.success(`上传成功`);
  } catch (error: any) {
    console.error('上传文件出错:', error);
    MessagePlugin.error(error.message || '上传文件失败');
  } finally {
    // 重置上传状态
    isUploading.value = false;
    // 重置文件输入框
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
};
</script>

<style lang="scss">
@import '/static/app/styles/variables.scss';

.chat-sender {
  padding: $comp-margin-s $comp-margin-xs 0;
  display: flex;
  flex-direction: column;
}

.uploaded-files {
  padding: 4px 0;
  width: 100%;
}

.files-scroll-container {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  padding: 4px 8px;
  white-space: nowrap;
}

/* 隐藏滚动条但保留功能 */
.files-scroll-container::-webkit-scrollbar {
  height: 4px;
}

.files-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.file-tag {
  display: inline-flex;
  align-items: center;
  margin: 0 4px;
  padding: 2px 6px 2px 10px;
  background-color: var(--td-bg-color-container, $gray-color-1);
  border-color: var(--td-component-border, $gray-color-3);
  flex-shrink: 0;

  .file-icon {
    color: $success-color-7;
    font-size: 16px;
    margin-right: 6px;
    flex-shrink: 0;
  }

  .file-name {
    color: var(--td-text-color-primary, $font-gray-1);
    max-width: 120px;
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

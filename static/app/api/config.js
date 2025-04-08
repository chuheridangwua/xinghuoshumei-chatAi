/**
 * API配置文件
 * 统一管理API的基础URL和密钥
 */

/**
 * API基础配置
 */
export const API_CONFIG = {
    baseURL: '/api/v1', // 使用相对路径，通过Vite代理转发
    apiKey: 'app-JUQYZhaSvAhw9YtuhOCo66A6',  // Dify API 密钥
    workflowApiKey: 'app-6aRhLAp4zAppCJus5ViMgOsh',  // 工作流API密钥（用于标题生成）
    datasetApiKey: 'dataset-NU4Kg7Wtm1616AOnxnRAeFct'  // 知识库API密钥
};

/**
 * 创建API URL
 * @param {String} path - API路径
 * @param {String} customBaseUrl - 可选的自定义基础URL，默认使用API_CONFIG.baseURL
 * @returns {URL} 创建的URL对象
 */
export const createApiUrl = (path, customBaseUrl) => {
    const baseUrl = customBaseUrl || API_CONFIG.baseURL;
    const urlString = `${baseUrl}${path}`;
    const isAbsoluteUrl = urlString.startsWith('http://') || urlString.startsWith('https://');
    return isAbsoluteUrl ? new URL(urlString) : new URL(urlString, window.location.origin);
};

/**
 * 获取API配置
 * @returns {Object} API配置对象
 */
export const getApiConfig = () => {
    return API_CONFIG;
};

/**
 * 重设API配置
 * @param {Object} newConfig - 新的配置对象
 */
export const updateAPIConfig = (newConfig) => {
    if (newConfig.baseURL) {
        API_CONFIG.baseURL = newConfig.baseURL;
    }
    
    if (newConfig.apiKey) {
        API_CONFIG.apiKey = newConfig.apiKey;
    }
    
    if (newConfig.workflowApiKey) {
        API_CONFIG.workflowApiKey = newConfig.workflowApiKey;
    }

    if (newConfig.datasetBaseURL) {
        API_CONFIG.datasetBaseURL = newConfig.datasetBaseURL;
    }
    
    if (newConfig.datasetApiKey) {
        API_CONFIG.datasetApiKey = newConfig.datasetApiKey;
    }

    console.log('API配置已更新:', API_CONFIG);
    return API_CONFIG;
};
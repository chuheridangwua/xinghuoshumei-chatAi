/**
 * API配置文件
 * 统一管理API的基础URL和密钥
 */

/**
 * API基础配置
 */
export const API_CONFIG = {
    baseURL: 'http://192.168.79.122:8083/v1', // Dify API 基础URL
    apiKey: 'app-JUQYZhaSvAhw9YtuhOCo66A6',  // Dify API 密钥
    workflowApiKey: 'app-6aRhLAp4zAppCJus5ViMgOsh'  // 工作流API密钥（用于标题生成）
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

    console.log('API配置已更新:', API_CONFIG);
    return API_CONFIG;
};
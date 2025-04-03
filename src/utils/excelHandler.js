/**
 * Excel文件处理工具
 * 提供Excel文件的读取、解析和输出功能
 * 使用Web Worker实现大文件的后台处理
 */

// 从XLSX库切换为ExcelJS
import * as ExcelJS from 'exceljs';

// Worker实例缓存
let worker = null;

/**
 * 获取Excel处理Worker实例
 * @returns {Worker} Worker实例
 */
function getWorker() {
  if (!worker) {
    // 创建新的Worker实例 (使用ES模块类型)
    const workerURL = new URL('./excelWorker.js', import.meta.url);
    worker = new Worker(workerURL, { type: 'module' });
  }
  return worker;
}

/**
 * 使用Worker读取Excel文件并解析内容
 * @param {File} file - 要解析的Excel文件对象
 * @param {Object} options - 分块选项
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise} - 返回包含解析结果的Promise
 */
export const parseExcelFileWithWorker = (file, options = {}, progressCallback = null) => {
  return new Promise((resolve, reject) => {
    // 验证文件类型
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isExcel) {
      reject(new Error('只能上传Excel文件(.xlsx, .xls格式)'));
      return;
    }
    
    const worker = getWorker();
    
    // 监听Worker消息
    const messageHandler = (e) => {
      const data = e.data;
      
      switch (data.type) {
        case 'start':
          if (progressCallback) progressCallback({ phase: 'start', progress: 0 });
          break;
          
        case 'sheetInfo':
          if (progressCallback) progressCallback({ 
            phase: 'sheetInfo', 
            progress: 10, 
            sheetNames: data.sheetNames,
            totalSheets: data.totalSheets
          });
          break;
        
        case 'progress':
          if (progressCallback) progressCallback({ 
            phase: data.phase, 
            progress: data.progress 
          });
          break;
        
        case 'sheetProcessed':
          if (progressCallback) progressCallback({ 
            phase: 'sheetProcessed', 
            progress: data.progress,
            sheetName: data.sheetName,
            totalRows: data.totalRows,
            blockCount: data.blockCount
          });
          break;
        
        case 'complete':
          // 移除消息监听器，避免内存泄漏
          worker.removeEventListener('message', messageHandler);
          resolve(data.result);
          break;
        
        case 'error':
          // 移除消息监听器，避免内存泄漏
          worker.removeEventListener('message', messageHandler);
          reject(new Error(data.message));
          break;
      }
    };
    
    // 添加消息监听器
    worker.addEventListener('message', messageHandler);
    
    // 发送解析命令到Worker
    worker.postMessage({ 
      action: 'parse', 
      file,
      options: {
        maxBlocks: options.maxBlocks || 100,
        minBlockSize: options.minBlockSize || 1000,
        overlapRows: options.overlapRows || 10
      }
    });
  });
};

/**
 * 读取Excel文件并解析内容 (后向兼容原函数)
 * @param {File} file - 要解析的Excel文件对象
 * @returns {Promise} - 返回包含解析结果的Promise
 */
export const parseExcelFile = (file, progressCallback = null) => {
  // 小于10MB的文件使用原来的方法，大文件使用Worker方法
  if (file.size < 10 * 1024 * 1024) {
    return parseExcelFileDirectly(file);
  } else {
    return parseExcelFileWithWorker(file, {}, progressCallback);
  }
};

/**
 * 直接在主线程读取Excel文件 (适用于小文件)
 * @param {File} file - 要解析的Excel文件对象
 * @returns {Promise} - 返回包含解析结果的Promise
 */
export const parseExcelFileDirectly = (file) => {
  return new Promise((resolve, reject) => {
    // 验证文件类型
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (!isExcel) {
      reject(new Error('只能上传Excel文件(.xlsx, .xls格式)'));
      return;
    }

    // 读取文件内容
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // 使用ExcelJS替代XLSX
        const workbook = new ExcelJS.Workbook();
        const buffer = e.target.result;
        
        // 加载工作簿
        await workbook.xlsx.load(buffer);
        
        // 读取所有工作表
        const sheets = {};
        const sheetNames = workbook.worksheets.map(sheet => sheet.name);
        
        // 处理每个工作表
        workbook.worksheets.forEach(worksheet => {
          const sheetName = worksheet.name;
          const jsonData = worksheetToJson(worksheet);
          sheets[sheetName] = jsonData;
        });
        
        // 构造返回结果
        const result = {
          fileName: file.name,
          sheets: sheets,
          totalSheets: sheetNames.length,
          sheetNames: sheetNames,
          // 默认使用第一个工作表数据
          data: sheets[sheetNames[0]] || [],
          totalRows: sheets[sheetNames[0]]?.length || 0,
          // 获取第一个工作表的列名（如果存在数据）
          columns: sheets[sheetNames[0]]?.length > 0 
            ? Object.keys(sheets[sheetNames[0]][0] || {}) 
            : []
        };
        
        resolve(result);
      } catch (error) {
        reject(new Error(`解析Excel文件失败: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件时发生错误'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 将ExcelJS工作表转换为JSON对象数组
 * @param {Worksheet} worksheet - ExcelJS工作表
 * @returns {Array} JSON对象数组
 */
function worksheetToJson(worksheet) {
  // 获取表头（第一行）
  const headerRow = worksheet.getRow(1);
  const headers = [];
  
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
  });
  
  // 初始化结果数组
  const jsonData = [];
  
  // 从第二行开始遍历数据行
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // 跳过表头
    if (rowNumber === 1) return;
    
    const rowData = {};
    
    // 处理每个单元格
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1] || `Column${colNumber}`;
      
      // 根据单元格类型处理值
      let value = null;
      
      if (cell.value !== null && cell.value !== undefined) {
        if (cell.value.text) { // 富文本
          value = cell.value.text;
        } else if (cell.value.formula) { // 公式
          value = cell.value.result;
        } else if (cell.type === ExcelJS.ValueType.Date) { // 日期
          value = cell.value.toISOString();
        } else {
          value = cell.value;
        }
      }
      
      rowData[header] = value;
    });
    
    // 添加到结果数组
    jsonData.push(rowData);
  });
  
  return jsonData;
}

/**
 * 将Excel数据分块处理
 * @param {Array} data - Excel数据数组 
 * @param {Object} options - 分块选项
 * @param {number} options.maxBlocks - 最大分块数量，默认100
 * @param {number} options.minBlockSize - 最小块大小，默认1000
 * @param {number} options.overlapRows - 块之间的重叠行数，默认10
 * @returns {Array} - 返回分块后的数据
 */
export const splitDataIntoBlocks = (data, options = {}) => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  const totalRows = data.length;
  const maxBlocks = options.maxBlocks || 100;
  const minBlockSize = options.minBlockSize || 1000;
  const overlapRows = options.overlapRows || 10;
  
  // 计算理想块大小
  const idealBlockSize = Math.max(minBlockSize, Math.ceil(totalRows / maxBlocks));
  
  // 计算实际块数
  const actualBlockCount = Math.min(maxBlocks, Math.ceil(totalRows / idealBlockSize));
  
  // 计算每块实际大小（不含重叠部分）
  const actualBlockSize = Math.ceil(totalRows / actualBlockCount);
  
  const blocks = [];
  
  // 生成数据块
  for (let i = 0; i < actualBlockCount; i++) {
    // 计算块的原始起止索引（不含重叠区域）
    const originalStartIndex = i * actualBlockSize;
    const originalEndIndex = Math.min(totalRows - 1, (i + 1) * actualBlockSize - 1);
    
    // 计算块的实际起止索引（含重叠区域）
    const startIndex = Math.max(0, originalStartIndex - (i > 0 ? overlapRows : 0));
    const endIndex = Math.min(totalRows - 1, originalEndIndex + (i < actualBlockCount - 1 ? overlapRows : 0));
    
    // 提取数据块
    const blockData = data.slice(startIndex, endIndex + 1);
    
    // 创建块信息
    blocks.push({
      blockId: i,
      originalStartIndex,
      originalEndIndex,
      startIndex,
      endIndex,
      size: blockData.length,
      originalSize: originalEndIndex - originalStartIndex + 1,
      hasOverlapTop: i > 0,
      hasOverlapBottom: i < actualBlockCount - 1,
      data: blockData
    });
  }
  
  return blocks;
};

/**
 * 获取特定数据块
 * @param {Object} excelData - Excel数据对象
 * @param {string} sheetName - 工作表名称
 * @param {number} blockId - 块ID
 * @returns {Promise} - 返回包含数据块的Promise
 */
export const getBlockDataWithWorker = (excelData, sheetName, blockId) => {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    const messageHandler = (e) => {
      const data = e.data;
      
      if (data.type === 'blockData' && data.blockId === blockId && data.sheetName === sheetName) {
        worker.removeEventListener('message', messageHandler);
        resolve(data.data);
      } else if (data.type === 'error' && data.blockId === blockId && data.sheetName === sheetName) {
        worker.removeEventListener('message', messageHandler);
        reject(new Error(data.message));
      }
    };
    
    worker.addEventListener('message', messageHandler);
    
    worker.postMessage({
      action: 'getBlockData',
      result: excelData,
      sheetName,
      blockId
    });
  });
};

/**
 * 在控制台输出Excel数据
 * @param {Object} excelData - parseExcelFile返回的Excel数据对象
 * @param {Object} options - 输出选项
 * @param {boolean} options.showAllSheets - 是否显示所有工作表数据
 * @param {boolean} options.verbose - 是否显示详细信息
 * @param {boolean} options.useBlocks - 是否使用分块处理
 * @param {Object} options.blockOptions - 分块选项
 */
export const logExcelData = (excelData, options = {}) => {
  const { 
    showAllSheets = false, 
    verbose = true, 
    useBlocks = true,
    blockOptions = {
      maxBlocks: 100,
      minBlockSize: 1000,
      overlapRows: 10
    }
  } = options;
  
  console.group(`===== Excel文件 "${excelData.fileName}" 数据 =====`);
  
  // 输出基本信息
  console.log(`文件名: ${excelData.fileName}`);
  console.log(`工作表数量: ${excelData.totalSheets}`);
  console.log(`工作表列表: ${excelData.sheetNames.join(', ')}`);
  
  if (verbose) {
    // 输出默认工作表的列名
    console.log(`默认工作表(${excelData.sheetNames[0]})列名:`, excelData.columns);
    
    // 输出行数
    console.log(`默认工作表(${excelData.sheetNames[0]})行数: ${excelData.totalRows}`);
  }
  
  // 获取默认工作表数据
  const defaultSheetData = excelData.data;
  
  // 是否有分块信息
  if (excelData.blocks && excelData.blocks.length > 0) {
    console.log(`数据已分为 ${excelData.blocks.length} 个数据块 (Worker处理)`);
    
    // 输出分块信息
    excelData.blocks.slice(0, 5).forEach(block => {
      console.group(`数据块 #${block.blockId + 1} (${block.size}行, 原始${block.originalSize}行)`);
      console.log(`索引范围: ${block.startIndex} - ${block.endIndex} (原始: ${block.originalStartIndex} - ${block.originalEndIndex})`);
      
      if (block.hasOverlapTop) {
        console.log(`上方重叠区: ${block.startIndex} - ${block.originalStartIndex - 1} (${block.originalStartIndex - block.startIndex}行)`);
      }
      
      if (block.hasOverlapBottom) {
        console.log(`下方重叠区: ${block.originalEndIndex + 1} - ${block.endIndex} (${block.endIndex - block.originalEndIndex}行)`);
      }
      
      // 输出数据内容示例（如果有）
      if (block.sampleData && block.sampleData.length > 0) {
        console.log(`数据块内容示例:`);
        console.table(block.sampleData);
      }
      
      console.groupEnd();
    });
    
    if (excelData.blocks.length > 5) {
      console.log(`... 还有 ${excelData.blocks.length - 5} 个数据块 ...`);
    }
  }
  // 是否使用分块处理
  else if (useBlocks && defaultSheetData && defaultSheetData.length > 0) {
    const blocks = splitDataIntoBlocks(defaultSheetData, blockOptions);
    
    console.log(`数据已分为 ${blocks.length} 个数据块:`);
    
    // 输出分块信息
    blocks.slice(0, 5).forEach(block => {
      console.group(`数据块 #${block.blockId + 1} (${block.size}行, 原始${block.originalSize}行)`);
      console.log(`索引范围: ${block.startIndex} - ${block.endIndex} (原始: ${block.originalStartIndex} - ${block.originalEndIndex})`);
      
      if (block.hasOverlapTop) {
        console.log(`上方重叠区: ${block.startIndex} - ${block.originalStartIndex - 1} (${block.originalStartIndex - block.startIndex}行)`);
      }
      
      if (block.hasOverlapBottom) {
        console.log(`下方重叠区: ${block.originalEndIndex + 1} - ${block.endIndex} (${block.endIndex - block.originalEndIndex}行)`);
      }
      
      // 输出数据内容（限制显示）
      console.log(`数据块内容示例 (前5行):`);
      console.table(block.data.slice(0, 5));
      
      if (block.data.length > 10) {
        console.log(`... 中间省略 ${block.data.length - 10} 行 ...`);
        console.log(`数据块内容示例 (后5行):`);
        console.table(block.data.slice(-5));
      } else if (block.data.length > 5) {
        console.log(`数据块内容示例 (后${block.data.length - 5}行):`);
        console.table(block.data.slice(5));
      }
      
      console.groupEnd();
    });
    
    if (blocks.length > 5) {
      console.log(`... 还有 ${blocks.length - 5} 个数据块 ...`);
    }
  } else {
    // 不分块，直接输出默认工作表的数据
    if (defaultSheetData && defaultSheetData.length > 0) {
      console.log(`默认工作表(${excelData.sheetNames[0]})数据:`);
      console.table(defaultSheetData.slice(0, 100)); // 限制显示前100行，避免数据过多
    } else {
      console.log(`默认工作表没有数据或数据未加载`);
    }
  }
  
  // 如果showAllSheets为true且有多个工作表，输出所有工作表的数据
  if (showAllSheets && excelData.totalSheets > 1) {
    excelData.sheetNames.slice(1).forEach(sheetName => {
      console.group(`工作表: ${sheetName}`);
      
      // 检查是否有工作表数据
      if (excelData.sheets && excelData.sheets[sheetName]) {
        const sheetData = excelData.sheets[sheetName];
        const totalRows = Array.isArray(sheetData) ? sheetData.length : 
                         (sheetData.totalRows || 0);
        
        console.log(`行数: ${totalRows}`);
        
        if (totalRows > 0) {
          if (verbose) {
            const columns = Array.isArray(sheetData) && sheetData.length > 0 ? 
                          Object.keys(sheetData[0]) : [];
            console.log('列名:', columns);
          }
          
          // 检查工作表是否有自己的分块信息
          if (sheetData.blocks && sheetData.blocks.length > 0) {
            console.log(`此工作表已分为 ${sheetData.blocks.length} 个数据块`);
            if (sheetData.blocks[0].sampleData) {
              console.log(`第一个数据块内容示例:`);
              console.table(sheetData.blocks[0].sampleData);
            }
          } 
          // 检查是否有实际数据
          else if (Array.isArray(sheetData) && sheetData.length > 0) {
            if (useBlocks && sheetData.length > blockOptions.minBlockSize) {
              console.log(`此工作表数据量较大，使用分块显示...`);
              const sheetBlocks = splitDataIntoBlocks(sheetData, blockOptions);
              console.log(`已分为 ${sheetBlocks.length} 个数据块`);
              console.log(`第一个数据块内容示例:`);
              console.table(sheetBlocks[0].data.slice(0, 5));
            } else {
              console.table(sheetData.slice(0, 100));
            }
          }
        } else {
          console.log('此工作表没有数据');
        }
      } else {
        console.log('此工作表数据未加载');
      }
      
      console.groupEnd();
    });
  }
  
  console.groupEnd();
  
  return excelData;
};

/**
 * 获取特定工作表的数据
 * @param {Object} excelData - parseExcelFile返回的Excel数据对象
 * @param {string} sheetName - 工作表名称
 * @returns {Array} - 返回指定工作表的数据
 */
export const getSheetData = (excelData, sheetName) => {
  if (!excelData.sheets[sheetName]) {
    console.warn(`工作表 "${sheetName}" 不存在`);
    return [];
  }
  return excelData.sheets[sheetName];
};

/**
 * 获取数据块
 * @param {Array} data - 完整数据数组
 * @param {number} blockIndex - 块索引
 * @param {Object} options - 分块选项
 * @returns {Object} - 返回指定的数据块
 */
export const getDataBlock = (data, blockIndex, options = {}) => {
  const blocks = splitDataIntoBlocks(data, options);
  return blockIndex >= 0 && blockIndex < blocks.length ? blocks[blockIndex] : null;
};

/**
 * 销毁Worker
 * 在不再需要时调用，释放资源
 */
export const destroyWorker = () => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
};

export default {
  parseExcelFile,
  parseExcelFileWithWorker,
  logExcelData,
  getSheetData,
  splitDataIntoBlocks,
  getDataBlock,
  getBlockDataWithWorker,
  destroyWorker
}; 
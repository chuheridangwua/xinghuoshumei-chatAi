# AntDesignX - 基于Vue 3和Ant Design的AI聊天应用

## 项目概述

AntDesignX是一个基于Vue 3和Ant Design Vue构建的现代化AI聊天应用程序。该应用使用Dify API作为后端，提供了流畅的聊天体验，支持多会话管理、消息历史记录查看、实时流式响应等功能。项目采用了最新的前端技术栈，具有响应式布局设计，适合各种设备使用。

## 技术栈

- **前端框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **UI组件库**：
  - Ant Design Vue 4.2.6
  - TDesign Vue Next 1.11.4
  - TDesign Mobile Vue 1.8.3
  - TDesign Chat 0.2.3
- **HTTP客户端**：Axios 1.8.4
- **路由管理**：Vue Router 4.5.0
- **AI集成**：OpenAI API + Dify API

## 项目结构

```
├── public/              # 静态资源
├── src/                 # 源代码
│   ├── app/             # 应用相关组件
│   │   └── index/       # 主要应用页面
│   │       ├── comps/   # 页面组件
│   │       └── index.vue # 主应用页面
│   ├── assets/          # 资源文件(图片、字体等)
│   ├── components/      # 公共组件
│   ├── router/          # 路由配置
│   ├── web/             # Web端相关组件
│   ├── App.vue          # 根组件
│   ├── main.ts          # 入口文件
│   ├── style.css        # 全局样式
│   └── vite-env.d.ts    # Vite环境类型声明
├── static/              # 静态资源
│   └── app/api/         # API接口
│       ├── chat.js      # 聊天相关API
│       ├── model.js     # 模型相关API
│       ├── request.js   # 请求处理工具
│       └── theme.js     # 主题管理
├── index.html           # HTML入口
├── package.json         # 项目依赖
├── tsconfig.json        # TypeScript配置
├── tsconfig.app.json    # 应用TypeScript配置
├── tsconfig.node.json   # Node环境TypeScript配置
└── vite.config.ts       # Vite配置
```

## 主要功能

### 1. 智能对话系统
- 集成Dify API进行AI对话
- 支持流式响应，实时显示AI回复
- 用户/AI消息交互界面

### 2. 会话管理
- 创建新会话
- 查看历史会话列表
- 按时间分组显示会话（今天、昨天、过去7天、更早）
- 重命名会话
- 删除会话
- 固定重要会话

### 3. 消息历史
- 查看历史消息记录
- 滚动加载更多历史消息
- 清除对话历史

### 4. 用户界面
- 响应式设计，适配不同设备
- 支持亮色/暗色主题切换
- 侧边会话抽屉
- 消息评价功能（点赞/点踩）

### 5. 数据管理
- 本地和服务器双重存储
- 自动保存会话历史
- 用户ID管理

## 安装与运行

### 前提条件
- Node.js 18.x或更高版本
- npm 9.x或更高版本

### 安装步骤

1. 克隆项目仓库
```bash
git clone https://github.com/your-username/AntDesignX.git
cd AntDesignX
```

2. 安装依赖
```bash
npm install
```

3. 配置API密钥
修改`static/app/api/model.js`文件中的API配置：
```javascript
export const modelConfig = {
    'dify-api': {
        instance: {
            baseURL: 'YOUR_DIFY_API_URL',
            apiKey: 'YOUR_DIFY_API_KEY',
            dangerouslyAllowBrowser: true
        },
        description: 'Dify API 模型'
    }
};
```

4. 启动开发服务器
```bash
npm run dev
```

5. 构建生产版本
```bash
npm run build
```

6. 预览生产版本
```bash
npm run preview
```

## 使用说明

1. 打开应用后，默认会加载最近的对话或创建新对话
2. 在输入框中输入问题并发送
3. AI会实时流式生成回复
4. 使用左上角菜单可以查看和管理所有对话
5. 可以重命名、删除或创建新对话
6. 可以通过主题设置切换亮色/暗色模式

## 开发者说明

- 项目使用Vue 3的组合式API和`<script setup>`语法
- 使用TypeScript提供类型检查
- API接口集成在static/app/api目录下
- 主要应用逻辑在src/app/index/index.vue文件中

## 许可证

[MIT License](LICENSE)

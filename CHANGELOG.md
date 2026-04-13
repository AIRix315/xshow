# Changelog

All notable changes to XShow will be documented in this file.

## [0.0.9] - 2026-04-13

### 修复
- **ComfyUI 工作流扫描失败**：目录参数 `default/workflows/` 修正为 `workflows`（API 路径相对于用户根目录而非文件系统绝对路径）
- **ComfyUI 工作流文件读取 404**：列表返回的路径是相对于 `workflows/` 子目录的，读取时需加 `workflows/` 前缀；目录分隔符 URL 编码为 `%2F`
- **ComfyUI 输出图片 URL 拼接错误**：`output.images` 为 `{filename, subfolder, type}` 对象，旧代码直接拼字符串产生 `[object Object]` 导致 404，改为正确提取属性
- **ComfyUI 图片上传 FormData 序列化失败**：`extensionFetch` 代理无法序列化 `FormData`，改为直连 `fetch`（ComfyUI 已启用 CORS）

### 改进
- 工作流扫描启用递归模式（`recurse=true`），支持子目录（Backup、RHAPI 等）
- 移除 `hasProblematicChars` 过滤器（URL 编码后中文、`&`、`[]` 等字符均可正常读取）
- 连接测试成功后显示工作流文件数量
- 扫描提示文案更新为正确的 ComfyUI 操作说明

### 测试
- 新增 `comfyApi.e2e.test.ts`：11 个纯逻辑测试 + 5 个 ComfyUI 集成测试（`COMFY_E2E=1` 启用）

## [0.0.8] - 2026-04-12

### 新功能
- ComfyUI 执行支持 (local/cloud/runninghub)
- 18 种新节点类型

### 新增节点
- TextInputNode - 文本输入
- VideoInputNode - 视频输入
- ImageInputNode - 图片输入
- Generate3DNode - 3D 生成
- GenerateAudioNode - 音频生成
- PromptConstructorNode - 提示词构造
- AnnotateNode - 标注
- ConditionalSwitchNode - 条件切换
- EaseCurveNode - 缓动曲线
- FrameGrabNode - 帧提取
- ImageCompareNode - 图片对比
- OutputGalleryNode - 输出画廊
- OutputNode - 输出
- RouterNode - 路由
- SwitchNode - 开关
- VideoStitchNode - 视频拼接
- VideoTrimNode - 视频裁剪
- Viewer3DNode - 3D 查看器

### 改动
- SettingsPanel ComfyUI 工作流配置
- UniversalNode executionType 扩展
- ComfyUI API 执行引擎 (comfyApi.ts)
- 节点类型定义统一迁移到 types.ts

## [0.0.7] - 2026-04-12

- 修复侧边栏节点拖拽到画布问题
- 统一节点标题为中文
- 优化万能节点样式（默认运行模式、溢出隐藏）
- 新增图片输入节点（ImageInputNode）区分图片加载和图片生成

## [0.0.6] - 2026-04-12

- Initial release
- Node-based visual AI workflow editor
- Chrome Extension Manifest V3 sidebar support
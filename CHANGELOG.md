# Changelog

All notable changes to XShow will be documented in this file.

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
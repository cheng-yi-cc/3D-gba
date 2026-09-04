# 系统架构设计 (Architecture)

本文档说明 3D GBA（博物馆展厅）的内部系统设计、核心模块划分及各模块间的数据流转。

---

## 1. 总体架构概览

系统由前端纯静态资源构成，无服务端依赖（完全客户端运行），包含四大子系统：

```
+-------------------------------------------------------------------------+
|                              浏览器客户端                                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ 3D 渲染子系统 (Three.js) ]           [ 模拟器内核 (EmulatorJS/mGBA) ]  |
|  - 舞台环境、展台与柔和打光             - 隐藏挂载点 (#ejs-mount)         |
|  - GBA 主机模型 (gba.glb)                - WebAssembly mGBA 核心          |
|  - 3D 物理质感卡带与插槽拾取             - 60FPS GBA 视频流与原生音频     |
|          ^                                      |                       |
|          |         [ 动态屏幕纹理桥接 ]          v                       |
|          +-------- CanvasTexture <---- 2D Canvas (离屏拉取)              |
|                                                                         |
|  [ 用户交互与状态机 ]                    [ 触觉音效引擎 (WebAudio) ]     |
|  - OrbitControls 轨道相机/自动巡览      - 合成微动开关声 (tick)         |
|  - 卡带插拔状态机 (插槽/卡带袋)         - 弹簧锁舌声 (insert/lock/eject)|
|  - 键盘事件 / 3D Raycast 映射           - 开机双音频 (boot)             |
|                                                                         |
|  [ 存储子系统 ]                                                         |
|  - IndexedDB (EmulatorJS 存档管理) / 手动导出导入 .sav                 |
+-------------------------------------------------------------------------+
```

---

## 2. 核心模块详解

### 2.1 3D 渲染与场景管线 (`assets/js/scene.js`)
- **渲染器配置**：
  - `WebGLRenderer({ antialias: true })`
  - 色调映射：`ACESFilmicToneMapping`，曝光度 `1.06`
  - 阴影：`PCFSoftShadowMap`，带偏置与模糊半径处理，呈现柔和阴影。
- **打光方案**：
  - 半球光（`HemisphereLight`）：提供温暖的天空底光与地面反光。
  - 主光源（`DirectionalLight`）：高位斜射，开启 2048x2048 阴影投影。
  - 补光与轮廓光（Fill & Rim Light）：补充暗部细节与边缘高光。
- **展台与背景**：
  - 哑光圆形木纹/亚克力展台垫（`pad`）与微弱渐变地面（`ground`）。
  - CSS 径向渐变暗角（`#vignette`），营造博物馆展品聚光质感。

### 2.2 屏幕动态纹理桥接 (Screen Dynamic Texture Bridge)
- **原理**：
  1. GBA 屏幕网格对应模型中的屏幕子材质。
  2. 初始化时创建高分辨率离屏 2D Canvas（`screenCanvas`，尺寸 480x320，精确对应 GBA 240x160 的 2x 缩放）。
  3. 未插卡/关机状态下，`screenCtx` 绘制微弱反光的关闭液晶屏底色与液晶网格微纹理。
  4. 插入卡带且模拟器初始化后，每帧（`onFrame`）从 EmulatorJS 渲染的目标 Canvas 提取画面数据，拷贝至 `screenCanvas` 并标记 `screenTex.needsUpdate = true`。
  5. 屏幕材质的 `emissiveMap` 与 `map` 绑定此 `CanvasTexture`，使得屏幕在 3D 空间自发光并呈现动态游戏画面。

### 2.3 卡带交互状态机与按需加载 (Cartridge State Machine & Lazy Loading)
系统内置 4 盘各具独立贴纸与主题色的实体卡带（CELESTE、ANGUNA、GOODBOY、FROGTRIS），卡带拥有 4 个核心离散状态：
1. **BAG_IDLE（收纳包闲置）**：静置于右侧毛毡卡带包网格槽中。未游玩前仅保留元数据与相对路径 `romPath`。
2. **HOVER / PICKED（拿起/悬浮）**：点击 3D 卡带或从工具栏快捷选单选择后，若未缓存 ROM 数据则触发异步惰性拉取（`ensureCartRom`），随后通过 Tween 平滑升起并悬停在插槽上方。
3. **INSERTING / INSERTED（插入插槽）**：沿特定旋转与平移曲线滑入 GBA 主机背部插槽；锁定后触发 mGBA WASM 核心初始化与开机引导。
4. **EJECTING（弹出即断电）**：按下弹出按钮、点击已插入卡带或换卡时，在触发的第 0 毫秒（$t=0$）立即触发模拟器强制下电机制：
   - 全局 WebAudio 沙箱同步调用 `suspend()` 和 `close()` 彻底释放模拟器声卡通道，断开 OpenAL 源节点；
   - 调用 `toggleMainLoop(0)` 与 `pauseMainLoop()` 挂起 WASM 主循环，不再占用 CPU；
   - 递增 `currentSessionId` 作废挂起的异步资源加载，防止空机唤醒；
   - 主机电源 LED 熄灭，屏幕即刻复位至待机画面（`drawBootArt`），卡带沿拟真物理抛物线平滑飞回收纳包。

### 2.4 WebAudio 合成音效引擎 (SFX Engine)
为了避免加载外部音频文件带来的网络延迟或 404 隐患，系统采用 Web Audio API 进行纯代码合成：
- **按键微动 (tick)**：高频带通滤波噪声脉冲 (2400Hz) + 方波音，模拟微动开关段落感。
- **插卡摩擦与咬合 (insert / lock)**：低频正弦扫频 (130Hz -> 70Hz) + 短暂带通滤波噪声脉冲 (3200Hz)，还原物理插槽弹片手感。
- **弹出机构声 (eject)**：低到高正弦轻挑声 (90Hz -> 150Hz) + 轻微摩擦声。
- **GBA 开机提示音 (boot)**：双段正弦波 (660Hz -> 990Hz) 经典音调组合。

### 2.5 模拟器与按键桥接 (`assets/js/app.js`)
- **内核**：本地自托管 EmulatorJS，使用 mGBA WebAssembly 核心 (`mgba-wasm.data`)。
- **挂载管理**：在视图外（负绝对定位）创建 `#ejs-mount`，禁用 EmulatorJS 自带的默认浮层与虚拟按键，全权交由 3D 场景控制。
- **输入桥接**：
  - 键盘事件监听器捕获 `keydown` / `keyup`，将方向键、Z/X/Q/E/V/Enter 翻译为 RetroArch 虚拟键码并派发至模拟器输入层。
  - 3D 实体按键交互：鼠标悬浮或点击 3D 主机按键时，按键产生沿法线的轻微下陷动画，同时触发对应的输入事件。

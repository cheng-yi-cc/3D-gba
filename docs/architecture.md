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
|  - IndexedDB gba3d / states（按 ROM 文件名保存即时状态）                 |
+-------------------------------------------------------------------------+
```

---

## 2. 核心模块详解

### 2.1 3D 渲染与场景管线 (`assets/js/scene.js`)
- **渲染器配置**：
  - `WebGLRenderer({ antialias: true })`
  - 色调映射：`ACESFilmicToneMapping`，曝光度 `1.06`
  - 阴影：代码配置 `PCFSoftShadowMap`，本地 Three.js r185 会提示弃用并回退为 `PCFShadowMap`。
- **打光方案**：
  - 半球光（`HemisphereLight`）：提供温暖的天空底光与地面反光。
  - 主光源（`DirectionalLight`）：高位斜射，开启 2048x2048 阴影投影。
  - 补光与轮廓光（Fill & Rim Light）：补充暗部细节与边缘高光。
- **展台与背景**：
  - 哑光圆形木纹/亚克力展台垫（`pad`）与微弱渐变地面（`ground`）。
  - CSS 径向渐变暗角（`#vignette`），营造博物馆展品聚光质感。

### 2.2 屏幕动态纹理桥接 (Screen Dynamic Texture Bridge)
- **原理**：
  1. `buildScreen` 在机身屏幕位置添加三维平面，覆盖模型原有的静态画面，并叠加透明保护镜片。
  2. 初始化时创建高分辨率离屏 2D Canvas（`screenCanvas`，尺寸 480x320，精确对应 GBA 240x160 的 2x 缩放）。
  3. 未插卡/关机状态下，`drawBootArt` 绘制深绿色待机画面、像素网格和插卡提示。
  4. 插入卡带且模拟器初始化后，每帧（`onFrame`）从 EmulatorJS 渲染的目标 Canvas 提取画面数据，拷贝至 `screenCanvas` 并标记 `screenTex.needsUpdate = true`。
  5. 三维屏幕使用 `MeshBasicMaterial({ map: screenTex })`，不受场景灯光明暗影响；未使用 `emissiveMap`。

### 2.3 卡带交互状态机与按需加载 (Cartridge State Machine & Lazy Loading)
系统内置 APOTRIS、AUNTFLORA、POWDER、VOLTORB 四盘卡带，`cart.state` 的实际取值只有 `bag`、`flight`、`inserted`：

1. `bag`：卡带在收纳包内，内置 ROM 首次游玩时由 `ensureCartRom` 从相对路径加载并缓存到内存。
2. `flight`：`insertFlight` 或 `ejectFlight` 正在移动卡带；`busy` 防止并发插拔。插入过程先抬升、旋转对位，再落入插槽。
3. `inserted`：记录 `state.activeCart`，调用 `bootRom` 初始化模拟器，并暂停自动巡览。

拔卡和换卡在启动飞行动画前同步调用 `stopEmulator()`：递增会话编号使旧启动回调失效，暂停 WASM 主循环，关闭或挂起捕获的模拟器音频上下文，销毁模拟器、清空挂载点、熄灭指示灯并恢复待机画面。卡带飞回收纳包后恢复 `bag` 和允许的自动巡览状态。

### 2.4 WebAudio 合成音效引擎 (SFX Engine)
为了避免加载外部音频文件带来的网络延迟或 404 隐患，系统采用 Web Audio API 进行纯代码合成：
- **按键微动 (tick)**：高频带通滤波噪声脉冲 (2400Hz) + 方波音，模拟微动开关段落感。
- **插卡摩擦与咬合 (insert / lock)**：低频正弦扫频 (130Hz -> 70Hz) + 短暂带通滤波噪声脉冲 (3200Hz)，还原物理插槽弹片手感。
- **弹出机构声 (eject)**：低到高正弦轻挑声 (90Hz -> 150Hz) + 轻微摩擦声。
- **GBA 开机提示音 (boot)**：双段正弦波 (660Hz -> 990Hz) 经典音调组合。

### 2.5 模拟器与按键桥接 (`assets/js/app.js` & `assets/js/scene.js`)
- **内核**：本地自托管 EmulatorJS，使用 mGBA WebAssembly 核心 (`mgba-wasm.data`)。
- **挂载管理**：在视图外（负绝对定位）创建 `#ejs-mount`，禁用 EmulatorJS 自带的默认浮层与虚拟按键，全权交由 3D 场景控制。
- **输入桥接与人体工学映射**：
  - 键盘事件监听器捕获 `keydown` / `keyup`，基于物理键码 `e.code` 消除输入法与大小写干扰：
    - 方向键：`W A S D`（及 Arrow Keys 备用）映射至 RetroArch 4(Up)、5(Down)、6(Left)、7(Right)；
    - 核心操作：右手 `J`(B键, 0)、`K`(A键, 8) 及兼容键 `Z`(B)、`X`(A)（键盘左 J 对机身左 B，右 K 对机身右 A）；
    - 肩键：`U`(L键, 10)、`I`(R键, 11) 及兼容键 `Q`(L)、`E`(R)；
    - 系统键：`Enter`(Start, 3)、`Space`(Select, 2，严格拦截默认滚动) 及 `V`(Select)。
  - **防卡键保护**：绑定 `window.blur`，切屏或失焦时自动复位所有按键状态，防止角色在模拟器中死循环奔跑。
  - **3D 实体按键交互与拓扑架构**：
    - 硬件键位标准：按键排布严格恪守任天堂官方掌机硬件标准「左 B 右 A」（左下为 B 键，右上为 A 键）。
    - 原模型按拓扑拆分：`gba.glb` 内的 `Button_DPad`、`Button_L`、`Button_R` 是独立网格，保留原表面位置、法线、切线、UV 和贴图。十字键沿 88 条原凹槽边形成的闭环与外框断开，键体及固定框补有暗色内壁。黑框留在机身网格，`DPad_FrameInterior` 固定不动。
    - `assets/js/rigid-buttons.js` 在 `TRUE_POS` 对应位置建立支点，用 `attach` 保持静息世界变换，再以整个对象的旋转驱动键体；顶点缓冲从不随十字键或肩键输入改写，法线随刚体一起旋转。
    - 十字键绕中心下方的支点倾斜，四向仍独立映射，斜向合成后总倾角上限为 0.085 rad，相反方向相消。L/R 的 X 转轴通过各自内侧端，铰链高度由端部几何范围求得，两侧转向相反，最外端名义行程为 root 局部单位 0.008。
    - 运动采用临界阻尼弹簧解析解，连续保留速度；快速松按、换向不会产生旧 tween 覆盖。接近静息时精确归零。拾取体挂在同一支点下，与实体保持对位。
    - A/B、Select/Start 继续使用 `classifyPressVerts` 与原有按压通道；它们的输入映射和 WebAudio 触觉音效保持现有行为。A/B 浮雕位于 normal 贴图，修改字母仍需编辑对应 UV 岛。
    - 右上角常驻半透明速查卡片（`#cheatSheet`）与键盘敲击实时高亮联动，支持一键最小化折叠。

### 2.6 模型维护

原始 30,949 个表面三角形完整分配为：机身/黑框 22,811，十字键 1,362，L/R 各 3,388；另增加 352 个内壁三角形。原贴图二进制数据不重采样。

交付的 `gba.glb` 已完成拆分，运行不需要 Python、NumPy 或生成脚本。为满足 Cloudflare Pages 单文件 25 MiB 上限，四张原始 PNG 从 GLB 内嵌缓冲原样移至 `assets/models/textures/`，由模型中的相对 URI 引用；几何缓冲、节点、材质和贴图字节保持不变。GLB 约 1.90 MiB，最大贴图约 9.86 MiB。模型和四张贴图共同组成完整资源，必须一起提交和发布；贴图内容变化时更新文件名中的内容哈希及模型引用，再更新加载 URL 的 `?v=`。

更新模型时保留具名部件及固定内壁，重新核对真孔位置、铰链、拾取和松键归位；手动检查步骤见 [运维手册](./runbook.md)。发布时 `npm run build` 校验文件体积并将网页资源复制到 `dist`，不转换模型或贴图。

### 2.7 存档

工具栏存档调用模拟器的 `getState()`，写入本应用 IndexedDB 数据库 `gba3d` 的 `states` 对象仓库，以 ROM 文件名为键。读档取回该状态并调用 `loadState()`。同名 ROM 共用存档键；存档属于当前浏览器和站点来源，清除站点数据会丢失。工具栏不提供 `.sav` 文件导入或导出。

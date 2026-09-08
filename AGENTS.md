# 3D GBA Agent 协作与开发规则手册

本项目为纯前端静态 Web 3D 互动体验项目，基于 Three.js 与自托管 WebAssembly EmulatorJS/mGBA 实现。未来 AI Agent 在此项目中进行任何开发或维护时，必须严格遵守以下规则。

---

## 1. 架构红线与禁止事项（违者必出事故）

1. **严禁引入外部服务端依赖**：
   本项目所有逻辑（3D 场景、物理动画、ROM 解析、WASM 模拟器、音效合成）完全运行于客户端浏览器中。严禁添加后端服务器、云函数或依赖公网未受控 CDN 的关键资源。
2. **严禁破坏离屏 CanvasTexture 桥接管线**：
   GBA 屏幕显示依赖 `screenCanvas` (480x320) 作为 2D 中转缓冲，并在 `onFrame` 中通过 `screenTex.needsUpdate = true` 实时刷新。严禁将模拟器 DOM 直接浮动盖在 3D 画布上伪造屏幕。
3. **音效必须基于 WebAudio 纯代码合成**：
   触觉微动声、插拔卡带声与开机声均在 `assets/js/app.js` 的 `SFX` 模块内通过正弦/方波振荡器和带通滤波噪声合成。严禁通过引入外部 `.mp3` / `.wav` 音频文件替代现有机制。
4. **禁止裸写绝对路径**：
   模型、贴图、脚本和 WASM 核心加载必须使用相对路径（如 `./assets/models/gba.glb`），以确保在任意子路径或静态托管服务下均能正常解析。
5. **本地开发严禁使用 `file://` 协议打开**：
   必须通过 HTTP 本地服务器启动（如 `npm run dev`），以避免浏览器 CORS 拦截 ES Module 与 WASM 资源。
6. **发布资源与体积约束**：
   生产分支为 `master`，推送后由 Cloudflare Pages 执行 `npm run build` 并发布 `dist`。单文件不得超过 25 MiB；`gba.glb` 与 `assets/models/textures/` 必须一起提交，贴图改变时更新内容哈希文件名和模型引用。不得合并为超限 GLB 或牺牲原贴图、几何精度。

---

## 2. 目录结构与核心职责

```
3Dgad/
├── index.html                   # 主页面入口，含 DOM 容器与 UI 控件
├── package.json                 # 依赖声明与 npm 脚本 (npm run dev)
├── scripts/build.cjs            # 体积检查，模型/应用模块内容指纹与 dist 生成
├── assets/
│   ├── js/
│   │   ├── scene.js             # Three.js 3D 场景、光照、模型加载、卡带动画与屏幕纹理
│   │   ├── rigid-buttons.js     # 十字键、L/R 独立刚体支点与阻尼运动
│   │   └── app.js               # 模拟器桥接 (EmulatorJS)、按键映射、WebAudio 音效、状态存储
│   ├── models/
│   │   ├── gba.glb              # 项目主机模型（含独立十字键、L/R 肩键）
│   │   └── textures/            # 四张原始 PNG，通过模型相对 URI 加载
│   ├── roms/
│   │   ├── apotris.gba          # 内置开源游戏：俄罗斯方块 (Apotris v4.1.0, GPL-3.0)
│   │   ├── auntflora.gba        # 内置开源游戏：弗洛拉庄园解谜 (Aunt Flora's Mansion, 0BSD)
│   │   ├── powder.gba           # 内置自制游戏：粉末地牢 Roguelike (POWDER r118，仅自用)
│   │   ├── voltorb.gba          # 内置自制游戏：雷电球大逃亡72关 (Voltorb's Escape，仅自用)
│   │   └── test3d.gba           # 备用 3D 演示 ROM
│   ├── emulator/                # 自托管 EmulatorJS 运行时、mGBA WASM 核心与本地化配置
│   └── vendor/three/            # 本地自托管 Three.js r185 及其扩展插件 (GLTFLoader, OrbitControls)
└── docs/
    ├── architecture.md          # 系统详细架构设计与数据流图
    └── runbook.md               # 本地调试、URL 参数与故障排查指南
```

---

## 3. 开发命令速查

```bash
# 启动本地开发与预览服务（默认端口 3000）
npm run dev

# 构建并检查 Cloudflare Pages 发布资源（输出 dist）
npm run build

# 使用 Python 备用启动
python -m http.server 3000
```

---

## 4. 深入文档指针

| 文档 | 包含内容 | 适用场景 |
|---|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | 3D 渲染管线、卡带状态机、屏幕桥接细节、WebAudio 合成实现 | 修改核心交互或重构模块时 |
| [`docs/runbook.md`](./docs/runbook.md) | 本地预览、调试参数、验证流程、自动部署配置与故障排查 | 调试、发布或排查部署失败时 |

---

- **按键坐标与拾取**：按键注册在 `buttons` 映射中，真孔坐标唯一源是 `TRUE_POS`；十字键和肩键拾取体必须挂到各自 `ButtonPivot_*` 下，随刚体运动。肩键铰链由具名网格内侧端几何确定；改模型时同步检查真孔坐标、支点和拾取，避免 Raycaster 命中漂移。
- **电源指示灯对位**：`buildPowerLed` 灯位必须由 baseColor 灯罩 UV 反推几何中心得出（已与 POWER 刻字对齐），严禁手填目测；灯球半径须 ≥ 灯罩盘半径（当前 0.011）以全覆盖。
- **按键布局标准**：必须坚守任天堂官方硬件标准「左 B 右 A」（左下为 B 键，右上为 A 键），机身几何与模拟器序号侧严禁反转；键盘映射以 README 按键表为准（当前 J=B、K=A），改键盘不算动机身标准。
- **外壳保护与独立按键**：`gba.glb` 中 `Button_DPad`、`Button_L`、`Button_R` 必须保持独立网格。十字键沿原凹槽与黑框分离，黑框及 `DPad_FrameInterior` 固定；只旋转按键支点，严禁对这三个部件恢复 feather、颜色蒙版或逐顶点变形。`classifyPressVerts` 仅用于机身网格内的 A/B、Select/Start。严禁永久沉降机壳、外加替代键块或改动原表面 UV/刻字；静息保持原外观。
- **十字键四向解耦**：`up`(4)、`down`(5)、`left`(6)、`right`(7) 保持四向独立输入，共同驱动同一刚性键体。斜向倾角必须限幅，相反方向相消；保留快速换向时的速度，严禁叠加多个按键 tween 或解除机械限位。
- **按键防黏连与事件隔离**：键盘事件监听必须基于物理键码 `e.code`（如 `KeyW`, `Space`），严格阻止 `Space` 等默认浏览器滚动；必须绑定 `window.blur` 自动复位所有按键，杜绝切屏导致角色原地长跑卡死。
- **模拟器生命周期与即时断电**：拔出或切换卡带时必须在点击的第 0 毫秒立即调用 `stopEmulator()`，同步释放模拟器 WebAudio 上下文（`close()` / `suspend()`）、暂停 WASM 主循环并切回待机贴图，杜绝声音残留与空转。
- **自动巡览恢复机制**：用户操作 OrbitControls 后，控制器会在闲置 4 秒后自动恢复低速旋转（可通过 `?aa=0` 设默认关）。底部工具栏 `#btnRotate` 为唯一手动开关（`isAutoRotateEnabled` / `setAutoRotateEnabled`，选择记入 `localStorage gba3d-autorotate`）；插入卡带游玩时 `setPlaying(true)` 自动暂停，拔卡归位后 `setPlaying(false)` 恢复，严禁在游玩中恢复旋转。

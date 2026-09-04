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

---

## 2. 目录结构与核心职责

```
3Dgad/
├── index.html                   # 主页面入口，含 DOM 容器与 UI 控件
├── package.json                 # 依赖声明与 npm 脚本 (npm run dev)
├── assets/
│   ├── js/
│   │   ├── scene.js             # Three.js 3D 场景、光照、模型加载、卡带动画与屏幕纹理
│   │   └── app.js               # 模拟器桥接 (EmulatorJS)、按键映射、WebAudio 音效、状态存储
│   ├── models/
│   │   └── gba.glb              # 唯一官方高保真 GBA 3D 展品模型（含屏幕子网格）
│   ├── roms/
│   │   ├── celeste.gba          # 内置开源游戏：蔚蓝经典版 (Celeste Classic GBA)
│   │   ├── anguna.gba           # 内置开源游戏：安古纳 (Anguna: Warriors of Virtue)
│   │   ├── goodboyadvance.gba   # 内置开源游戏：好狗星系 (Goodboy Galaxy Demo)
│   │   ├── frogtris.gba         # 内置开源游戏：经典俄罗斯方块 (Frogtris)
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

# 使用 Python 备用启动
python -m http.server 3000
```

---

## 4. 深入文档指针

| 文档 | 包含内容 | 适用场景 |
|---|---|---|
| [`docs/architecture.md`](file:///d:/My%20Project/3Dgad/docs/architecture.md) | 3D 渲染管线、卡带状态机、屏幕桥接细节、WebAudio 合成实现 | 修改核心交互或重构模块时 |
| [`docs/runbook.md`](file:///d:/My%20Project/3Dgad/docs/runbook.md) | URL 调试参数列表、测试验证流程、常见报错排查 | 遇到加载异常或调整相机参数时 |

---

## 5. 核心开发与踩坑警示

- **按键坐标与拾取**：按键几何体绑定在 `buttons` 映射中，若调整主机模型，需同步更新按键包围盒与微动动画偏置，避免 Raycaster 命中漂移。
- **模拟器生命周期与即时断电**：拔出或切换卡带时必须在点击的第 0 毫秒立即调用 `stopEmulator()`，同步释放模拟器 WebAudio 上下文（`close()` / `suspend()`）、暂停 WASM 主循环并切回待机贴图，杜绝声音残留与空转。
- **自动巡览恢复机制**：用户操作 OrbitControls 后，控制器会在闲置 4 秒后自动恢复低速旋转（可通过 `?aa=0` 临时关闭）。

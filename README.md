# 3D GBA · 博物馆展厅 (Museum Gallery)

基于 Three.js 与自托管 WebAssembly 模拟器内核构建的高保真 3D Game Boy Advance 博物馆交互展厅。

---

## 特性亮点

- 🏛️ **博物馆级 3D 展厅**：采用 Three.js r185，配备电影级 ACES Filmic 色调映射、柔和阴影、亚克力展台垫与自动空闲巡览旋转。
- 🎮 **真实 GBA 游戏运行**：完全客户端自托管 mGBA WebAssembly 内核，将游戏画面实时映射至 3D 掌机屏幕（CanvasTexture），呈现逼真的自发光与液晶质感。
- 🕹️ **卡带物理插拔体验**：支持从右侧卡带收纳包点击卡带，平滑滑入主机插槽，伴随微动与机械咬合音效；支持一键弹出与换卡。
- 🔊 **WebAudio 纯合成触觉音效**：按键微动声、卡槽弹簧弹片咬合声、弹出机构声与经典双音开机声全部通过 Web Audio 振荡器实时合成，无需外部音频资源。
- 💾 **即时存档与读档**：依托浏览器本地 IndexedDB 存储，支持游戏状态的即时保存、读取与持久化。
- 📂 **内置 4 款开源经典大作**：内置《蔚蓝经典版 (Celeste)》、《安古纳 (Anguna)》、《好狗星系 (Goodboy Galaxy)》、《经典俄罗斯方块 (Frogtris)》，支持卡带点击即玩与工具栏快捷换卡；亦可将任意本地 `.gba` / `.zip` 游戏文件直接拖入页面游玩。

---

## 按键操作说明

页面右上角常驻半透明快捷键速查面板（支持敲击实时高亮与一键折叠收起）。

| GBA 按键 | 键盘推荐按键 | 兼容按键 | 3D 实体交互 |
|---|---|---|---|
| **十字方向键 (D-Pad)** | `W` `A` `S` `D` | `↑` `↓` `←` `→` 方向键 | 四向机械摇杆翘板微动下沉 |
| **B 键 / A 键** | `J` (B) / `K` (A) | `Z` (B) / `X` (A) | 官方标准「左 B 右 A」实体按键物理微沉 · 键盘左右对应机身左右 |
| **L 键 / R 键** | `U` (L) / `I` (R) | `Q` (L) / `E` (R) | 主机上方两侧肩键微动响应 |
| **Select / Start** | `Space` / `Enter` | `V` (Select) | 原模型绿键下沉回弹 |
| **视角旋转 / 缩放** | 鼠标左键拖拽 / 滚轮 | 鼠标右键平移视角 | 闲置 4 秒自动恢复优雅低速巡览 |

---

## 本地运行与预览

由于项目依赖 WebAssembly 二进制资源与 ES Module 规范，请使用本地静态 HTTP 服务器预览：

### 方式 1：npm 启动（推荐）
```bash
# 启动本地服务
npm run dev
```
启动后在浏览器打开：[http://localhost:3000](http://localhost:3000)

### 方式 2：Python 启动
```bash
python -m http.server 3000
```
浏览器访问：[http://localhost:3000](http://localhost:3000)

---

## 项目技术文档

- [系统架构设计 (Architecture)](./docs/architecture.md)：包含渲染管线、屏幕纹理桥接、卡带状态机与音效合成原理。
- [运维与调试手册 (Runbook)](./docs/runbook.md)：包含 URL 调试参数（`?debug=1`, `?aa=0`）、测试用例与故障排查。
- [AI Agent 规则手册 (AGENTS.md)](./AGENTS.md)：供自动化开发助手与未来协作者遵循的代码红线与规范。

---

## 模型与技术致谢

- 3D 模型：“Gameboy Advance - Zelda Concept” by [yassineCGI](https://sketchfab.com/yassineCGI) (CC BY 4.0)。
- 模拟器框架：[EmulatorJS](https://emulatorjs.org/) & [mGBA](https://mgba.io/) WebAssembly Core。

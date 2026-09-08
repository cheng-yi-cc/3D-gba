# 运维与调试手册 (Runbook)

本文档面向开发者和维护人员，提供本地启动、调试方法、常见故障排查与运行约束说明。

---

## 1. 本地启动与预览

> **重要前提**：由于本项目依赖 ES Module 导入及 WebAssembly 二进制资源（`assets/emulator/cores/mgba-wasm.data` 等），**严禁直接以 `file://` 协议双击打开 `index.html`**，否则会因浏览器的同源策略（CORS）阻断脚本和 WASM 加载。必须使用本地 HTTP 服务器托管。

### 方式一：使用 npm 脚本启动（推荐）
```bash
# 启动本地静态服务器（默认端口 3000）
npm run dev
# 或
npm run preview
```
需要 Node.js/npm；脚本通过 `npx serve` 启动，首次运行可能联网下载 `serve`。若不可用，使用下方已安装的 Python。

终端输出后，浏览器访问：[http://localhost:3000](http://localhost:3000)

### 方式二：使用 Python 一键托管
```bash
# 进入项目根目录
python -m http.server 3000
```
浏览器访问：[http://localhost:3000](http://localhost:3000)

---

## 2. 功能调试与 URL 参数

`assets/js/scene.js` 提供了多项 URL 查询参数，方便视觉调试与相机定位：

| 参数名 | 默认值 | 作用说明 | 示例 |
|---|---|---|---|
| `debug` | `0` | 设为 `1` 时在 `window.G3DTEST` 暴露模拟器、卡带、按键与屏幕采样调试接口；不显示碰撞盒 | `?debug=1` |
| `aa` | `1` | 设为 `0` 时默认关闭相机空闲自动巡览（页面底部工具栏「🔄 环绕」可随时手动开关，选择记入 localStorage；插入卡带游玩时自动暂停，拔卡后恢复） | `?aa=0` |
| `yaw` | `-90` | 主机初始偏航角（度） | `?yaw=-90` |
| `cx,cy,cz`| `0.1, 0.78, 3.15` | 相机初始位置坐标 | `?cx=0&cy=1&cz=3` |
| `tx,ty,tz`| `0.15, 0.32, 0` | 轨道相机注视中心点（Target）坐标 | `?tx=0&ty=0.3&tz=0` |

---

## 3. 测试与验证流程

1. **基础渲染检查**：
   - 页面加载后，3D 展厅正常渲染，展台、灯光与 GBA 主机阴影柔和自然。
   - 鼠标左键拖拽可旋转视角，右键平移，滚轮缩放；停止交互 4 秒后自动恢复低速巡览旋转（底部工具栏「🔄 环绕」可开关；插入卡带游玩时自动暂停）。
2. **卡带与模拟器验证**：
   - 点击右侧卡带收纳包中的 4 盘内置经典游戏卡带（`APOTRIS`、`AUNTFLORA`、`POWDER`、`VOLTORB`）或左下角「🎮 经典游戏」下拉菜单。
   - 目标卡带平滑悬浮并飞入 GBA 主机卡槽，触发插卡微动与锁舌音效，屏幕自发光并进入游戏画面。
   - 键盘输入：WASD 走位（亦支持方向键），J / K 对应 B / A 键，U / I 对应 L / R 肩键，Space / Enter 对应 Select / Start 键；右上角速查面板实时高亮当前按键状态，3D 主机实体按键产生拟真力学下陷。
   - 点击已插入的卡带或点击「弹出卡带」，卡带优雅弹出归位，屏幕恢复展厅待机画面。
3. **导入自定义 ROM**：
   - 将本地 `.gba` / `.zip` 文件直接拖拽至浏览器窗口中，或点击底部工具栏「导入 ROM」。
   - 确认卡带自动生成标签并触发插卡与运行流程。
4. **存档与读档**：
   - 游戏过程中点击「存档」，弹出成功提示；刷新页面或重新开机后点击「读档」，状态无缝恢复。

---

### 独立按键专项检查

打开 [关闭巡览的本地预览](http://localhost:3000/?aa=0)，放大主机，依次测试 WASD、W+A、S+D、U、I 和 U+I。十字键的外框与白壳保持不动；键帽整体倾斜，肩键绕内侧端转动。快速交替按键、松开以及切出浏览器后应顺滑归位，无残留按压。鼠标点击四个方向和两颗肩键应与键盘对应。

模型必须带有 `Button_DPad`、`Button_L`、`Button_R`、`DPad_FrameInterior` 四个具名节点；缺失时更新模型，不应退回逐顶点变形。交付模型已拆分，不需要额外生成步骤。

`npm test` 目前是失败占位脚本，不作为验收命令。修改按键后按上述步骤验证，必要时检查网格属性缓冲不变、固定框/机壳矩阵不变、刚体边长不变和松键精确归位。

---

## 4. 常见故障排查 (Troubleshooting)

### Q1: 页面全白或控制台报错 `Failed to fetch` / `CORS request not HTTP`
- **原因**：通过 `file://` 直接打开网页。
- **解决**：按第 1 节使用 `npm run dev` 或 `python -m http.server` 运行。

### Q2: 游戏运行正常但没有声音
- **原因**：现代浏览器对 Web Audio 有自动播放限制（Autoplay Policy），未经用户交互的 AudioContext 处于 `suspended` 状态。
- **解决**：在页面任意位置点击一次或按任意键，系统内部的 `SFX.unlock()` 会自动唤醒音频上下文。

### Q3: 弹出卡带后画面仍卡在屏幕上或出现音频残留
- **原因**：旧版模拟器实例未能完全卸载，或 WebAudio/OpenAL 声卡通道在后台持续保持连接。
- **解决**：`assets/js/app.js` 现已内置 `stopEmulator()` 完整销毁管线：在拔出触发瞬间调用 `actx.close()` 释放声卡通道，断开 OpenAL sources，暂停 WASM 主循环并重置离屏 Canvas，确保音画与硬件状态在 0ms 内同步归零。

### Q4: 改了 `gba.glb` 模型但预览没变化
- **原因**：浏览器缓存了旧模型文件。
- **解决**：同步 bump `assets/js/scene.js` 里模型加载 URL 的 `?v=` 查询串（如 `gba.glb?v=20260908-rigid`），然后 Ctrl+F5 硬刷新。

---

## 5. 线上部署（Cloudflare Pages，已接通）

- **项目**：Cloudflare Pages `gba`（`gba-9cq.pages.dev`，自定义域 `gba.chengyi.me`），Git 直连 `cheng-yi-cc/3D-gba`。
- **自动部署**：生产分支 `master`，`push` 到 `master` 自动触发 Production 构建并上线；构建配置：框架预设无、构建命令空、输出目录 `/`（纯静态，无需构建）。
- **仓库**：`origin` 使用 `https://github.com/cheng-yi-cc/3D-gba.git`。
- **验证**：push 后到 Pages 项目 → 部署页确认出现对应 commit 的 Production 部署，再 `curl` 线上 HTML 确认内容已更新。

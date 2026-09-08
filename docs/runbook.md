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
需要 Node.js/npm；脚本通过 `npx serve` 启动，首次运行可能联网下载 `serve`。若不可用，可使用已安装的 Python，按下方命令启动。`npm run preview` 与 `npm run dev` 都服务于源码根目录，不是 `dist`。

终端输出后，浏览器访问：[http://localhost:3000](http://localhost:3000)

### 方式二：使用 Python 一键托管
```bash
# 进入项目根目录
python -m http.server 3000
```
浏览器访问：[http://localhost:3000](http://localhost:3000)

---

## 2. 功能调试与 URL 参数

`assets/js/scene.js` 提供巡览与相机查询参数，`assets/js/app.js` 根据 `debug` 暴露调试接口：

| 参数名 | 默认值 | 作用说明 | 示例 |
|---|---|---|---|
| `debug` | `0` | 设为 `1` 时在 `window.G3DTEST` 暴露模拟器、卡带、按键与屏幕采样调试接口；不显示碰撞盒 | `?debug=1` |
| `aa` | `1` | 设为 `0` 时默认关闭相机空闲自动巡览（页面底部工具栏「🔄 环绕」可随时手动开关，选择记入 localStorage；插入卡带游玩时自动暂停，拔卡后恢复） | `?aa=0` |
| `yaw` | `-90` | 主机初始偏航角（度） | `?yaw=-90` |
| `cx,cy,cz`| `0.1, 0.78, 3.15` | 相机初始位置坐标 | `?cx=0&cy=1&cz=3` |
| `tx,ty,tz`| `0.15, 0.32, 0` | 轨道相机注视中心点（Target）坐标；必须提供 `tx` 才会应用 `ty`、`tz` | `?tx=0&ty=0.3&tz=0` |

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

### Q4: 更新后模型或按键动画仍是旧版
- **原因**：浏览器可能缓存了旧脚本或旧模型；旧按键脚本配上新的独立按键模型，会出现十字键和肩键不动。
- **线上发布**：构建自动给 `gba.glb`、`rigid-buttons.js`、`scene.js`、`app.js` 生成内容指纹文件名，并按依赖顺序更新引用。模型或刚体模块变化会传递到场景、应用和 HTML，普通刷新即可加载匹配版本。不要只给 HTML 的脚本加版本而遗漏 `app.js` 对场景的导入，否则会初始化两套场景。
- **源码预览**：`npm run dev` 不经过构建，模型改变后仍需更新 `scene.js` 内的 `?v=` 并 Ctrl+F5。预览 `dist` 时先重新执行 `npm run build`。修改贴图时还要更新贴图内容哈希文件名及 GLB 中对应的相对 URI。

---

## 5. 线上部署（Cloudflare Pages）

- **项目**：Cloudflare Pages `gba`（`gba-9cq.pages.dev`，自定义域 `gba.chengyi.me`），Git 直连 `cheng-yi-cc/3D-gba`。
- **自动部署**：生产分支 `master`，`push` 到 `master` 自动触发 Production 构建并上线；框架预设无，构建命令 `npm run build`，输出目录 `dist`，根目录为仓库根目录。构建配置在 Cloudflare Pages 项目设置中维护。
- **发布内容**：`scripts/build.cjs` 只发布 `index.html`、`_headers`、`assets/`，保留目录结构与跨域隔离响应头；模型和三个应用模块使用自动生成的内容指纹文件名。几何与贴图字节不变，模块只更新资源引用；`node_modules`、文档、开发脚本和本地临时文件不会发布。`dist` 是忽略提交的生成目录，每次构建重建；脚本只使用 Node.js 内置模块。
- **发布前检查**：先运行 `npm run build`。任何文件超过 25 MiB，或文件数超过免费方案 20,000 上限时，构建会明确报错并退出。需要预览实际产物时运行 `python -m http.server 3000 --directory dist`，打开 [http://localhost:3000](http://localhost:3000)。
- **仓库**：`origin` 使用 `https://github.com/cheng-yi-cc/3D-gba.git`。
- **验证**：push 后确认该 commit 的 GitHub `Cloudflare Pages` 检查成功，并到 Pages 部署页确认 Production 部署引用相同 commit；随后检查域名上的 HTML、脚本、模型和四张贴图均已更新，并在浏览器确认展厅、插卡与游戏画面正常。只看到首页 HTTP 200 不能证明新版本已上线，失败时域名通常仍提供上一次成功版本。

`_headers` 由 Cloudflare Pages 解析；普通 `serve` 和 Python HTTP 服务不会自动应用它。两种本地预览可验证资源和交互，线上 COOP/COEP 响应头则需在部署后核对。`dist` 和 `.wrangler` 均为忽略提交的生成或临时目录，收尾可删除，下次预览发布产物前重新构建。

### 2026-09-08 部署失败原因与修复

提交 `25bafb8` 的构建日志明确报错：`Pages only supports files up to 25 MiB in size`，其中 `assets/models/gba.glb is 25.3 MiB in size`。独立按键拆分后模型增至 26,523,368 字节，超过 26,214,400 字节上限，失败发生在上传前的资源校验；GitHub 自动触发和域名绑定正常。

修复将 GLB 内嵌的四张 PNG 原字节移到 `assets/models/textures/`，模型通过相对路径加载。GLB 降至 1,990,100 字节，最大贴图 10,334,854 字节，无需图片压缩、降低模型精度或外部存储服务。模型的节点、材质、几何缓冲、UV 与四张 PNG 字节均已核对不变。后续不能只复制 `gba.glb` 而遗漏配套贴图，也不要重新导出成超过上限的单文件。

修复提交 `28b1f89` 已由 `github:push` 触发 Production 部署并成功上线；域名上的 12 项关键资源与提交内容一致，COOP/COEP 响应头正确，本地及线上 Apotris 插卡画面均已验证。

# Chromex Side Chat

基于 [GENEXIS-AI/ChromeX](https://github.com/GENEXIS-AI/chromex) 的 Chrome / Edge 侧边追问扩展。复用本地 Codex App Server 的登录、模型选择和会话能力，无需自行实现推理循环。

## 使用方式

1. 在网页选中文字，右键选择 **选文侧边追问**。扩展创建一个独立会话，并带入选文及附近文字。
2. 或在侧栏顶部点击 **新建页面侧聊**，读取当前网页已加载的正文、代码、表格和聊天记录。
3. 展开 **Side Chat · 网页上下文**，查看并编辑本次携带的内容，再在下方输入问题。
4. 连续追问使用固定快照；网页更新后，点击 **更新上下文** 才重新读取。切换标签页不会自动替换已有快照。
5. 使用原有的聊天历史和模型选择器管理会话。启用设置中的 **Remember chats / 记住聊天**，才能在重新打开扩展后恢复本地聊天历史。

侧聊不向原网站的聊天输入框发送消息。问答通路跳过自动路由模型，不自动读取新页面、历史或其他标签页。当前支持 Codex 可用模型；Claude、Gemini 等跨厂商运行时尚未接入。

## 从源码安装

需要 Node.js 20+、Chrome 116+ 或兼容的 Edge，以及可运行的 Codex CLI（上游最低要求 0.130.0）。

```sh
git clone https://github.com/luyyyyy666/chromex-side-chat.git
cd chromex-side-chat
npm ci
npm run build
npm install -g @openai/codex
codex --version
codex login
```

打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，加载 `packages/extension/dist`。然后注册本地桥接：

```sh
node scripts/install-native-host.mjs --browser=chrome
# Edge 用户改为：
node scripts/install-native-host.mjs --browser=edge
```

完全退出并重启浏览器，在扩展内检查连接。若浏览器显示的扩展 ID 与安装器推导出的 ID 不同，传入实际 ID：

```sh
node scripts/install-native-host.mjs <extension-id> --browser=chrome
```

本项目有独立的扩展公钥和 Native Messaging host `com.chromex.sidechat.bridge`。不使用 ChromeX 商店安装包。安装器会使用当前源码路径，因此安装后请保留此目录。

## 数据与边界

- 仅读取页面 DOM 中当前已加载、可提取的文字；不读取网站后台上下文、未加载历史或跨域 iframe。
- 单个快照最多 48,000 字符，超出时预览提示截断；最多保留最近 50 个会话快照。
- 快照保存在扩展本地存储。发送问题时，预览内容随问题交给本地 Codex，再由其配置的模型服务处理。
- “清空”停止后续携带该快照，不会抹除已发送的 Codex 会话历史；要从空白上下文开始，请新建会话。
- 浏览器限制页（例如 `chrome://`）、扫描 PDF、图片文字、封闭 Shadow DOM 和不可访问 iframe 不保证可提取。
- 上游语音、图片、文件、浏览器工具仍在源码中；本次新增的 Side Chat 问答通路使用显式快照。此版本不是 Codex 桌面原生侧聊的完整复刻。

## 开发与验证

```sh
npm run typecheck
npm test
npm run build
npm run smoke
npm run smoke:side-chat
```

新增模块位于 `packages/extension/src/side-chat`：快照、编辑面板和固定问答路由；接入点是原有 sidepanel 与 background。浏览器烟雾测试使用隔离临时配置，不需要真实模型登录。真实 Codex 回答需要完成上面的桥接与登录设置。

## Attribution

Derived from ChromeX upstream commit `dda4409583d9ea7ef4bba8df515a6259be3a9b9b`. Original code is MIT licensed; original copyright and Git history are preserved. Upstream documentation is retained in [readmes/UPSTREAM.md](readmes/UPSTREAM.md); the other localized readmes and optional Pages assets describe upstream ChromeX.

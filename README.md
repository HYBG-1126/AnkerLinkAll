# AnkerLinkAll · 安克万连

基于蓝牙发现并控制附近安克（Anker）设备的 macOS 菜单栏应用，同时保留完整 Web Bluetooth 调试能力。

- **macOS 菜单栏常驻**：点击菜单栏图标弹出控制面板，面板失焦自动收起，`Esc` 快速隐藏
- **安克风格移动端界面**：我的设备、160W Prime Charger 设备主页、端口控制、设备设置、我的、实验室功能与协议管理
- **真实蓝牙能力**：扫描附近设备、快速重连、读取标准 GATT 信息、浏览服务与特征值、下发 Hex/文本指令、订阅通知、实时日志
- **演示数据**：未连接设备时展示端口功率与安克设备信息，界面中标注「演示」，避免与真实读数混淆

> 安克产品的私有 GATT 服务与指令集未公开，应用不内置具体产品指令。真实端口功率与控制需要登记厂商服务 UUID 并按对应产品协议下发。

## macOS 菜单栏客户端

| 项目 | 说明 |
| --- | --- |
| 运行平台 | macOS Apple Silicon（arm64） |
| 形态 | `LSUIElement` 菜单栏应用，不占用 Dock |
| 面板 | 430 × 800 无边框窗口，锚定在菜单栏图标下方 |
| 蓝牙选择 | 调起原生设备选择对话框；蓝牙权限说明已写入 `Info.plist` |
| 退出 | 右键菜单栏图标 → 退出，或面板内按 `Esc` 隐藏 |

### 开发运行

```bash
npm install
npm run desktop:dev     # 同时启动 Vite 与 Electron，面板自动弹出
```

### 构建安装包

```bash
npm run desktop:pack    # 生成 release/mac-arm64/AnkerLinkAll.app（免安装）
npm run desktop:build   # 生成 release/AnkerLinkAll-<version>-arm64.dmg
```

安装包未签名（`identity: null`），适合本机与内部分发。首次启动如被 Gatekeeper 拦截，可右键应用选择「打开」，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/AnkerLinkAll.app
```

若 Electron 二进制或构建依赖下载超时，可使用镜像：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run desktop:build
```

## 界面结构

| 路由 | 页面 | 内容 |
| --- | --- | --- |
| `#/` | 我的设备 | 已授权设备列表、扫描入口、未连接状态 |
| `#/device` | 设备主页 | 产品图、输出/蓝牙按钮、C1/C2/C3 端口功率、实时曲线、端口控制、充电模式 |
| `#/device/settings` | 设备设置 | 充电模式、亮度、熄屏、旋转、屏保、名称、SN、固件、恢复默认、删除设备 |
| `#/profile` | 我的 | 账户卡片、商城横幅、帮助/手册/设置/关于、清除本地数据 |
| `#/lab` | 实验室功能 | 设备扫描、设备概览、GATT 浏览器、指令下发、实时日志 |
| `#/lab/protocol` | 协议管理 | 厂商服务 UUID 登记、已登记列表、设备连接 |

设置与设备名称保存在 `localStorage`（`ankerlink.settings.*`），厂商服务 UUID 保存在 `ankerlink.extraServiceUuids`。

## Web 端运行

```bash
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 生产构建
npm run lint       # Oxlint
npm run preview
```

浏览器中使用要求 Chrome / Edge（桌面或 Android），且页面必须处于 HTTPS 或 `localhost` 安全上下文。Electron 客户端内无此限制。

## 接入安克私有协议

标准 GATT 服务（`0x180A` 设备信息、`0x180F` 电池）开箱即用。私有控制能力通常位于厂商自定义服务，需要两步：

1. 在「我的 → 设备设置 → 协议管理」或「实验室功能 → 高级 · 厂商服务 UUID」登记服务 UUID（重新连接后生效）
2. 在「实验室功能 → 指令下发」选择可写特征值，按产品协议填写 Hex 或文本数据

> 不同安克产品（充电器、音箱、扫地机、投影仪等）的服务与指令集互不相同，请以对应产品的 GATT 协议文档为准。

## 项目结构

```
electron/
├── main.mjs              # 菜单栏 Tray、无边框面板、蓝牙设备选择、权限
├── preload.cjs           # 暴露 hidePanel 等桌面能力
└── assets/               # 菜单栏模板图标、应用图标（icns）
src/
├── pages/                # 我的设备、设备主页、设置、我的、实验室、协议管理
├── components/           # 通用列表/弹层/图表 + 蓝牙调试面板
├── hooks/                # useBle、设备设置、演示遥测、当前设备信息
├── lib/ble/              # 扫描、连接、GATT 读写、通知、日志（单例 store）
├── lib/deviceData.ts     # 演示设备、端口元数据
├── App.tsx               # HashRouter 路由
└── index.css             # 浅色安克主题
```

## 技术栈

React 19 · TypeScript · Vite · Electron 45 · Web Bluetooth · Oxlint

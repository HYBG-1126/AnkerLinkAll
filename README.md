# AnkerLinkAll · 安克万连

基于蓝牙发现并控制附近安克（Anker）设备的 macOS 菜单栏应用，同时保留完整 Web Bluetooth 调试能力。

- **macOS 菜单栏常驻**：点击菜单栏图标弹出控制面板，面板失焦自动收起，`Esc` 快速隐藏
- **安克风格移动端界面**：我的设备、160W Prime Charger 设备主页、端口控制、设备设置、我的、实验室功能与协议管理
- **真实 A2687 遥测**：连接 160W Prime Charger 后自动完成 ECDH + AES-GCM 握手，实时读取 C1/C2/C3 电压、电流、功率与总功率
- **真实设备控制**：端口开关、倒计时、充电模式、亮度、熄屏、旋转等设置直接下发到设备
- **通用蓝牙调试**：扫描附近设备、快速重连、读取标准 GATT 信息、浏览服务与特征值、下发 Hex/文本指令、订阅通知、实时日志
- **诚实占位**：未连接或设备不支持私有协议时显示 `--`，不会伪造读数

> 私有协议实现针对 Anker 160W Prime Charger（A2687，服务 `8c850001-…`）。其他安克产品需按各自 GATT 协议接入；可在「协议管理」登记厂商服务 UUID，并通过「指令下发」调试。

## macOS 菜单栏客户端

| 项目 | 说明 |
| --- | --- |
| 运行平台 | macOS Apple Silicon（arm64） |
| 形态 | `LSUIElement` 菜单栏应用，不占用 Dock |
| 面板 | 430 × 800 无边框窗口，锚定在菜单栏图标下方 |
| 蓝牙选择 | 内置设备选择器，实时刷新附近设备、支持搜索、安克系设备优先；蓝牙权限说明已写入 `Info.plist` |
| 退出 | 右键菜单栏图标 → 退出，或面板内按 `Esc` 隐藏 |

> 扫描会列出附近全部 BLE 设备，安克系设备排在前面。若充电器在多设备环境中显示为「未知或不支持的设备 (MAC)」，请按名称或 MAC 选择。

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

## A2687 私有协议

连接广播 `0000ff09-…` 服务的设备后，应用会自动识别并启动私有协议会话：

| 环节 | 说明 |
| --- | --- |
| GATT 服务 | `8c850001-0302-41c5-b46e-cf057c562025`，写入 `…0002`，通知 `…0003` |
| 帧格式 | `FF 09 + LE16 总长 + 载荷 + XOR 校验`，载荷头部 `03 00 group cmd|0x40` |
| 加密 | 初始密钥握手后，客户端生成 P-256 临时密钥对，与设备返回的公钥做 ECDH，取共享密钥前 16 字节作 AES-128-GCM 密钥，后 12 字节作 nonce |
| 握手 | `0x0001` → `0x0003` → `0x0029`（身份）→ `0x0005` → `0x0021` → `0x0022` → `0x0027` → `0x0200/0x020A` 探测 |
| 遥测 | `0x020A` 每 5 秒轮询，`0x0200` 每 15 秒轮询，解析 TLV A5/A6/A7 与线缆状态码 |
| 控制 | 端口开关 `0x0207`、倒计时 `0x0209`、充电模式 `0x0206`、显示设置 `0x0202/03/04/0B/0D/0F` |

标准 GATT 服务（`0x180A` 设备信息、`0x180F` 电池）仍开箱即用。非 A2687 设备会停留在「标准 GATT」状态，界面显示 `--`。

### 其他安克产品

1. 在「我的 → 设备设置 → 协议管理」或「实验室功能 → 高级 · 厂商服务 UUID」登记服务 UUID（重新连接后生效）
2. 在「实验室功能 → 指令下发」选择可写特征值，按产品协议填写 Hex 或文本数据

> A2687 协议由公开抓包与逆向分析实现，尚未在实机上完成全量验证；不同安克产品的服务与指令集互不相同，请以对应产品的 GATT 协议文档为准。

### 连接排障

- **设备被占用**：充电器同一时间只能被一个主机连接。若手机安克 App 或其他电脑仍在连接，先在手机端断开或退出 App，再在应用中重试。
- **系统权限**：首次连接时 macOS 会弹窗请求蓝牙与配对权限。若曾拒绝，请到「系统设置 → 隐私与安全性 → 蓝牙」重新允许 AnkerLinkAll。
- **设备名称**：安克设备的名称可能是序列号（如 `ASHDPPE1G19600139`），在选择器中按名称或 MAC 选择即可。
- **连接超时**：应用会等待最多 12 秒并自动重试一次；仍失败时会在「我的设备」页显示具体原因（占用、权限、超出范围等）。

## 项目结构

```
electron/
├── main.mjs              # 菜单栏 Tray、无边框面板、蓝牙扫描与选择器、权限
├── preload.cjs           # 暴露 hidePanel 等桌面能力
├── picker.html           # 蓝牙设备选择器（实时刷新、搜索、安克设备优先）
├── picker-preload.cjs    # 选择器 IPC 桥
└── assets/               # ANKER 菜单栏模板图标、应用图标（icns）
src/
├── pages/                # 我的设备、设备主页、设置、我的、实验室、协议管理
├── components/           # 通用列表/弹层/图表 + 蓝牙调试面板
├── hooks/                # useBle、设备设置、当前设备信息
├── lib/anker/
│   ├── protocol.ts       # 帧编解码、TLV、遥测解析、控制指令
│   └── session.ts        # 握手、ECDH、AES-GCM、轮询与写入队列
├── lib/ble/              # 扫描、连接、GATT 读写、通知、日志（单例 store）
├── lib/deviceData.ts     # 设备展示信息
├── assets/anker-logo.svg # ANKER 字标
├── App.tsx               # HashRouter 路由
└── index.css             # 浅色安克主题
```

品牌图标基于用户提供的 ANKER 字标：菜单栏使用模板图像（自动适配明暗），应用图标为圆角深青底白色字标。

## 技术栈

React 19 · TypeScript · Vite · Electron 45 · Web Bluetooth · Web Crypto（ECDH / AES-GCM）· Oxlint

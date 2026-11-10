# AnkerLinkAll · 安克万连

基于蓝牙发现并控制附近安克（Anker）设备的 macOS 菜单栏应用，使用 **C++ / Qt 6 + QML** 实现。

- **macOS 菜单栏常驻**：点击菜单栏图标弹出控制面板，面板失焦自动收起
- **三层页面结构**：设备列表 → 设备详情 → 设备设置，对齐移动端安克 App 的信息架构
- **真实 A2687 遥测**：连接 160W Prime Charger 后自动完成 ECDH + AES-GCM 握手，实时读取 C1/C2/C3 电压、电流、功率与总功率
- **真实设备控制**：端口开关、充电模式、屏幕亮度、熄屏时间、屏幕旋转等设置直接下发到设备
- **断线自动重连**：设备主动断开后自动扫描并恢复会话
- **诚实占位**：未连接或设备不支持私有协议时显示 `--`，不会伪造读数

> 私有协议实现针对 Anker 160W Prime Charger（A2687，服务 `8c850001-…`）。其他安克产品需按各自 GATT 协议接入。

## 运行形态

| 项目 | 说明 |
| --- | --- |
| 运行平台 | macOS Apple Silicon（arm64） |
| 形态 | `LSUIElement` 菜单栏应用，不占用 Dock |
| 面板 | 无边框浮动窗口，锚定在菜单栏图标下方 |
| 单实例 | 通过 `/tmp/AnkerLinkAll-qt.lock` 加锁，重复启动会静默退出 |

## 构建与运行

依赖：Xcode Command Line Tools、CMake ≥ 3.21、Ninja、Qt 6.5+（Homebrew `qt`，含 Bluetooth 模块）。

```bash
/opt/homebrew/opt/qt/bin/qt-cmake -G Ninja -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
open build/AnkerLinkAll.app
```

## 打包安装包

```bash
# 内嵌 Qt 框架
/opt/homebrew/opt/qt/bin/macdeployqt qt/build/AnkerLinkAll.app -always-overwrite

# 生成 DMG
rm -rf /tmp/anker-dmg && mkdir -p /tmp/anker-dmg
cp -R qt/build/AnkerLinkAll.app /tmp/anker-dmg/
ln -s /Applications /tmp/anker-dmg/Applications
hdiutil create -volname AnkerLinkAll -srcfolder /tmp/anker-dmg -ov -format UDZO \
  release/AnkerLinkAll-0.2.0-arm64.dmg
```

安装包使用 ad-hoc 签名，适合本机与内部分发。首次启动如被 Gatekeeper 拦截，可右键应用选择「打开」，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/AnkerLinkAll.app
```

## 界面结构

| 层级 | 页面 | 内容 |
| --- | --- | --- |
| 1 | 我的设备（DevicesPage） | 设备卡片、连接状态、右上角 `+` 扫描附近设备 |
| 2 | 设备详情（DevicePage） | 产品主图与充电线、端口功率汇总、实时数据曲线、端口控制、充电模式 |
| 3 | 设备设置（SettingsPage） | 充电模式、屏幕亮度、熄屏时间、屏幕旋转、设备名称、SN（可复制）、固件版本、蓝牙 MAC、断开/忘记设备 |
| - | 日志（LogsPage） | 会话、协议与错误日志 |

## A2687 私有协议

连接广播 `0xff09` 服务的设备后，应用会自动识别并启动私有协议会话：

| 环节 | 说明 |
| --- | --- |
| GATT 服务 | `8c850001-0302-41c5-b46e-cf057c562025`，写入 `…0002`，通知 `…0003` |
| 帧格式 | `FF 09 + LE16 总长 + 载荷 + XOR 校验`，载荷头部 `03 00 group cmd\|0x40` |
| 加密 | 客户端生成 P-256 临时密钥对，与设备公钥做 ECDH，取共享密钥前 16 字节作 AES-128-GCM 密钥，后 12 字节作 nonce |
| 握手 | `0x0001` → `0x0003` → `0x0029`（身份）→ `0x0005` → `0x0021` → `0x0022` → `0x0027` |
| 心跳/遥测 | `0x020A`、`0x0200` 每 6 秒轮询，解析 TLV A5/A6/A7 与线缆状态码 |
| 控制 | 端口开关 `0x0207`、倒计时 `0x0209`、充电模式 `0x0206`、显示设置 `0x0202/03/04/0B/0D/0F` |

固件 v0.0.5.2 会发送未置位标志但实际加密的帧，解析层对此做了兼容。该固件在无交互约 60 秒后会主动断开蓝牙，应用会自动重连。

## 项目结构

```
├── CMakeLists.txt        # Qt 6 工程定义、QML 模块与 macOS Bundle 配置
├── cmake/Info.plist.in   # LSUIElement、蓝牙权限说明
├── src/
│   ├── main.cpp            # 单实例锁、托盘、面板定位与生命周期
│   ├── ChargerController.* # 扫描、连接、重连、遥测状态与设置下发
│   ├── AnkerSession.*      # 握手、ECDH、AES-GCM、轮询与写入队列
│   ├── AnkerProtocol.*     # 帧编解码、TLV、遥测解析、控制指令
│   ├── AnkerCrypto.*       # ECDH P-256 / AES-128-GCM
│   └── MacUtils.mm         # NSWindow 层级与 Space 行为
├── qml/
│   ├── Main.qml            # 面板窗口与 StackView 路由
│   ├── DevicesPage.qml     # 第一层：我的设备
│   ├── DevicePage.qml      # 第二层：设备详情
│   ├── SettingsPage.qml    # 第三层：设备设置
│   └── LogsPage.qml        # 日志
└── assets/               # 应用图标（由 anker-logo.svg 生成）、菜单栏模板图标、产品图
```

## 连接排障

- **设备被占用**：充电器同一时间只能被一个主机连接。若手机安克 App 或其他电脑仍在连接，先断开再重试。
- **系统权限**：首次连接时 macOS 会请求蓝牙权限。若曾拒绝，请到「系统设置 → 隐私与安全性 → 蓝牙」重新允许 AnkerLinkAll。
- **旧实例**：更新应用前请完全退出旧版本，否则单实例锁会让新进程直接退出。
- **设备名称**：安克设备的名称可能是序列号（如 `ASHDPPE1G19600139`），界面统一显示为 `160W Prime Charger`。

## 技术栈

C++17 · Qt 6（Core / Gui / Widgets / Qml / Quick / QuickControls2 / Bluetooth / Svg）· QML · OpenSSL（ECDH / AES-GCM）· CMake + Ninja

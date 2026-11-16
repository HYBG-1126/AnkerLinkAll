#!/bin/bash
# 构建可分发安装包：部署 Qt 框架与 QML 模块 → 修正 qt.conf → 清理未使用模块 → ad-hoc 签名 → 生成 DMG
set -euo pipefail
cd "$(dirname "$0")/.."

QT_PREFIX="${QT_PREFIX:-/opt/homebrew/opt/qt}"
VERSION=$(sed -n 's/^project(AnkerLinkAll VERSION \([0-9.]*\).*/\1/p' CMakeLists.txt)
APP=build/AnkerLinkAll.app

"$QT_PREFIX/bin/macdeployqt" "$APP" -qmldir=qml -always-overwrite

# macdeployqt 不会覆盖构建期生成的 qt.conf，这里必须写包内相对路径，否则安装到其他机器找不到 QML 模块
cat > "$APP/Contents/Resources/qt.conf" <<'EOF'
[Paths]
Plugins = PlugIns
Imports = Resources/qml
QmlImports = Resources/qml
EOF

# 未使用虚拟键盘；其框架未部署，保留会导致悬空引用
rm -rf "$APP/Contents/Resources/qml/QtQuick/VirtualKeyboard"
rm -f "$APP"/Contents/PlugIns/quick/libqtvkb*.dylib
rm -f "$APP/Contents/PlugIns/quick/libvirtualkeyboardplugin.dylib"
rm -f "$APP/Contents/PlugIns/platforminputcontexts/libqtvirtualkeyboardplugin.dylib"

# 包内 Homebrew 依赖常按构建机系统编译，最低系统版本取所有 Mach-O 的最大 minos，避免在旧系统上启动即崩溃
MIN_OS=$(find "$APP" -type f -print0 | xargs -0 file | awk -F: '/Mach-O/{print $1}' \
  | while read -r bin; do vtool -show-build "$bin" 2>/dev/null | awk '/minos/{print $2; exit}'; done \
  | sort -V | tail -1)
/usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion ${MIN_OS}" "$APP/Contents/Info.plist"

ARCHS=$(lipo -archs "$APP/Contents/MacOS/AnkerLinkAll")
case "$ARCHS" in
  arm64) ARCH_LABEL="AppleSilicon-arm64" ;;
  x86_64) ARCH_LABEL="Intel-x86_64" ;;
  *) ARCH_LABEL="Universal" ;;
esac
DMG="release/AnkerLinkAll-v${VERSION}-macOS${MIN_OS}+-${ARCH_LABEL}.dmg"

codesign --force --deep --sign - "$APP"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
mkdir -p release
hdiutil create -volname "AnkerLinkAll ${VERSION}" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
echo "$DMG"
echo "  版本：${VERSION}  架构：${ARCH_LABEL}  系统：macOS ${MIN_OS} 及以上"

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page
    signal back()

    TextEdit {
        id: clipboardHelper
        visible: false
        function copyText(text) {
            clipboardHelper.text = text
            clipboardHelper.selectAll()
            clipboardHelper.copy()
        }
    }

    function sendIndexSetting(kind, index, onSuccess) {
        if (!charger.sessionReady) {
            App.toast("设备未连接，设置未下发")
            return
        }
        const ok = charger.setSetting(kind, index)
        if (ok) onSuccess()
        App.toast(ok ? "设置已下发" : "设置下发失败")
    }

    Flickable {
        id: flick
        anchors.fill: parent
        contentHeight: body.implicitHeight + 24
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        ColumnLayout {
            id: body
            x: 16
            y: 14
            width: flick.width - 32
            spacing: 14

            Item {
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                Rectangle {
                    id: backButton
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    width: 36; height: 36; radius: 18
                    color: backMouse.pressed ? App.line : "transparent"
                    Icon { anchors.centerIn: parent; name: "back"; size: 22; strokeWidth: 2; color: App.ink }
                    MouseArea {
                        id: backMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: page.back()
                    }
                }
            }

            Text {
                text: "设置"
                color: App.ink
                font.pixelSize: 26
                font.weight: Font.DemiBold
                Layout.bottomMargin: 2
            }

            SectionTitle { text: "功能设置" }
            Card {
                Layout.fillWidth: true
                padding: 8
                ColumnLayout {
                    width: parent.width
                    spacing: 0
                    ListRow {
                        icon: "info"
                        label: "充电模式"
                        value: App.modeLabel(charger.chargingMode)
                        onClicked: {
                            if (!charger.sessionReady) { App.toast("设备未连接，设置未下发"); return }
                            modeSheet.open()
                        }
                    }
                    ListRow {
                        label: "屏幕亮度"
                        value: App.prefs.brightness >= 0 ? App.prefs.brightness + "%" : "—"
                        onClicked: brightnessPopup.open()
                    }
                    ListRow {
                        label: "熄屏时间"
                        value: App.prefs.screenOff >= 0 ? App.screenOffOptions[App.prefs.screenOff] : "—"
                        onClicked: screenOffSheet.open()
                    }
                    ListRow {
                        label: "屏幕旋转"
                        value: App.prefs.rotation >= 0 ? App.rotationOptions[App.prefs.rotation] : "—"
                        showDivider: false
                        onClicked: rotationSheet.open()
                    }
                }
            }

            SectionTitle { text: "通用设置" }
            Card {
                Layout.fillWidth: true
                padding: 8
                ColumnLayout {
                    width: parent.width
                    spacing: 0
                    ListRow {
                        label: "设备名称"
                        value: charger.hasDevice ? App.textOr(charger.displayName) : "—"
                        clickable: false
                    }
                    ListRow {
                        label: "SN"
                        value: App.textOr(charger.serial)
                        mono: true
                        onClicked: {
                            if (!charger.serial) { App.toast("暂无 SN"); return }
                            clipboardHelper.copyText(charger.serial)
                            App.toast("SN 已复制")
                        }
                    }
                    ListRow { label: "固件版本"; value: App.textOr(charger.firmware); mono: true; clickable: false }
                    ListRow { label: "蓝牙 MAC"; value: App.textOr(charger.mac); mono: true; showDivider: false; clickable: false }
                }
            }

            Card {
                Layout.fillWidth: true
                padding: 8
                ColumnLayout {
                    width: parent.width
                    spacing: 0
                    ListRow {
                        label: charger.linked ? "断开连接" : "重新连接"
                        labelColor: App.accentDeep
                        onClicked: {
                            if (charger.linked) {
                                charger.disconnectDevice()
                                App.toast("已断开，可重新连接")
                            } else {
                                charger.connectNow()
                                App.toast("正在寻找充电器…")
                            }
                        }
                    }
                    ListRow {
                        label: "忘记此设备"
                        labelColor: App.danger
                        showDivider: false
                        onClicked: forgetDialog.open()
                    }
                }
            }

            ListRow {
                label: "退出 AnkerLinkAll"
                labelColor: App.inkSoft
                showDivider: false
                onClicked: Window.window.quitRequested()
            }
        }
    }

    OptionSheet {
        id: modeSheet
        title: "充电模式"
        options: App.chargingModes
        current: App.modeLabel(charger.chargingMode)
        onSelected: (index, label) => {
            const ok = charger.setChargingMode(App.chargingModes[index].value)
            App.toast(ok ? "已切换为 " + label : "充电模式指令发送失败")
        }
    }

    OptionSheet {
        id: screenOffSheet
        title: "熄屏时间"
        options: App.screenOffOptions
        current: App.prefs.screenOff >= 0 ? App.screenOffOptions[App.prefs.screenOff] : ""
        onSelected: index => page.sendIndexSetting("screenTimeout", index, () => App.prefs.screenOff = index)
    }

    OptionSheet {
        id: rotationSheet
        title: "屏幕旋转"
        options: App.rotationOptions
        current: App.prefs.rotation >= 0 ? App.rotationOptions[App.prefs.rotation] : ""
        onSelected: index => page.sendIndexSetting("screenDirection", index, () => App.prefs.rotation = index)
    }

    Popup {
        id: brightnessPopup
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: 300
        modal: true
        padding: 20
        Overlay.modal: Rectangle { color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.3); radius: 18 }
        background: Rectangle { radius: 20; color: App.surface }
        contentItem: ColumnLayout {
            spacing: 16
            RowLayout {
                Layout.fillWidth: true
                Text { text: "屏幕亮度"; color: App.ink; font.pixelSize: 15; font.weight: Font.DemiBold; Layout.fillWidth: true }
                Text { text: Math.round(brightnessSlider.value) + "%"; color: App.sub; font.pixelSize: 14 }
            }
            Slider {
                id: brightnessSlider
                Layout.fillWidth: true
                from: 10
                to: 100
                stepSize: 5
                snapMode: Slider.SnapAlways
                value: App.prefs.brightness >= 0 ? App.prefs.brightness : 50
                background: Rectangle {
                    x: brightnessSlider.leftPadding
                    y: brightnessSlider.topPadding + brightnessSlider.availableHeight / 2 - height / 2
                    width: brightnessSlider.availableWidth
                    height: 4
                    radius: 2
                    color: App.line
                    Rectangle {
                        width: brightnessSlider.visualPosition * parent.width
                        height: parent.height
                        radius: 2
                        color: App.accent
                    }
                }
                handle: Rectangle {
                    x: brightnessSlider.leftPadding + brightnessSlider.visualPosition * (brightnessSlider.availableWidth - width)
                    y: brightnessSlider.topPadding + brightnessSlider.availableHeight / 2 - height / 2
                    width: 22
                    height: 22
                    radius: 11
                    color: "white"
                    border.color: App.accent
                    border.width: 2
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 40
                radius: 20
                color: App.accent
                Text {
                    anchors.centerIn: parent
                    text: "保存"
                    color: "white"
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        const next = Math.round(brightnessSlider.value)
                        brightnessPopup.close()
                        page.sendIndexSetting("brightness", next, () => App.prefs.brightness = next)
                    }
                }
            }
        }
    }

    Popup {
        id: forgetDialog
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: 300
        modal: true
        padding: 20
        Overlay.modal: Rectangle { color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.35); radius: 18 }
        background: Rectangle { radius: 20; color: App.surface }
        contentItem: ColumnLayout {
            spacing: 14
            Text { text: "忘记此设备？"; color: App.ink; font.pixelSize: 16; font.weight: Font.DemiBold; Layout.alignment: Qt.AlignHCenter }
            Text {
                text: "将断开连接并清除记住的充电器，下次需要重新扫描。"
                color: App.sub
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
                Layout.fillWidth: true
            }
            RowLayout {
                Layout.fillWidth: true
                spacing: 10
                DialogButton { text: "取消"; onClicked: forgetDialog.close() }
                DialogButton {
                    text: "忘记"
                    primary: true
                    onClicked: {
                        forgetDialog.close()
                        charger.forgetDevice()
                        App.toast("已忘记设备")
                    }
                }
            }
        }
    }

    component SectionTitle: Text {
        color: App.sub
        font.pixelSize: 13
        font.weight: Font.DemiBold
        Layout.leftMargin: 4
        Layout.topMargin: 2
    }

    component DialogButton: Rectangle {
        id: button
        property string text
        property bool primary
        signal clicked()
        Layout.fillWidth: true
        implicitHeight: 40
        radius: 20
        color: primary ? App.danger : App.bg
        Text { anchors.centerIn: parent; text: button.text; color: button.primary ? "white" : App.ink; font.pixelSize: 14; font.weight: Font.DemiBold }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: button.clicked() }
    }
}

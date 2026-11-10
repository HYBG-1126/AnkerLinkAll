import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects

Item {
    id: page
    signal openBack()
    signal openSettings()
    signal openLogs()

    property int selectedPort: 0
    // 固件约每 60 秒主动断开一次，重连宽限期内保持设备视图与最近数据
    readonly property bool showDevice: charger.linked || charger.reconnecting
    readonly property var ports: charger.ports
    readonly property var currentPort: ports.length > selectedPort ? ports[selectedPort] : null
    readonly property var pluggedIds: ports.filter(p => p.plugged).map(p => p.id)
    readonly property string chip: {
        if (charger.sessionReady) return "实时"
        if (charger.reconnecting) return "重连中"
        if (!charger.linked) return "未连接"
        if (charger.connectionState === "handshaking") return "握手中"
        return "连接中"
    }
    readonly property string footnote: {
        if (charger.reconnecting && !charger.sessionReady) return "充电器暂时断开，正在自动重连…"
        if (!charger.sessionReady) return charger.statusText
        if (!charger.hasTelemetry) return "会话已建立，等待设备上报遥测数据…"
        return ""
    }

    function requireSession() {
        if (charger.sessionReady) return true
        App.toast("请先连接充电器并等待安克会话建立")
        return false
    }

    PageHeader {
        id: headerRow
        title: charger.hasDevice ? charger.displayName : "设备详情"
        onBack: page.openBack()
        HeaderButton { icon: "log"; onClicked: page.openLogs() }
        HeaderButton { icon: "settings"; onClicked: page.openSettings() }
    }

    Flickable {
        id: flick
        anchors.top: headerRow.bottom
        anchors.topMargin: 6
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        contentHeight: body.implicitHeight + 20
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

        ColumnLayout {
            id: body
            x: 16
            width: flick.width - 32
            spacing: 12

            Rectangle {
                id: hero
                Layout.fillWidth: true
                Layout.preferredHeight: 300
                radius: 28
                clip: true
                gradient: Gradient {
                    GradientStop { position: 0; color: "#ffffff" }
                    GradientStop { position: 0.55; color: "#eef5f9" }
                    GradientStop { position: 1; color: "#e5edf3" }
                }

                Item {
                    id: stage
                    visible: page.showDevice
                    anchors.centerIn: parent
                    height: 264
                    width: height * 1024 / 1536

                    Image {
                        id: product
                        anchors.fill: parent
                        source: "qrc:/qt/qml/AnkerLinkAll/assets/device-160w-empty.png"
                        fillMode: Image.PreserveAspectFit
                        smooth: true
                        mipmap: true
                        visible: false
                    }
                    MultiEffect {
                        anchors.fill: parent
                        source: product
                        shadowEnabled: true
                        shadowColor: Qt.rgba(15 / 255, 42 / 255, 66 / 255, 0.22)
                        shadowBlur: 0.8
                        shadowVerticalOffset: 14
                    }
                    DeviceCables {
                        anchors.fill: parent
                        activePorts: page.pluggedIds
                    }
                }

                ColumnLayout {
                    visible: !page.showDevice
                    anchors.centerIn: parent
                    width: parent.width - 48
                    spacing: 8
                    Rectangle {
                        Layout.alignment: Qt.AlignHCenter
                        width: 56; height: 56; radius: 28
                        color: App.accentSoft
                        Icon { anchors.centerIn: parent; name: "bluetooth"; size: 28; color: App.accentDeep; strokeWidth: 2 }
                        SequentialAnimation on opacity {
                            running: ["scanning", "connecting", "discovering", "handshaking", "reconnecting", "waiting"].indexOf(charger.connectionState) >= 0
                            loops: Animation.Infinite
                            onRunningChanged: if (!running) parent.opacity = 1
                            NumberAnimation { to: 0.45; duration: 700; easing.type: Easing.InOutQuad }
                            NumberAnimation { to: 1; duration: 700; easing.type: Easing.InOutQuad }
                        }
                    }
                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        text: charger.reconnecting ? "正在重连充电器" : "未连接设备"
                        color: App.ink
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                    }
                    Text {
                        Layout.fillWidth: true
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        text: charger.statusText
                        color: App.sub
                        font.pixelSize: 12
                    }
                }

                Rectangle {
                    anchors.left: parent.left
                    anchors.bottom: parent.bottom
                    anchors.margins: 14
                    height: 30
                    width: outputRow.implicitWidth + 24
                    radius: 15
                    color: Qt.rgba(1, 1, 1, 0.85)
                    border.color: App.line
                    visible: page.showDevice
                    RowLayout {
                        id: outputRow
                        anchors.centerIn: parent
                        spacing: 4
                        Icon { name: "output"; size: 14; color: App.accentDeep; strokeWidth: 2 }
                        Text { text: page.pluggedIds.length > 0 ? "输出中 " + page.pluggedIds.join(" ") : "无输出"; color: App.inkSoft; font.pixelSize: 12 }
                    }
                }

                Rectangle {
                    id: fab
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    anchors.margins: 14
                    width: 48; height: 48; radius: 24
                    gradient: Gradient {
                        GradientStop { position: 0; color: page.showDevice ? "#34d399" : "#1ed2e8" }
                        GradientStop { position: 1; color: page.showDevice ? "#10b981" : "#0aa7bd" }
                    }
                    scale: fabMouse.pressed ? 0.94 : 1
                    Behavior on scale { NumberAnimation { duration: 90 } }
                    Icon { anchors.centerIn: parent; name: "bluetooth"; size: 22; color: "white"; strokeWidth: 2.2 }
                    MouseArea {
                        id: fabMouse
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (charger.reconnecting && !charger.sessionReady) {
                                App.toast("正在自动重连充电器…")
                                return
                            }
                            if (charger.linked) {
                                App.toast(charger.sessionReady ? "蓝牙已连接" : charger.statusText)
                                return
                            }
                            charger.connectNow()
                            App.toast("正在寻找充电器…")
                        }
                    }
                }
            }

            Card {
                visible: !page.showDevice && charger.nearbyDevices.length > 0
                Layout.fillWidth: true
                ColumnLayout {
                    width: parent.width
                    spacing: 0
                    Text {
                        text: "附近的蓝牙设备"
                        color: App.inkSoft
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        Layout.bottomMargin: 4
                    }
                    Repeater {
                        model: charger.nearbyDevices
                        delegate: ListRow {
                            required property var modelData
                            required property int index
                            icon: "bluetooth"
                            label: modelData.name
                            labelColor: modelData.anker ? App.accentDeep : App.ink
                            value: modelData.rssi + " dBm"
                            showDivider: index < charger.nearbyDevices.length - 1
                            onClicked: {
                                App.toast("正在连接 " + modelData.name + " …")
                                charger.connectToNearby(modelData.uuid)
                            }
                        }
                    }
                }
            }

            Card {
                Layout.fillWidth: true
                padding: 8
                RowLayout {
                    width: parent.width
                    spacing: 0
                    Repeater {
                        model: page.ports
                        delegate: Item {
                            id: summary
                            required property var modelData
                            required property int index
                            readonly property bool active: page.selectedPort === index
                            Layout.fillWidth: true
                            implicitHeight: 86
                            Rectangle {
                                anchors.fill: parent
                                radius: 14
                                color: summary.active ? App.accentSoft : "transparent"
                            }
                            ColumnLayout {
                                anchors.centerIn: parent
                                spacing: 4
                                Rectangle {
                                    Layout.alignment: Qt.AlignHCenter
                                    width: 30; height: 18; radius: 9
                                    color: summary.modelData.plugged ? App.accent : App.line
                                    Text {
                                        anchors.centerIn: parent
                                        text: summary.modelData.id
                                        color: summary.modelData.plugged ? "white" : App.inkSoft
                                        font.pixelSize: 10
                                        font.weight: Font.Bold
                                    }
                                }
                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    textFormat: Text.RichText
                                    text: (summary.modelData.plugged ? App.watts(summary.modelData.power) : "--")
                                          + "<span style='font-size:11px;color:" + App.sub + "'> W</span>"
                                    color: App.ink
                                    font.pixelSize: 20
                                    font.weight: Font.DemiBold
                                }
                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    text: summary.modelData.plugged || summary.modelData.voltage != null
                                          ? App.volts(summary.modelData.voltage) + " / " + App.amps(summary.modelData.current)
                                          : "--V / --A"
                                    color: App.sub
                                    font.pixelSize: 11
                                }
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: page.selectedPort = summary.index
                            }
                        }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.topMargin: 4
                Text { text: "实时数据"; color: App.ink; font.pixelSize: 15; font.weight: Font.DemiBold }
                Rectangle {
                    implicitWidth: chipText.implicitWidth + 14
                    implicitHeight: 20
                    radius: 10
                    color: charger.sessionReady ? App.accentSoft : App.line
                    Text {
                        id: chipText
                        anchors.centerIn: parent
                        text: page.chip
                        color: charger.sessionReady ? App.accentDeep : App.sub
                        font.pixelSize: 11
                        font.weight: Font.DemiBold
                    }
                }
                Item { Layout.fillWidth: true }
            }

            Card {
                Layout.fillWidth: true
                ColumnLayout {
                    width: parent.width
                    spacing: 2
                    Text { text: "总输出"; color: App.sub; font.pixelSize: 12 }
                    Text {
                        textFormat: Text.RichText
                        text: App.watts(charger.totalPower) + "<span style='font-size:13px;color:" + App.sub + "'> W</span>"
                        color: App.ink
                        font.pixelSize: 30
                        font.weight: Font.Bold
                    }
                    Sparkline {
                        Layout.fillWidth: true
                        Layout.topMargin: 6
                        Layout.preferredHeight: 64
                        values: charger.history
                    }
                }
            }

            Text {
                text: "端口控制"
                color: App.ink
                font.pixelSize: 15
                font.weight: Font.DemiBold
                Layout.topMargin: 4
            }

            Card {
                Layout.fillWidth: true
                ColumnLayout {
                    width: parent.width
                    spacing: 12

                    Rectangle {
                        Layout.fillWidth: true
                        implicitHeight: 36
                        radius: 18
                        color: App.bg
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 3
                            spacing: 3
                            Repeater {
                                model: page.ports
                                delegate: Rectangle {
                                    required property var modelData
                                    required property int index
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    radius: 15
                                    color: page.selectedPort === index ? App.surface : "transparent"
                                    Text {
                                        anchors.centerIn: parent
                                        text: parent.modelData.id
                                        color: page.selectedPort === parent.index ? App.accentDeep : App.inkSoft
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: page.selectedPort = parent.index
                                    }
                                }
                            }
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "端口设置"; color: App.ink; font.pixelSize: 14; Layout.fillWidth: true }
                        RoundToggle {
                            icon: "clock"
                            filled: false
                            on: page.currentPort ? App.portTimerOn(page.currentPort.id) : false
                            onClicked: if (page.requireSession()) timerSheet.open()
                        }
                        RoundToggle {
                            icon: "power"
                            filled: true
                            on: page.currentPort ? page.currentPort.outputOn === true : false
                            dimmed: !charger.sessionReady
                            onClicked: {
                                if (!page.requireSession() || !page.currentPort) return
                                const next = page.currentPort.outputOn !== true
                                const id = page.currentPort.id
                                const ok = charger.setPortPower(page.selectedPort, next)
                                App.toast(ok ? id + " 输出已" + (next ? "开启" : "关闭") : "端口指令发送失败")
                            }
                        }
                    }

                    Rectangle { Layout.fillWidth: true; height: 1; color: App.line }

                    InfoRow {
                        label: "线缆信息"
                        value: !page.currentPort ? "—" : page.currentPort.plugged ? App.textOr(page.currentPort.cable || "已连接") : "未检测到线缆"
                    }
                    InfoRow { label: "充电信息"; value: page.currentPort ? App.textOr(page.currentPort.charging) : "—" }
                    InfoRow { label: "设备信息"; value: App.textOr(charger.model) }
                }
            }

            Card {
                Layout.fillWidth: true
                padding: 6
                ListRow {
                    width: parent.width
                    icon: "info"
                    label: "充电模式"
                    value: App.modeLabel(charger.chargingMode)
                    showDivider: false
                    onClicked: if (page.requireSession()) modeSheet.open()
                }
            }

            Text {
                visible: page.footnote !== ""
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: page.footnote
                color: App.sub
                font.pixelSize: 12
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
        id: timerSheet
        title: (page.currentPort ? page.currentPort.id : "") + " 定时关闭"
        options: App.timerOptions
        current: page.currentPort && App.portTimerOn(page.currentPort.id) ? "" : "关闭"
        onSelected: (index, label) => {
            if (!page.currentPort) return
            const id = page.currentPort.id
            const seconds = App.timerOptions[index].seconds
            if (!charger.setPortTimer(page.selectedPort, seconds)) {
                App.toast("定时指令发送失败")
                return
            }
            App.setPortTimerOn(id, seconds > 0)
            App.toast(seconds > 0 ? id + " 定时" + label : id + " 定时已关闭")
        }
    }

    component HeaderButton: Rectangle {
        id: hb
        property string icon
        signal clicked()
        width: 32; height: 32; radius: 16
        color: hbMouse.pressed ? App.line : (hbMouse.containsMouse ? Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.05) : "transparent")
        Icon { anchors.centerIn: parent; name: hb.icon; size: 20; color: App.inkSoft }
        MouseArea { id: hbMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: hb.clicked() }
    }

    component RoundToggle: Rectangle {
        id: toggle
        property string icon
        property bool filled
        property bool on
        property bool dimmed
        signal clicked()
        width: 38; height: 38; radius: 19
        opacity: dimmed ? 0.45 : 1
        color: filled ? (on ? App.accent : App.line) : (on ? App.accentSoft : "transparent")
        border.width: filled ? 0 : 1.5
        border.color: on ? App.accent : "#d5dde6"
        Icon { anchors.centerIn: parent; name: toggle.icon; size: 18; strokeWidth: 2; color: toggle.filled ? (toggle.on ? "white" : App.inkSoft) : (toggle.on ? App.accentDeep : App.inkSoft) }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: toggle.clicked() }
    }

    component InfoRow: RowLayout {
        property string label
        property string value
        Layout.fillWidth: true
        Text { text: parent.label; color: App.sub; font.pixelSize: 13 }
        Text {
            text: parent.value
            color: App.ink
            font.pixelSize: 13
            horizontalAlignment: Text.AlignRight
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
    }
}

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page
    signal openDevice()
    signal openLogs()

    readonly property bool online: charger.hasDevice && (charger.sessionReady || charger.reconnecting)

    Flickable {
        anchors.fill: parent
        contentHeight: body.implicitHeight + 24
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        ColumnLayout {
            id: body
            x: 16
            width: parent.width - 32
            spacing: 16

            Item {
                Layout.fillWidth: true
                Layout.topMargin: 18
                Layout.preferredHeight: 36
                Text {
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    text: "我的设备"
                    color: App.ink
                    font.pixelSize: 24
                    font.weight: Font.DemiBold
                }
                Rectangle {
                    id: addButton
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    width: 36; height: 36; radius: 18
                    color: addMouse.pressed ? App.line : "transparent"
                    Icon { anchors.centerIn: parent; name: "plus"; size: 26; color: App.ink }
                    MouseArea {
                        id: addMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            charger.scanNow()
                            addSheet.open()
                        }
                    }
                }
            }

            Rectangle {
                id: deviceCard
                Layout.fillWidth: true
                Layout.preferredHeight: 128
                radius: 24
                color: App.surface
                border.color: App.line
                border.width: 1

                RowLayout {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.leftMargin: 18
                    anchors.rightMargin: 18
                    spacing: 16

                    Image {
                        Layout.preferredWidth: 72
                        Layout.preferredHeight: 100
                        source: "qrc:/qt/qml/AnkerLinkAll/assets/device-160w-empty.png"
                        fillMode: Image.PreserveAspectFit
                        smooth: true
                        mipmap: true
                        opacity: page.online ? 1 : 0.55
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        Text {
                            text: charger.hasDevice ? charger.displayName : "Anker 充电器"
                            color: page.online ? App.ink : App.sub
                            font.pixelSize: 17
                            font.weight: Font.DemiBold
                            elide: Text.ElideRight
                            Layout.fillWidth: true
                        }
                        RowLayout {
                            spacing: 4
                            Icon {
                                name: "bluetooth"
                                size: 15
                                strokeWidth: 2
                                color: page.online ? App.accentDeep : App.sub
                            }
                            Text {
                                text: charger.sessionReady ? "已连接"
                                      : charger.reconnecting ? "重连中"
                                      : charger.linked ? "连接中"
                                      : "未连接"
                                color: page.online ? App.inkSoft : App.sub
                                font.pixelSize: 13
                            }
                        }
                    }

                    Icon {
                        name: "chevronRight"
                        size: 18
                        strokeWidth: 2
                        color: App.sub
                        visible: charger.hasDevice
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        if (charger.hasDevice)
                            page.openDevice()
                        else
                            App.toast("正在搜索充电器，稍后可进入详情")
                    }
                }
            }

            Text {
                visible: !page.online
                Layout.fillWidth: true
                Layout.topMargin: 4
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: App.textOr(charger.statusText)
                color: App.sub
                font.pixelSize: 12
            }
        }
    }

    Popup {
        id: addSheet
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: 300
        modal: true
        padding: 18
        Overlay.modal: Rectangle { color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.3); radius: 18 }
        background: Rectangle { radius: 20; color: App.surface }
        contentItem: ColumnLayout {
            spacing: 12
            RowLayout {
                Layout.fillWidth: true
                Text {
                    text: "添加设备"
                    color: App.ink
                    font.pixelSize: 16
                    font.weight: Font.DemiBold
                    Layout.fillWidth: true
                }
                Rectangle {
                    width: 28; height: 28; radius: 14
                    color: closeMouse.pressed ? App.line : "transparent"
                    Icon { anchors.centerIn: parent; name: "close"; size: 16; color: App.sub }
                    MouseArea { id: closeMouse; anchors.fill: parent; onClicked: addSheet.close() }
                }
            }
            Text {
                Layout.fillWidth: true
                visible: charger.nearbyDevices.length === 0
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
                text: "正在搜索附近的充电器…\n请确认充电器已接通电源"
                color: App.sub
                font.pixelSize: 13
            }
            Repeater {
                model: charger.nearbyDevices
                delegate: ListRow {
                    required property var modelData
                    Layout.fillWidth: true
                    icon: "bluetooth"
                    label: modelData.name
                    labelColor: modelData.anker ? App.accentDeep : App.ink
                    value: modelData.rssi + " dBm"
                    showDivider: false
                    onClicked: {
                        charger.connectToNearby(modelData.uuid)
                        addSheet.close()
                        App.toast("正在连接 " + modelData.name + " …")
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 38
                radius: 19
                color: App.bg
                Text {
                    anchors.centerIn: parent
                    text: "重新搜索"
                    color: App.ink
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: charger.scanNow()
                }
            }
        }
    }
}

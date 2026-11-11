import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects

Item {
    id: page
    signal openSettings()

    function comingSoon() {
        App.toast("该功能请在手机安克 App 中使用")
    }

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
                Layout.topMargin: 14
                Layout.preferredHeight: 36
                Rectangle {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    width: 36; height: 36; radius: 18
                    color: bellMouse.pressed ? App.line : "transparent"
                    Icon { anchors.centerIn: parent; name: "bell"; size: 22; strokeWidth: 2; color: App.ink }
                    MouseArea {
                        id: bellMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: page.comingSoon()
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 14

                Rectangle {
                    Layout.preferredWidth: 56
                    Layout.preferredHeight: 56
                    radius: 28
                    color: App.accentSoft
                    Image {
                        anchors.centerIn: parent
                        width: 30; height: 30
                        source: "qrc:/qt/qml/AnkerLinkAll/assets/anker-logo.svg"
                        fillMode: Image.PreserveAspectFit
                        smooth: true
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 3
                    Text {
                        text: "AnkerLinkAll 用户"
                        color: App.ink
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: "桌面端 · 本地蓝牙直连"
                        color: App.sub
                        font.pixelSize: 12
                    }
                }

                Icon { name: "chevronRight"; size: 18; strokeWidth: 2; color: App.sub }
            }

            Rectangle {
                id: banner
                Layout.fillWidth: true
                Layout.preferredHeight: 120
                radius: 20
                clip: true
                gradient: Gradient {
                    GradientStop { position: 0; color: "#e8f6fb" }
                    GradientStop { position: 1; color: "#d9eef7" }
                }

                ColumnLayout {
                    anchors.left: parent.left
                    anchors.leftMargin: 18
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 3
                    Text { text: "安克官方商城"; color: App.ink; font.pixelSize: 17; font.weight: Font.DemiBold }
                    Text { text: "粉丝阵地　独家福利"; color: App.inkSoft; font.pixelSize: 12 }
                    Rectangle {
                        Layout.topMargin: 6
                        implicitWidth: creatorText.implicitWidth + 20
                        implicitHeight: 26
                        radius: 13
                        color: App.accent
                        Text {
                            id: creatorText
                            anchors.centerIn: parent
                            text: "成为创造者"
                            color: "white"
                            font.pixelSize: 12
                            font.weight: Font.DemiBold
                        }
                    }
                }

                Image {
                    anchors.right: parent.right
                    anchors.rightMargin: 10
                    anchors.verticalCenter: parent.verticalCenter
                    width: 84; height: 108
                    source: "qrc:/qt/qml/AnkerLinkAll/assets/device-160w-empty.png"
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    mipmap: true
                    opacity: 0.9
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: page.comingSoon()
                }
            }

            Card {
                Layout.fillWidth: true
                padding: 8
                ColumnLayout {
                    width: parent.width
                    spacing: 0
                    ListRow { icon: "help"; label: "帮助和反馈"; onClicked: page.comingSoon() }
                    ListRow { icon: "manual"; label: "用户手册"; onClicked: page.comingSoon() }
                    ListRow { icon: "settings"; label: "设置"; onClicked: page.openSettings() }
                    ListRow { icon: "about"; label: "关于"; onClicked: aboutDialog.open() }
                    ListRow { icon: "discover"; label: "发现"; onClicked: page.comingSoon() }
                    ListRow { icon: "maker"; label: "安克创客空间"; onClicked: page.comingSoon() }
                    ListRow { icon: "star"; label: "评价"; showDivider: false; onClicked: page.comingSoon() }
                }
            }

            ListRow {
                Layout.fillWidth: true
                label: "退出 AnkerLinkAll"
                labelColor: App.inkSoft
                showDivider: false
                onClicked: Window.window.quitRequested()
            }
        }
    }

    Popup {
        id: aboutDialog
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: 280
        modal: true
        padding: 22
        Overlay.modal: Rectangle { color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.3); radius: 18 }
        background: Rectangle { radius: 20; color: App.surface }
        contentItem: ColumnLayout {
            spacing: 10
            Rectangle {
                Layout.alignment: Qt.AlignHCenter
                Layout.preferredWidth: 56
                Layout.preferredHeight: 56
                radius: 28
                color: App.accentSoft
                Image {
                    anchors.centerIn: parent
                    width: 30; height: 30
                    source: "qrc:/qt/qml/AnkerLinkAll/assets/anker-logo.svg"
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                }
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "AnkerLinkAll 安克万连"
                color: App.ink
                font.pixelSize: 16
                font.weight: Font.DemiBold
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "版本 v" + Qt.application.version
                color: App.sub
                font.pixelSize: 12
                font.family: App.mono
            }
            Text {
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: "非官方个人项目，与安克官方 App 账号体系不互通\n仅通过蓝牙直连控制附近设备"
                color: App.sub
                font.pixelSize: 12
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.topMargin: 4
                Layout.preferredHeight: 38
                radius: 19
                color: App.bg
                Text { anchors.centerIn: parent; text: "好"; color: App.ink; font.pixelSize: 13; font.weight: Font.DemiBold }
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: aboutDialog.close() }
            }
        }
    }
}

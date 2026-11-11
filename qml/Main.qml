import QtQuick
import QtQuick.Controls
import QtQuick.Effects

ApplicationWindow {
    id: window
    signal quitRequested()

    width: 380
    height: 660
    visible: false
    title: "AnkerLinkAll"
    flags: Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.NoDropShadowWindowHint
    color: "transparent"

    background: Rectangle {
        radius: 18
        color: App.bg
        border.color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.12)
        border.width: 1
    }

    Item {
        anchors.fill: parent
        anchors.margins: 1
        clip: true

        StackView {
            id: stack
            anchors.fill: parent
            initialItem: devicesPage
            pushEnter: Transition {
                XAnimator { from: stack.width; to: 0; duration: 200; easing.type: Easing.OutCubic }
            }
            pushExit: Transition {
                XAnimator { from: 0; to: -stack.width * 0.3; duration: 200; easing.type: Easing.OutCubic }
            }
            popEnter: Transition {
                XAnimator { from: -stack.width * 0.3; to: 0; duration: 200; easing.type: Easing.OutCubic }
            }
            popExit: Transition {
                XAnimator { from: 0; to: stack.width; duration: 200; easing.type: Easing.OutCubic }
            }
        }
    }

    Component {
        id: devicesPage
        DevicesPage {
            onOpenDevice: stack.push(devicePage)
            onOpenLogs: stack.push(logsPage)
            onOpenSettings: stack.push(settingsPage)
        }
    }
    Component {
        id: devicePage
        DevicePage {
            onOpenBack: stack.pop()
            onOpenSettings: stack.push(settingsPage)
            onOpenLogs: stack.push(logsPage)
        }
    }
    Component {
        id: settingsPage
        SettingsPage { onBack: stack.pop() }
    }
    Component {
        id: logsPage
        LogsPage { onBack: stack.pop() }
    }

    onVisibleChanged: if (!visible) stack.pop(null)

    Rectangle {
        id: toast
        property string message
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 28
        width: Math.min(toastText.implicitWidth + 32, parent.width - 48)
        height: toastText.implicitHeight + 18
        radius: height / 2
        color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.88)
        opacity: 0
        visible: opacity > 0
        z: 100
        Behavior on opacity { NumberAnimation { duration: 160 } }
        Text {
            id: toastText
            anchors.centerIn: parent
            width: Math.min(implicitWidth, window.width - 80)
            text: toast.message
            color: "white"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
        }
        Timer {
            id: toastTimer
            interval: 2200
            onTriggered: toast.opacity = 0
        }
    }

    Connections {
        target: App
        function onToast(message) {
            toast.message = message
            toast.opacity = 1
            toastTimer.restart()
        }
    }

    Shortcut {
        sequence: "Ctrl+Q"
        onActivated: window.quitRequested()
    }
}

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Popup {
    id: root
    property string title
    property var options: []
    property string current
    signal selected(int index, string label)

    parent: Overlay.overlay
    width: parent ? parent.width : 380
    height: content.implicitHeight + 28
    x: 0
    y: parent ? parent.height - height : 0
    modal: true
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    Overlay.modal: Rectangle {
        color: Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.35)
        radius: 18
    }

    enter: Transition {
        NumberAnimation { property: "y"; from: root.parent.height; to: root.parent.height - root.height; duration: 180; easing.type: Easing.OutCubic }
    }
    exit: Transition {
        NumberAnimation { property: "y"; to: root.parent.height; duration: 140; easing.type: Easing.InCubic }
    }

    background: Rectangle {
        color: App.surface
        radius: 22
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 22
            color: App.surface
            radius: 18
        }
    }

    contentItem: ColumnLayout {
        id: content
        spacing: 0

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 10
            width: 36
            height: 4
            radius: 2
            color: App.line
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 12
            Layout.bottomMargin: 8
            text: root.title
            color: App.ink
            font.pixelSize: 16
            font.weight: Font.DemiBold
        }

        Repeater {
            model: root.options
            delegate: Item {
                id: option
                required property var modelData
                required property int index
                readonly property string label: typeof modelData === "string" ? modelData : modelData.label
                readonly property bool active: label === root.current
                Layout.fillWidth: true
                implicitHeight: 52

                Rectangle {
                    anchors.fill: parent
                    anchors.leftMargin: 12
                    anchors.rightMargin: 12
                    radius: 12
                    color: option.active ? App.accentSoft : (optionMouse.pressed ? App.line : "transparent")
                }
                Text {
                    anchors.left: parent.left
                    anchors.leftMargin: 28
                    anchors.verticalCenter: parent.verticalCenter
                    text: option.label
                    color: option.active ? App.accentDeep : App.ink
                    font.pixelSize: 15
                    font.weight: option.active ? Font.DemiBold : Font.Normal
                }
                Rectangle {
                    visible: option.active
                    anchors.right: parent.right
                    anchors.rightMargin: 30
                    anchors.verticalCenter: parent.verticalCenter
                    width: 8
                    height: 8
                    radius: 4
                    color: App.accent
                }
                MouseArea {
                    id: optionMouse
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        root.selected(option.index, option.label)
                        root.close()
                    }
                }
            }
        }

        Item { implicitHeight: 6 }
    }
}

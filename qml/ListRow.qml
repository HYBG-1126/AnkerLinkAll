import QtQuick
import QtQuick.Layouts

Item {
    id: root
    property string label
    property string value
    property string icon
    property bool clickable: true
    property bool showDivider: true
    property bool mono: false
    property color labelColor: App.ink
    signal clicked()

    implicitHeight: 50
    Layout.fillWidth: true

    Rectangle {
        anchors.fill: parent
        anchors.leftMargin: -8
        anchors.rightMargin: -8
        radius: 10
        color: mouse.pressed && root.clickable ? App.line : "transparent"
    }

    RowLayout {
        anchors.fill: parent
        spacing: 10

        Icon {
            visible: root.icon !== ""
            name: root.icon
            size: 20
            color: App.inkSoft
        }
        Text {
            text: root.label
            color: root.labelColor
            font.pixelSize: 14
            font.weight: Font.Medium
            Layout.fillWidth: true
            elide: Text.ElideRight
        }
        Text {
            text: root.value
            color: App.sub
            font.pixelSize: 13
            font.family: root.mono ? App.mono : ""
            elide: Text.ElideMiddle
            Layout.maximumWidth: root.width * 0.6
            horizontalAlignment: Text.AlignRight
        }
        Icon {
            visible: root.clickable
            name: "chevronRight"
            size: 16
            color: App.sub
        }
    }

    Rectangle {
        visible: root.showDivider
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 1
        color: App.line
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        enabled: root.clickable
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}

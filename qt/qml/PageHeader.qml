import QtQuick
import QtQuick.Layouts

Item {
    id: root
    property string title
    default property alias actions: actionRow.data
    signal back()

    anchors.left: parent.left
    anchors.right: parent.right
    anchors.top: parent.top
    height: 56

    Rectangle {
        id: backButton
        anchors.left: parent.left
        anchors.leftMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        width: 32; height: 32; radius: 16
        color: backMouse.pressed ? App.line : (backMouse.containsMouse ? Qt.rgba(15 / 255, 28 / 255, 46 / 255, 0.05) : "transparent")
        Icon { anchors.centerIn: parent; name: "back"; size: 20; strokeWidth: 2; color: App.ink }
        MouseArea { id: backMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.back() }
    }

    Text {
        anchors.centerIn: parent
        text: root.title
        color: App.ink
        font.pixelSize: 16
        font.weight: Font.DemiBold
    }

    RowLayout {
        id: actionRow
        anchors.right: parent.right
        anchors.rightMargin: 12
        anchors.verticalCenter: parent.verticalCenter
    }
}

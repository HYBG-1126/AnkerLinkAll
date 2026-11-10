import QtQuick
import QtQuick.Effects

Item {
    id: root
    default property alias content: inner.data
    property real padding: 16
    property real radius: 20

    implicitHeight: inner.childrenRect.height + padding * 2

    RectangularShadow {
        anchors.fill: background
        radius: root.radius
        blur: 24
        offset.y: 6
        color: Qt.rgba(15 / 255, 42 / 255, 66 / 255, 0.06)
    }

    Rectangle {
        id: background
        anchors.fill: parent
        radius: root.radius
        color: App.surface
        border.color: Qt.rgba(226 / 255, 235 / 255, 243 / 255, 0.75)
        border.width: 1
    }

    Item {
        id: inner
        anchors.fill: parent
        anchors.margins: root.padding
    }
}

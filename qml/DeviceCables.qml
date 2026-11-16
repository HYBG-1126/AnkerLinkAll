import QtQuick

// 官方线缆叠加图与 device-a2687.png 同为 504×729 画布，直接叠放即可对齐
Item {
    id: root
    property var activePorts: []
    readonly property var visiblePorts: ["C1", "C2", "C3"].filter(port => activePorts.indexOf(port) >= 0)

    visible: visiblePorts.length > 0

    Repeater {
        model: root.visiblePorts
        delegate: Image {
            required property string modelData
            anchors.fill: parent
            source: "qrc:/qt/qml/AnkerLinkAll/assets/cable-" + modelData.toLowerCase() + ".png"
            fillMode: Image.PreserveAspectFit
            smooth: true
            mipmap: true
        }
    }
}

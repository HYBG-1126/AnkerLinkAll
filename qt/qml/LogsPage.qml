import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page
    signal back()

    PageHeader {
        id: header
        title: "连接日志"
        onBack: page.back()
        Text {
            text: "复制"
            color: App.accentDeep
            font.pixelSize: 13
            font.weight: Font.DemiBold
            MouseArea {
                anchors.fill: parent
                anchors.margins: -6
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    clipboardHelper.text = charger.logs.join("\n")
                    clipboardHelper.selectAll()
                    clipboardHelper.copy()
                    App.toast("日志已复制")
                }
            }
        }
    }

    TextEdit { id: clipboardHelper; visible: false }

    Rectangle {
        anchors.top: header.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 12
        anchors.topMargin: 0
        radius: 16
        color: "#0f1c2e"

        ListView {
            id: list
            anchors.fill: parent
            anchors.margins: 10
            clip: true
            model: charger.logs
            spacing: 3
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBar {}
            onCountChanged: Qt.callLater(positionViewAtEnd)
            Component.onCompleted: positionViewAtEnd()
            delegate: Text {
                required property string modelData
                width: list.width - 8
                text: modelData
                wrapMode: Text.WrapAnywhere
                color: modelData.indexOf("失败") >= 0 || modelData.indexOf("错误") >= 0 || modelData.indexOf("超时") >= 0 ? "#ff8a8d" : "#c9d6e3"
                font.family: App.mono
                font.pixelSize: 11
            }
        }

        Text {
            visible: list.count === 0
            anchors.centerIn: parent
            text: "暂无日志"
            color: App.sub
            font.pixelSize: 13
        }
    }
}

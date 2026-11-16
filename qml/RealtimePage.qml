import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page
    signal back()

    readonly property var ports: charger.ports
    readonly property var portHistory: charger.portHistory

    PageHeader {
        id: headerRow
        title: "实时数据"
        onBack: page.back()
    }

    Flickable {
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
            width: parent.width - 32
            spacing: 12

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
                        Layout.preferredHeight: 72
                        values: charger.history
                    }
                }
            }

            Text {
                text: "各端口"
                color: App.ink
                font.pixelSize: 15
                font.weight: Font.DemiBold
                Layout.topMargin: 4
            }

            Repeater {
                model: page.ports
                delegate: Card {
                    required property var modelData
                    required property int index
                    Layout.fillWidth: true

                    ColumnLayout {
                        width: parent.width
                        spacing: 6

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 8
                            Rectangle {
                                implicitWidth: 34; implicitHeight: 20; radius: 10
                                color: modelData.plugged ? App.accent : App.line
                                Text {
                                    anchors.centerIn: parent
                                    text: modelData.id
                                    color: modelData.plugged ? "white" : App.inkSoft
                                    font.pixelSize: 11
                                    font.weight: Font.Bold
                                }
                            }
                            Text {
                                text: modelData.plugged ? "已接入" : "未接入"
                                color: modelData.plugged ? App.accentDeep : App.sub
                                font.pixelSize: 12
                            }
                            Item { Layout.fillWidth: true }
                            Text {
                                textFormat: Text.RichText
                                text: (modelData.plugged ? App.watts(modelData.power) : "--")
                                      + "<span style='font-size:11px;color:" + App.sub + "'> W</span>"
                                color: App.ink
                                font.pixelSize: 22
                                font.weight: Font.DemiBold
                            }
                        }

                        Text {
                            text: modelData.plugged || modelData.voltage != null
                                  ? App.volts(modelData.voltage) + " / " + App.amps(modelData.current)
                                  : "--V / --A"
                            color: App.sub
                            font.pixelSize: 12
                        }

                        Sparkline {
                            Layout.fillWidth: true
                            Layout.topMargin: 2
                            Layout.preferredHeight: 48
                            values: page.portHistory.length > index ? page.portHistory[index] : []
                        }
                    }
                }
            }

            Text {
                visible: !charger.sessionReady
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: charger.sessionReady ? "" : "设备未连接，显示为占位数据"
                color: App.sub
                font.pixelSize: 12
            }
        }
    }
}

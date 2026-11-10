import QtQuick
import QtQuick.Shapes
import QtQuick.Effects

// 坐标与 device-160w-empty.png 的 1024×1536 画布一致，plug 为端口中心
Item {
    id: root
    property var activePorts: []

    readonly property var specs: ({
        "C1": { plug: [353, 952], cable: "M353 1118 C353 1255 344 1400 326 1530" },
        "C2": { plug: [437, 1018], cable: "M437 1184 C437 1305 429 1420 413 1530" },
        "C3": { plug: [508, 1079], cable: "M508 1245 C508 1345 501 1440 487 1530" }
    })
    readonly property var visiblePorts: ["C1", "C2", "C3"].filter(port => activePorts.indexOf(port) >= 0)
    readonly property real canvasScale: Math.min(width / 1024, height / 1536)

    visible: visiblePorts.length > 0

    Item {
        id: canvas
        width: 1024
        height: 1536
        x: (root.width - width * root.canvasScale) / 2
        y: (root.height - height * root.canvasScale) / 2
        scale: root.canvasScale
        transformOrigin: Item.TopLeft

        Item {
            id: cableLayer
            anchors.fill: parent
            visible: false

            Repeater {
                model: root.visiblePorts
                delegate: Item {
                    required property string modelData
                    anchors.fill: parent
                    Shape {
                        anchors.fill: parent
                        preferredRendererType: Shape.CurveRenderer
                        ShapePath {
                            strokeColor: "#1f2124"
                            strokeWidth: 34
                            fillColor: "transparent"
                            capStyle: ShapePath.RoundCap
                            PathSvg { path: root.specs[modelData].cable }
                        }
                    }
                    Shape {
                        anchors.fill: parent
                        transform: Translate { x: -8 }
                        opacity: 0.5
                        preferredRendererType: Shape.CurveRenderer
                        ShapePath {
                            strokeColor: "#666b72"
                            strokeWidth: 6
                            fillColor: "transparent"
                            capStyle: ShapePath.RoundCap
                            PathSvg { path: root.specs[modelData].cable }
                        }
                    }
                }
            }
        }

        Rectangle {
            id: fadeMask
            anchors.fill: parent
            visible: false
            layer.enabled: true
            gradient: Gradient {
                GradientStop { position: 0; color: "white" }
                GradientStop { position: 1320 / 1536; color: "white" }
                GradientStop { position: 1530 / 1536; color: "transparent" }
            }
        }

        MultiEffect {
            anchors.fill: parent
            source: cableLayer
            maskEnabled: true
            maskSource: fadeMask
            maskThresholdMin: 0.5
            maskSpreadAtMin: 1.0
        }

        Repeater {
            model: root.visiblePorts
            delegate: Item {
                required property string modelData
                x: root.specs[modelData].plug[0]
                y: root.specs[modelData].plug[1]

                Shape {
                    preferredRendererType: Shape.CurveRenderer
                    ShapePath {
                        strokeColor: "transparent"
                        fillGradient: RadialGradient {
                            centerX: 0; centerY: -8; centerRadius: 76
                            focalX: 0; focalY: -8
                            GradientStop { position: 0; color: Qt.rgba(0, 0, 0, 0.4) }
                            GradientStop { position: 1; color: "transparent" }
                        }
                        PathSvg { path: "M-86 -8 a86 30 0 1 0 172 0 a86 30 0 1 0 -172 0" }
                    }
                    ShapePath {
                        strokeColor: "transparent"
                        fillGradient: LinearGradient {
                            x1: -28; y1: 0; x2: 28; y2: 0
                            GradientStop { position: 0; color: "#141517" }
                            GradientStop { position: 0.4; color: "#34363b" }
                            GradientStop { position: 1; color: "#101113" }
                        }
                        PathSvg { path: "M-28 104 L28 104 L23 178 Q0 184 -23 178 Z" }
                    }
                }

                Rectangle { x: -30; y: 104; width: 60; height: 13; radius: 6; color: "#3a3d42" }

                Item {
                    transform: Matrix4x4 {
                        matrix: Qt.matrix4x4(1, 0, 0, 0,
                                             Math.tan(5 * Math.PI / 180), 1, 0, 0,
                                             0, 0, 1, 0,
                                             0, 0, 0, 1)
                    }
                    Rectangle {
                        x: -56; y: -18; width: 112; height: 124; radius: 17
                        gradient: Gradient {
                            orientation: Gradient.Horizontal
                            GradientStop { position: 0; color: "#1c1d20" }
                            GradientStop { position: 0.45; color: "#2a2c30" }
                            GradientStop { position: 1; color: "#121315" }
                        }
                    }
                    Rectangle {
                        x: -52; y: -18; width: 104; height: 17; radius: 8
                        gradient: Gradient {
                            orientation: Gradient.Horizontal
                            GradientStop { position: 0; color: "#55595f" }
                            GradientStop { position: 1; color: "#2e3034" }
                        }
                    }
                    Rectangle { x: -50; y: 6; width: 7; height: 84; radius: 3.5; color: "#767b83"; opacity: 0.3 }
                }
            }
        }
    }
}

import QtQuick
import QtQuick.Shapes

Item {
    id: root
    property string name: "bluetooth"
    property color color: "#0f1c2e"
    property real size: 20
    property real strokeWidth: 1.8

    readonly property var paths: ({
        "bluetooth": ["M8 7.5l8 8-4 3V4l4 3-8 8"],
        "chevronRight": ["M9 5l7 7-7 7"],
        "back": ["M15 5l-7 7 7 7"],
        "clock": ["M3.8 12a8.2 8.2 0 1 0 16.4 0a8.2 8.2 0 1 0 -16.4 0", "M12 7.5v5l3 1.8"],
        "info": ["M12 2.8l7.4 4.3v8.6L12 21.2l-7.4-4.3V7.1L12 2.8z", "M12 10.6v4.2", "M12 8h0.01"],
        "settings": ["M12 2.8l7.4 4.3v8.6L12 21.2l-7.4-4.3V7.1L12 2.8z", "M9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0"],
        "output": ["M12 19V5", "M6.5 10.5L12 5l5.5 5.5"],
        "power": ["M12 3v8.5", "M6.6 6.8a8 8 0 1 0 10.8 0"],
        "refresh": ["M20 11a8 8 0 1 0 -2.5 6.5", "M20 4v7h-7"],
        "close": ["M6 6l12 12", "M18 6L6 18"],
        "log": ["M5 5h14", "M5 10h14", "M5 15h9", "M5 20h6"],
        "plus": ["M12 5v14", "M5 12h14"],
        "copy": ["M9 9h11v11H9z", "M5 15V4h11"]
    })
    readonly property var current: paths[name] || []

    function pathAt(index) {
        return index < current.length ? current[index] : ""
    }

    implicitWidth: size
    implicitHeight: size

    component Stroke: ShapePath {
        property alias d: svg.path
        strokeColor: root.color
        strokeWidth: root.strokeWidth
        fillColor: "transparent"
        capStyle: ShapePath.RoundCap
        joinStyle: ShapePath.RoundJoin
        PathSvg { id: svg }
    }

    Shape {
        width: 24
        height: 24
        scale: root.size / 24
        transformOrigin: Item.TopLeft
        preferredRendererType: Shape.CurveRenderer

        Stroke { d: root.pathAt(0) }
        Stroke { d: root.pathAt(1) }
        Stroke { d: root.pathAt(2) }
        Stroke { d: root.pathAt(3) }
    }
}

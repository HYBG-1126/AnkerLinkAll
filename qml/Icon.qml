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
        "copy": ["M9 9h11v11H9z", "M5 15V4h11"],
        "grid": ["M13.5 3.5h7v7h-7z", "M3.5 13.5h7v7h-7z", "M13.5 13.5h7v7h-7z"],
        "user": ["M12 11.2a3.8 3.8 0 1 0 0-7.6a3.8 3.8 0 0 0 0 7.6z", "M4.5 20.3a7.5 7.5 0 0 1 15 0"],
        "bell": ["M6 9.5a6 6 0 0 1 12 0c0 3.8 1.4 5.4 1.4 5.4H4.6S6 13.3 6 9.5", "M10.2 18.8a1.9 1.9 0 0 0 3.6 0"],
        "help": ["M3.8 12a8.2 8.2 0 1 0 16.4 0a8.2 8.2 0 1 0 -16.4 0", "M9.4 9.1a2.8 2.8 0 1 1 4.4 2.3c-.9.7-1.6 1.1-1.6 2.3", "M12.2 16.6h0.01"],
        "manual": ["M12 5.5c-1.6-1.2-3.8-1.6-6.5-1.5v13.4c2.7-.1 4.9.3 6.5 1.5c1.6-1.2 3.8-1.6 6.5-1.5V4c-2.7-.1-4.9.3-6.5 1.5z", "M12 5.5v13.4"],
        "about": ["M5 4.5h14v15H5z", "M8.5 9h7", "M8.5 12.5h7", "M8.5 16h4"],
        "discover": ["M4.5 19.5l1.1-4.1L16.6 4.4a2.1 2.1 0 0 1 3 3L8.6 18.4z", "M14.8 6.2l3 3"],
        "maker": ["M9 4.5H6.5v15h11v-15H15", "M9.5 4.5a2.5 2.5 0 0 1 5 0", "M9.3 12.6l2 2 3.6-4.1"],
        "star": ["M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4l5.7-.8z"]
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

pragma Singleton
import QtQuick
import QtCore

QtObject {
    readonly property color bg: "#f2f6fa"
    readonly property color surface: "#ffffff"
    readonly property color ink: "#0f1c2e"
    readonly property color inkSoft: "#405168"
    readonly property color sub: "#8b98a8"
    readonly property color line: "#edf1f6"
    readonly property color accent: "#10c3dd"
    readonly property color accentDeep: "#0aa7bd"
    readonly property color accentSoft: "#e6f9fc"
    readonly property color success: "#10b981"
    readonly property color danger: "#e5484d"
    readonly property string mono: "SF Mono"

    readonly property var chargingModes: [
        { label: "AI 模式", value: 0 },
        { label: "标准模式", value: 1 }
    ]
    readonly property var screenOffOptions: ["30秒", "1分钟", "5分钟", "30分钟", "12小时"]
    readonly property var rotationOptions: ["向上", "向左", "向下", "向右"]
    readonly property var timerOptions: [
        { label: "关闭", seconds: 0 },
        { label: "15 分钟", seconds: 900 },
        { label: "30 分钟", seconds: 1800 },
        { label: "1 小时", seconds: 3600 },
        { label: "2 小时", seconds: 7200 }
    ]

    property Settings prefs: Settings {
        category: "device"
        property int brightness: -1
        property int screenOff: -1
        property int rotation: -1
        property string portTimers: "{}"
    }

    signal toast(string message)

    function modeLabel(value) {
        if (value === 0) return "AI 模式"
        if (value === 1) return "标准模式"
        if (value === 4) return "自定义模式"
        return "—"
    }

    function watts(value) {
        return value === undefined || value === null ? "--" : Number(value).toFixed(1)
    }

    function volts(value) {
        return value === undefined || value === null ? "--V" : Number(value).toFixed(1) + "V"
    }

    function amps(value) {
        return value === undefined || value === null ? "--A" : Number(value).toFixed(2) + "A"
    }

    function textOr(value) {
        return value === undefined || value === null || value === "" ? "—" : value
    }

    function portTimerOn(portId) {
        try {
            return JSON.parse(prefs.portTimers)[portId] === true
        } catch (e) {
            return false
        }
    }

    function setPortTimerOn(portId, on) {
        let map = {}
        try { map = JSON.parse(prefs.portTimers) } catch (e) {}
        map[portId] = on
        prefs.portTimers = JSON.stringify(map)
    }
}

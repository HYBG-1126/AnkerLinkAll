import QtQuick

Canvas {
    id: root
    property var values: []
    implicitHeight: 64
    antialiasing: true

    onValuesChanged: requestPaint()
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
        const ctx = getContext("2d")
        ctx.reset()
        const values = root.values || []
        const w = width
        const h = height
        ctx.strokeStyle = App.line
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, h - 0.5)
        ctx.lineTo(w, h - 0.5)
        ctx.stroke()
        if (values.length < 2)
            return

        let max = 0
        for (let i = 0; i < values.length; ++i)
            max = Math.max(max, values[i])
        max = Math.max(max * 1.15, 5)
        const step = w / (values.length - 1)
        const pointAt = i => ({ x: i * step, y: h - 4 - (values[i] / max) * (h - 10) })

        ctx.beginPath()
        let p = pointAt(0)
        ctx.moveTo(p.x, p.y)
        for (let i = 1; i < values.length; ++i) {
            p = pointAt(i)
            ctx.lineTo(p.x, p.y)
        }
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()
        const gradient = ctx.createLinearGradient(0, 0, 0, h)
        gradient.addColorStop(0, Qt.rgba(16 / 255, 195 / 255, 221 / 255, 0.28))
        gradient.addColorStop(1, Qt.rgba(16 / 255, 195 / 255, 221 / 255, 0))
        ctx.fillStyle = gradient
        ctx.fill()

        ctx.beginPath()
        p = pointAt(0)
        ctx.moveTo(p.x, p.y)
        for (let i = 1; i < values.length; ++i) {
            p = pointAt(i)
            ctx.lineTo(p.x, p.y)
        }
        ctx.strokeStyle = App.accent
        ctx.lineWidth = 2
        ctx.lineJoin = "round"
        ctx.lineCap = "round"
        ctx.stroke()
    }
}

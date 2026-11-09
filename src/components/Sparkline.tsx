import { MAX_OUTPUT_WATTS } from '../lib/deviceData'

interface SparklineProps {
  data: number[]
  height?: number
}

const VIEW_WIDTH = 320
const PADDING = 8

export function Sparkline({ data, height = 132 }: SparklineProps) {
  const innerWidth = VIEW_WIDTH - PADDING * 2
  const innerHeight = height - PADDING * 2
  const usable = data.length > 1 ? data : [0, 0]
  const points = usable.map((value, index) => {
    const x = PADDING + (index / (usable.length - 1)) * innerWidth
    const ratio = Math.min(1, Math.max(0, value / MAX_OUTPUT_WATTS))
    const y = PADDING + innerHeight - ratio * innerHeight
    return [x, y] as const
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${(PADDING + innerWidth).toFixed(1)} ${(PADDING + innerHeight).toFixed(1)} L${PADDING} ${(PADDING + innerHeight).toFixed(1)} Z`

  const horizontalLines = Array.from(
    { length: 5 },
    (_, index) => PADDING + (index / 4) * innerHeight,
  )
  const verticalLines = Array.from(
    { length: 7 },
    (_, index) => PADDING + (index / 6) * innerWidth,
  )

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="总输出功率曲线"
    >
      <defs>
        <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#18c8de" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#18c8de" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g stroke="#e8eef3" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {horizontalLines.map((y) => (
          <line
            key={`h-${y}`}
            x1={PADDING}
            x2={PADDING + innerWidth}
            y1={y}
            y2={y}
          />
        ))}
        {verticalLines.map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            x2={x}
            y1={PADDING}
            y2={PADDING + innerHeight}
          />
        ))}
      </g>
      <path d={area} fill="url(#spark-area)" />
      <path
        d={line}
        fill="none"
        stroke="#18c8de"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

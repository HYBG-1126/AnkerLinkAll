import type { AnkerPortId } from '../lib/anker/protocol'

interface CableSpec {
  plug: readonly [number, number]
  cable: string
}

// 坐标与 device-160w-empty.png 的 1024×1536 画布一致，plug 为端口中心
const CABLE_SPECS: Record<AnkerPortId, CableSpec> = {
  C1: { plug: [353, 952], cable: 'M353 1118 C353 1255 344 1400 326 1530' },
  C2: { plug: [437, 1018], cable: 'M437 1184 C437 1305 429 1420 413 1530' },
  C3: { plug: [508, 1079], cable: 'M508 1245 C508 1345 501 1440 487 1530' },
}

const CABLE_ORDER: AnkerPortId[] = ['C1', 'C2', 'C3']

export function DeviceCables({ activePorts }: { activePorts: AnkerPortId[] }) {
  const visible = CABLE_ORDER.filter((port) => activePorts.includes(port))
  if (visible.length === 0) return null

  return (
    <svg className="hero-cables" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="cable-fade" gradientUnits="userSpaceOnUse" x1="0" y1="1320" x2="0" y2="1530">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id="cable-fade-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536">
          <rect x="0" y="0" width="1024" height="1536" fill="url(#cable-fade)" />
        </mask>
        <linearGradient id="cable-plug-front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c1d20" />
          <stop offset="0.45" stopColor="#2a2c30" />
          <stop offset="1" stopColor="#121315" />
        </linearGradient>
        <linearGradient id="cable-plug-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#55595f" />
          <stop offset="1" stopColor="#2e3034" />
        </linearGradient>
        <linearGradient id="cable-neck" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#141517" />
          <stop offset="0.4" stopColor="#34363b" />
          <stop offset="1" stopColor="#101113" />
        </linearGradient>
        <filter id="cable-plug-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {visible.map((port) => {
        const { plug, cable } = CABLE_SPECS[port]
        return (
          <g key={port}>
            <g mask="url(#cable-fade-mask)" fill="none" strokeLinecap="round">
              <path d={cable} stroke="#1f2124" strokeWidth={34} />
              <path d={cable} stroke="#666b72" strokeWidth={6} strokeOpacity={0.5} transform="translate(-8 0)" />
            </g>
            <g transform={`translate(${plug[0]} ${plug[1]})`}>
              <ellipse cx={0} cy={-8} rx={66} ry={20} fill="#000" opacity={0.4} filter="url(#cable-plug-shadow)" />
              <path d="M-28 104 L28 104 L23 178 Q0 184 -23 178 Z" fill="url(#cable-neck)" />
              <rect x={-30} y={104} width={60} height={13} rx={6} fill="#3a3d42" />
              <g transform="skewY(5)">
                <rect x={-56} y={-18} width={112} height={124} rx={17} fill="url(#cable-plug-front)" />
                <rect x={-52} y={-18} width={104} height={17} rx={8} fill="url(#cable-plug-top)" />
                <rect x={-50} y={6} width={7} height={84} rx={3.5} fill="#767b83" opacity={0.3} />
              </g>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

import { DetailHeader } from '../components/PageHeader'
import { CommandSender } from '../components/CommandSender'
import { DevicePanel } from '../components/DevicePanel'
import { GattExplorer } from '../components/GattExplorer'
import { LogPanel } from '../components/LogPanel'
import { SummaryPanel } from '../components/SummaryPanel'
import { useBle } from '../hooks/useBle'

export function LabPage() {
  const { state, manager } = useBle()

  return (
    <div className="page lab-page">
      <DetailHeader title="实验室功能" />

      <div className="notice">
        以下为原始蓝牙调试工具，直接读写 GATT 服务与特征值。厂商私有协议需先在「协议管理」中登记服务 UUID。
      </div>

      <div className="lab-stack">
        <DevicePanel state={state} manager={manager} />
        <SummaryPanel state={state} />
        <GattExplorer state={state} manager={manager} />
        <CommandSender state={state} manager={manager} />
        <LogPanel state={state} manager={manager} />
      </div>

      <p className="page-footnote">
        调试操作会直接写入设备，请确认指令与目标特征值后再发送。
      </p>
    </div>
  )
}

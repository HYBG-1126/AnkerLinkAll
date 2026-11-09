import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LargeHeader } from '../components/PageHeader'
import { ListGroup, ListRow } from '../components/List'
import { OptionSheet, Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { BellIcon, BookIcon, InfoHexIcon, PowerIcon, SettingsHexIcon, StarIcon } from '../components/icons'
import { useBle } from '../hooks/useBle'
import { useCurrentDeviceProfile } from '../hooks/useCurrentDeviceProfile'
import {
  CHARGING_MODES,
  ROTATION_OPTIONS,
  SCREEN_OFF_OPTIONS,
  SCREENSAVER_OPTIONS,
  useDeviceSettings,
} from '../hooks/useDeviceSettings'

type OptionKind = 'mode' | 'screenOff' | 'rotation' | 'screensaver' | null

export function DeviceSettingsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { state, manager } = useBle()
  const { connected, deviceKey, profile } = useCurrentDeviceProfile()
  const { settings, update, reset } = useDeviceSettings(deviceKey)
  const [option, setOption] = useState<OptionKind>(null)
  const [brightnessOpen, setBrightnessOpen] = useState(false)
  const [firmwareOpen, setFirmwareOpen] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(settings.name)

  const optionConfig = {
    mode: {
      title: '充电模式',
      options: CHARGING_MODES,
      value: settings.chargingMode,
      onSelect: (value: string) => update({ chargingMode: value }),
    },
    screenOff: {
      title: '熄屏时间',
      options: SCREEN_OFF_OPTIONS,
      value: settings.screenOff,
      onSelect: (value: string) => update({ screenOff: value }),
    },
    rotation: {
      title: '屏幕旋转',
      options: ROTATION_OPTIONS,
      value: settings.rotation,
      onSelect: (value: string) => update({ rotation: value }),
    },
    screensaver: {
      title: '屏保设置',
      options: SCREENSAVER_OPTIONS,
      value: settings.screensaver,
      onSelect: (value: string) => update({ screensaver: value }),
    },
  } as const

  const activeOption = option === null ? null : optionConfig[option]

  const copySerial = () => {
    if (profile.sn === '—') {
      toast('暂无序列号')
      return
    }
    void navigator.clipboard?.writeText(profile.sn)
    toast('序列号已复制')
  }

  const saveName = () => {
    const next = nameDraft.trim()
    if (!next) {
      toast('设备名称不能为空')
      return
    }
    update({ name: next })
    setNameOpen(false)
    toast('设备名称已更新')
  }

  const confirmReset = () => {
    reset()
    setResetOpen(false)
    toast('已恢复默认设置')
  }

  const confirmDelete = () => {
    if (connected && state.device) void manager.forgetDevice(state.device.id)
    reset()
    setDeleteOpen(false)
    toast('已删除该设备')
    navigate('/')
  }

  return (
    <div className="page settings-page">
      <LargeHeader title="设置" />

      <ListGroup title="功能设置">
        <ListRow
          label="充电模式"
          icon={<PowerIcon />}
          value={settings.chargingMode}
          onClick={() => setOption('mode')}
        />
        <ListRow
          label="屏幕亮度"
          icon={<StarIcon />}
          value={`${settings.brightness}%`}
          onClick={() => setBrightnessOpen(true)}
        />
        <ListRow
          label="熄屏时间"
          icon={<BellIcon />}
          value={settings.screenOff}
          onClick={() => setOption('screenOff')}
        />
        <ListRow
          label="屏幕旋转"
          icon={<SettingsHexIcon />}
          value={settings.rotation}
          onClick={() => setOption('rotation')}
        />
        <ListRow
          label="实验室功能"
          icon={<InfoHexIcon />}
          value="GATT 调试"
          onClick={() => navigate('/lab')}
        />
        <ListRow
          label="屏保设置"
          icon={<BookIcon />}
          value={settings.screensaver}
          onClick={() => setOption('screensaver')}
        />
      </ListGroup>

      <ListGroup title="通用设置">
        <ListRow
          label="设备名称"
          value={connected ? profile.name : settings.name}
          onClick={() => {
            setNameDraft(settings.name)
            setNameOpen(true)
          }}
        />
        <ListRow label="SN" value={profile.sn} onClick={copySerial} />
        <ListRow label="固件版本" value={profile.firmware} onClick={() => setFirmwareOpen(true)} />
        <ListRow
          label="协议管理"
          value="厂商服务"
          onClick={() => navigate('/lab/protocol')}
        />
        <ListRow label="帮助和反馈" onClick={() => toast('可通过「我的」页面提交反馈')} />
        <ListRow
          label="恢复默认设置"
          showChevron={false}
          onClick={() => setResetOpen(true)}
        />
      </ListGroup>

      <button type="button" className="danger-btn" onClick={() => setDeleteOpen(true)}>
        删除设备
      </button>
      <p className="page-footnote">删除后需要重新扫描并授权此设备。</p>

      {activeOption !== null && (
        <OptionSheet
          open
          title={activeOption.title}
          options={activeOption.options}
          value={activeOption.value}
          onSelect={activeOption.onSelect}
          onClose={() => setOption(null)}
        />
      )}

      <Sheet open={brightnessOpen} title="屏幕亮度" onClose={() => setBrightnessOpen(false)}>
        <div className="sheet-slider">
          <span>{settings.brightness}%</span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={settings.brightness}
            aria-label="屏幕亮度"
            onChange={(event) => update({ brightness: Number(event.target.value) })}
          />
        </div>
        <button type="button" className="sheet-primary" onClick={() => setBrightnessOpen(false)}>
          完成
        </button>
      </Sheet>

      <Sheet open={firmwareOpen} title="固件升级" onClose={() => setFirmwareOpen(false)}>
        <div className="sheet-info">
          <p>当前版本 {profile.firmware}</p>
          <p className="muted">已是最新版本，无需升级。</p>
        </div>
        <button
          type="button"
          className="sheet-primary"
          onClick={() => {
            setFirmwareOpen(false)
            toast('已是最新版本')
          }}
        >
          检查更新
        </button>
      </Sheet>

      <Sheet open={nameOpen} title="设备名称" onClose={() => setNameOpen(false)}>
        <input
          className="sheet-input"
          value={nameDraft}
          maxLength={32}
          onChange={(event) => setNameDraft(event.target.value)}
          aria-label="设备名称"
        />
        <button type="button" className="sheet-primary" onClick={saveName}>
          保存
        </button>
      </Sheet>

      <Sheet open={resetOpen} title="恢复默认设置" onClose={() => setResetOpen(false)}>
        <p className="sheet-text">将清除此设备的充电模式、亮度与端口开关等本地设置。</p>
        <button type="button" className="sheet-primary" onClick={confirmReset}>
          恢复默认
        </button>
      </Sheet>

      <Sheet open={deleteOpen} title="删除设备" onClose={() => setDeleteOpen(false)}>
        <p className="sheet-text">删除后需重新扫描授权，确定要删除此设备吗？</p>
        <button type="button" className="sheet-primary is-danger" onClick={confirmDelete}>
          删除设备
        </button>
      </Sheet>
    </div>
  )
}

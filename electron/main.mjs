import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const devServerUrl = process.env.DESKTOP_DEV_URL ?? 'http://localhost:5173'
const PANEL_WIDTH = 430
const PANEL_MAX_HEIGHT = 800

let tray = null
let panel = null
let quitting = false
let bluetoothDialogOpen = false
let pickerWindow = null
let chooseBluetoothDevice = null
let cancelBluetoothPicker = null

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showPanel())
  app.whenReady().then(() => {
    app.dock?.hide()
    registerPermissions()
    createPanel()
    createTray()
    registerIpc()
  })
}

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  // 菜单栏应用常驻，关闭面板不退出
})

function registerPermissions() {
  const allowed = new Set(['bluetooth', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowed.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    allowed.has(permission),
  )
  session.defaultSession.setBluetoothPairingHandler((details, callback) => {
    void dialog
      .showMessageBox({
        type: 'question',
        title: '蓝牙配对',
        message: `请求与 ${details.deviceId} 配对`,
        detail: '允许后系统可能会要求输入配对码。',
        buttons: ['允许', '取消'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then(({ response }) =>
        callback({ confirmed: response === 0 && details.pairingKind !== 'providePin' }),
      )
      .catch(() => callback({ confirmed: false }))
  })
}

function createPanel() {
  const workArea = screen.getPrimaryDisplay().workArea
  const height = Math.min(PANEL_MAX_HEIGHT, workArea.height - 40)

  panel = new BrowserWindow({
    width: PANEL_WIDTH,
    height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    acceptFirstMouse: true,
    backgroundColor: '#f2f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  panel.on('blur', () => {
    if (quitting || bluetoothDialogOpen) return
    if (panel?.webContents.isDevToolsOpened()) return
    panel?.hide()
  })

  panel.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    panel?.hide()
  })

  attachBluetoothPicker(panel)

  if (isDev) {
    void panel.loadURL(devServerUrl)
  } else {
    void panel.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  if (process.env.DESKTOP_SHOW === '1') {
    panel.webContents.once('did-finish-load', () => showPanel())
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('AnkerLinkAll · 安克万连')
  tray.on('click', () => {
    if (panel?.isVisible()) panel.hide()
    else showPanel()
  })
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '打开控制面板', click: () => showPanel() },
      { type: 'separator' },
      { label: '关于 AnkerLinkAll', click: () => showAbout() },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ])
    tray?.popUpContextMenu(menu)
  })
}

function showPanel() {
  if (!panel) return
  positionPanel()
  panel.show()
  panel.focus()
}

function positionPanel() {
  if (!panel || !tray) return
  const trayBounds = tray.getBounds()
  const panelBounds = panel.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const { workArea } = display

  const x = Math.round(
    Math.min(
      Math.max(trayBounds.x + trayBounds.width / 2 - panelBounds.width / 2, workArea.x + 8),
      workArea.x + workArea.width - panelBounds.width - 8,
    ),
  )
  const y = Math.round(trayBounds.y + trayBounds.height + 6)

  panel.setPosition(x, y, false)
}

function showAbout() {
  void dialog.showMessageBox({
    type: 'info',
    title: '关于 AnkerLinkAll',
    message: 'AnkerLinkAll · 安克万连',
    detail: `菜单栏蓝牙控制面板\n版本 ${app.getVersion()}\nElectron ${process.versions.electron}`,
    buttons: ['好'],
    noLink: true,
  })
}

function attachBluetoothPicker(win) {
  let pendingCallback = null
  let pendingDevices = []
  let pickerReady = false
  let updateTimer = null
  let lastLoggedCount = -1

  const rankName = (name) => {
    if (/anker|soundcore|eufy|nebula|ankermake|a2687|prime/i.test(name)) return 0
    if (/^未知或不支持/.test(name)) return 2
    return 1
  }

  const sortDevices = (deviceList) => {
    const seen = new Set()
    const devices = []
    for (const device of deviceList) {
      if (!device?.deviceId || seen.has(device.deviceId)) continue
      seen.add(device.deviceId)
      devices.push({
        deviceId: device.deviceId,
        name: device.deviceName || `未知设备 (${device.deviceId})`,
      })
    }
    return devices.sort(
      (a, b) => rankName(a.name) - rankName(b.name) || a.name.localeCompare(b.name, 'zh-Hans'),
    )
  }

  const sendDevices = () => {
    if (!pickerReady || !pickerWindow || pickerWindow.isDestroyed()) return
    pickerWindow.webContents.send('bt:devices', pendingDevices)
  }

  const scheduleUpdate = () => {
    if (updateTimer) return
    updateTimer = setTimeout(() => {
      updateTimer = null
      sendDevices()
    }, 250)
  }

  const finish = (deviceId) => {
    if (updateTimer) clearTimeout(updateTimer)
    updateTimer = null
    const callback = pendingCallback
    pendingCallback = null
    pendingDevices = []
    pickerReady = false
    bluetoothDialogOpen = false
    chooseBluetoothDevice = null
    cancelBluetoothPicker = null

    const picker = pickerWindow
    pickerWindow = null
    if (picker && !picker.isDestroyed()) picker.destroy()
    if (callback) callback(deviceId)
  }

  const ensurePicker = () => {
    if (pickerWindow && !pickerWindow.isDestroyed()) return pickerWindow

    pickerReady = false
    pickerWindow = new BrowserWindow({
      width: 430,
      height: 580,
      parent: win,
      modal: true,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: '选择蓝牙设备',
      backgroundColor: '#f2f6fa',
      webPreferences: {
        preload: path.join(__dirname, 'picker-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    pickerWindow.once('ready-to-show', () => {
      pickerWindow?.show()
      pickerWindow?.focus()
    })
    pickerWindow.webContents.on('did-finish-load', () => {
      pickerReady = true
      sendDevices()
    })
    pickerWindow.on('closed', () => {
      pickerWindow = null
      pickerReady = false
      if (pendingCallback) finish('')
    })

    void pickerWindow.loadFile(path.join(__dirname, 'picker.html'))
    return pickerWindow
  }

  chooseBluetoothDevice = (deviceId) => {
    const selected = pendingDevices.find((device) => device.deviceId === deviceId)
    if (!selected) return
    finish(deviceId)
    showPanel()
  }

  cancelBluetoothPicker = () => finish('')

  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault()

    pendingCallback = callback
    pendingDevices = sortDevices(deviceList)
    bluetoothDialogOpen = true

    if (pendingDevices.length !== lastLoggedCount) {
      lastLoggedCount = pendingDevices.length
      console.log(`[bluetooth] 发现 ${pendingDevices.length} 个设备`)
    }

    ensurePicker()
    scheduleUpdate()
  })

  win.on('closed', () => {
    if (pendingCallback) finish('')
  })
}

function registerIpc() {
  ipcMain.on('panel:hide', () => panel?.hide())
  ipcMain.on('bt:select', (_event, deviceId) => {
    if (typeof deviceId === 'string') chooseBluetoothDevice?.(deviceId)
  })
  ipcMain.on('bt:cancel', () => cancelBluetoothPicker?.())
}

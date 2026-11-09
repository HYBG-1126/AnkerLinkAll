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
  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault()

    if (deviceList.length === 0) {
      callback('')
      return
    }
    if (bluetoothDialogOpen) return

    bluetoothDialogOpen = true
    const buttons = deviceList.map(
      (device, index) => `${index + 1}. ${device.deviceName || '未命名设备'}`,
    )

    dialog
      .showMessageBox(win, {
        type: 'question',
        title: '选择蓝牙设备',
        message: '发现附近的蓝牙设备',
        detail: '请选择要连接的设备。列表在扫描期间可能持续更新。',
        buttons: [...buttons, '取消'],
        defaultId: 0,
        cancelId: buttons.length,
        noLink: true,
      })
      .then(({ response }) => {
        bluetoothDialogOpen = false
        const selected = deviceList[response]
        callback(selected ? selected.deviceId : '')
        if (selected) showPanel()
      })
      .catch(() => {
        bluetoothDialogOpen = false
        callback('')
      })
  })
}

function registerIpc() {
  ipcMain.on('panel:hide', () => panel?.hide())
}

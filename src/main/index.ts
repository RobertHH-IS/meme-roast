import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { mintEphemeralKey } from './ephemeral-key.js'
import { registerHotkeys, unregisterHotkeys } from './hotkeys.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '../../.env') })

let mainWindow: BrowserWindow | null = null

const COMPACT = { width: 420, height: 720 }
const MARGIN = 24

function placeWindow(win: BrowserWindow, expanded: boolean): void {
  const { workArea } = screen.getPrimaryDisplay()
  const bounds = expanded
    ? workArea
    : {
        x: workArea.x + workArea.width - COMPACT.width - MARGIN,
        y: workArea.y + MARGIN,
        width: COMPACT.width,
        height: COMPACT.height
      }

  win.setBounds(bounds, true)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: COMPACT.width,
    height: COMPACT.height,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  placeWindow(mainWindow, false)

  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  registerHotkeys(mainWindow)
}

ipcMain.handle('realtime:ephemeral-key', async () => {
  try {
    const key = await mintEphemeralKey()
    return { ok: true as const, ...key }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false as const, error: message }
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:set-click-through', (_, enabled: boolean) => {
  mainWindow?.setIgnoreMouseEvents(enabled, { forward: true })
})

ipcMain.handle('window:set-expanded', (_, expanded: boolean) => {
  if (mainWindow) placeWindow(mainWindow, expanded)
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  unregisterHotkeys()
})

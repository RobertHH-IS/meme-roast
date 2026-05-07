import { BrowserWindow, globalShortcut } from 'electron'

export type HotkeyEvent = 'kill-last' | 'mute-toggle' | 'force-meme'

export function registerHotkeys(win: BrowserWindow): void {
  const send = (event: HotkeyEvent) => () => {
    if (!win.isDestroyed()) win.webContents.send('hotkey', event)
  }

  globalShortcut.register('CommandOrControl+Shift+K', send('kill-last'))
  globalShortcut.register('CommandOrControl+Shift+M', send('mute-toggle'))
  globalShortcut.register('CommandOrControl+Shift+Space', send('force-meme'))
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}

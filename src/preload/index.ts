import { contextBridge, ipcRenderer } from 'electron'

export type EphemeralKeyResult =
  | { ok: true; value: string; expires_at: number; session: { id: string; model: string } }
  | { ok: false; error: string }

export type HotkeyEvent = 'kill-last' | 'mute-toggle' | 'force-meme'

const api = {
  getEphemeralKey: (): Promise<EphemeralKeyResult> =>
    ipcRenderer.invoke('realtime:ephemeral-key'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  setClickThrough: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-click-through', enabled),
  setExpanded: (expanded: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-expanded', expanded),
  onHotkey: (cb: (event: HotkeyEvent) => void): (() => void) => {
    const handler = (_: unknown, event: HotkeyEvent) => cb(event)
    ipcRenderer.on('hotkey', handler)
    return () => ipcRenderer.off('hotkey', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

import { create } from 'zustand'

export type Meme = {
  id: string
  templateId: string
  templateName: string
  captions: string[]
  url: string
  ts: number
}

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'

type Store = {
  memes: Meme[]
  cooldownTemplates: Set<string>
  connection: ConnectionState
  connectionError: string | null
  muted: boolean
  expanded: boolean
  pushMeme: (m: Meme) => void
  killLast: () => void
  setConnection: (s: ConnectionState, error?: string | null) => void
  toggleMute: () => void
  setExpanded: (expanded: boolean) => void
  reset: () => void
}

const MAX_MEMES = 50

export const useStore = create<Store>((set) => ({
  memes: [],
  cooldownTemplates: new Set(),
  connection: 'idle',
  connectionError: null,
  muted: false,
  expanded: false,
  pushMeme: (m) =>
    set((state) => ({
      memes: [m, ...state.memes].slice(0, MAX_MEMES)
    })),
  killLast: () =>
    set((state) => {
      if (state.memes.length === 0) return state
      const [killed, ...rest] = state.memes
      const cooldown = new Set(state.cooldownTemplates)
      cooldown.add(killed.templateId)
      return { memes: rest, cooldownTemplates: cooldown }
    }),
  setConnection: (s, error = null) =>
    set({ connection: s, connectionError: error }),
  toggleMute: () => set((state) => ({ muted: !state.muted })),
  setExpanded: (expanded) => set({ expanded }),
  reset: () =>
    set({
      memes: [],
      cooldownTemplates: new Set(),
      connection: 'idle',
      connectionError: null,
      muted: false
    })
}))

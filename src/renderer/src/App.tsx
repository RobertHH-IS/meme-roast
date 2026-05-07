import { useEffect, useRef, useState } from 'react'
import { StatusBar } from './components/StatusBar'
import { MemeStage } from './components/MemeStage'
import { MemeFeed } from './components/MemeFeed'
import { startRealtime, type RealtimeClient } from './realtime/client'
import { useStore } from './store'

const COOLDOWN_AFTER_MEME_MS = 9_000
const COOLDOWN_AFTER_SCAN_MS = 1_200

function getAvoidTemplateIds(): string[] {
  const { memes, cooldownTemplates } = useStore.getState()
  const ids = new Set(cooldownTemplates)
  const latestTemplateId = memes[0]?.templateId
  if (latestTemplateId) ids.add(latestTemplateId)
  return [...ids]
}

export default function App() {
  const [running, setRunning] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const clientRef = useRef<RealtimeClient | null>(null)
  const lastMemeAtRef = useRef<number>(0)
  const lastScanAtRef = useRef<number>(0)

  const setConnection = useStore((s) => s.setConnection)
  const pushMeme = useStore((s) => s.pushMeme)
  const reset = useStore((s) => s.reset)

  const start = async (): Promise<void> => {
    if (clientRef.current) return
    try {
      const client = await startRealtime({
        onStateChange: (state, error) => setConnection(state, error ?? null),
        onStream: setMicStream,
        onMeme: (meme) => {
          lastMemeAtRef.current = Date.now()
          pushMeme({
            id: crypto.randomUUID(),
            templateId: meme.templateId,
            templateName: meme.templateName,
            captions: meme.captions,
            url: meme.url,
            ts: Date.now()
          })
        },
        onCommit: () => {
          const c = clientRef.current
          if (!c) return
          const { muted } = useStore.getState()
          if (muted) return
          const now = Date.now()
          if (now - lastMemeAtRef.current < COOLDOWN_AFTER_MEME_MS) return
          if (now - lastScanAtRef.current < COOLDOWN_AFTER_SCAN_MS) return
          lastScanAtRef.current = now
          c.triggerScan(getAvoidTemplateIds())
        },
        onLog: (msg) => console.log('[realtime]', msg)
      })
      clientRef.current = client
      setRunning(true)
    } catch (err) {
      console.error(err)
    }
  }

  const stop = (): void => {
    clientRef.current?.stop()
    clientRef.current = null
    setRunning(false)
    reset()
  }

  useEffect(() => {
    const off = window.api.onHotkey((event) => {
      const { killLast: kill, toggleMute: mute } = useStore.getState()
      switch (event) {
        case 'kill-last':
          kill()
          break
        case 'mute-toggle':
          mute()
          break
        case 'force-meme':
          clientRef.current?.forceMeme(getAvoidTemplateIds())
          break
      }
    })
    return () => off()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      clientRef.current?.stop()
    }
  }, [])

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900/85 backdrop-blur-md text-white rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/60">
      <StatusBar onStart={start} onStop={stop} running={running} micStream={micStream} />
      <MemeStage />
      <MemeFeed />
      <div className="px-4 py-2 text-[10px] text-zinc-500 border-t border-white/5 bg-black/30 flex justify-between">
        <span>⌘/Ctrl ⇧ K kill · ⌘/Ctrl ⇧ M mute · ⌘/Ctrl ⇧ Space force</span>
      </div>
    </div>
  )
}

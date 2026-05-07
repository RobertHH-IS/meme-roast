import { useStore } from '../store'
import { MicMeter } from './MicMeter'

type Props = {
  onStart: () => void
  onStop: () => void
  running: boolean
  micStream: MediaStream | null
}

export function StatusBar({ onStart, onStop, running, micStream }: Props) {
  const connection = useStore((s) => s.connection)
  const muted = useStore((s) => s.muted)
  const error = useStore((s) => s.connectionError)
  const expanded = useStore((s) => s.expanded)
  const toggleMute = useStore((s) => s.toggleMute)
  const setExpanded = useStore((s) => s.setExpanded)

  const onToggleExpand = (): void => {
    const next = !expanded
    setExpanded(next)
    void window.api.setExpanded(next)
  }

  const dotClass =
    connection === 'connected'
      ? muted
        ? 'bg-amber-400'
        : 'bg-emerald-400 pulse-dot'
      : connection === 'connecting'
        ? 'bg-sky-400 pulse-dot'
        : connection === 'error'
          ? 'bg-rose-500'
          : 'bg-zinc-500'

  const label =
    connection === 'connected'
      ? muted
        ? 'muted'
        : 'listening'
      : connection === 'connecting'
        ? 'connecting…'
        : connection === 'error'
          ? 'error'
          : 'idle'

  return (
    <div className="drag-region flex items-center justify-between gap-3 px-4 py-3 bg-zinc-950/80 border-b border-white/10 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`size-2.5 rounded-full ${dotClass}`} />
        <span className="text-xs font-medium tracking-wide uppercase text-zinc-300">
          {label}
        </span>
        {error && (
          <span className="text-xs text-rose-300/80 truncate" title={error}>
            {error}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 no-drag">
        {running && <MicMeter stream={micStream} />}
        <button
          onClick={onToggleExpand}
          title={expanded ? 'compact view' : 'expand for show-off'}
          className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition"
        >
          {expanded ? '⤡' : '⤢'}
        </button>
        {running ? (
          <>
            <button
              onClick={toggleMute}
              className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition"
            >
              {muted ? 'unmute' : 'mute'}
            </button>
            <button
              onClick={onStop}
              className="text-xs px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition"
            >
              stop
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            className="text-xs px-3 py-1 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 transition"
          >
            start listening
          </button>
        )}
      </div>
    </div>
  )
}

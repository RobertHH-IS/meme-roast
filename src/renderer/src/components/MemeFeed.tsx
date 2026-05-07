import { useStore } from '../store'

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour12: false })
}

export function MemeFeed() {
  const memes = useStore((s) => s.memes)

  if (memes.length === 0) {
    return null
  }

  return (
    <div className="border-t border-white/10 bg-black/40 px-3 py-2 max-h-[280px] overflow-y-auto">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 px-1">
        feed · {memes.length}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {memes.map((m) => (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="group relative block rounded overflow-hidden ring-1 ring-white/5 hover:ring-white/20 transition"
            title={`${m.templateName} · ${m.captions.join(' / ')}`}
          >
            <img
              src={m.url}
              alt={m.templateName}
              className="w-full h-20 object-cover"
              draggable={false}
            />
            <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[9px] text-white/80 bg-black/60 opacity-0 group-hover:opacity-100 transition">
              {fmtTime(m.ts)}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

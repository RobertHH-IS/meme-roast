import { useStore } from '../store'

export function MemeStage() {
  const latest = useStore((s) => s.memes[0])

  if (!latest) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6 text-zinc-500 text-sm">
        <div>
          <div className="text-zinc-300 text-base font-medium mb-1">
            keep talking
          </div>
          <div>memes will appear here when something is roastable</div>
        </div>
      </div>
    )
  }

  return (
    <div
      key={latest.id}
      className="meme-slam flex-1 flex flex-col items-center justify-center px-4 py-3"
    >
      <img
        src={latest.url}
        alt={latest.templateName}
        className="max-w-full max-h-[260px] rounded-lg shadow-xl shadow-black/40 ring-1 ring-white/10"
        draggable={false}
      />
      <div className="mt-2 text-[11px] text-zinc-400 text-center">
        {latest.templateName}
      </div>
    </div>
  )
}

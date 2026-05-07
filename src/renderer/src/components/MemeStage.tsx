import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Meme } from '../store'

const CROSSFADE_MS = 360

export function MemeStage() {
  const latest = useStore((s) => s.memes[0])
  const [previous, setPrevious] = useState<Meme | null>(null)
  const visibleIdRef = useRef<string | null>(latest?.id ?? null)

  useEffect(() => {
    if (!latest) {
      setPrevious(null)
      visibleIdRef.current = null
      return
    }

    const currentId = visibleIdRef.current
    if (!currentId || currentId === latest.id) {
      visibleIdRef.current = latest.id
    } else {
      const current = useStore.getState().memes.find((m) => m.id === currentId)
      setPrevious(current ?? null)
      visibleIdRef.current = latest.id
    }

    const t = window.setTimeout(() => setPrevious(null), CROSSFADE_MS)
    return () => window.clearTimeout(t)
  }, [latest])

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
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-3">
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        {previous && (
          <StageImage
            meme={previous}
            className="meme-fade-out"
          />
        )}
        <StageImage
          meme={latest}
          className="meme-fade-in"
        />
      </div>
      <div className="mt-2 shrink-0 text-[11px] text-zinc-400 text-center">
        {latest.templateName}
      </div>
    </div>
  )
}

function StageImage({ meme, className }: { meme: Meme; className: string }) {
  return (
    <img
      src={meme.url}
      alt={meme.templateName}
      className={[
        'absolute inset-0 m-auto max-w-full max-h-full object-contain rounded-lg shadow-xl shadow-black/40 ring-1 ring-white/10',
        className
      ].join(' ')}
      draggable={false}
    />
  )
}

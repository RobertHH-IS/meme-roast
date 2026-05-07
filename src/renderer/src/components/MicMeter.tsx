import { useEffect, useRef } from 'react'

type Props = {
  stream: MediaStream | null
}

export function MicMeter({ stream }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const peakRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!stream) {
      if (barRef.current) barRef.current.style.transform = 'scaleX(0)'
      if (peakRef.current) peakRef.current.style.opacity = '0'
      return
    }

    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.7
    src.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    let peak = 0
    let peakDecay = 0

    const tick = (): void => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      const level = Math.min(1, rms * 4)

      if (level > peak) {
        peak = level
        peakDecay = performance.now()
      } else if (performance.now() - peakDecay > 600) {
        peak = Math.max(0, peak - 0.015)
      }

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${level})`
      }
      if (peakRef.current) {
        peakRef.current.style.left = `${peak * 100}%`
        peakRef.current.style.opacity = peak > 0.02 ? '1' : '0'
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      try {
        src.disconnect()
      } catch {
        /* noop */
      }
      void ctx.close()
    }
  }, [stream])

  return (
    <div className="relative h-1.5 w-28 rounded-full bg-white/10 overflow-visible">
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full origin-left bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400"
          style={{ transform: 'scaleX(0)', transition: 'none' }}
        />
      </div>
      <div
        ref={peakRef}
        className="absolute -top-0.5 h-2.5 w-0.5 bg-white/80 rounded-full pointer-events-none"
        style={{ left: '0%', opacity: 0, transform: 'translateX(-50%)' }}
      />
    </div>
  )
}

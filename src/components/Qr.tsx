import { useMemo } from 'react'
import { encode } from 'uqr'

/** A QR code drawn as one SVG path. `label` is read out instead of the picture. */
export function Qr({ text, label, className }: { text: string; label: string; className?: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: 2 })
    let d = ''
    for (let y = 0; y < qr.size; y++) {
      let run = 0
      for (let x = 0; x <= qr.size; x++) {
        if (x < qr.size && qr.data[y][x]) run++
        else if (run) {
          d += `M${x - run} ${y}h${run}v1h-${run}z`
          run = 0
        }
      }
    }
    return { path: d, size: qr.size }
  }, [text])

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#101828" />
    </svg>
  )
}

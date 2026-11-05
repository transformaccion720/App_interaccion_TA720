'use client'

// Nube de palabras sencilla y legible (sin animaciones exageradas).
// `scale` y `dark` permiten usarla en modo presentación (letras grandes sobre
// fondo oscuro) sin duplicar el componente.
import { useMemo } from 'react'

const PALETTE = [
  'text-brand-600',
  'text-viva-600',
  'text-energy-600',
  'text-rose-500',
  'text-violet-600',
  'text-cyan-700',
  'text-orange-600',
  'text-fuchsia-600',
]

// Variantes claras para fondos oscuros (modo presentación)
const PALETTE_DARK = [
  'text-brand-300',
  'text-viva-400',
  'text-energy-400',
  'text-rose-400',
  'text-violet-400',
  'text-cyan-300',
  'text-orange-300',
  'text-fuchsia-400',
]

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function WordCloud({
  words,
  className,
  scale = 1,
  dark = false,
}: {
  words: { word: string; count: number }[]
  className?: string
  scale?: number
  dark?: boolean
}) {
  const palette = dark ? PALETTE_DARK : PALETTE
  const sized = useMemo(() => {
    if (!words.length) return []
    const max = Math.max(...words.map((w) => w.count))
    const min = Math.min(...words.map((w) => w.count))
    const span = Math.max(1, max - min)
    return words.map((w) => {
      const ratio = (w.count - min) / span // 0..1
      const fontSize = Math.min(110, (14 + ratio * 30 + (w.count > 1 ? 4 : 0)) * scale)
      const color = palette[hashCode(w.word) % palette.length]
      const weight = w.count === max ? 700 : ratio > 0.5 ? 600 : 500
      return { ...w, fontSize, color, weight }
    })
  }, [words, scale, palette])

  if (!sized.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aún no hay palabras. Las respuestas aparecerán aquí.
      </p>
    )
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-4 ${className || ''}`}
      aria-label="Nube de palabras con las respuestas más frecuentes"
    >
      {sized.map((w) => (
        <span
          key={w.word}
          className={`${w.color} leading-tight`}
          style={{ fontSize: `${w.fontSize}px`, fontWeight: w.weight }}
          title={`${w.word}: ${w.count} ${w.count === 1 ? 'mención' : 'menciones'}`}
        >
          {w.word}
          {w.count > 1 && (
            <sub className="text-[10px] text-muted-foreground ml-0.5">{w.count}</sub>
          )}
        </span>
      ))}
    </div>
  )
}

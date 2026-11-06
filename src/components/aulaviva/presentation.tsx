'use client'

// Modo presentación de resultados — pantalla completa estilo Mentimeter,
// pensado para proyectar a la audiencia:
//  - Separadores de pregunta: cada pregunta arranca con una diapositiva de
//    apertura para que tome protagonismo (1 × 1 o 2 a la vez).
//  - Palabras clave profesionales y estáticas: en las preguntas de texto libre
//    solo se muestran las palabras principales del grupo, nunca los comentarios
//    largos (sin animaciones).
//  - Gráficos estilo dashboard: barras horizontales con cuadrícula y valores,
//    gráfico de columnas con línea de promedio para la escala 1-5.
//  - Actualización en vivo: hereda el polling del panel (cada 2 s) y añade
//    un botón de refresco manual como refuerzo.
//  - Navegación entre diapositivas (botones ‹ › o flechas del teclado),
//    pantalla completa (tecla F) y cierre (Esc o botón).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AdminLive,
  DecisionTreeResults,
  DiagnosticoConfig,
  DiagPromptResult,
  MultipleChoiceConfig,
  MultipleChoiceResults,
  OpenTextResults,
  QuestionAdmin,
  SemaforoConfig,
  SemaforoResults,
  SemaforoColor,
  WordCloudResults,
} from '@/lib/types'
import { QUESTION_TYPE_LABELS } from '@/lib/types'
import { BrandLogo } from './brand-logo'
import { extractKeywordsFromTexts } from '@/lib/codes'
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize,
  Minimize,
  CheckCircle2,
  Users,
  Radio,
  BarChart3,
  Square,
  Columns2,
} from 'lucide-react'

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

type Slide = { kind: 'divider' | 'results'; gi: number }

export function PresentationOverlay({
  live,
  initialQuestionId,
  onClose,
  onRefresh,
}: {
  live: AdminLive
  initialQuestionId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const questions = live.questions
  const [perView, setPerView] = useState<1 | 2>(1)
  const [slideIndex, setSlideIndex] = useState(() => {
    const qi = questions.findIndex((q) => q.id === initialQuestionId)
    // Aterriza en la diapositiva de resultados de la pregunta elegida
    return qi >= 0 ? qi * 2 + 1 : 0
  })
  const [spinning, setSpinning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Grupos de preguntas según el modo (1 × 1 o 2 a la vez)
  const groups = useMemo(() => {
    const out: QuestionAdmin[][] = []
    for (let i = 0; i < questions.length; i += perView) {
      out.push(questions.slice(i, i + perView))
    }
    return out
  }, [questions, perView])

  // Baraja de diapositivas: separador + resultados por cada grupo
  const slides = useMemo<Slide[]>(
    () => groups.flatMap((_, gi) => [{ kind: 'divider' as const, gi }, { kind: 'results' as const, gi }]),
    [groups]
  )

  // El índice se acota al leerlo: si la baraja se acorta (p. ej. al cambiar
  // entre 1 × 1 y 2 a la vez) nunca se sale del rango sin efectos extra.
  const maxIndex = Math.max(0, slides.length - 1)
  const safeIndex = Math.min(slideIndex, maxIndex)

  const go = useCallback(
    (delta: number) => {
      setSlideIndex(Math.min(maxIndex, Math.max(0, safeIndex + delta)))
    },
    [maxIndex, safeIndex]
  )

  // Cambiar entre 1 × 1 y 2 a la vez sin perder la pregunta visible
  function changePerView(next: 1 | 2) {
    if (next === perView) return
    const cur = slides[safeIndex]
    const anchorId = cur ? groups[cur.gi]?.[0]?.id : undefined
    const newGroups: QuestionAdmin[][] = []
    for (let i = 0; i < questions.length; i += next) {
      newGroups.push(questions.slice(i, i + next))
    }
    const gi = Math.max(0, newGroups.findIndex((g) => g.some((q) => q.id === anchorId)))
    setPerView(next)
    setSlideIndex(gi * 2 + 1)
  }

  const toggleFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen()
      } else {
        void document.documentElement.requestFullscreen()
      }
    } catch {
      /* el iframe puede bloquear pantalla completa: se ignora */
    }
  }, [])

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key.toLowerCase() === 'f') toggleFullscreen()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, go, toggleFullscreen])

  function refreshNow() {
    setSpinning(true)
    onRefresh()
    window.setTimeout(() => setSpinning(false), 700)
  }

  const slide: Slide | undefined = slides[safeIndex]
  const group = slide ? groups[slide.gi] : undefined
  // Número de cada pregunta dentro de la sesión (1-indexado)
  const numbers = group ? group.map((q) => questions.findIndex((x) => x.id === q.id) + 1) : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-carbon-950 text-white overflow-hidden">
      {/* Ambientación de marca */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,102,255,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(0,204,136,0.12),transparent_50%)]"
        aria-hidden
      />

      {/* Barra superior */}
      <header className="relative z-10 h-14 shrink-0 border-b border-white/10 flex items-center gap-3 px-4">
        <BrandLogo className="h-6 w-auto shrink-0" dark />
        <p className="text-sm text-slate-300 truncate hidden sm:block">{live.session.title}</p>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-viva-400 shrink-0">
          <Radio className="h-3.5 w-3.5" /> EN VIVO
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Modo: una pregunta o dos a la vez */}
          <div
            className="hidden sm:flex rounded-lg border border-white/10 overflow-hidden"
            role="group"
            aria-label="Preguntas por pantalla"
          >
            <button
              type="button"
              onClick={() => changePerView(1)}
              aria-pressed={perView === 1}
              title="Una pregunta a la vez"
              className={`px-2.5 py-2 ${perView === 1 ? 'bg-brand-500/25 text-brand-200' : 'text-slate-300 hover:bg-white/10'}`}
            >
              <Square className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => changePerView(2)}
              aria-pressed={perView === 2}
              title="Dos preguntas a la vez"
              className={`px-2.5 py-2 ${perView === 2 ? 'bg-brand-500/25 text-brand-200' : 'text-slate-300 hover:bg-white/10'}`}
            >
              <Columns2 className="h-5 w-5" />
            </button>
          </div>

          {/* Navegación entre diapositivas */}
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={safeIndex === 0}
            aria-label="Anterior"
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm tabular-nums text-slate-300 min-w-16 text-center">
            {slides.length > 0 ? `${safeIndex + 1} / ${slides.length}` : '—'}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={safeIndex >= slides.length - 1}
            aria-label="Siguiente"
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Refresco manual (los datos también llegan en vivo cada 2 s) */}
          <button
            type="button"
            onClick={refreshNow}
            title="Actualizar resultados ahora (también se actualizan en vivo automáticamente)"
            aria-label="Actualizar resultados"
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <RotateCw className={`h-5 w-5 ${spinning ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            title="Pantalla completa (F)"
            className="p-2 rounded-lg hover:bg-white/10"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Salir del modo presentación"
            title="Salir (Esc)"
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="min-h-full max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8 flex flex-col">
          {slide && group ? (
            slide.kind === 'divider' ? (
              <DividerSlide group={group} numbers={numbers} total={questions.length} />
            ) : (
              <ResultsSlide group={group} numbers={numbers} live={live} compact={group.length > 1} />
            )
          ) : (
            <div className="flex-1 grid place-items-center text-slate-400">
              Esta sesión no tiene preguntas.
            </div>
          )}
        </div>
      </main>

      {/* Pie: código para unirse */}
      <footer className="relative z-10 h-12 shrink-0 border-t border-white/10 flex items-center justify-center gap-3 text-sm text-slate-300">
        <span>
          Únete en <span className="font-semibold text-white">/join</span> con el código
        </span>
        <span className="rounded-lg bg-white/10 border border-white/15 px-3 py-1 font-bold tracking-[0.25em] text-white">
          {live.session.joinCode}
        </span>
        <span className="hidden sm:inline text-slate-400">
          · {live.participants.length} participante{live.participants.length === 1 ? '' : 's'}
        </span>
      </footer>
    </div>
  )
}

// ------------------ Separador de pregunta (protagonismo 1 × 1 o 2 a la vez) ------------------

function DividerSlide({ group, numbers, total }: { group: QuestionAdmin[]; numbers: number[]; total: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-10">
      <p className="text-sm md:text-base font-bold uppercase tracking-[0.35em] text-brand-300">
        {numbers.length > 1
          ? `Preguntas ${numbers[0]} y ${numbers[1]} de ${total}`
          : `Pregunta ${numbers[0] || 1} de ${total}`}
      </p>
      <div className="h-1 w-20 rounded-full bg-gradient-to-r from-brand-500 via-viva-500 to-energy-500" aria-hidden />
      {group.map((q) => (
        <div key={q.id} className="space-y-3 max-w-5xl">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-balance">
            {q.title}
          </h1>
          {q.description && (
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">{q.description}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold px-3 py-1">
              {QUESTION_TYPE_LABELS[q.type]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1">
              <Users className="h-3.5 w-3.5" />
              {q.answeredCount} respuesta{q.answeredCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500 mt-2 hidden md:block">Usa las flechas ← → del teclado para avanzar</p>
    </div>
  )
}

// ------------------ Diapositiva de resultados (1 o 2 preguntas) ------------------

function ResultsSlide({
  group,
  numbers,
  live,
  compact,
}: {
  group: QuestionAdmin[]
  numbers: number[]
  live: AdminLive
  compact: boolean
}) {
  if (group.length === 1) {
    const q = group[0]
    const results = live.resultsByQuestion[q.id]
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold px-3 py-1">
            {QUESTION_TYPE_LABELS[q.type]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1">
            <Users className="h-3.5 w-3.5" />
            {q.answeredCount} respuesta{q.answeredCount === 1 ? '' : 's'}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 ml-1">
            Pregunta {numbers[0]} de {live.questions.length}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-balance">
          {q.title}
        </h1>
        {q.description && (
          <p className="mt-3 text-lg text-slate-300 leading-relaxed max-w-3xl">{q.description}</p>
        )}
        {q.imageUrl && (
          <img
            src={q.imageUrl}
            alt="Imagen de apoyo"
            className="mt-4 max-h-56 rounded-xl border border-white/10 object-contain bg-white/95"
          />
        )}

        <div className="flex-1 flex flex-col justify-center py-6 min-h-0">
          {results ? (
            <PresentationResults results={results} config={q.config} compact={false} />
          ) : (
            <EmptyResults />
          )}
        </div>
      </div>
    )
  }

  // Dos preguntas a la vez, en paneles equilibrados
  return (
    <div className="flex-1 grid md:grid-cols-2 gap-4 md:gap-6 min-h-0 py-1">
      {group.map((q, i) => {
        const results = live.resultsByQuestion[q.id]
        return (
          <section
            key={q.id}
            className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 flex flex-col min-h-0 overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-xl md:text-2xl font-bold leading-snug text-balance">{q.title}</h2>
              <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-500 pt-1.5">
                N.º {numbers[i]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-brand-500/15 border border-brand-400/25 text-brand-200 text-[11px] font-semibold px-2.5 py-0.5">
                {QUESTION_TYPE_LABELS[q.type]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11px] font-medium px-2.5 py-0.5">
                <Users className="h-3 w-3" />
                {q.answeredCount}
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-center py-2 min-h-0">
              {results ? (
                <PresentationResults results={results} config={q.config} compact />
              ) : (
                <p className="text-center text-sm text-slate-400 py-8">Sin respuestas todavía.</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function EmptyResults() {
  return (
    <div className="text-center py-16 space-y-3">
      <BarChart3 className="h-14 w-14 mx-auto text-slate-600" />
      <p className="text-xl font-semibold text-slate-300">Sin respuestas todavía</p>
      <p className="text-sm text-slate-400">
        Los resultados aparecerán aquí en tiempo real a medida que los participantes respondan.
      </p>
    </div>
  )
}

// ------------------ Resultados grandes por tipo ------------------

function PresentationResults({
  results,
  config,
  compact,
}: {
  results: NonNullable<AdminLive['resultsByQuestion'][string]>
  config: unknown
  compact: boolean
}) {
  switch (results.type) {
    case 'multiple_choice':
      return <BigMultiple data={results.data} config={config as MultipleChoiceConfig} compact={compact} />
    case 'semaforo':
      return <BigSemaforo data={results.data} config={config as SemaforoConfig} compact={compact} />
    case 'word_cloud':
      return <BigWordCloud data={results.data} compact={compact} />
    case 'decision_tree':
      return <BigDecision data={results.data} compact={compact} />
    case 'open_text':
      return <BigOpenText data={results.data} compact={compact} />
    case 'diagnostico':
      return <BigDiagnostico data={results.data} config={config as DiagnosticoConfig} compact={compact} />
  }
}

// ------------------ Barras horizontales estilo dashboard ------------------

type BarRow = {
  id: string
  label: string
  count: number
  letter?: string
  correct?: boolean
}

function DashboardHBars({ rows, total, compact }: { rows: BarRow[]; total: number; compact?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {rows.map((r) => {
        const p = pct(r.count, total)
        return (
          <div key={r.id} className="flex items-center gap-3">
            {r.letter && (
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-extrabold ${
                  r.correct ? 'bg-viva-500 text-white' : 'bg-white/10 text-slate-200'
                }`}
              >
                {r.letter}
              </span>
            )}
            <span
              className={`shrink-0 font-semibold leading-snug truncate flex items-center gap-1.5 ${
                compact ? 'w-28 md:w-44 text-sm md:text-base' : 'w-40 md:w-72 text-base md:text-lg'
              }`}
              title={r.label}
            >
              <span className="truncate">{r.label}</span>
              {r.correct && <CheckCircle2 className="h-5 w-5 shrink-0 text-viva-400" aria-label="Correcta" />}
            </span>
            <div
              className="relative flex-1 h-8 md:h-9 rounded-lg bg-white/[0.04] overflow-hidden"
              style={{
                // cuadrícula vertical sutil cada 25 % (estilo dashboard)
                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '25% 100%',
              }}
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-r-lg ${
                  r.correct ? 'bg-gradient-to-r from-viva-600 to-viva-400' : 'bg-gradient-to-r from-brand-600 to-brand-400'
                }`}
                style={{ width: `${Math.max(r.count > 0 ? 3 : 0, (r.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-16 md:w-20 shrink-0 text-right leading-none">
              <span className="text-xl md:text-2xl font-extrabold tabular-nums">
                {p}
                <span className="text-sm text-slate-400 font-bold">%</span>
              </span>
              <span className="block mt-0.5 text-[11px] md:text-xs text-slate-400 tabular-nums">
                {r.count} {r.count === 1 ? 'voto' : 'votos'}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BigMultiple({
  data,
  config,
  compact,
}: {
  data: MultipleChoiceResults
  config: MultipleChoiceConfig
  compact: boolean
}) {
  const options = config?.options || []
  const rows: BarRow[] = options.map((opt, i) => ({
    id: opt.id,
    label: opt.text,
    count: data.counts[opt.id] || 0,
    letter: String.fromCharCode(65 + i),
    correct: !!opt.correct,
  }))
  return <DashboardHBars rows={rows} total={data.total} compact={compact} />
}

// ------------------ Semáforo: tarjetas dashboard (single y multi) ------------------

type SemaforoColorMeta = {
  color: SemaforoColor
  label: string
  dot: string
  text: string
  grad: string
  card: string
  chip: string
}

// Metadatos visuales de los 3 colores del semáforo (etiquetas personalizables)
function semaforoColorMeta(labels: Partial<Record<SemaforoColor, string>>): SemaforoColorMeta[] {
  return [
    {
      color: 'green',
      label: labels.green || 'Verde',
      dot: 'bg-viva-400',
      text: 'text-viva-300',
      grad: 'from-viva-500 to-viva-400',
      card: 'border-viva-400/30 bg-gradient-to-b from-viva-500/[0.14] to-viva-500/[0.03]',
      chip: 'border-viva-400/40 bg-viva-500/20 text-viva-300',
    },
    {
      color: 'yellow',
      label: labels.yellow || 'Amarillo',
      dot: 'bg-energy-400',
      text: 'text-energy-300',
      grad: 'from-energy-500 to-energy-400',
      card: 'border-energy-400/30 bg-gradient-to-b from-energy-500/[0.14] to-energy-500/[0.03]',
      chip: 'border-energy-400/40 bg-energy-500/20 text-energy-300',
    },
    {
      color: 'red',
      label: labels.red || 'Rojo',
      dot: 'bg-red-400',
      text: 'text-red-300',
      grad: 'from-red-500 to-red-400',
      card: 'border-red-400/30 bg-gradient-to-b from-red-500/[0.14] to-red-500/[0.03]',
      chip: 'border-red-400/40 bg-red-500/20 text-red-300',
    },
  ]
}

// Tarjeta dashboard de un color: etiqueta, porcentaje grande, votos y barra.
// Las 3 tarjetas se ven a la vez, en línea, para cada pregunta del semáforo.
function SemaforoCard({
  meta,
  count,
  total,
  isLeader,
  big,
}: {
  meta: SemaforoColorMeta
  count: number
  total: number
  isLeader: boolean
  big?: boolean // modo single: tarjetas grandes a pantalla completa
}) {
  const p = pct(count, total)
  return (
    <div
      className={`relative rounded-xl border p-3 md:p-4 ${meta.card} ${
        isLeader ? 'ring-1 ring-inset ring-white/30' : ''
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
        <span
          className={`min-w-0 flex-1 truncate font-semibold uppercase tracking-wide text-slate-300 ${
            big ? 'text-xs md:text-sm' : 'text-[11px] md:text-xs'
          }`}
        >
          {meta.label}
        </span>
        {isLeader && (
          <span
            className={`shrink-0 rounded-full border px-1.5 py-px font-bold uppercase tracking-widest text-[9px] md:text-[10px] ${meta.chip}`}
          >
            Líder
          </span>
        )}
      </div>
      <p
        className={`mt-2 font-extrabold leading-none tabular-nums ${meta.text} ${
          big ? 'text-4xl md:text-6xl' : 'text-2xl md:text-3xl'
        }`}
      >
        {p}
        <span className={`font-bold text-slate-400 ${big ? 'text-lg md:text-2xl' : 'text-sm md:text-base'}`}>
          %
        </span>
      </p>
      <p className={`mt-1.5 text-slate-400 tabular-nums ${big ? 'text-xs md:text-sm' : 'text-[11px] md:text-xs'}`}>
        {count} {count === 1 ? 'voto' : 'votos'}
      </p>
      <div className={`mt-2.5 overflow-hidden rounded-full bg-white/10 ${big ? 'h-2 md:h-2.5' : 'h-1.5'}`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${meta.grad}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

function BigSemaforo({ data, config, compact }: { data: SemaforoResults; config: SemaforoConfig; compact: boolean }) {
  // Modo 'single': una pregunta → las 3 tarjetas dashboard grandes, a la vez
  if (data.mode === 'single') {
    const counts = data.counts || { green: 0, yellow: 0, red: 0 }
    const meta = semaforoColorMeta(config?.labels || {})
    const per = meta.map((m) => ({ meta: m, n: counts[m.color] || 0 }))
    const vTotal = data.total
    const lead = vTotal > 0 ? Math.max(...per.map((x) => x.n)) : 0
    const leader = vTotal > 0 ? [...per].sort((a, b) => b.n - a.n)[0] : null
    return (
      <div className="space-y-6 md:space-y-8">
        {leader && leader.n > 0 && (
          <div className="flex items-center justify-center">
            <span
              className={`inline-flex items-center gap-2.5 rounded-full border px-5 py-2 text-xl md:text-2xl font-extrabold ${leader.meta.chip}`}
            >
              <span className={`h-3.5 w-3.5 rounded-full ${leader.meta.dot}`} aria-hidden />
              {leader.meta.label} · {pct(leader.n, vTotal)}%
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {per.map(({ meta: m, n }) => (
            <SemaforoCard key={m.color} meta={m} count={n} total={vTotal} isLeader={lead > 0 && n === lead} big />
          ))}
        </div>
        {vTotal > 0 && (
          <p className="text-center text-sm text-slate-400">
            {vTotal} {vTotal === 1 ? 'participante respondió' : 'participantes respondieron'}
          </p>
        )}
      </div>
    )
  }

  // Modo 'multi': N preguntas → por pregunta, las 3 tarjetas dashboard en línea
  if (data.mode === 'multi') {
    const meta = semaforoColorMeta(config?.labels || {})
    const cfgItems = config?.items || []
    const totalVotes = data.items.reduce(
      (s, it) => s + (it.green || 0) + (it.yellow || 0) + (it.red || 0), 0
    )
    const totals = data.items.reduce(
      (acc, it) => ({
        green: acc.green + (it.green || 0),
        yellow: acc.yellow + (it.yellow || 0),
        red: acc.red + (it.red || 0),
      }),
      { green: 0, yellow: 0, red: 0 }
    )
    return (
      <div className="space-y-5 md:space-y-6">
        {/* Resumen general: totales por color en las N preguntas */}
        {totalVotes > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {meta.map((m) => (
              <span
                key={m.color}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm md:text-base font-bold ${m.chip}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} aria-hidden />
                {m.label} · {pct(totals[m.color], totalVotes)}%
              </span>
            ))}
          </div>
        )}

        {/* Por pregunta: las 3 tarjetas del dashboard a la vez, en línea */}
        <div className="space-y-4 md:space-y-5">
          {cfgItems.map((item, idx) => {
            const r = data.items.find((i) => i.itemId === item.id)
            const per = [
              { meta: meta[0], n: r?.green || 0 },
              { meta: meta[1], n: r?.yellow || 0 },
              { meta: meta[2], n: r?.red || 0 },
            ]
            const vTotal = per.reduce((s, x) => s + x.n, 0)
            const lead = vTotal > 0 ? Math.max(...per.map((x) => x.n)) : 0
            return (
              <section
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
              >
                <div className="mb-3 flex items-baseline justify-between gap-4 md:mb-4">
                  <p className={`font-semibold leading-snug ${compact ? 'text-base md:text-lg' : 'text-lg md:text-2xl'}`}>
                    <span className="mr-2 tabular-nums text-slate-500">{idx + 1}.</span>
                    {item.text}
                  </p>
                  {vTotal > 0 && (
                    <span className="shrink-0 text-xs text-slate-400 tabular-nums md:text-sm">
                      {vTotal} {vTotal === 1 ? 'voto' : 'votos'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5 md:gap-4">
                  {per.map(({ meta: m, n }) => (
                    <SemaforoCard key={m.color} meta={m} count={n} total={vTotal} isLeader={lead > 0 && n === lead} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {data.total > 0 && (
          <p className="text-center text-sm text-slate-400">
            {data.total} {data.total === 1 ? 'participante respondió' : 'participantes respondieron'} · {cfgItems.length}{' '}
            {cfgItems.length === 1 ? 'pregunta' : 'preguntas'}
          </p>
        )}
      </div>
    )
  }

  // Modo 'items' (legacy)
  const items = config?.items || []
  return (
    <div className={compact ? 'space-y-4' : 'space-y-7'}>
      {items.map((item) => {
        const r = data.items.find((i) => i.itemId === item.id)
        const total = r ? r.valid + r.partial + r.invalid : 0
        const overall =
          r?.overall === 'valid' ? { label: 'Válida', cls: 'bg-viva-500/20 border-viva-400/40 text-viva-300' }
          : r?.overall === 'partial' ? { label: 'Parcial', cls: 'bg-energy-500/20 border-energy-400/40 text-energy-300' }
          : r?.overall === 'invalid' ? { label: 'No válida', cls: 'bg-red-500/20 border-red-400/40 text-red-300' }
          : { label: 'Sin votos', cls: 'bg-white/5 border-white/10 text-slate-400' }
        return (
          <div key={item.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className={`font-semibold leading-snug ${compact ? 'text-base md:text-lg' : 'text-xl md:text-2xl'}`}>
                {item.text}
              </p>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-bold ${overall.cls}`}>
                {overall.label}
              </span>
            </div>
            <div className="flex h-8 md:h-9 rounded-xl overflow-hidden bg-white/5">
              {total > 0 && (
                <>
                  <div
                    className="bg-gradient-to-b from-viva-500 to-viva-600 flex items-center justify-center"
                    style={{ width: `${(r!.valid / total) * 100}%` }}
                  >
                    {r!.valid / total > 0.12 && <span className="text-base font-extrabold text-white">{r!.valid}</span>}
                  </div>
                  <div
                    className="bg-gradient-to-b from-energy-400 to-energy-600 flex items-center justify-center"
                    style={{ width: `${(r!.partial / total) * 100}%` }}
                  >
                    {r!.partial / total > 0.12 && <span className="text-base font-extrabold text-white">{r!.partial}</span>}
                  </div>
                  <div
                    className="bg-gradient-to-b from-red-400 to-red-600 flex items-center justify-center"
                    style={{ width: `${(r!.invalid / total) * 100}%` }}
                  >
                    {r!.invalid / total > 0.12 && <span className="text-base font-extrabold text-white">{r!.invalid}</span>}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-300">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-viva-500" /> Válidas: {r?.valid || 0}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-energy-500" /> Parciales: {r?.partial || 0}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> No válidas: {r?.invalid || 0}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ------------------ Panel de palabras clave (profesional y estático) ------------------

// Muestra solo las palabras principales del grupo, con tamaño según frecuencia.
// Sin animaciones y con la paleta de marca: pensado para proyección.
function KeywordBoard({
  words,
  total,
  compact,
}: {
  words: { word: string; count: number }[]
  total: number
  compact?: boolean
}) {
  if (!words.length) {
    return <p className="text-slate-400 text-center py-10">Aún no hay palabras para destacar.</p>
  }
  const max = Math.max(...words.map((w) => w.count))
  const list = compact ? words.slice(0, 14) : words.slice(0, 22)
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
        <span className="h-px w-10 bg-white/15" aria-hidden />
        Palabras clave del grupo
        <span className="h-px w-10 bg-white/15" aria-hidden />
      </div>
      <div
        className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-3 px-2"
        aria-label="Palabras principales mencionadas por los participantes"
      >
        {list.map((w, i) => {
          const ratio = w.count / max
          const isTop = i === 0
          const fontSize = isTop
            ? `clamp(${compact ? 34 : 44}px, ${compact ? 5.5 : 7.5}vw, ${compact ? 64 : 96}px)`
            : `${Math.max(compact ? 15 : 18, Math.round((compact ? 15 : 18) + (compact ? 26 : 40) * Math.pow(ratio, 0.8)))}px`
          const color =
            isTop ? 'text-brand-300' : i === 1 ? 'text-viva-300' : i === 2 ? 'text-energy-300' : 'text-slate-100'
          const opacity = i < 3 ? 1 : Math.max(0.55, 1 - i * 0.03)
          const weight = isTop ? 800 : i < 3 ? 700 : ratio > 0.4 ? 600 : 500
          return (
            <span
              key={w.word}
              className={`${color} leading-none inline-flex items-baseline gap-1.5`}
              style={{ fontSize, fontWeight: weight, opacity }}
              title={`${w.count} ${w.count === 1 ? 'mención' : 'menciones'}`}
            >
              <span>{w.word}</span>
              {w.count > 1 && (
                <span className="rounded-full bg-white/10 text-slate-300 px-1.5 py-0.5 tabular-nums text-[0.38em] font-bold">
                  {w.count}
                </span>
              )}
            </span>
          )
        })}
      </div>
      {total > 0 && (
        <p className="text-center text-sm text-slate-400">
          {total} respuesta{total === 1 ? '' : 's'} · solo se muestran las palabras principales
        </p>
      )}
    </div>
  )
}

function BigWordCloud({ data, compact }: { data: WordCloudResults; compact: boolean }) {
  return <KeywordBoard words={data.words} total={data.total} compact={compact} />
}

function BigDecision({ data, compact }: { data: DecisionTreeResults; compact: boolean }) {
  const rows: BarRow[] = data.leaves.map((l) => ({
    id: l.optionId,
    label: l.label,
    count: l.count,
  }))
  return (
    <div className="space-y-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Conclusiones alcanzadas</p>
      <DashboardHBars rows={rows} total={data.total} compact={compact} />
    </div>
  )
}

// Texto abierto: solo palabras clave, sin comentarios largos en pantalla
function BigOpenText({ data, compact }: { data: OpenTextResults; compact: boolean }) {
  if (!data.items.length) {
    return <p className="text-slate-400 text-center py-10">Aún no hay respuestas.</p>
  }
  const words = extractKeywordsFromTexts(data.items.map((i) => i.text), 24)
  if (!words.length) {
    return (
      <p className="text-slate-400 text-center py-10">
        {data.total} respuesta{data.total === 1 ? '' : 's'} recibida{data.total === 1 ? '' : 's'}.
      </p>
    )
  }
  return <KeywordBoard words={words} total={data.total} compact={compact} />
}

// ------------------ Diagnóstico situacional en grande ------------------

function BigDiagnostico({
  data,
  config,
  compact,
}: {
  data: { total: number; prompts: DiagPromptResult[] }
  config: DiagnosticoConfig
  compact: boolean
}) {
  const prompts = config?.prompts || []
  return (
    <div className={compact ? 'space-y-4' : 'space-y-7'}>
      <p className="text-sm text-slate-400">
        {data.total} participante{data.total === 1 ? '' : 's'} respondieron el diagnóstico
      </p>
      {prompts.map((prompt, i) => {
        const r = data.prompts.find((p) => p.promptId === prompt.id)
        if (!r) return null
        return (
          <section key={prompt.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className={`font-bold leading-snug ${compact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
                <span className="text-slate-500 mr-2">{i + 1}.</span>
                {prompt.label}
              </h2>
              <span className="shrink-0 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                {r.kind === 'text' ? 'Palabras clave' : r.kind === 'choice' ? 'Opciones' : 'Escala 1-5'}
              </span>
            </div>
            {r.kind === 'choice' && <BigChoiceCounts counts={r.counts} total={r.total} compact={compact} />}
            {r.kind === 'scale' && (
              <BigScale result={r} compact={compact} minLabel={prompt.minLabel} maxLabel={prompt.maxLabel} />
            )}
            {r.kind === 'text' && <BigDiagText result={r} compact={compact} />}
          </section>
        )
      })}
    </div>
  )
}

function BigChoiceCounts({
  counts,
  total,
  compact,
}: {
  counts: Record<string, number>
  total: number
  compact: boolean
}) {
  const rows: BarRow[] = Object.entries(counts).map(([label, count]) => ({ id: label, label, count }))
  return <DashboardHBars rows={rows} total={total} compact={compact} />
}

// Gráfico de columnas estilo dashboard para la escala 1-5, con cuadrícula,
// valores sobre cada columna y línea de promedio.
function BigScale({
  result,
  compact,
  minLabel,
  maxLabel,
}: {
  result: Extract<DiagPromptResult, { kind: 'scale' }>
  compact: boolean
  minLabel?: string
  maxLabel?: string
}) {
  const counts = [1, 2, 3, 4, 5].map((n) => result.counts[String(n)] || 0)
  const max = Math.max(1, ...counts)
  const chartH = compact ? 'h-40' : 'h-52 md:h-64'
  const barColors = [
    'from-red-600 to-red-400',
    'from-orange-600 to-orange-400',
    'from-energy-600 to-energy-400',
    'from-brand-600 to-brand-400',
    'from-viva-600 to-viva-400',
  ]
  return (
    <div className="flex flex-wrap items-stretch gap-4 md:gap-6">
      <div className="flex-1 min-w-64 rounded-2xl bg-white/[0.03] border border-white/10 p-4 md:p-6">
        <div className={`relative ${chartH}`}>
          {/* Cuadrícula horizontal */}
          {[25, 50, 75].map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ bottom: `${t}%` }} />
          ))}
          {/* Línea de promedio */}
          {result.total > 0 && (
            <div className="absolute inset-x-0 z-10" style={{ bottom: `${(result.average / 5) * 100}%` }}>
              <div className="relative border-t-2 border-dashed border-energy-400/80">
                <span className="absolute -top-2.5 right-0 text-[10px] font-bold uppercase tracking-wider text-energy-300 bg-carbon-950/85 px-1.5 rounded">
                  Promedio {result.average.toFixed(1)}
                </span>
              </div>
            </div>
          )}
          {/* Columnas */}
          <div className="absolute inset-0 grid grid-cols-5 gap-2 md:gap-4">
            {[1, 2, 3, 4, 5].map((n, idx) => (
              <div key={n} className="relative h-full">
                <div className="absolute inset-x-0 top-0 h-8 flex items-end justify-center">
                  <span className="text-lg md:text-2xl font-extrabold tabular-nums text-slate-100">
                    {counts[idx]}
                  </span>
                </div>
                <div className="absolute inset-x-1 bottom-0 top-9">
                  <div
                    className={`absolute bottom-0 inset-x-0 rounded-t-md bg-gradient-to-b ${barColors[idx]}`}
                    style={{
                      height: counts[idx] > 0 ? `${Math.max(6, (counts[idx] / max) * 100)}%` : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Eje X */}
        <div className="mt-2 grid grid-cols-5 gap-2 md:gap-4 border-t border-white/10 pt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="text-center text-base md:text-lg font-extrabold text-slate-300">
              {n}
            </span>
          ))}
        </div>
        {(minLabel || maxLabel) && (
          <div className="mt-1 flex justify-between text-xs text-slate-500 gap-4">
            <span className="truncate">{minLabel}</span>
            <span className="truncate text-right">{maxLabel}</span>
          </div>
        )}
      </div>

      {/* KPI de promedio */}
      <div className="flex flex-col justify-center items-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-viva-500/10 border border-white/10 px-6 md:px-8 py-5 text-center min-w-44">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Promedio del grupo</p>
        <p className={`mt-1 font-extrabold tabular-nums text-white leading-none ${compact ? 'text-5xl' : 'text-6xl md:text-7xl'}`}>
          {result.average.toFixed(1)}
          <span className="text-2xl text-slate-400 font-bold"> / 5</span>
        </p>
        <div className="mt-3 h-2 w-36 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-viva-400"
            style={{ width: `${(result.average / 5) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {result.total} respuesta{result.total === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

// Texto del diagnóstico: solo palabras clave del grupo, nunca los comentarios
function BigDiagText({
  result,
  compact,
}: {
  result: Extract<DiagPromptResult, { kind: 'text' }>
  compact: boolean
}) {
  if (!result.keywords.length) {
    return (
      <p className="text-slate-400 text-sm">
        Aún no hay suficientes respuestas para extraer palabras clave ({result.total} respuesta
        {result.total === 1 ? '' : 's'}).
      </p>
    )
  }
  return <KeywordBoard words={result.keywords} total={result.total} compact={compact} />
}

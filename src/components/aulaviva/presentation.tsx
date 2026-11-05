'use client'

// Modo presentación de resultados — pantalla completa estilo Mentimeter,
// pensado para proyectar a la audiencia:
//  - Fondo oscuro corporativo con tipografía y barras grandes.
//  - Actualización en vivo: hereda el polling del panel (cada 2 s) y añade
//    un botón de refresco manual como refuerzo.
//  - Navegación entre preguntas (botones ‹ › o flechas del teclado),
//    pantalla completa (tecla F) y cierre (Esc o botón).
import { useCallback, useEffect, useState } from 'react'
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
  WordCloudResults,
} from '@/lib/types'
import { QUESTION_TYPE_LABELS } from '@/lib/types'
import { BrandLogo } from './brand-logo'
import { WordCloud } from './word-cloud'
import { relativeTime } from '@/lib/codes'
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
} from 'lucide-react'

const BAR_COLORS = [
  'bg-brand-500',
  'bg-viva-500',
  'bg-energy-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-brand-300',
  'bg-slate-500',
]

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

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
  const [index, setIndex] = useState(() => {
    const i = questions.findIndex((q) => q.id === initialQuestionId)
    return i >= 0 ? i : 0
  })
  const [spinning, setSpinning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Mantener el índice dentro del rango si cambia la lista de preguntas
  useEffect(() => {
    if (index > questions.length - 1) setIndex(Math.max(0, questions.length - 1))
  }, [questions.length, index])

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(questions.length - 1, Math.max(0, i + delta)))
    },
    [questions.length]
  )

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
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key.toLowerCase() === 'f') toggleFullscreen()
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

  const q: QuestionAdmin | undefined = questions[index]
  const results = q ? live.resultsByQuestion[q.id] : undefined

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
          {/* Navegación entre preguntas */}
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Pregunta anterior"
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm tabular-nums text-slate-300 min-w-20 text-center">
            {questions.length > 0 ? `${index + 1} / ${questions.length}` : '—'}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index >= questions.length - 1}
            aria-label="Pregunta siguiente"
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
        <div className="min-h-full max-w-5xl mx-auto px-6 py-8 md:py-10 flex flex-col">
          {q ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold px-3 py-1">
                  {QUESTION_TYPE_LABELS[q.type]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1">
                  <Users className="h-3.5 w-3.5" />
                  {q.answeredCount} respuesta{q.answeredCount === 1 ? '' : 's'}
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

              <div className="flex-1 flex flex-col justify-center py-8">
                {results ? (
                  <PresentationResults results={results} config={q.config} />
                ) : (
                  <div className="text-center py-16 space-y-3">
                    <BarChart3 className="h-14 w-14 mx-auto text-slate-600" />
                    <p className="text-xl font-semibold text-slate-300">Sin respuestas todavía</p>
                    <p className="text-sm text-slate-400">
                      Los resultados aparecerán aquí en tiempo real a medida que los participantes respondan.
                    </p>
                  </div>
                )}
              </div>
            </>
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

// ------------------ Resultados grandes por tipo ------------------

function PresentationResults({
  results,
  config,
}: {
  results: NonNullable<AdminLive['resultsByQuestion'][string]>
  config: unknown
}) {
  switch (results.type) {
    case 'multiple_choice':
      return <BigMultiple data={results.data} config={config as MultipleChoiceConfig} />
    case 'semaforo':
      return <BigSemaforo data={results.data} config={config as SemaforoConfig} />
    case 'word_cloud':
      return <BigWordCloud data={results.data} />
    case 'decision_tree':
      return <BigDecision data={results.data} />
    case 'open_text':
      return <BigOpenText data={results.data} />
    case 'diagnostico':
      return <BigDiagnostico data={results.data} config={config as DiagnosticoConfig} />
  }
}

function BigMultiple({
  data,
  config,
}: {
  data: MultipleChoiceResults
  config: MultipleChoiceConfig
}) {
  const options = config?.options || []
  const max = Math.max(1, ...options.map((o) => data.counts[o.id] || 0))
  return (
    <div className="space-y-5">
      {options.map((opt, i) => {
        const count = data.counts[opt.id] || 0
        const p = pct(count, data.total)
        const isCorrect = !!opt.correct
        return (
          <div key={opt.id} className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${
                  isCorrect ? 'bg-viva-500 text-white' : 'bg-white/10 text-white'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 text-xl md:text-2xl font-semibold leading-snug flex items-center gap-2 min-w-0">
                <span className="truncate">{opt.text}</span>
                {isCorrect && <CheckCircle2 className="h-6 w-6 shrink-0 text-viva-400" aria-label="Correcta" />}
              </span>
              <span className="text-2xl md:text-3xl font-extrabold tabular-nums shrink-0">
                {p}
                <span className="text-base md:text-lg text-slate-400 font-bold">%</span>
              </span>
              <span className="text-lg text-slate-400 tabular-nums w-12 text-right shrink-0">{count}</span>
            </div>
            <div className="h-9 md:h-10 rounded-xl bg-white/5 overflow-hidden ml-14">
              <div
                className={`h-full rounded-xl transition-all duration-700 ${isCorrect ? 'bg-viva-500' : BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${Math.max(count > 0 ? 6 : 0, (count / max) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BigSemaforo({ data, config }: { data: SemaforoResults; config: SemaforoConfig }) {
  const items = config?.items || []
  return (
    <div className="space-y-7">
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
              <p className="text-xl md:text-2xl font-semibold leading-snug">{item.text}</p>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-bold ${overall.cls}`}>
                {overall.label}
              </span>
            </div>
            <div className="flex h-9 md:h-10 rounded-xl overflow-hidden bg-white/5">
              {total > 0 && (
                <>
                  <div
                    className="bg-viva-500 transition-all duration-700 flex items-center justify-center"
                    style={{ width: `${(r!.valid / total) * 100}%` }}
                  >
                    {r!.valid / total > 0.12 && <span className="text-base font-extrabold text-white">{r!.valid}</span>}
                  </div>
                  <div
                    className="bg-energy-500 transition-all duration-700 flex items-center justify-center"
                    style={{ width: `${(r!.partial / total) * 100}%` }}
                  >
                    {r!.partial / total > 0.12 && <span className="text-base font-extrabold text-white">{r!.partial}</span>}
                  </div>
                  <div
                    className="bg-red-500 transition-all duration-700 flex items-center justify-center"
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

function BigWordCloud({ data }: { data: WordCloudResults }) {
  return (
    <div className="space-y-4">
      <WordCloud words={data.words} scale={2.4} dark />
      <p className="text-center text-slate-400">
        {data.total} participante{data.total === 1 ? '' : 's'} ·{' '}
        {data.words.reduce((s, w) => s + w.count, 0)} palabras
      </p>
    </div>
  )
}

function BigDecision({ data }: { data: DecisionTreeResults }) {
  const max = Math.max(1, ...data.leaves.map((l) => l.count))
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Conclusiones alcanzadas</h2>
        {data.leaves.map((leaf, i) => (
          <div key={leaf.optionId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xl md:text-2xl font-semibold truncate">{leaf.label}</span>
              <span className="shrink-0 text-2xl md:text-3xl font-extrabold tabular-nums">
                {pct(leaf.count, data.total)}
                <span className="text-base md:text-lg text-slate-400 font-bold">%</span>
              </span>
            </div>
            <div className="h-9 md:h-10 rounded-xl bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-xl transition-all duration-700 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${Math.max(leaf.count > 0 ? 6 : 0, (leaf.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.comments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Comentarios de los participantes
          </h2>
          <div className="grid md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {data.comments.map((c, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold">{c.participant}</span>
                  <span className="text-xs text-slate-400">{relativeTime(c.at)}</span>
                </div>
                <p className="text-xs text-slate-400 mb-1.5">{c.pathText}</p>
                <p className="leading-snug text-slate-100">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-slate-400">
        {data.total} recorrido{data.total === 1 ? '' : 's'} completado{data.total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function BigOpenText({ data }: { data: OpenTextResults }) {
  if (!data.items.length) {
    return <p className="text-slate-400 text-center py-10">Aún no hay respuestas.</p>
  }
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
        {data.items.map((item, i) => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold">{item.participant}</span>
              <span className="text-xs text-slate-400">{relativeTime(item.at)}</span>
            </div>
            <p className="text-lg leading-snug text-slate-100 break-words">{item.text}</p>
          </div>
        ))}
      </div>
      <p className="text-slate-400">{data.total} respuesta{data.total === 1 ? '' : 's'}</p>
    </div>
  )
}

// ------------------ Diagnóstico situacional en grande ------------------

function BigDiagnostico({ data, config }: { data: { total: number; prompts: DiagPromptResult[] }; config: DiagnosticoConfig }) {
  const prompts = config?.prompts || []
  return (
    <div className="space-y-7">
      <p className="text-sm text-slate-400">
        {data.total} participante{data.total === 1 ? '' : 's'} respondieron el diagnóstico
      </p>
      {prompts.map((prompt, i) => {
        const r = data.prompts.find((p) => p.promptId === prompt.id)
        if (!r) return null
        return (
          <section key={prompt.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl md:text-2xl font-bold leading-snug">
                <span className="text-slate-500 mr-2">{i + 1}.</span>
                {prompt.label}
              </h2>
              <span className="shrink-0 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                {r.kind === 'text' ? 'Texto libre' : r.kind === 'choice' ? 'Opciones' : 'Escala 1-5'}
              </span>
            </div>
            {r.kind === 'choice' && <BigChoiceCounts counts={r.counts} total={r.total} />}
            {r.kind === 'scale' && <BigScale result={r} />}
            {r.kind === 'text' && <BigDiagText result={r} />}
          </section>
        )
      })}
    </div>
  )
}

function BigChoiceCounts({ counts, total }: { counts: Record<string, number>; total: number }) {
  const entries = Object.entries(counts)
  const max = Math.max(1, ...entries.map(([, n]) => n))
  return (
    <div className="space-y-3.5">
      {entries.map(([label, count], i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg md:text-xl font-semibold">{label}</span>
            <span className="text-xl md:text-2xl font-extrabold tabular-nums shrink-0">
              {pct(count, total)}
              <span className="text-sm text-slate-400 font-bold">%</span>
              <span className="ml-2 text-base text-slate-400 font-semibold">{count}</span>
            </span>
          </div>
          <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all duration-700 ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${Math.max(count > 0 ? 6 : 0, (count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function BigScale({ result }: { result: Extract<DiagPromptResult, { kind: 'scale' }> }) {
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => result.counts[String(n)] || 0))
  return (
    <div className="flex flex-wrap items-end gap-8">
      <div className="flex items-end gap-3" aria-label="Distribución de la escala">
        {[1, 2, 3, 4, 5].map((n) => {
          const count = result.counts[String(n)] || 0
          return (
            <div key={n} className="flex w-14 md:w-16 flex-col items-center gap-1.5">
              <span className="text-lg font-bold tabular-nums text-slate-200">{count}</span>
              <div className="flex h-32 md:h-40 w-full items-end rounded-xl bg-white/5 overflow-hidden">
                <div
                  className={`w-full rounded-xl transition-all duration-700 ${
                    n >= 4 ? 'bg-viva-500' : n === 3 ? 'bg-energy-500' : 'bg-red-500'
                  }`}
                  style={{ height: `${Math.max(count > 0 ? 8 : 0, (count / max) * 100)}%` }}
                />
              </div>
              <span className="text-base font-extrabold text-slate-400">{n}</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 px-8 py-5 text-center">
        <p className="text-sm text-slate-400">Promedio del grupo</p>
        <p className="text-6xl font-extrabold text-brand-300 tabular-nums leading-tight">
          {result.average.toFixed(1)}
          <span className="text-2xl text-slate-400"> / 5</span>
        </p>
      </div>
    </div>
  )
}

function BigDiagText({ result }: { result: Extract<DiagPromptResult, { kind: 'text' }> }) {
  return (
    <div className="space-y-4">
      {result.keywords.length >= 3 && result.items.length >= 3 && (
        <div className="flex flex-wrap gap-2.5">
          {result.keywords.slice(0, 14).map((k) => (
            <span
              key={k.word}
              className="rounded-full bg-brand-500/15 border border-brand-400/30 text-brand-200 px-4 py-1.5"
              style={{
                fontSize: `${Math.min(1, k.count / Math.max(1, result.keywords[0].count)) * 12 + 16}px`,
                fontWeight: k.count >= 3 ? 700 : 500,
              }}
              title={`${k.count} menciones`}
            >
              {k.word}
              {k.count > 1 && <sub className="text-[10px] text-slate-400 ml-1">{k.count}</sub>}
            </span>
          ))}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
        {result.items.map((item, i) => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold">{item.participant}</span>
              <span className="text-xs text-slate-400">{relativeTime(item.at)}</span>
            </div>
            <p className="leading-snug text-slate-100 break-words">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

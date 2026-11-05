'use client'

// Vistas de resultados por tipo de pregunta — compartidas entre el panel
// del administrador y la vista de resultados revelada a los participantes.
import type {
  DecisionTreeResults,
  DiagnosticoConfig,
  DiagnosticoResults,
  DiagPromptResult,
  MultipleChoiceConfig,
  MultipleChoiceResults,
  OpenTextConfig,
  OpenTextResults,
  QuestionResults,
  SemaforoConfig,
  SemaforoResults,
  WordCloudResults,
} from '@/lib/types'
import { WordCloud } from './word-cloud'
import { relativeTime } from '@/lib/codes'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, CircleDashed, MessageSquareText, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react'
import { useState } from 'react'

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function ResultsView({
  results,
  config,
  showCorrect,
  compact,
}: {
  results: QuestionResults
  config: unknown
  showCorrect?: boolean
  compact?: boolean
}) {
  switch (results.type) {
    case 'multiple_choice':
      return (
        <MultipleResults
          data={results.data}
          config={config as MultipleChoiceConfig}
          showCorrect={showCorrect}
          compact={compact}
        />
      )
    case 'semaforo':
      return <SemaforoResultsView data={results.data} config={config as SemaforoConfig} compact={compact} />
    case 'word_cloud':
      return <WordCloudResultsView data={results.data} />
    case 'decision_tree':
      return <DecisionResultsView data={results.data} />
    case 'open_text':
      return <OpenTextResultsView data={results.data} config={config as OpenTextConfig} />
    case 'diagnostico':
      return <DiagnosticoResultsView data={results.data} config={config as DiagnosticoConfig} />
  }
}

function MultipleResults({
  data,
  config,
  showCorrect,
  compact,
}: {
  data: MultipleChoiceResults
  config: MultipleChoiceConfig
  showCorrect?: boolean
  compact?: boolean
}) {
  const options = config?.options || []
  const max = Math.max(1, ...options.map((o) => data.counts[o.id] || 0))
  const COLORS = [
    'bg-brand-500', 'bg-viva-500', 'bg-energy-500', 'bg-brand-300',
    'bg-violet-500', 'bg-cyan-600', 'bg-rose-400', 'bg-carbon-600',
  ]
  return (
    <div className={`space-y-3 ${compact ? '' : 'py-2'}`}>
      {options.map((opt, i) => {
        const count = data.counts[opt.id] || 0
        const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
        const isCorrect = showCorrect && opt.correct
        return (
          <div key={opt.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium flex items-center gap-1.5">
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-viva-600 shrink-0" aria-label="Correcta" />}
                {opt.text}
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {pct}% · {count}
              </span>
            </div>
            <Bar value={count} max={max} color={COLORS[i % COLORS.length]} />
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground pt-1">
        {data.total} {data.total === 1 ? 'respuesta' : 'respuestas'}
      </p>
    </div>
  )
}

function SemaforoResultsView({
  data,
  config,
  compact,
}: {
  data: SemaforoResults
  config: SemaforoConfig
  compact?: boolean
}) {
  const items = config?.items || []
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const r = data.items.find((i) => i.itemId === item.id)
        const total = r ? r.valid + r.partial + r.invalid : 0
        const light =
          r?.overall === 'valid' ? { text: 'text-viva-700', bg: 'bg-viva-100', label: 'Válida' }
          : r?.overall === 'partial' ? { text: 'text-energy-700', bg: 'bg-energy-100', label: 'Parcial' }
          : r?.overall === 'invalid' ? { text: 'text-red-700', bg: 'bg-red-100', label: 'No válida' }
          : { text: 'text-muted-foreground', bg: 'bg-muted', label: 'Sin votos' }
        return (
          <div key={item.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{item.text}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${light.bg} ${light.text}`}>
                {light.label}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {total > 0 && (
                <>
                  <div className="bg-viva-500 transition-all duration-500" style={{ width: `${(r!.valid / total) * 100}%` }} title={`Válidas: ${r!.valid}`} />
                  <div className="bg-energy-400 transition-all duration-500" style={{ width: `${(r!.partial / total) * 100}%` }} title={`Parciales: ${r!.partial}`} />
                  <div className="bg-red-500 transition-all duration-500" style={{ width: `${(r!.invalid / total) * 100}%` }} title={`No válidas: ${r!.invalid}`} />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-viva-500" /> Válidas: {r?.valid || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-energy-400" /> Parciales: {r?.partial || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> No válidas: {r?.invalid || 0}
              </span>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {data.total} {data.total === 1 ? 'participante evaluó' : 'participantes evaluaron'}
      </p>
    </div>
  )
}

function WordCloudResultsView({ data }: { data: WordCloudResults }) {
  return (
    <div>
      <WordCloud words={data.words} />
      <p className="text-xs text-muted-foreground text-center">
        {data.total} {data.total === 1 ? 'participante escribió' : 'participantes escribieron'} ·{' '}
        {data.words.reduce((s, w) => s + w.count, 0)} palabras
      </p>
    </div>
  )
}

function DecisionResultsView({ data }: { data: DecisionTreeResults }) {
  const max = Math.max(1, ...data.leaves.map((l) => l.count))
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Conclusiones alcanzadas</h4>
        {data.leaves.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay recorridos completados.</p>
        )}
        {data.leaves.map((leaf) => (
          <div key={leaf.optionId} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{leaf.label}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {leaf.count} · {data.total > 0 ? Math.round((leaf.count / data.total) * 100) : 0}%
              </span>
            </div>
            <Bar value={leaf.count} max={max} color="bg-brand-500" />
          </div>
        ))}
      </div>

      {data.comments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageSquareText className="h-4 w-4" /> Comentarios de los participantes
          </h4>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {data.comments.map((c, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium">{c.participant}</span>
                  <span className="text-xs text-muted-foreground">{relativeTime(c.at)}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Ruta: {c.pathText}
                </p>
                <p className="leading-snug">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {data.total} {data.total === 1 ? 'recorrido completado' : 'recorridos completados'}
      </p>
    </div>
  )
}

function OpenTextResultsView({
  data,
  config,
}: {
  data: OpenTextResults
  config: OpenTextConfig
}) {
  return (
    <div className="space-y-2">
      {data.items.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Aún no hay respuestas.</p>
      )}
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {data.items.map((item, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium">{item.participant}</span>
              <span className="text-xs text-muted-foreground">{relativeTime(item.at)}</span>
            </div>
            <p className="leading-snug break-words">{item.text}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {data.total} {data.total === 1 ? 'respuesta' : 'respuestas'}
        {config?.maxLength ? ` · máx. ${config.maxLength} caracteres` : ''}
      </p>
    </div>
  )
}

// Icono de estado global del semáforo para resúmenes
export function SemaforoLight({ vote }: { vote: 'valid' | 'partial' | 'invalid' | null }) {
  if (vote === 'valid') return <CheckCircle2 className="h-4 w-4 text-viva-600" />
  if (vote === 'partial') return <CircleDashed className="h-4 w-4 text-energy-500" />
  if (vote === 'invalid') return <XCircle className="h-4 w-4 text-red-500" />
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />
}

// ------------------- Diagnóstico situacional -------------------
// Los gráficos se adaptan a la cantidad de respuestas: con pocas se muestran
// las respuestas individuales; a medida que crecen aparecen los agregados
// (barras de distribución, promedio y palabras clave).

const CHART_BARS = ['bg-brand-500', 'bg-brand-400', 'bg-energy-500', 'bg-slate-400', 'bg-brand-600']

function DiagnosticoResultsView({
  data,
  config,
}: {
  data: DiagnosticoResults
  config: DiagnosticoConfig
}) {
  const prompts = config?.prompts || []
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data.total} {data.total === 1 ? 'participante respondió' : 'participantes respondieron'} el diagnóstico
        {data.total >= 4 ? ' · con 4 o más respuestas se priorizan los gráficos resumidos' : ''}
      </p>
      {prompts.map((prompt, i) => {
        const r = data.prompts.find((p) => p.promptId === prompt.id)
        if (!r) return null
        return <DiagPromptResults key={prompt.id} index={i + 1} label={prompt.label} result={r} />
      })}
    </div>
  )
}

function DiagPromptResults({
  index,
  label,
  result,
}: {
  index: number
  label: string
  result: DiagPromptResult
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">
          <span className="text-muted-foreground mr-1.5">{index}.</span>
          {label}
        </p>
        <Badge variant="secondary" className="shrink-0">
          {result.kind === 'text' ? 'Texto libre' : result.kind === 'choice' ? 'Opciones' : 'Escala 1-5'}
          {' · '}
          {result.total} resp.
        </Badge>
      </div>
      {result.kind === 'choice' && <DiagChoiceResults result={result} />}
      {result.kind === 'scale' && <DiagScaleResults result={result} />}
      {result.kind === 'text' && <DiagTextResults result={result} />}
    </div>
  )
}

function DiagChoiceResults({ result }: { result: Extract<DiagPromptResult, { kind: 'choice' }> }) {
  const entries = Object.entries(result.counts)
  const max = Math.max(1, ...entries.map(([, n]) => n))
  return (
    <div className="space-y-2">
      {entries.map(([label, count], i) => {
        const pct = result.total > 0 ? Math.round((count / result.total) * 100) : 0
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {result.total >= 5 ? `${pct}% · ` : ''}{count}
              </span>
            </div>
            <Bar value={count} max={max} color={CHART_BARS[i % CHART_BARS.length]} />
          </div>
        )
      })}
    </div>
  )
}

function DiagScaleResults({ result }: { result: Extract<DiagPromptResult, { kind: 'scale' }> }) {
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => result.counts[String(n)] || 0))
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex h-28 items-end gap-2" aria-label="Distribución de la escala">
        {[1, 2, 3, 4, 5].map((n) => {
          const count = result.counts[String(n)] || 0
          const pct = (count / max) * 100
          return (
            <div key={n} className="flex w-9 flex-col items-center gap-1">
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
              <div className="flex h-16 w-full items-end rounded-md bg-muted overflow-hidden">
                <div
                  className={`w-full rounded-md ${n >= 4 ? 'bg-viva-500' : n === 3 ? 'bg-energy-500' : 'bg-red-400'} transition-all duration-500`}
                  style={{ height: `${Math.max(count > 0 ? 12 : 0, pct)}%` }}
                  title={`${n} estrella${n === 1 ? '' : 's'}: ${count}`}
                />
              </div>
              <span className="text-xs font-bold text-muted-foreground">{n}</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-xl border bg-card px-5 py-3 text-center">
        <p className="text-xs text-muted-foreground">Promedio del grupo</p>
        <p className="text-3xl font-extrabold text-primary tabular-nums leading-tight">
          {result.average.toFixed(1)}
          <span className="text-base font-semibold text-muted-foreground"> / 5</span>
        </p>
      </div>
    </div>
  )
}

function DiagTextResults({ result }: { result: Extract<DiagPromptResult, { kind: 'text' }> }) {
  // Adaptativo: con 4+ respuestas se muestran primero las palabras clave;
  // con menos, directamente las respuestas individuales.
  const showKeywordsFirst = result.items.length >= 4 && result.keywords.length >= 3
  const [listOpen, setListOpen] = useState(!showKeywordsFirst)

  return (
    <div className="space-y-3">
      {showKeywordsFirst && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Palabras más repetidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.keywords.slice(0, 12).map((k) => (
              <span
                key={k.word}
                className="rounded-full bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-brand-900"
                style={{ fontSize: `${Math.min(1, k.count / Math.max(1, result.keywords[0].count)) * 8 + 12}px`, fontWeight: k.count >= 3 ? 700 : 500 }}
                title={`${k.count} menciones`}
              >
                {k.word}
                {k.count > 1 && <sub className="text-[9px] text-muted-foreground ml-0.5">{k.count}</sub>}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setListOpen(!listOpen)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        aria-expanded={listOpen}
      >
        {listOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {listOpen ? 'Ocultar respuestas individuales' : `Ver respuestas individuales (${result.items.length})`}
      </button>

      {listOpen && (
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {result.items.map((item, i) => (
            <div key={i} className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium">{item.participant}</span>
                <span className="text-xs text-muted-foreground">{relativeTime(item.at)}</span>
              </div>
              <p className="leading-snug break-words">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

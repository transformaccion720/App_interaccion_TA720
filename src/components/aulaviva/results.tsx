'use client'

// Vistas de resultados por tipo de pregunta — compartidas entre el panel
// del administrador y la vista de resultados revelada a los participantes.
import type {
  DecisionTreeResults,
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
import { CheckCircle2, XCircle, CircleDashed, MessageSquareText } from 'lucide-react'

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
    'bg-teal-500', 'bg-amber-500', 'bg-rose-400', 'bg-violet-500',
    'bg-emerald-500', 'bg-cyan-600', 'bg-orange-500', 'bg-fuchsia-500',
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
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-label="Correcta" />}
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
          r?.overall === 'valid' ? { text: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Válida' }
          : r?.overall === 'partial' ? { text: 'text-amber-700', bg: 'bg-amber-100', label: 'Parcial' }
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
                  <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(r!.valid / total) * 100}%` }} title={`Válidas: ${r!.valid}`} />
                  <div className="bg-amber-400 transition-all duration-500" style={{ width: `${(r!.partial / total) * 100}%` }} title={`Parciales: ${r!.partial}`} />
                  <div className="bg-red-500 transition-all duration-500" style={{ width: `${(r!.invalid / total) * 100}%` }} title={`No válidas: ${r!.invalid}`} />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Válidas: {r?.valid || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Parciales: {r?.partial || 0}
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
            <Bar value={leaf.count} max={max} color="bg-teal-500" />
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
  if (vote === 'valid') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (vote === 'partial') return <CircleDashed className="h-4 w-4 text-amber-500" />
  if (vote === 'invalid') return <XCircle className="h-4 w-4 text-red-500" />
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />
}

'use client'

// Pestaña "Resultados": resumen agregado de todas las preguntas + exportación CSV.
import type { AdminLive, QuestionAdmin } from '@/lib/types'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ICONS } from '@/lib/types'
import { ResultsView } from './results'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, MonitorPlay } from 'lucide-react'

export function ResultsTab({
  live,
  adminCode,
  onPresent,
}: {
  live: AdminLive
  adminCode: string
  onPresent: (questionId: string) => void
}) {
  const qs = live.questions

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Resultados consolidados de la sesión ({qs.length} pregunta{qs.length === 1 ? '' : 's'}).
        </p>
        <a
          href={`/api/sessions/${live.session.id}/export?admin=${encodeURIComponent(adminCode)}`}
          download
          className="inline-flex"
        >
          <Badge variant="outline" className="cursor-pointer hover:bg-muted gap-1.5 px-3 py-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar todo a CSV (Excel)
          </Badge>
        </a>
      </div>

      {qs.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground bg-card">
          Aún no hay preguntas en esta sesión.
        </div>
      )}

      {qs.map((q: QuestionAdmin, i) => {
        const results = live.resultsByQuestion[q.id]
        return (
          <div key={q.id} className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  Pregunta {i + 1} · {QUESTION_TYPE_LABELS[q.type]}
                </p>
                <h3 className="font-bold leading-snug">
                  {QUESTION_TYPE_ICONS[q.type]} {q.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">
                  {q.answeredCount} respuesta{q.answeredCount === 1 ? '' : 's'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPresent(q.id)}
                  title="Proyectar esta pregunta a la audiencia en pantalla completa"
                >
                  <MonitorPlay className="h-4 w-4 mr-1.5" /> Presentar
                </Button>
              </div>
            </div>

            {q.imageUrl && (
              <img src={q.imageUrl} alt="Imagen de apoyo" className="rounded-lg border max-h-56 object-contain bg-muted/30 w-full" />
            )}

            {results ? (
              <ResultsView
                results={results}
                config={q.config}
                showCorrect={q.type === 'multiple_choice' ? !!(q.config as { showCorrect?: boolean }).showCorrect : true}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Sin respuestas todavía.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

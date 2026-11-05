'use client'

// Pestaña "En vivo": conduce la sesión — activa preguntas, muestra resultados,
// y monitorea quién ha respondido en tiempo real.
import type { AdminLive, QuestionAdmin } from '@/lib/types'
import type { EditorDraft } from './question-editor'
import { ResultsView } from './results'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  Eye,
  Square,
  SkipForward,
  CheckCircle2,
  CircleDashed,
  Hourglass,
  Users,
  MonitorPlay,
} from 'lucide-react'
import { QUESTION_TYPE_LABELS } from '@/lib/types'

export function LiveTab({
  live,
  onStateChange,
  busyQuestion,
  onPresent,
}: {
  live: AdminLive
  onStateChange: (question: QuestionAdmin, state: 'open' | 'revealed' | 'closed') => void
  busyQuestion: string | null
  onPresent: (questionId: string) => void
}) {
  const active = live.activeQuestion
  const participants = live.participants.length
  const answered = active?.answeredCount || 0

  const draftType = active ? QUESTION_TYPE_LABELS[active.type] : ''

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      {/* Columna principal: pregunta activa */}
      <div className="space-y-4">
        {!active && (
          <div className="rounded-2xl border border-dashed p-8 text-center space-y-4 bg-card">
            <Hourglass className="h-10 w-10 mx-auto text-brand-600" />
            <div className="space-y-1.5">
              <h3 className="font-bold text-lg">Sin pregunta activa</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {live.questions.length === 0
                  ? 'Añade preguntas en la pestaña «Preguntas» para comenzar la sesión.'
                  : 'Activa una pregunta para presentarla. Los participantes la verán al instante en su celular.'}
              </p>
            </div>
            {live.questions.length > 0 && (
              <div className="space-y-2 max-w-lg mx-auto pt-2 text-left">
                {live.questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 rounded-xl border bg-white p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {QUESTION_TYPE_LABELS[q.type]} · {q.answeredCount} respuestas
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onStateChange(q, 'open')}
                      disabled={busyQuestion === q.id}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {q.state === 'pending' ? 'Activar' : 'Reabrir'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {active && (
          <div className="space-y-4">
            {/* Controles del docente */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-brand-100 text-brand-800">{draftType}</Badge>
                <Badge
                  variant="secondary"
                  className={
                    active.state === 'open'
                      ? 'bg-viva-100 text-viva-800'
                      : active.state === 'revealed'
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-muted'
                  }
                >
                  {active.state === 'open' && 'Aceptando respuestas'}
                  {active.state === 'revealed' && 'Resultados visibles'}
                  {active.state === 'closed' && 'Cerrada'}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  Pregunta {active.order + 1}
                </span>
              </div>

              <h2 className="text-xl font-bold leading-snug">{active.title}</h2>
              {active.description && (
                <p className="text-sm text-muted-foreground">{active.description}</p>
              )}
              {active.imageUrl && (
                <img src={active.imageUrl} alt="Imagen de apoyo" className="rounded-lg border max-h-64 object-contain bg-muted/30 w-full" />
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Respondieron {answered} de {participants}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {participants > 0 ? Math.round((answered / Math.max(1, participants)) * 100) : 0}%
                  </span>
                </div>
                <Progress value={participants > 0 ? (answered / participants) * 100 : 0} className="h-2" />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {active.state !== 'open' && (
                  <Button size="sm" onClick={() => onStateChange(active, 'open')} disabled={busyQuestion === active.id}>
                    <Play className="h-4 w-4 mr-1.5" /> {active.state === 'pending' ? 'Activar pregunta' : 'Reabrir respuestas'}
                  </Button>
                )}
                {active.state === 'open' && (
                  <Button size="sm" variant="secondary" onClick={() => onStateChange(active, 'revealed')} disabled={busyQuestion === active.id}>
                    <Eye className="h-4 w-4 mr-1.5" /> Mostrar resultados a los participantes
                  </Button>
                )}
                {(active.state === 'open' || active.state === 'revealed') && (
                  <Button size="sm" variant="outline" onClick={() => onStateChange(active, 'closed')} disabled={busyQuestion === active.id}>
                    <Square className="h-4 w-4 mr-1.5" /> Cerrar
                  </Button>
                )}
                <NextQuestionButton live={live} onStateChange={onStateChange} busyQuestion={busyQuestion} />
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto bg-carbon-950 text-white border-carbon-950 hover:bg-carbon-800 hover:text-white"
                  onClick={() => onPresent(active.id)}
                  title="Proyectar esta pregunta y sus resultados a la audiencia"
                >
                  <MonitorPlay className="h-4 w-4 mr-1.5" /> Presentar
                </Button>
              </div>
            </div>

            {/* Resultados (siempre visibles para el trainer) */}
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Resultados en tiempo real {active.state !== 'revealed' && '(solo tú los ves)'}
                </h3>
                <Button size="sm" variant="outline" onClick={() => onPresent(active.id)}>
                  <MonitorPlay className="h-4 w-4 mr-1.5" /> Presentar en pantalla
                </Button>
              </div>
              {live.activeResults ? (
                <ResultsView results={live.activeResults} config={active.config} showCorrect={active.type === 'multiple_choice' ? !!(active.config as { showCorrect?: boolean }).showCorrect : true} />
              ) : (
                <p className="text-sm text-muted-foreground">Esperando la primera respuesta…</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Columna lateral: quién falta por responder */}
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <CircleDashed className="h-4 w-4 text-energy-500" />
            Sin responder {active ? `(${live.notAnsweredActive.length})` : ''}
          </h3>
          {!active && <p className="text-xs text-muted-foreground">Activa una pregunta para ver quién falta.</p>}
          {active && live.notAnsweredActive.length === 0 && (
            <p className="text-xs text-viva-700 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" /> ¡Todos respondieron!
            </p>
          )}
          {active && live.notAnsweredActive.length > 0 && (
            <ScrollArea className="max-h-64">
              <div className="flex flex-wrap gap-1.5">
                {live.notAnsweredActive.map((name) => (
                  <Badge key={name} variant="outline" className="font-normal text-muted-foreground">
                    {name}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <h3 className="text-sm font-semibold">Resumen</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li className="flex justify-between">
              <span>Asistentes registrados</span>
              <span className="font-semibold text-foreground tabular-nums">{participants}</span>
            </li>
            <li className="flex justify-between">
              <span>En línea ahora</span>
              <span className="font-semibold text-viva-700 tabular-nums">{live.onlineCount}</span>
            </li>
            <li className="flex justify-between">
              <span>Preguntas en la sesión</span>
              <span className="font-semibold text-foreground tabular-nums">{live.questions.length}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

// Botón para pasar a la siguiente pregunta pendiente
function NextQuestionButton({
  live,
  onStateChange,
  busyQuestion,
}: {
  live: AdminLive
  onStateChange: (question: QuestionAdmin, state: 'open' | 'revealed' | 'closed') => void
  busyQuestion: string | null
}) {
  const next = live.questions.find((q) => q.state === 'pending' && (!live.activeQuestion || q.id !== live.activeQuestion.id))
  if (!next || !live.activeQuestion || live.activeQuestion.state === 'pending') return null
  return (
    <Button
      size="sm"
      variant="secondary"
      className="ml-auto"
      onClick={() => onStateChange(next, 'open')}
      disabled={busyQuestion === next.id}
    >
      <SkipForward className="h-4 w-4 mr-1.5" /> Siguiente: {next.title.length > 24 ? next.title.slice(0, 24) + '…' : next.title}
    </Button>
  )
}

export type { EditorDraft }

'use client'

// /s/[code] — vista en vivo del participante durante la sesión
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { ParticipantQuestion } from '@/components/aulaviva/participant-questions'
import { ResultsView } from '@/components/aulaviva/results'
import type { ParticipantSync } from '@/lib/types'
import { Wifi, WifiOff, Users, CheckCircle2, Hourglass, LogOut } from 'lucide-react'

const POLL_MS = 2000

export default function ParticipantSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState<string | null>(null)
  const [state, setState] = useState<ParticipantSync | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    params.then((p) => setCode(decodeURIComponent(p.code).toUpperCase()))
  }, [params])

  // ---- Sincronización periódica ----
  const sync = useCallback(async () => {
    if (!code) return
    const token = localStorage.getItem(`aulaviva:t:${code}`)
    if (!token) {
      window.location.replace(`/join?code=${code}`)
      return
    }
    try {
      const res = await fetch('/api/participant/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.status === 404) {
        // token inválido: volver a registrarse
        localStorage.removeItem(`aulaviva:t:${code}`)
        window.location.replace(`/join?code=${code}`)
        return
      }
      const data: ParticipantSync = await res.json()
      setConnectionError(false)
      setState(data)
    } catch {
      setConnectionError(true)
    }
  }, [code])

  useEffect(() => {
    sync()
    const id = setInterval(sync, POLL_MS)
    return () => clearInterval(id)
  }, [sync])

  // ---- Cuenta regresiva del temporizador ----
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    function tick() {
      if (!state?.question || state.question.state !== 'open' || !state.question.timerSeconds || !state.question.openedAt) {
        setRemaining(null)
        return
      }
      const serverNow = new Date(state.serverNow).getTime()
      const elapsedLocal = Date.now() - serverNow // desfase local vs servidor
      const end = new Date(state.question.openedAt).getTime() + state.question.timerSeconds * 1000
      const left = Math.max(0, Math.round((end - Date.now() + elapsedLocal) / 1000))
      setRemaining(left)
    }
    tick()
    interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [state?.question, state?.serverNow])

  async function submitAnswer(payload: Record<string, unknown>) {
    if (!state?.question || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const token = localStorage.getItem(`aulaviva:t:${code || ''}`)
    try {
      const res = await fetch(`/api/questions/${state.question.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo enviar la respuesta', variant: 'destructive' })
      } else {
        toast({ title: '¡Respuesta registrada!', description: 'Puedes cambiarla mientras la pregunta esté abierta.' })
        await sync()
      }
    } catch {
      toast({ title: 'Error de conexión al enviar', variant: 'destructive' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function leave() {
    if (code) localStorage.removeItem(`aulaviva:t:${code}`)
    window.location.href = '/join'
  }

  // ---- Estados de carga / error ----
  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Cargando" />
      </div>
    )
  }

  const q = state?.question
  const answered = !!state?.myAnswer
  const isOpen = q?.state === 'open'
  const showResults = q?.state === 'revealed' && state?.results

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Encabezado compacto */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{state?.session.title || 'Sesión'}</p>
            <p className="text-xs text-muted-foreground">
              {state ? `${state.participantName} · código ${code}` : `Código ${code}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state && (
              <Badge variant="secondary" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> {state.totalParticipants}
              </Badge>
            )}
            {connectionError ? (
              <Badge variant="destructive" className="gap-1.5">
                <WifiOff className="h-3.5 w-3.5" /> Sin conexión
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 text-viva-700">
                <Wifi className="h-3.5 w-3.5" /> En vivo
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={leave} aria-label="Salir de la sesión" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        {/* Sesión finalizada */}
        {state && state.session.status === 'closed' && (
          <Card className="text-center py-10">
            <CardContent className="space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-xl font-bold">La sesión ha finalizado</h2>
              <p className="text-muted-foreground text-sm">Gracias por participar, {state.participantName}.</p>
              <Button onClick={leave} variant="outline">Salir</Button>
            </CardContent>
          </Card>
        )}

        {/* Esperando pregunta */}
        {state && state.session.status !== 'closed' && !q && (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <Hourglass className="h-12 w-12 mx-auto text-brand-600 animate-pulse" />
              <h2 className="text-xl font-bold">¡Ya estás dentro!</h2>
              <p className="text-muted-foreground">
                Espera a que tu profesor abra una pregunta.<br />
                Mantén esta pantalla abierta para participar.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pregunta activa */}
        {q && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-snug">{q.title}</h1>
                {q.description && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{q.description}</p>
                )}
              </div>
              {remaining !== null && remaining > 0 && (
                <Badge
                  variant="secondary"
                  className={`shrink-0 tabular-nums font-bold ${remaining <= 10 ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'}`}
                >
                  ⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                </Badge>
              )}
            </div>

            {q.imageUrl && (
              <img
                src={q.imageUrl}
                alt="Imagen de apoyo de la pregunta"
                className="w-full rounded-xl border max-h-80 object-contain bg-white"
              />
            )}

            {isOpen && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Respondieron: {state?.answeredCount ?? 0} de {state?.totalParticipants ?? 0}</span>
                  {answered && (
                    <span className="flex items-center gap-1 text-viva-700 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Respuesta registrada — puedes cambiarla
                    </span>
                  )}
                </div>
                <Progress value={state && state.totalParticipants > 0 ? (state.answeredCount / state.totalParticipants) * 100 : 0} className="h-1.5" />
              </div>
            )}

            <Card>
              <CardContent className="pt-5">
                {isOpen && state?.config && (
                  <ParticipantQuestion
                    key={`${q.id}-${q.state}`}
                    question={q}
                    config={state.config}
                    myAnswer={state.myAnswer}
                    onSubmit={submitAnswer}
                    submitting={submitting}
                  />
                )}

                {!isOpen && q.state === 'open' && !state?.config && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Cargando pregunta…</p>
                )}

                {showResults && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Resultados de la pregunta
                    </h2>
                    <ResultsView results={state!.results!} config={state!.config} showCorrect />
                    <div className="rounded-lg bg-muted/70 p-4 text-center text-sm text-muted-foreground">
                      Esperando a que tu profesor continúe con la siguiente pregunta…
                    </div>
                  </div>
                )}

                {(q.state === 'closed' || (q.state === 'pending')) && (
                  <div className="rounded-lg bg-muted/70 p-4 text-center text-sm text-muted-foreground">
                    {q.state === 'closed' ? 'Esta pregunta se cerró. Espera los resultados o la siguiente pregunta…' : 'Esperando…'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="mt-auto py-4 text-center text-xs text-muted-foreground border-t bg-white">
        <Link href="/" className="hover:text-foreground">Transform Acción 720</Link> — participación en el aula en tiempo real
      </footer>
    </div>
  )
}

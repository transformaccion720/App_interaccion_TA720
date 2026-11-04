'use client'

// /admin/[id] — panel de gestión completo de la sesión
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/client-auth'
import { QrDialog } from '@/components/aulaviva/qr-dialog'
import { LiveTab } from '@/components/aulaviva/live-tab'
import { QuestionsTab } from '@/components/aulaviva/questions-tab'
import { ParticipantsTab } from '@/components/aulaviva/participants-tab'
import { ResultsTab } from '@/components/aulaviva/results-tab'
import { type EditorDraft } from '@/components/aulaviva/question-editor'
import type { AdminLive, QuestionAdmin, QuestionType } from '@/lib/types'
import {
  ArrowLeft,
  Users,
  Wifi,
  Settings2,
  RefreshCw,
  Copy,
  Radio,
  CircleStop,
} from 'lucide-react'

const POLL_MS = 2000

export default function AdminSessionPage() {
  const params = useParams<{ id: string }>()
  const sessionId = params?.id

  const [adminCode, setAdminCode] = useState<string | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'need-code' | 'ok'>('loading')
  const [codeInput, setCodeInput] = useState('')
  const [live, setLive] = useState<AdminLive | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [busyQuestion, setBusyQuestion] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editMax, setEditMax] = useState(100)
  const busyRef = useRef(false)

  // ---- Autenticación: cookie del docente primero; código de administrador como respaldo ----
  useEffect(() => {
    if (!sessionId) return
    const fromUrl = new URLSearchParams(window.location.search).get('admin')
    if (fromUrl) {
      // Ruta legada: sesión compartida con el código en la URL
      setAdminCode(fromUrl)
      setAuthState('ok')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`/api/sessions/${sessionId}/live`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (cancelled) return
        if (res.ok) {
          setAuthState('ok') // autorizado por la cookie o el token Bearer del docente
        } else {
          setAuthState('need-code')
        }
      } catch {
        if (!cancelled) setAuthState('need-code')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const refresh = useCallback(async () => {
    if (!sessionId || authState !== 'ok') return
    try {
      const res = await authFetch(`/api/sessions/${sessionId}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminCode ? { 'x-admin-code': adminCode } : {}) },
        body: JSON.stringify(adminCode ? { adminCode } : {}),
      })
      if (res.status === 401) {
        setAuthState('need-code')
        return
      }
      const data: AdminLive = await res.json()
      setLive(data)
      setConnectionError(false)
    } catch {
      setConnectionError(true)
    }
  }, [sessionId, adminCode, authState])

  useEffect(() => {
    if (authState !== 'ok') return
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [authState, refresh])

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code || !sessionId) return
    const res = await authFetch(`/api/sessions/${sessionId}/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: code }),
    })
    if (res.ok) {
      setAdminCode(code)
      setAuthState('ok')
    } else {
      toast({ title: 'Código de administrador incorrecto', variant: 'destructive' })
    }
  }

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Cargando" />
      </div>
    )
  }

  if (authState === 'need-code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">Panel del docente</h1>
          <p className="text-sm text-muted-foreground">
            Esta sesión no está asociada a tu cuenta. Ingresa tu cuenta en{' '}
            <Link href="/admin" className="text-primary hover:underline">/admin</Link> o usa el
            código de administrador de esta sesión.
          </p>
          <form onSubmit={submitCode} className="space-y-3">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Código de administrador"
              maxLength={8}
              className="h-14 text-center text-xl font-bold tracking-[0.3em]"
              autoComplete="off"
              autoFocus
            />
            <Button type="submit" className="w-full min-h-11">Abrir panel</Button>
          </form>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ---- Acciones ----
  async function setQuestionState(q: QuestionAdmin, state: 'open' | 'revealed' | 'closed') {
    setBusyQuestion(q.id)
    try {
      const res = await authFetch(`/api/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
        body: JSON.stringify({ state }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: data.error || 'No se pudo cambiar el estado', variant: 'destructive' })
      }
      await refresh()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setBusyQuestion(null)
    }
  }

  async function createQuestion(type: QuestionType, draft: EditorDraft): Promise<boolean> {
    try {
      const res = await authFetch(`/api/sessions/${sessionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          imageUrl: draft.imageUrl || null,
          timerSeconds: draft.timerSeconds ? Number(draft.timerSeconds) : null,
          type,
          config: draft.config,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo crear la pregunta', variant: 'destructive' })
        return false
      }
      toast({ title: 'Pregunta creada' })
      await refresh()
      return true
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
      return false
    }
  }

  async function updateQuestion(q: QuestionAdmin, draft: EditorDraft): Promise<boolean> {
    try {
      const res = await authFetch(`/api/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          imageUrl: draft.imageUrl || null,
          timerSeconds: draft.timerSeconds ? Number(draft.timerSeconds) : null,
          config: draft.config,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo actualizar', variant: 'destructive' })
        return false
      }
      toast({ title: 'Pregunta actualizada' })
      await refresh()
      return true
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
      return false
    }
  }

  async function deleteQuestion(q: QuestionAdmin) {
    try {
      const res = await authFetch(`/api/questions/${q.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-code': adminCode || '' },
      })
      if (!res.ok) {
        toast({ title: 'No se pudo eliminar la pregunta', variant: 'destructive' })
        return
      }
      toast({ title: 'Pregunta eliminada' })
      await refresh()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  async function reorder(ids: string[]) {
    await authFetch(`/api/sessions/${sessionId}/manage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
      body: JSON.stringify({ questionOrder: ids }),
    })
    await refresh()
  }

  async function kickParticipant(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} de la sesión? Sus respuestas también se borrarán.`)) return
    try {
      await authFetch(`/api/participants/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-code': adminCode || '' },
      })
      toast({ title: `${name} fue eliminado de la sesión` })
      await refresh()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  async function setSessionStatus(status: 'live' | 'closed' | 'draft') {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await authFetch(`/api/sessions/${sessionId}/manage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
        body: JSON.stringify({ status }),
      })
      await refresh()
    } finally {
      busyRef.current = false
    }
  }

  async function saveSettings() {
    await authFetch(`/api/sessions/${sessionId}/manage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-code': adminCode || '' },
      body: JSON.stringify({ title: editTitle, maxParticipants: editMax }),
    })
    toast({ title: 'Ajustes guardados' })
    setSettingsOpen(false)
    await refresh()
  }

  function openSettings() {
    if (!live) return
    setEditTitle(live.session.title)
    setEditMax(live.session.maxParticipants)
    setSettingsOpen(true)
  }

  if (!live) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Cargando" />
      </div>
    )
  }

  const statusInfo =
    live.session.status === 'live'
      ? { label: 'En curso', cls: 'bg-viva-100 text-viva-800' }
      : live.session.status === 'closed'
        ? { label: 'Finalizada', cls: 'bg-red-100 text-red-700' }
        : { label: 'Preparación', cls: 'bg-energy-100 text-energy-800' }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Encabezado del panel */}
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/admin" aria-label="Volver al inicio del panel">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold truncate">{live.session.title}</h1>
              <Badge variant="secondary" className={statusInfo.cls}>{statusInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                className="flex items-center gap-1 hover:text-foreground"
                onClick={() => {
                  navigator.clipboard?.writeText(live.session.joinCode)
                  toast({ title: 'Código copiado' })
                }}
                title="Copiar código de acceso"
              >
                Código: <span className="font-bold tracking-wider text-foreground">{live.session.joinCode}</span>
                <Copy className="h-3 w-3" />
              </button>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {live.participants.length}/{live.session.maxParticipants}
              </span>
              <span className="flex items-center gap-1 text-viva-700 font-medium">
                <Wifi className="h-3.5 w-3.5" /> {live.onlineCount} en línea
              </span>
              {connectionError && <span className="text-destructive">· reconectando…</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <QrDialog joinCode={live.session.joinCode} title={live.session.title} />
            <Button variant="outline" size="sm" onClick={openSettings}>
              <Settings2 className="h-4 w-4 mr-1.5" /> Ajustes
            </Button>
            {live.session.status !== 'closed' ? (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setSessionStatus('closed')}>
                <CircleStop className="h-4 w-4 mr-1.5" /> Finalizar sesión
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSessionStatus('live')}>
                <Radio className="h-4 w-4 mr-1.5" /> Reabrir
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5">
        <Tabs defaultValue="live">
          <TabsList className="mb-4">
            <TabsTrigger value="live">En vivo</TabsTrigger>
            <TabsTrigger value="questions">Preguntas</TabsTrigger>
            <TabsTrigger value="participants">
              Asistentes
              {live.participants.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5">{live.participants.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <LiveTab live={live} onStateChange={setQuestionState} busyQuestion={busyQuestion} />
          </TabsContent>

          <TabsContent value="questions">
            <QuestionsTab
              live={live}
              onCreate={createQuestion}
              onUpdate={updateQuestion}
              onDelete={deleteQuestion}
              onReorder={reorder}
              onActivate={(q) => setQuestionState(q, 'open')}
              busyQuestion={busyQuestion}
            />
          </TabsContent>

          <TabsContent value="participants">
            <ParticipantsTab live={live} onKick={kickParticipant} />
          </TabsContent>

          <TabsContent value="results">
            <ResultsTab live={live} adminCode={adminCode || ''} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Diálogo de ajustes */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustes de la sesión</DialogTitle>
            <DialogDescription>Cambia el título o el límite de participantes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="st-title">Título</Label>
              <Input id="st-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-max">Máximo de participantes</Label>
              <Input id="st-max" type="number" min={2} max={500} value={editMax} onChange={(e) => setEditMax(Number(e.target.value))} className="h-10 w-32" />
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
              <p>Código de acceso de los alumnos: <span className="font-bold text-foreground tracking-wider">{live.session.joinCode}</span></p>
              <p className="flex items-center gap-1">
                Tu código de administrador:
                <button
                  className="flex items-center gap-1 font-bold text-foreground tracking-wider hover:text-brand-700"
                  onClick={() => {
                    navigator.clipboard?.writeText(live.session.adminCode)
                    toast({ title: 'Código de administrador copiado' })
                  }}
                >
                  {live.session.adminCode} <Copy className="h-3 w-3" />
                </button>
                — guárdalo para reabrir el panel desde otro equipo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
              <Button onClick={saveSettings}><RefreshCw className="h-4 w-4 mr-1.5" /> Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="mt-auto border-t bg-white py-3 text-center text-xs text-muted-foreground">
        Transform Acción 720 — panel docente · {live.session.title}
      </footer>
    </div>
  )
}

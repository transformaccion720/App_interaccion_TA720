'use client'

// /admin — inicio de sesión del docente y panel con sus sesiones.
// Los alumnos NO inician sesión: entran con el código o QR desde /join.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import {
  Presentation,
  LogOut,
  LogIn,
  Plus,
  Sparkles,
  Radio,
  ClipboardCopy,
  QrCode,
  Users,
  ListChecks,
  ChevronRight,
  CircleCheck,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react'

interface TeacherInfo {
  id: string
  email: string
  name: string
}

interface SessionSummary {
  id: string
  title: string
  description: string | null
  joinCode: string
  status: string
  maxParticipants: number
  updatedAt: string
  _count: { questions: number; participants: number }
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'En preparación', cls: 'bg-amber-100 text-amber-800' },
  live: { label: 'En curso', cls: 'bg-emerald-100 text-emerald-800' },
  closed: { label: 'Finalizada', cls: 'bg-slate-200 text-slate-700' },
}

export default function AdminPage() {
  const router = useRouter()
  const [view, setView] = useState<'loading' | 'login' | 'dashboard'>('loading')
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        if (!cancelled) {
          setTeacher(data?.teacher ?? null)
          setView(data?.teacher ? 'dashboard' : 'login')
        }
      } catch {
        if (!cancelled) setView('login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setTeacher(null)
    setView('login')
    toast({ title: 'Sesión cerrada' })
  }

  const stableLogout = useCallback(() => {
    void handleLogout()
  }, [])

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700" aria-label="Cargando" />
      </div>
    )
  }

  if (view === 'login') {
    return <LoginView onLoggedIn={(t) => { setTeacher(t); setView('dashboard') }} />
  }

  return <Dashboard teacher={teacher!} onLogout={stableLogout} router={router} />
}

// ==================== VISTA: INICIO DE SESIÓN ====================

function LoginView({ onLoggedIn }: { onLoggedIn: (t: TeacherInfo) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo iniciar sesión', variant: 'destructive' })
        return
      }
      toast({ title: mode === 'login' ? `¡Hola de nuevo, ${data.teacher.name}!` : 'Cuenta creada. ¡Bienvenido/a!' })
      onLoggedIn(data.teacher)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function fillDemo() {
    setMode('login')
    setEmail('docente@aulaviva.app')
    setPassword('AulaViva2026')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Panel de marca (corporativo) */}
      <aside className="relative lg:w-[46%] bg-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(13,148,136,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(13,148,136,0.18),transparent_50%)]" aria-hidden />
        <div className="relative h-full flex flex-col justify-between p-8 lg:p-12 gap-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/90 font-black text-xl text-white shadow-lg shadow-teal-500/30">
              A
            </span>
            <div>
              <p className="font-bold text-lg leading-none">AulaViva</p>
              <p className="text-sm text-teal-200/80">Participación en el aula en tiempo real</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
              El panel del docente,{' '}
              <span className="text-teal-300">protegido y siempre a mano</span>
            </h1>
            <p className="text-slate-300 leading-relaxed">
              Administra tus sesiones, lanza preguntas y mira los resultados en vivo. Tus alumnos
              entran sin cuenta con el código o el QR de la clase.
            </p>
            <ul className="space-y-3 text-sm text-slate-200">
              {[
                { icon: ShieldCheck, t: 'Acceso seguro con tu correo y contraseña' },
                { icon: QrCode, t: 'Tus alumnos entran con código o QR, sin registrarse' },
                { icon: Radio, t: 'Panel en vivo: conectados, respuestas y resultados' },
              ].map((f) => (
                <li key={f.t} className="flex items-start gap-2.5">
                  <f.icon className="h-4.5 w-4.5 mt-0.5 shrink-0 text-teal-300" />
                  <span>{f.t}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400">
            ¿Eres estudiante? No necesitas cuenta:{' '}
            <Link href="/join" className="text-teal-300 hover:underline">únete con el código de tu clase</Link>.
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 bg-gradient-to-b from-teal-50/60 to-white">
        <div className="w-full max-w-md space-y-5">
          <Card className="shadow-xl shadow-teal-100/60 border-teal-100">
            <CardHeader className="pb-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-teal-300 mb-1">
                <GraduationCap className="h-6 w-6" />
              </span>
              <CardTitle className="text-2xl">
                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta docente'}
              </CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? 'Accede al panel de administración de AulaViva.'
                  : 'Regístrate para crear y gestionar tus sesiones.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')} className="mb-5">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="register">Crear cuenta</TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={submit} className="space-y-4">
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="login-name">Tu nombre</Label>
                    <Input
                      id="login-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej.: Ana Martínez"
                      maxLength={60}
                      className="h-11"
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Correo electrónico</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="h-11"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pass">Contraseña</Label>
                  <Input
                    id="login-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                  />
                  {mode === 'register' && (
                    <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full min-h-12 text-base" disabled={busy}>
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {mode === 'login' ? 'Entrando…' : 'Creando cuenta…'}
                    </span>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-1.5" />
                      {mode === 'login' ? 'Entrar al panel' : 'Crear cuenta y entrar'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Cuenta de demostración */}
          <div className="rounded-xl border border-dashed border-teal-300 bg-teal-50/60 p-4 text-sm">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <Sparkles className="h-4 w-4 text-teal-700" /> ¿Quieres probarla rápido?
            </p>
            <p className="text-muted-foreground mb-2.5">
              Cuenta de demostración: <code className="font-semibold text-foreground">docente@aulaviva.app</code> ·
              contraseña <code className="font-semibold text-foreground">AulaViva2026</code>
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={fillDemo}>
              Rellenar con la cuenta demo
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">← Volver al inicio</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

// ==================== VISTA: DASHBOARD DEL DOCENTE ====================

function Dashboard({
  teacher,
  onLogout,
  router,
}: {
  teacher: TeacherInfo
  onLogout: () => void
  router: ReturnType<typeof useRouter>
}) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [max, setMax] = useState(100)
  const [creating, setCreating] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [legacyCode, setLegacyCode] = useState('')
  const [legacyBusy, setLegacyBusy] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', { cache: 'no-store' })
      if (res.status === 401) {
        onLogout()
        return
      }
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      setSessions([])
    }
  }, [onLogout])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  async function createSession(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast({ title: 'Ponle un título a tu sesión', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, maxParticipants: max }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo crear la sesión', variant: 'destructive' })
        return
      }
      toast({ title: 'Sesión creada', description: 'Añade preguntas y comparte el código.' })
      router.push(`/admin/${data.id}`)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function createDemo() {
    setDemoBusy(true)
    try {
      const res = await fetch('/api/demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      router.push(`/admin/${data.id}`)
    } catch {
      toast({ title: 'No se pudo crear la demo', variant: 'destructive' })
      setDemoBusy(false)
    }
  }

  async function openLegacy(e: React.FormEvent) {
    e.preventDefault()
    const code = legacyCode.trim().toUpperCase()
    if (!code) return
    setLegacyBusy(true)
    try {
      const res = await fetch('/api/sessions/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Código no válido', variant: 'destructive' })
        return
      }
      router.push(`/admin/${data.id}?admin=${code}`)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLegacyBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/90 font-black text-lg shrink-0">
              A
            </span>
            <div className="min-w-0">
              <p className="font-bold leading-none">AulaViva</p>
              <p className="text-xs text-teal-200/80 truncate">Panel del docente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300">
              <CircleCheck className="h-4 w-4 text-teal-400" />
              {teacher.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Mis sesiones */}
        <section className="space-y-4 order-2 lg:order-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Mis sesiones</h2>
            <Button variant="secondary" size="sm" onClick={createDemo} disabled={demoBusy}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {demoBusy ? 'Creando…' : 'Crear demo'}
            </Button>
          </div>

          {sessions === null && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {sessions !== null && sessions.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center bg-card space-y-2">
              <Presentation className="h-10 w-10 mx-auto text-teal-600" />
              <h3 className="font-bold text-lg">Aún no tienes sesiones</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Crea tu primera sesión con el formulario de la derecha, o genera una demo con los
                6 tipos de preguntas ya listos.
              </p>
            </div>
          )}

          {sessions !== null && sessions.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {sessions.map((s) => {
                const st = STATUS_META[s.status] || STATUS_META.draft
                return (
                  <div
                    key={s.id}
                    className="group rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:border-teal-300 hover:shadow-md hover:shadow-teal-100/60 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold leading-snug line-clamp-2">{s.title}</h3>
                      <Badge variant="secondary" className={`${st.cls} shrink-0`}>{st.label}</Badge>
                    </div>
                    {s.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <button
                        className="flex items-center gap-1 font-semibold text-foreground hover:text-teal-700"
                        title="Copiar código de acceso"
                        onClick={() => {
                          navigator.clipboard?.writeText(s.joinCode)
                          toast({ title: 'Código copiado' })
                        }}
                      >
                        <QrCode className="h-3.5 w-3.5" /> Código: {s.joinCode}
                        <ClipboardCopy className="h-3 w-3" />
                      </button>
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" /> {s._count.questions} preguntas
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {s._count.participants}/{s.maxParticipants}
                      </span>
                    </div>
                    <Button
                      className="w-full mt-auto group-hover:bg-primary"
                      onClick={() => router.push(`/admin/${s.id}`)}
                    >
                      Abrir panel <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Columna lateral: nueva sesión + código heredado */}
        <aside className="space-y-5 order-1 lg:order-2">
          <Card className="shadow-lg shadow-teal-100/50 border-teal-100">
            <CardHeader className="pb-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-1">
                <Presentation className="h-6 w-6" />
              </span>
              <CardTitle className="text-xl">Nueva sesión</CardTitle>
              <CardDescription>
                Se asociará a tu cuenta y compartirás el código o QR con tus alumnos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createSession} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-title">Título de la sesión</Label>
                  <Input
                    id="s-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej.: Clase 1 — Diagnóstico IA"
                    maxLength={120}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-desc">Descripción (opcional)</Label>
                  <Textarea
                    id="s-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tema, grupo, indicaciones…"
                    rows={2}
                    maxLength={300}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-max">Máximo de participantes</Label>
                  <Input
                    id="s-max"
                    type="number"
                    min={2}
                    max={500}
                    value={max}
                    onChange={(e) => setMax(Number(e.target.value))}
                    className="h-11 w-32"
                  />
                  <p className="text-xs text-muted-foreground">Por defecto, 100 alumnos.</p>
                </div>
                <Button type="submit" size="lg" className="w-full min-h-11" disabled={creating}>
                  <Plus className="h-5 w-5 mr-1.5" />
                  {creating ? 'Creando…' : 'Crear sesión'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Abrir con código de administrador</CardTitle>
              <CardDescription>
                Para sesiones creadas antes del inicio de sesión o compartidas por otro docente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={openLegacy} className="flex gap-2">
                <Input
                  value={legacyCode}
                  onChange={(e) => setLegacyCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEFGH"
                  maxLength={8}
                  className="h-11 text-center font-bold tracking-[0.2em] uppercase"
                  autoComplete="off"
                  aria-label="Código de administrador"
                />
                <Button type="submit" variant="outline" className="h-11 shrink-0" disabled={legacyBusy}>
                  Abrir
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="mt-auto border-t bg-white py-4 text-center text-xs text-muted-foreground">
        AulaViva — panel del docente ·{' '}
        <Link href="/join" className="hover:text-foreground">¿Tienes un código? Únete aquí</Link>
      </footer>
    </div>
  )
}

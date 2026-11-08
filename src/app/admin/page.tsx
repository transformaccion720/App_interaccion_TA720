'use client'

// /admin — inicio de sesión del equipo (trainer, moderador o administrador)
// y panel con sus sesiones.
// Los alumnos NO inician sesión: entran con el código o QR desde /join.
// El registro público está deshabilitado: solo el ADMIN crea cuentas
// (trainers o moderadores) desde la gestión interna de usuarios.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrandLogo } from '@/components/aulaviva/brand-logo'
import { authFetch, saveAuthToken, clearAuthToken } from '@/lib/client-auth'
import { formatDateES, formatDateTimeES, localInputToIso } from '@/lib/utils'
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
  UserPlus,
  KeyRound,
  Trash2,
  Info,
  CalendarDays,
  CalendarPlus,
} from 'lucide-react'

interface TeacherInfo {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'DOCENTE' | 'MODERADOR'
}

interface SessionSummary {
  id: string
  title: string
  description: string | null
  joinCode: string
  status: string
  maxParticipants: number
  createdAt: string
  scheduledAt: string | null
  updatedAt: string
  _count: { questions: number; participants: number }
}

interface UserRow {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'DOCENTE' | 'MODERADOR'
  createdAt: string
  _count: { sessions: number }
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'En preparación', cls: 'bg-energy-100 text-energy-800' },
  live: { label: 'En curso', cls: 'bg-viva-100 text-viva-800' },
  closed: { label: 'Finalizada', cls: 'bg-slate-200 text-slate-700' },
}

// Pestañas del listado de sesiones, una por estado.
const TAB_DEFS: { key: TabKey; status: string; label: string; badge: string; empty: string }[] = [
  {
    key: 'curso',
    status: 'live',
    label: 'En curso',
    badge: 'bg-viva-100 text-viva-800',
    empty: 'Ninguna sesión está en curso ahora mismo. Entra a una sesión en preparación y actívala en vivo.',
  },
  {
    key: 'preparacion',
    status: 'draft',
    label: 'En preparación',
    badge: 'bg-energy-100 text-energy-800',
    empty: 'No hay sesiones en preparación. Crea una con el formulario de la derecha.',
  },
  {
    key: 'finalizadas',
    status: 'closed',
    label: 'Finalizadas',
    badge: 'bg-slate-200 text-slate-700',
    empty: 'Aún no hay sesiones finalizadas. Cuando cierres una aparecerá aquí.',
  },
]

type TabKey = 'curso' | 'preparacion' | 'finalizadas'

const ROLE_META: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'Administrador', cls: 'bg-brand-100 text-brand-800' },
  DOCENTE: { label: 'Trainer', cls: 'bg-viva-100 text-viva-800' },
  MODERADOR: { label: 'Moderador', cls: 'bg-energy-100 text-energy-800' },
}

export default function AdminPage() {
  const router = useRouter()
  const [view, setView] = useState<'loading' | 'login' | 'dashboard'>('loading')
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/auth/me')
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
    clearAuthToken()
    await authFetch('/api/auth/logout', { method: 'POST' })
    setTeacher(null)
    setView('login')
    toast({ title: 'Sesión cerrada' })
  }

  const stableLogout = useCallback(() => {
    void handleLogout()
     
  }, [])

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-claro">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Cargando" />
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // Diagnóstico visible en pantalla: si el servidor rechaza el inicio de sesión
  // por configuración del deploy (BD, variables, cliente Prisma), el usuario ve
  // la causa exacta sin necesidad de abrir las herramientas de desarrollador.
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [diag, setDiag] = useState<string | null>(null)
  const [diagBusy, setDiagBusy] = useState(false)

  async function runDiag() {
    setDiagBusy(true)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setDiag(JSON.stringify(data, null, 2))
    } catch {
      setDiag('No se pudo consultar /api/health — el deploy puede estar caído o ser una versión anterior a la actual.')
    } finally {
      setDiagBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const extra = [data.detalle, data.pista].filter(Boolean).join(' — ')
        const msg = `${data.error || 'No se pudo iniciar sesión'}${extra ? `: ${extra}` : ''}`
        setErrorMsg(msg)
        toast({
          title: data.error || 'No se pudo iniciar sesión',
          description: data.pista || data.detalle,
          variant: 'destructive',
        })
        return
      }
      // Respaldo de sesión en localStorage: si el navegador bloquea las
      // cookies de terceros (iframe de vista previa), el token Bearer
      // mantiene la sesión abierta al recargar o navegar.
      if (data.token) saveAuthToken(data.token)
      toast({ title: `¡Hola de nuevo, ${data.teacher.name}!` })
      onLoggedIn(data.teacher)
    } catch {
      setErrorMsg(
        'Error de conexión: el navegador no pudo alcanzar /api/auth/login. Revisa tu conexión o que la URL del sitio sea la del deploy actual.',
      )
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Panel de marca (corporativo) */}
      <aside className="relative lg:w-[46%] bg-carbon-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,102,255,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(0,204,136,0.16),transparent_50%)]" aria-hidden />
        <div className="relative h-full flex flex-col justify-between p-8 lg:p-12 gap-10">
          {/* Logo blanco directamente sobre el fondo oscuro: contrasta solo,
              sin caja blanca (la variante dark ya es blanca) */}
          <div className="self-start">
            <BrandLogo className="h-12 w-auto" dark />
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
              El panel del trainer,{' '}
              <span className="text-brand-300">protegido y siempre a mano</span>
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
                  <f.icon className="h-4.5 w-4.5 mt-0.5 shrink-0 text-brand-300" />
                  <span>{f.t}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-400">
            ¿Eres estudiante? No necesitas cuenta:{' '}
            <Link href="/join" className="text-brand-300 hover:underline">únete con el código de tu clase</Link>.
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 bg-claro">
        <div className="w-full max-w-md space-y-5">
          <Card className="shadow-xl shadow-brand-100/60 border-brand-100">
            <CardHeader className="pb-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-carbon-950 text-brand-300 mb-1">
                <GraduationCap className="h-6 w-6" />
              </span>
              <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
              <CardDescription>
                Accede al panel de administración de Transform Acción 720.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
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
                    autoComplete="current-password"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full min-h-12 text-base" disabled={busy}>
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Entrando…
                    </span>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-1.5" />
                      Entrar al panel
                    </>
                  )}
                </Button>

                {errorMsg && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="font-semibold">No se pudo iniciar sesión</p>
                    <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{errorMsg}</p>
                    <button
                      type="button"
                      onClick={runDiag}
                      disabled={diagBusy}
                      className="mt-2 text-xs font-medium underline underline-offset-2 hover:opacity-80"
                    >
                      {diagBusy ? 'Consultando diagnóstico…' : 'Ver diagnóstico técnico'}
                    </button>
                    {diag && (
                      <pre className="mt-2 max-h-56 overflow-auto rounded-md border bg-background/80 p-2.5 text-left text-[11px] leading-relaxed text-muted-foreground">
                        {diag}
                      </pre>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Aviso: el alta de cuentas es interna del administrador */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm flex gap-2.5">
            <Info className="h-4.5 w-4.5 mt-0.5 shrink-0 text-brand-600" />
            <p className="text-muted-foreground">
              Las cuentas de <strong className="text-foreground">trainer</strong> o{' '}
              <strong className="text-foreground">moderador</strong> las crea internamente el
              administrador de la plataforma. Si necesitas una, solicítala a tu administración.
            </p>
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
  const isAdmin = teacher.role === 'ADMIN'
  const roleMeta = ROLE_META[teacher.role] || ROLE_META.DOCENTE

  return (
    <div className="min-h-screen flex flex-col bg-claro">
      <header className="sticky top-0 z-20 border-b bg-carbon-950 text-white">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo className="h-8 w-auto shrink-0" dark />
            <div className="min-w-0 border-l border-white/15 pl-3">
              <p className="font-bold leading-none">Panel de administración</p>
              <p className="text-xs text-slate-300 truncate">Transform Acción 720</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300">
              <CircleCheck className="h-4 w-4 text-viva-400" />
              {teacher.name}
              <Badge variant="secondary" className={`${roleMeta.cls} ml-1`}>{roleMeta.label}</Badge>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="sesiones">
          <TabsList className="mb-5">
            <TabsTrigger value="sesiones">
              <Presentation className="h-4 w-4 mr-1.5" /> Mis sesiones
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="usuarios">
                <Users className="h-4 w-4 mr-1.5" /> Usuarios
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sesiones">
            <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
              <SessionsList isAdmin={isAdmin} router={router} />
              <NewSessionCard />
            </div>
          </TabsContent>

          {isAdmin && <TabsContent value="usuarios"><UsersAdmin /></TabsContent>}
        </Tabs>
      </main>

      <footer className="mt-auto border-t bg-white py-4 text-center text-xs text-muted-foreground">
        Transform Acción 720 — panel de administración ·{' '}
        <Link href="/join" className="hover:text-foreground">¿Tienes un código? Únete aquí</Link>
      </footer>
    </div>
  )
}

// ==================== SECCIÓN: MIS SESIONES ====================

function SessionsList({
  isAdmin,
  router,
}: {
  isAdmin: boolean
  router: ReturnType<typeof useRouter>
}) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<TabKey>('preparacion')
  const tabInit = useRef(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [legacyCode, setLegacyCode] = useState('')
  const [legacyBusy, setLegacyBusy] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch('/api/sessions')
      if (res.status === 401) {
        clearAuthToken()
        await authFetch('/api/auth/logout', { method: 'POST' })
        window.location.reload()
        return
      }
      const data = await res.json()
      setSessions(data.sessions || [])
      setLoadError(false)
    } catch {
      setLoadError(true)
      setSessions([])
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Pestaña por defecto al cargar: la primera con contenido
  // (en curso → en preparación → finalizadas).
  useEffect(() => {
    if (sessions && !tabInit.current) {
      tabInit.current = true
      if (sessions.some((s) => s.status === 'live')) setTab('curso')
      else if (sessions.some((s) => s.status === 'draft')) setTab('preparacion')
      else if (sessions.some((s) => s.status === 'closed')) setTab('finalizadas')
    }
  }, [sessions])

  // Sesiones agrupadas por estado y ordenadas dentro de cada pestaña:
  //  · En curso / Finalizadas: actividad más reciente primero.
  //  · En preparación: las que tienen fecha programada primero (la más
  //    cercana arriba); las sin fecha van al final.
  const groups = useMemo(() => {
    const g: Record<TabKey, SessionSummary[]> = { curso: [], preparacion: [], finalizadas: [] }
    for (const s of sessions || []) {
      if (s.status === 'live') g.curso.push(s)
      else if (s.status === 'closed') g.finalizadas.push(s)
      else g.preparacion.push(s)
    }
    const byUpdate = (a: SessionSummary, b: SessionSummary) =>
      +new Date(b.updatedAt) - +new Date(a.updatedAt)
    const byScheduled = (a: SessionSummary, b: SessionSummary) => {
      if (a.scheduledAt && b.scheduledAt)
        return +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
      if (a.scheduledAt) return -1
      if (b.scheduledAt) return 1
      return byUpdate(a, b)
    }
    g.curso.sort(byUpdate)
    g.preparacion.sort(byScheduled)
    g.finalizadas.sort(byUpdate)
    return g
  }, [sessions])

  async function createDemo() {
    setDemoBusy(true)
    try {
      const res = await authFetch('/api/demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      toast({ title: 'Demo creada', description: 'Explora los 6 tipos de preguntas.' })
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
      const res = await authFetch('/api/sessions/lookup', {
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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Mis sesiones</h2>
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={createDemo} disabled={demoBusy}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {demoBusy ? 'Creando…' : 'Crear demo'}
          </Button>
        )}
      </div>

      {sessions === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {sessions !== null && loadError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive space-y-1">
          <p className="font-semibold">No se pudieron cargar las sesiones</p>
          <p className="leading-relaxed">
            Revisa tu conexión y recarga la página. Si esto ocurre justo después de un despliegue,
            puede faltar actualizar la base de datos (ver DEPLOY-NEON.md, paso «Actualizar la base de
            datos en Neon»).
          </p>
        </div>
      )}

      {sessions !== null && !loadError && sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center bg-card space-y-2">
          <Presentation className="h-10 w-10 mx-auto text-brand-600" />
          <h3 className="font-bold text-lg">Aún no tienes sesiones</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Crea tu primera sesión con el formulario de la derecha
            {isAdmin ? ', o genera una demo con los 6 tipos de preguntas ya listos.' : '.'}
          </p>
        </div>
      )}

      {sessions !== null && !loadError && sessions.length > 0 && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {TAB_DEFS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                <Badge variant="secondary" className={`${t.badge} ml-1.5 px-1.5`}>
                  {groups[t.key].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_DEFS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              {groups[t.key].length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center bg-card text-sm text-muted-foreground">
                  {t.empty}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {groups[t.key].map((s) => (
                    <SessionCard key={s.id} s={s} router={router} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Abrir con código de administrador</CardTitle>
          <CardDescription>
            Para sesiones creadas antes del inicio de sesión o compartidas por otro trainer.
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
    </section>
  )
}

// Tarjeta individual de sesión (usada en las tres pestañas).
function SessionCard({
  s,
  router,
}: {
  s: SessionSummary
  router: ReturnType<typeof useRouter>
}) {
  const st = STATUS_META[s.status] || STATUS_META.draft
  return (
    <div
      className="group rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:border-brand-300 hover:shadow-md hover:shadow-brand-100/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold leading-snug line-clamp-2">{s.title}</h3>
        <Badge variant="secondary" className={`${st.cls} shrink-0`}>{st.label}</Badge>
      </div>
      {s.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Fecha de creación (automática)">
          <CalendarPlus className="h-3.5 w-3.5" /> Creada: {formatDateES(s.createdAt)}
        </span>
        {s.scheduledAt && (
          <span
            className="flex items-center gap-1 font-semibold text-brand-700"
            title="Fecha programada de la sesión"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Sesión: {formatDateTimeES(s.scheduledAt)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <button
          className="flex items-center gap-1 font-semibold text-foreground hover:text-brand-700"
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
        className="w-full mt-auto group-hover:bg-brand-600"
        onClick={() => router.push(`/admin/${s.id}`)}
      >
        Abrir panel <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

// ==================== SECCIÓN: NUEVA SESIÓN ====================

function NewSessionCard() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [max, setMax] = useState(100)
  const [scheduled, setScheduled] = useState('') // fecha programada (datetime-local, opcional)
  const [creating, setCreating] = useState(false)

  async function createSession(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast({ title: 'Ponle un título a tu sesión', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await authFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          maxParticipants: max,
          scheduledAt: localInputToIso(scheduled),
        }),
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

  return (
    <Card className="shadow-lg shadow-brand-100/50 border-brand-100">
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
          <div className="space-y-1.5">
            <Label htmlFor="s-date">Fecha de la sesión (opcional)</Label>
            <Input
              id="s-date"
              type="datetime-local"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              ¿Cuándo se realizará? La podrás cambiar después en Ajustes.
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarPlus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-600" />
            <span>
              La <strong className="text-foreground">fecha de creación</strong> se guarda
              automáticamente al crear la sesión (hoy, {formatDateES(new Date())}).
            </span>
          </div>
          <Button type="submit" size="lg" className="w-full min-h-11" disabled={creating}>
            <Plus className="h-5 w-5 mr-1.5" />
            {creating ? 'Creando…' : 'Crear sesión'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ==================== SECCIÓN: GESTIÓN DE USUARIOS (SOLO ADMIN) ====================

function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'DOCENTE' | 'MODERADOR'>('DOCENTE')
  const [busy, setBusy] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/users')
      if (!res.ok) {
        setUsers([])
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      setUsers([])
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast({
        title: 'Completa los datos',
        description: 'Nombre, correo y contraseña (mín. 6 caracteres).',
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo crear la cuenta', variant: 'destructive' })
        return
      }
      toast({
        title: 'Cuenta creada',
        description: `${data.teacher.email} ya puede iniciar sesión como ${role === 'DOCENTE' ? 'trainer' : 'moderador'}.`,
      })
      setName(''); setEmail(''); setPassword(''); setRole('DOCENTE')
      await loadUsers()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(u: UserRow) {
    const next = window.prompt(`Nueva contraseña para ${u.email} (mín. 6 caracteres):`)
    if (!next) return
    if (next.length < 6) {
      toast({ title: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' })
      return
    }
    const res = await authFetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || 'No se pudo actualizar', variant: 'destructive' })
      return
    }
    toast({ title: 'Contraseña actualizada', description: u.email })
  }

  async function changeRole(u: UserRow, newRole: string) {
    const res = await authFetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || 'No se pudo actualizar el rol', variant: 'destructive' })
      return
    }
    toast({ title: 'Rol actualizado', description: `${u.email} ahora es ${ROLE_META[newRole]?.label || newRole}` })
    await loadUsers()
  }

  async function removeUser(u: UserRow) {
    if (!window.confirm(`¿Eliminar la cuenta de ${u.email}? Sus sesiones quedarán sin dueño.`)) return
    const res = await authFetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || 'No se pudo eliminar', variant: 'destructive' })
      return
    }
    toast({ title: 'Cuenta eliminada', description: u.email })
    await loadUsers()
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      {/* Formulario: crear cuenta interna */}
      <Card className="shadow-lg shadow-brand-100/50 border-brand-100">
        <CardHeader className="pb-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-1">
            <UserPlus className="h-6 w-6" />
          </span>
          <CardTitle className="text-xl">Crear usuario interno</CardTitle>
          <CardDescription>
            Genera cuentas de trainer o moderador. Esta opción solo es visible para el administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input
                id="u-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej.: Ana Martínez"
                maxLength={60}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Correo electrónico</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trainer@ejemplo.com"
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-pass">Contraseña temporal</Label>
              <Input
                id="u-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol de la cuenta</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'DOCENTE' | 'MODERADOR')}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Selecciona el rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOCENTE">Trainer — crea y gestiona sus sesiones</SelectItem>
                  <SelectItem value="MODERADOR">Moderador — apoya la gestión en vivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="lg" className="w-full min-h-11" disabled={busy}>
              <UserPlus className="h-5 w-5 mr-1.5" />
              {busy ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Listado de cuentas */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Cuentas registradas</h2>
        {users === null && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {users !== null && users.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center bg-card text-sm text-muted-foreground">
            Aún no hay cuentas creadas.
          </div>
        )}
        {users !== null && users.map((u) => {
          const rm = ROLE_META[u.role] || ROLE_META.DOCENTE
          return (
            <div key={u.id} className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{u.name}</p>
                  <Badge variant="secondary" className={`${rm.cls} shrink-0`}>{rm.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {u.email} · {u._count.sessions} {u._count.sessions === 1 ? 'sesión' : 'sesiones'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Cambiar rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="DOCENTE">Trainer</SelectItem>
                    <SelectItem value="MODERADOR">Moderador</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Restablecer contraseña"
                  onClick={() => resetPassword(u)}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                  title="Eliminar cuenta"
                  onClick={() => removeUser(u)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

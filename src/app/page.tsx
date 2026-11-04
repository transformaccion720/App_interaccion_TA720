'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import {
  CheckSquare,
  TrafficCone,
  Cloud,
  Network,
  MessageSquareText,
  Presentation,
  LogIn,
  Sparkles,
  QrCode,
  Users,
  LayoutDashboard,
} from 'lucide-react'
import { useState } from 'react'

const FEATURES = [
  {
    icon: CheckSquare,
    title: 'Opción múltiple',
    desc: 'Preguntas con opciones, selección única o múltiple y respuestas correctas opcionales.',
  },
  {
    icon: TrafficCone,
    title: 'Semáforo',
    desc: 'Los alumnos evalúan afirmaciones como válidas, parciales o no válidas y ves el consenso.',
  },
  {
    icon: Cloud,
    title: 'Nube de palabras',
    desc: 'Lluvia de palabras clave que se agrupa automáticamente en una nube en vivo.',
  },
  {
    icon: Network,
    title: 'Árbol de decisiones',
    desc: 'Los participantes recorren un árbol guiado con comentarios hasta una conclusión.',
  },
  {
    icon: MessageSquareText,
    title: 'Preguntas abiertas',
    desc: 'Recoge dudas y opiniones escritas, con adjuntos opcionales en cada pregunta.',
  },
  {
    icon: LayoutDashboard,
    title: 'Panel en vivo',
    desc: 'Asistentes conectados, quién respondió, quién no y resultados en tiempo real.',
  },
]

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)

  function goJoin(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 4) {
      toast({ title: 'Ingresa el código de tu sesión', variant: 'destructive' })
      return
    }
    router.push(`/join?code=${encodeURIComponent(clean)}`)
  }

  async function createDemo() {
    setCreating(true)
    try {
      const res = await fetch('/api/demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      router.push(`/admin/${data.id}?admin=${data.adminCode}`)
    } catch {
      toast({ title: 'No se pudo crear la demo', variant: 'destructive' })
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Encabezado */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg">
              A
            </span>
            <div>
              <p className="font-bold leading-none text-lg">AulaViva</p>
              <p className="text-xs text-muted-foreground">Participación en clase</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/join">
                <LogIn className="h-4 w-4 mr-1" /> Unirme
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin">
                <Presentation className="h-4 w-4 mr-1" /> Panel docente
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Héroe */}
        <section className="w-full bg-gradient-to-b from-teal-50 via-white to-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" /> Interacción en vivo para el aula
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                Tu clase participando, <span className="text-primary">en tiempo real</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                Comparte un código o código QR: tus alumnos entran desde el celular sin instalar nada.
                Pregunta, evalúa y decide en grupo con resultados instantáneos.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild size="lg" className="min-h-11">
                  <Link href="/admin">
                    <Presentation className="h-5 w-5 mr-2" />
                    Crear una sesión
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="min-h-11" onClick={createDemo} disabled={creating}>
                  {creating ? 'Creando…' : 'Probar con una demo'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 pt-2">
                <span className="flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-primary" /> Acceso por código o QR
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" /> Hasta 100 alumnos por sesión
                </span>
              </p>
            </div>

            {/* Tarjeta de acceso rápido para estudiantes */}
            <Card className="w-full max-w-md md:justify-self-end shadow-lg shadow-teal-100/60">
              <CardHeader>
                <CardTitle className="text-xl">¿Tienes un código?</CardTitle>
                <CardDescription>Únete a la sesión de tu profesor en dos pasos.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={goJoin} className="space-y-3">
                  <label htmlFor="quick-code" className="text-sm font-medium">
                    Código de la sesión
                  </label>
                  <Input
                    id="quick-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="h-14 text-center text-2xl font-bold tracking-[0.35em] uppercase"
                    autoComplete="off"
                  />
                  <Button type="submit" size="lg" className="w-full min-h-12 text-base">
                    <LogIn className="h-5 w-5 mr-2" />
                    Unirme a la sesión
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    También puedes escanear el código QR que proyecta tu profesor.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Características */}
        <section className="max-w-6xl mx-auto px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Cinco formas de participar
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
            Diseña cada pregunta a tu manera y combina formatos dentro de la misma sesión.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/80 hover:border-teal-300 transition-colors">
                <CardHeader className="pb-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700 mb-2">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="w-full bg-muted/50 border-t">
          <div className="max-w-6xl mx-auto px-4 py-14">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Cómo funciona</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: '1', t: 'Crea tu sesión', d: 'Registra las preguntas: opción múltiple, semáforo, nube de palabras, árbol de decisiones o abiertas, con imágenes de apoyo.' },
                { n: '2', t: 'Comparte código o QR', d: 'Los alumnos entran desde su celular con el código de 6 caracteres o escaneando el QR. Sin instalar nada.' },
                { n: '3', t: 'Conduce en vivo', d: 'Activa cada pregunta, mira quién responde en tiempo real y muestra los resultados cuando tú decidas.' },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl bg-white border p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg mb-3">
                    {s.n}
                  </span>
                  <h3 className="font-bold text-lg mb-1.5">{s.t}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="mt-auto border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            <span className="font-bold text-foreground">AulaViva</span> — participación en el aula en tiempo real
          </p>
          <div className="flex gap-4">
            <Link href="/join" className="hover:text-foreground">Unirme a una sesión</Link>
            <Link href="/admin" className="hover:text-foreground">Panel docente</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

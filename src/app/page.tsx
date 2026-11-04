'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLogo } from '@/components/aulaviva/brand-logo'
import { toast } from '@/hooks/use-toast'
import {
  CheckSquare,
  TrafficCone,
  Cloud,
  Network,
  MessageSquareText,
  ClipboardList,
  LogIn,
  Sparkles,
  QrCode,
  Users,
  LayoutDashboard,
  ShieldCheck,
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
    icon: ClipboardList,
    title: 'Diagnóstico situacional',
    desc: 'Bloques de preguntas mixtas —opciones, escala 1-5 y texto— con gráficos en vivo que se adaptan a las respuestas.',
    highlight: true,
  },
  {
    icon: MessageSquareText,
    title: 'Preguntas abiertas',
    desc: 'Recoge dudas y opiniones escritas, con adjuntos opcionales en cada pregunta.',
  },
]

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')

  function goJoin(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 4) {
      toast({ title: 'Ingresa el código de tu sesión', variant: 'destructive' })
      return
    }
    router.push(`/join?code=${encodeURIComponent(clean)}`)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Encabezado */}
      <header className="border-b bg-white/85 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-auto" />
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/join">
                <LogIn className="h-4 w-4 mr-1" /> Unirme
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4 mr-1" /> Panel docente
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Héroe corporativo */}
        <section className="relative w-full bg-carbon-950 text-white overflow-hidden">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,102,255,0.30),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(0,102,255,0.14),transparent_50%)]"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/10 border border-brand-300/25 text-brand-200 text-xs font-semibold px-3 py-1">
                <Sparkles className="h-3.5 w-3.5" /> Interacción en vivo para el aula
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1]">
                Tu clase participando,{' '}
                <span className="text-brand-300">en tiempo real</span>
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed max-w-xl">
                Comparte un código o código QR: tus alumnos entran desde el celular sin instalar
                nada ni crear cuentas. Diagnostica, pregunta y decide en grupo con resultados
                instantáneos.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild size="lg" className="min-h-11 bg-brand-500 hover:bg-brand-400 text-white font-semibold">
                  <Link href="/admin">
                    <ShieldCheck className="h-5 w-5 mr-2" />
                    Entrar como docente
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-slate-400 flex flex-wrap gap-x-5 gap-y-1.5 pt-2">
                <span className="flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-brand-300" /> Acceso por código o QR
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-brand-300" /> Hasta 100 alumnos por sesión
                </span>
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4 text-brand-300" /> Panel en vivo
                </span>
              </p>
            </div>

            {/* Tarjeta de acceso rápido para estudiantes */}
            <Card className="w-full max-w-md md:justify-self-end border-slate-700/60 bg-white text-foreground shadow-2xl shadow-brand-950/40">
              <CardHeader>
                <CardTitle className="text-xl">¿Tienes un código?</CardTitle>
                <CardDescription>Únete a la sesión de tu profesor. Sin cuenta.</CardDescription>
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
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Seis formas de participar
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
            Diseña cada pregunta a tu manera y combina formatos dentro de la misma sesión.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className={`border-border/80 hover:border-brand-300 transition-colors ${
                  f.highlight ? 'ring-1 ring-brand-200 bg-gradient-to-b from-brand-50/70 to-white' : ''
                }`}
              >
                <CardHeader className="pb-2">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl mb-2 ${
                      f.highlight ? 'bg-primary text-primary-foreground' : 'bg-brand-100 text-brand-800'
                    }`}
                  >
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
        <section className="w-full bg-muted/60 border-t">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Cómo funciona</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: '1', t: 'Crea tu sesión', d: 'Regístrate como docente y registra las preguntas: opción múltiple, semáforo, nube de palabras, árbol de decisiones, diagnóstico situacional o abiertas, con imágenes de apoyo.' },
                { n: '2', t: 'Comparte código o QR', d: 'Los alumnos entran desde su celular con el código de 6 caracteres o escaneando el QR. Sin cuentas ni instalaciones.' },
                { n: '3', t: 'Conduce en vivo', d: 'Activa cada pregunta, mira quién responde en tiempo real, qué personas faltan y muestra los resultados cuando tú decidas.' },
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
          <div className="flex items-center gap-2">
            <BrandLogo className="h-7 w-auto" />
          </div>
          <div className="flex gap-4">
            <Link href="/join" className="hover:text-foreground">Unirme a una sesión</Link>
            <Link href="/admin" className="hover:text-foreground">Panel docente</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

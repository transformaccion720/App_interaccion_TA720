'use client'

// /admin — crea una sesión nueva o abre una existente con el código de administrador
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, KeyRound, Presentation, Sparkles } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [max, setMax] = useState(100)
  const [creating, setCreating] = useState(false)

  const [adminCode, setAdminCode] = useState('')
  const [opening, setOpening] = useState(false)

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
        setCreating(false)
        return
      }
      router.push(`/admin/${data.id}?admin=${data.adminCode}`)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
      setCreating(false)
    }
  }

  async function openSession(e: React.FormEvent) {
    e.preventDefault()
    const code = adminCode.trim().toUpperCase()
    if (!code) {
      toast({ title: 'Ingresa tu código de administrador', variant: 'destructive' })
      return
    }
    setOpening(true)
    try {
      const res = await fetch('/api/sessions/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Código no válido', variant: 'destructive' })
        setOpening(false)
        return
      }
      router.push(`/admin/${data.id}?admin=${code}`)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
      setOpening(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50 to-white">
      <header className="px-4 py-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" /> Inicio
          </Link>
        </Button>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pb-16 grid md:grid-cols-2 gap-6 items-start">
        {/* Crear sesión */}
        <Card className="shadow-lg shadow-teal-100/50">
          <CardHeader>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-1">
              <Presentation className="h-6 w-6" />
            </span>
            <CardTitle className="text-xl">Crear una sesión</CardTitle>
            <CardDescription>
              Registra tus preguntas y comparte el código o QR con tus alumnos.
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
                  placeholder="Ej.: Clase 5 — Revolución Industrial"
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
                <p className="text-xs text-muted-foreground">Por defecto 100 alumnos.</p>
              </div>
              <Button type="submit" size="lg" className="w-full min-h-11" disabled={creating}>
                {creating ? 'Creando…' : 'Crear sesión'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Abrir existente */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700 mb-1">
                <KeyRound className="h-6 w-6" />
              </span>
              <CardTitle className="text-xl">Abrir mi sesión</CardTitle>
              <CardDescription>
                Ingresa el código de administrador que se te dio al crear la sesión.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={openSession} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-code">Código de administrador</Label>
                  <Input
                    id="admin-code"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEFGH"
                    maxLength={8}
                    className="h-14 text-center text-xl font-bold tracking-[0.3em] uppercase"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" variant="outline" size="lg" className="w-full min-h-11" disabled={opening}>
                  {opening ? 'Buscando…' : 'Abrir panel de gestión'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> ¿Primera vez?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Crea una sesión de demostración con los 5 tipos de preguntas ya configuradas y pruébala
                desde el celular como si fueras un alumno.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  toast({ title: 'Usa el botón «Probar con una demo» en la página de inicio', description: 'Allí creamos la sesión por ti.' })
                }}
                asChild
              >
                <Link href="/">Ir a la demo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="mt-auto border-t bg-white py-4 text-center text-xs text-muted-foreground">
        <Separator className="mb-4" />
        AulaViva — panel docente
      </footer>
    </div>
  )
}

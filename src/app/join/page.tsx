'use client'

// /join — el alumno ingresa el código y su nombre para unirse a la sesión
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLogo } from '@/components/aulaviva/brand-logo'
import { toast } from '@/hooks/use-toast'
import { LogIn, ArrowLeft } from 'lucide-react'

function JoinForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  // Precarga el código tras el montaje si viene por la URL (?code=XXXX) —
  // típico al escanear el QR. Se lee después de hidratar para evitar
  // discrepancias entre el HTML del servidor y el primer render del cliente.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code')
    if (fromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de un sistema externo (URL del navegador)
      setCode(fromUrl.toUpperCase())
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    const cleanName = name.trim()
    if (cleanCode.length < 4) {
      toast({ title: 'Ingresa el código de la sesión', variant: 'destructive' })
      return
    }
    if (!cleanName) {
      toast({ title: 'Ingresa tu nombre', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: cleanCode, name: cleanName }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'No se pudo unir a la sesión', variant: 'destructive' })
        setLoading(false)
        return
      }
      // Guarda el token del participante por código y por sesión
      localStorage.setItem(`aulaviva:t:${cleanCode}`, data.token)
      localStorage.setItem(`aulaviva:p:${data.sessionId}`, data.token)
      localStorage.setItem(`aulaviva:name:${data.sessionId}`, cleanName)
      router.push(`/s/${cleanCode}`)
    } catch {
      toast({ title: 'Error de conexión. Intenta de nuevo.', variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg shadow-brand-100/50">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Unirme a una sesión</CardTitle>
        <CardDescription>Ingresa el código que te compartió tu profesor</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="join-code" className="text-sm font-medium">
              Código de la sesión
            </label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="h-14 text-center text-2xl font-bold tracking-[0.35em] uppercase"
              autoComplete="off"
              autoFocus={!code}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="join-name" className="text-sm font-medium">
              Tu nombre
            </label>
            <Input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: María Pérez"
              maxLength={40}
              className="h-12 text-base"
              autoComplete="off"
              autoFocus={!!code}
            />
          </div>
          <Button type="submit" size="lg" className="w-full min-h-12 text-base" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Entrando…
              </span>
            ) : (
              <>
                <LogIn className="h-5 w-5 mr-1" /> Entrar a la sesión
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex flex-col bg-claro">
      <header className="px-4 py-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" /> Inicio
          </Link>
        </Button>
        <BrandLogo className="h-8 w-auto" />
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <Suspense fallback={null}>
          <JoinForm />
        </Suspense>
      </main>
      <footer className="mt-auto py-4 text-center text-xs text-muted-foreground">
        Transform Acción 720 — participación en el aula en tiempo real
      </footer>
    </div>
  )
}

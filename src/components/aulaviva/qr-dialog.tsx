'use client'

// Diálogo con el código de acceso y su QR — listo para proyectar en clase
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode, Copy, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function QrDialog({ joinCode, title }: { joinCode: string; title: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // El enlace se calcula en el render: el contenido del diálogo solo se monta en el cliente
  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/join?code=${joinCode}` : ''

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`${joinUrl}`, {
      width: 480,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [joinUrl])

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      toast({ title: 'Enlace copiado al portapapeles' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-1.5" /> Invitar con QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invita a tus alumnos</DialogTitle>
          <DialogDescription>
            Proyecta esta pantalla o comparte el enlace. Entran con el código, sin instalar nada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-b from-brand-50 to-white border p-6 text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Entra en <span className="text-brand-700">{typeof window !== 'undefined' ? window.location.host : ''}</span> y usa el código
            </p>
            <p className="text-5xl font-black tracking-[0.2em] text-brand-700">{joinCode}</p>
            <p className="text-sm text-muted-foreground truncate">«{title}»</p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt={`Código QR para unirse a la sesión ${joinCode}`} className="mx-auto rounded-xl border bg-white w-52 h-52" />
            )}
            {!qrDataUrl && <div className="mx-auto rounded-xl border bg-white w-52 h-52 animate-pulse" aria-label="Generando QR" />}
          </div>
          <Button variant="outline" className="w-full" onClick={copyJoinUrl}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? '¡Copiado!' : 'Copiar enlace de acceso'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

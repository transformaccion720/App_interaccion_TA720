'use client'

// Pestaña "Asistentes": tabla de participantes con estado de conexión y actividad.
import type { AdminLive } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { relativeTime } from '@/lib/codes'
import { UserRound, UserRoundX } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ParticipantsTab({ live, onKick }: { live: AdminLive; onKick: (id: string, name: string) => void }) {
  const ps = [...live.participants].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Badge variant="secondary" className="px-3 py-1.5 text-sm">
          {ps.length} registrado{ps.length === 1 ? '' : 's'}
        </Badge>
        <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800">
          {live.onlineCount} en línea
        </Badge>
        <Badge variant="secondary" className="px-3 py-1.5 text-sm">
          Máx.: {live.session.maxParticipants}
        </Badge>
      </div>

      {ps.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center bg-card space-y-2">
          <UserRound className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no se ha unido nadie. Comparte el código{' '}
            <span className="font-bold text-foreground tracking-wider">{live.session.joinCode}</span> o el QR.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asistente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pregunta activa</TableHead>
                  <TableHead className="text-right">Respuestas</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ps.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.online ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          En línea
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          Desconectado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {live.activeQuestion ? (
                        p.answeredActive ? (
                          <span className="text-emerald-700 font-medium text-sm">Respondió</span>
                        ) : (
                          <span className="text-amber-600 font-medium text-sm">Pendiente</span>
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.totalAnswers}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{relativeTime(p.lastSeenAt, live.serverNow)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onKick(p.id, p.name)}
                        aria-label={`Eliminar a ${p.name} de la sesión`}
                        title="Eliminar de la sesión"
                      >
                        <UserRoundX className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

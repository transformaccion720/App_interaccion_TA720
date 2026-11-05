// POST /api/join — un participante se une a una sesión con el código de acceso
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const joinCode = String(body.joinCode || '').trim().toUpperCase()
    const name = String(body.name || '').trim()

    if (!joinCode) return jsonError('Ingresa el código de la sesión')
    if (!name) return jsonError('Ingresa tu nombre')
    if (name.length > 40) return jsonError('El nombre es demasiado largo (máx. 40)')

    const session = await db.session.findUnique({
      where: { joinCode },
      include: { _count: { select: { participants: true } } },
    })
    if (!session) return jsonError('No existe una sesión con ese código', 404)
    if (session.status === 'closed') return jsonError('Esta sesión ya finalizó', 409)
    if (session._count.participants >= session.maxParticipants) {
      return jsonError(`La sesión está llena (máx. ${session.maxParticipants} participantes)`, 409)
    }

    const token = randomUUID()
    const participant = await db.participant.create({
      data: { sessionId: session.id, name, token },
    })

    return Response.json({
      token,
      participantId: participant.id,
      sessionId: session.id,
      sessionTitle: session.title,
    })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

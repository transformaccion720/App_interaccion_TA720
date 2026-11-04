// POST /api/questions/[id]/answer — registra o actualiza la respuesta de un participante
import { db } from '@/lib/db'
import { jsonError, maybeAutoClose } from '@/lib/api-helpers'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const token = String(body.token || '')
    if (!token) return jsonError('Sesión de participante no válida', 401)

    const participant = await db.participant.findUnique({ where: { token } })
    if (!participant) return jsonError('Participante no encontrado. Vuelve a unirte.', 401)

    const question = await db.question.findUnique({ where: { id } })
    if (!question || question.sessionId !== participant.sessionId) {
      return jsonError('Pregunta no encontrada', 404)
    }

    const question2 = await maybeAutoClose(question)
    if (question2.state !== 'open') {
      return jsonError('La pregunta no está abierta para respuestas', 409)
    }

    if (!body.payload || typeof body.payload !== 'object') {
      return jsonError('Respuesta inválida')
    }

    const payload = JSON.stringify(body.payload)
    await db.answer.upsert({
      where: {
        questionId_participantId: {
          questionId: id,
          participantId: participant.id,
        },
      },
      create: { questionId: id, participantId: participant.id, payload },
      update: { payload },
    })

    // Señal de vida
    await db.participant.update({
      where: { id: participant.id },
      data: { lastSeenAt: new Date() },
    })

    return Response.json({ ok: true })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

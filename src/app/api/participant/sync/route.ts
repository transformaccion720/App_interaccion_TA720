// POST /api/participant/sync — latido + estado actual para el participante
import { db } from '@/lib/db'
import { jsonError, maybeAutoClose } from '@/lib/api-helpers'
import { aggregateResults, parseConfig, parsePayload } from '@/lib/aggregate'
import type {
  ParticipantSync,
  QuestionConfig,
  QuestionPublic,
  QuestionResults,
  QuestionType,
} from '@/lib/types'
import type { Answer, Question } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const token = String(body.token || '')
    if (!token) return jsonError('Falta el identificador del participante', 401)

    const participant = await db.participant.findUnique({
      where: { token },
      include: { session: true },
    })
    if (!participant) return jsonError('Participante no encontrado. Vuelve a unirte.', 404)

    // Latido
    await db.participant.update({
      where: { id: participant.id },
      data: { lastSeenAt: new Date() },
    })

    // Pregunta activa (abierta o recién mostrada/cerrada)
    const questions = await db.question.findMany({
      where: { sessionId: participant.sessionId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    // Si hay una revelada, es la que se muestra con resultados; si no, la abierta
    const activeRaw =
      questions.find((q) => q.state === 'open') ||
      questions.find((q) => q.state === 'revealed') ||
      null
    const active = activeRaw ? await maybeAutoClose(activeRaw) : null

    let question: QuestionPublic | null = null
    let config: QuestionConfig | null = null
    let myAnswer: ParticipantSync['myAnswer'] = null
    let results: QuestionResults | null = null

    if (active) {
      question = {
        id: active.id,
        order: active.order,
        title: active.title,
        description: active.description,
        imageUrl: active.imageUrl,
        type: active.type as QuestionType,
        state: active.state as QuestionPublic['state'],
        timerSeconds: active.timerSeconds,
        openedAt: active.openedAt ? active.openedAt.toISOString() : null,
      }
      config = parseConfig<QuestionConfig>(active)

      const mine = await db.answer.findUnique({
        where: { questionId_participantId: { questionId: active.id, participantId: participant.id } },
      })
      if (mine) myAnswer = parsePayload(mine)

      if (active.state === 'revealed') {
        const answers = await answersFor(active)
        results = aggregateResults(active.type as QuestionType, active.config, answers)
      }
    }

    const [answeredCount, totalParticipants] = await Promise.all([
      active
        ? db.answer.count({ where: { questionId: active.id } })
        : Promise.resolve(0),
      db.participant.count({ where: { sessionId: participant.sessionId } }),
    ])

    const response: ParticipantSync = {
      session: {
        id: participant.session.id,
        title: participant.session.title,
        status: participant.session.status as ParticipantSync['session']['status'],
      },
      participantName: participant.name,
      question,
      config,
      myAnswer,
      results,
      answeredCount,
      totalParticipants,
      serverNow: new Date().toISOString(),
    }

    return Response.json(response)
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

// Helper local: respuestas con nombre del participante
async function answersFor(question: Question) {
  const rows: Answer[] = await db.answer.findMany({ where: { questionId: question.id } })
  const participants = await db.participant.findMany({
    where: { sessionId: question.sessionId },
    select: { id: true, name: true },
  })
  const nameById = new Map(participants.map((p) => [p.id, p.name]))
  return rows.map((r) => ({
    payload: r.payload,
    participantName: nameById.get(r.participantId),
    updatedAt: r.updatedAt,
  }))
}

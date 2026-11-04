// POST /api/sessions/[id]/live — panel en vivo del administrador (latidos de asistentes, resultados)
import { db } from '@/lib/db'
import { jsonError, verifyAdminAccess, maybeAutoClose } from '@/lib/api-helpers'
import { aggregateResults, parseConfig } from '@/lib/aggregate'
import { ONLINE_WINDOW_MS } from '@/lib/codes'
import type {
  AdminLive,
  QuestionAdmin,
  QuestionConfig,
  QuestionResults,
  QuestionType,
} from '@/lib/types'
import type { Question } from '@prisma/client'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const adminCode = body.adminCode || req.headers.get('x-admin-code')
    const session = await verifyAdminAccess(id, adminCode)
    if (!session) return jsonError('No autorizado', 401)

    const [participants, questions] = await Promise.all([
      db.participant.findMany({
        where: { sessionId: id },
        orderBy: { createdAt: 'asc' },
      }),
      db.question.findMany({
        where: { sessionId: id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: { answers: { include: { participant: { select: { name: true } } } } },
      }),
    ])

    // Normaliza temporizadores vencidos
    const normalized: Question[] = []
    for (const q of questions) {
      normalized.push(await maybeAutoClose(q))
    }

    const now = Date.now()
    const onlineCount = participants.filter(
      (p) => now - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS
    ).length

    // Pregunta activa: abierta primero; si no, la revelada; si no, la última cerrada con actividad
    const active =
      normalized.find((q) => q.state === 'open') ||
      normalized.find((q) => q.state === 'revealed') ||
      null

    const questionAdmins: QuestionAdmin[] = normalized.map((q) => ({
      id: q.id,
      order: q.order,
      title: q.title,
      description: q.description,
      imageUrl: q.imageUrl,
      type: q.type as QuestionType,
      state: q.state as QuestionAdmin['state'],
      timerSeconds: q.timerSeconds,
      openedAt: q.openedAt ? q.openedAt.toISOString() : null,
      config: parseConfig<QuestionConfig>(q),
      answeredCount: q.answers.length,
    }))

    let activeQuestion: QuestionAdmin | null = null
    let activeResults: QuestionResults | null = null
    const answeredIds = new Set<string>()

    // Resultados agregados de TODAS las preguntas (para la pestaña de resultados)
    const resultsByQuestion: Record<string, QuestionResults> = {}
    for (const q of normalized) {
      if (q.answers.length === 0) continue
      const agg = aggregateResults(
        q.type as QuestionType,
        q.config,
        q.answers.map((a) => ({
          payload: a.payload,
          participantName: a.participant.name,
          updatedAt: a.updatedAt,
        }))
      )
      if (agg) resultsByQuestion[q.id] = agg
    }

    if (active) {
      const activeAdmin = questionAdmins.find((q) => q.id === active.id) || null
      activeQuestion = activeAdmin
      activeResults = resultsByQuestion[active.id] || null
      for (const a of active.answers) answeredIds.add(a.participantId)
    }

    // Respuestas por participante (total)
    const answersByParticipant = new Map<string, number>()
    for (const q of normalized) {
      for (const a of q.answers) {
        answersByParticipant.set(a.participantId, (answersByParticipant.get(a.participantId) || 0) + 1)
      }
    }

    const participantViews = participants.map((p) => ({
      id: p.id,
      name: p.name,
      online: now - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
      lastSeenAt: p.lastSeenAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      answeredActive: answeredIds.has(p.id),
      totalAnswers: answersByParticipant.get(p.id) || 0,
    }))

    const notAnsweredActive = active
      ? participants
          .filter((p) => !answeredIds.has(p.id))
          .map((p) => p.name)
          .sort((a, b) => a.localeCompare(b))
      : []

    const response: AdminLive = {
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        joinCode: session.joinCode,
        adminCode: session.adminCode,
        maxParticipants: session.maxParticipants,
        status: session.status as AdminLive['session']['status'],
      },
      participants: participantViews,
      onlineCount,
      questions: questionAdmins,
      activeQuestion,
      activeResults,
      resultsByQuestion,
      notAnsweredActive,
      serverNow: new Date().toISOString(),
    }

    return Response.json(response)
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

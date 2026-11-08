// GET  /api/sessions/[id]/manage — datos completos para editar (requiere adminCode)
// PUT  /api/sessions/[id]/manage — actualiza sesión y orden de preguntas
import { db } from '@/lib/db'
import { jsonError, verifyAdmin, verifyAdminAccess } from '@/lib/api-helpers'
import { parseConfig } from '@/lib/aggregate'
import type { QuestionAdmin, QuestionConfig, QuestionType } from '@/lib/types'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminCode = req.headers.get('x-admin-code')
  const session = await verifyAdminAccess(id, adminCode)
  if (!session) return jsonError('No autorizado', 401)

  const [questions, participantCount] = await Promise.all([
    db.question.findMany({
      where: { sessionId: id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { answers: true } } },
    }),
    db.participant.count({ where: { sessionId: id } }),
  ])

  const questionList: QuestionAdmin[] = questions.map((q) => ({
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
    answeredCount: q._count.answers,
  }))

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      description: session.description,
      joinCode: session.joinCode,
      adminCode: session.adminCode,
      maxParticipants: session.maxParticipants,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      scheduledAt: session.scheduledAt ? session.scheduledAt.toISOString() : null,
      archivedAt: session.archivedAt ? session.archivedAt.toISOString() : null,
    },
    questions: questionList,
    participantCount,
  })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminCode = req.headers.get('x-admin-code')
  const session = await verifyAdminAccess(id, adminCode)
  if (!session) return jsonError('No autorizado', 401)

  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
    if ('description' in body) data.description = body.description ? String(body.description) : null
    if ('status' in body && ['draft', 'live', 'closed'].includes(body.status)) data.status = body.status
    if ('scheduledAt' in body) {
      // null/'' borra la fecha; una cadena válida la actualiza.
      if (body.scheduledAt === null || body.scheduledAt === '') {
        data.scheduledAt = null
      } else {
        const d = new Date(String(body.scheduledAt))
        if (Number.isNaN(d.getTime())) return jsonError('La fecha de la sesión no es válida')
        data.scheduledAt = d
      }
    }
    if ('archivedAt' in body) {
      // null/'' restaura la sesión; una fecha válida la archiva.
      if (body.archivedAt === null || body.archivedAt === '') {
        data.archivedAt = null
      } else {
        const d = new Date(String(body.archivedAt))
        if (Number.isNaN(d.getTime())) return jsonError('La fecha de archivado no es válida')
        data.archivedAt = d
      }
    }
    if ('maxParticipants' in body) {
      data.maxParticipants = Math.min(500, Math.max(2, Number(body.maxParticipants) || 100))
    }
    if (Array.isArray(body.questionOrder)) {
      // Reordena según la lista de ids recibida
      const orderIds: string[] = body.questionOrder
      await Promise.all(
        orderIds.map((qid: string, idx: number) =>
          db.question.updateMany({ where: { id: qid, sessionId: id }, data: { order: idx } })
        )
      )
    }

    const updated = await db.session.update({ where: { id }, data })
    return Response.json({ ok: true, status: updated.status, title: updated.title })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

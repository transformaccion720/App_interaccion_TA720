// GET  /api/sessions — lista las sesiones del docente autenticado (más recientes primero)
// POST /api/sessions — crea una nueva sesión (asociada al docente si inició sesión)
import { db } from '@/lib/db'
import { generateCode } from '@/lib/codes'
import { jsonError } from '@/lib/api-helpers'
import { getAuthTeacher } from '@/lib/auth'

export async function GET() {
  const teacher = await getAuthTeacher()
  if (!teacher) return jsonError('No autenticado', 401)

  const sessions = await db.session.findMany({
    where: { teacherId: teacher.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      joinCode: true,
      status: true,
      maxParticipants: true,
      createdAt: true,
      scheduledAt: true,
      updatedAt: true,
      _count: { select: { questions: true, participants: true } },
    },
  })

  return Response.json({ sessions })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    const description = body.description ? String(body.description).trim() : null
    const maxParticipants = Math.min(500, Math.max(2, Number(body.maxParticipants) || 100))
    // Fecha programada de la sesión (opcional). null/'' → sin fecha.
    let scheduledAt: Date | null = null
    if (body.scheduledAt !== undefined && body.scheduledAt !== null && body.scheduledAt !== '') {
      scheduledAt = new Date(String(body.scheduledAt))
      if (Number.isNaN(scheduledAt.getTime())) {
        return jsonError('La fecha de la sesión no es válida')
      }
    }

    if (!title) return jsonError('El título es obligatorio')
    if (title.length > 120) return jsonError('El título es demasiado largo')

    const teacher = await getAuthTeacher()

    // Genera códigos únicos
    let joinCode = ''
    let adminCode = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      const jc = generateCode(6)
      const ac = generateCode(8)
      const [existsJ, existsA] = await Promise.all([
        db.session.findUnique({ where: { joinCode: jc } }),
        db.session.findUnique({ where: { adminCode: ac } }),
      ])
      if (!existsJ && !existsA) {
        joinCode = jc
        adminCode = ac
        break
      }
    }
    if (!joinCode) return jsonError('No se pudo generar un código único, intenta de nuevo', 500)

    const session = await db.session.create({
      data: {
        title,
        description,
        joinCode,
        adminCode,
        maxParticipants,
        status: 'draft',
        // Nota: createdAt se guarda automáticamente (fecha de creación).
        ...(scheduledAt ? { scheduledAt } : {}),
        teacherId: teacher?.id || null,
      },
    })

    return Response.json({
      id: session.id,
      title: session.title,
      joinCode: session.joinCode,
      adminCode: session.adminCode,
      maxParticipants: session.maxParticipants,
      createdAt: session.createdAt.toISOString(),
      scheduledAt: session.scheduledAt ? session.scheduledAt.toISOString() : null,
    })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

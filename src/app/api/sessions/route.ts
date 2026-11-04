// POST /api/sessions — crea una nueva sesión
import { db } from '@/lib/db'
import { generateCode } from '@/lib/codes'
import { jsonError } from '@/lib/api-helpers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    const description = body.description ? String(body.description).trim() : null
    const maxParticipants = Math.min(500, Math.max(2, Number(body.maxParticipants) || 100))

    if (!title) return jsonError('El título es obligatorio')
    if (title.length > 120) return jsonError('El título es demasiado largo')

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
      data: { title, description, joinCode, adminCode, maxParticipants, status: 'draft' },
    })

    return Response.json({
      id: session.id,
      title: session.title,
      joinCode: session.joinCode,
      adminCode: session.adminCode,
      maxParticipants: session.maxParticipants,
    })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

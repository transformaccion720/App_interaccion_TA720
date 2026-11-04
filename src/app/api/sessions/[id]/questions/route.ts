// POST /api/sessions/[id]/questions — crea una pregunta
import { db } from '@/lib/db'
import { jsonError, verifyAdmin } from '@/lib/api-helpers'

const VALID_TYPES = ['multiple_choice', 'semaforo', 'word_cloud', 'decision_tree', 'open_text']

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminCode = req.headers.get('x-admin-code')
  const session = await verifyAdmin(id, adminCode)
  if (!session) return jsonError('No autorizado', 401)

  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    const type = String(body.type || '')
    const description = body.description ? String(body.description).trim() : null
    const imageUrl = body.imageUrl ? String(body.imageUrl) : null
    const timerSeconds = body.timerSeconds ? Math.max(5, Math.min(3600, Number(body.timerSeconds))) : null

    if (!title) return jsonError('El enunciado es obligatorio')
    if (!VALID_TYPES.includes(type)) return jsonError('Tipo de pregunta no válido')

    const config = body.config && typeof body.config === 'object' ? JSON.stringify(body.config) : '{}'

    // Valida límite de imagen (data URL) — máximo ~1.8 MB
    if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 2_400_000) {
      return jsonError('La imagen es demasiado grande (máx. ~1.5 MB). Usa una URL externa.', 413)
    }

    const last = await db.question.findFirst({
      where: { sessionId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const question = await db.question.create({
      data: {
        sessionId: id,
        title,
        description,
        imageUrl,
        type,
        config,
        timerSeconds,
        order: (last?.order ?? -1) + 1,
      },
    })

    return Response.json({ id: question.id })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

// PUT    /api/questions/[id] — actualiza pregunta (contenido, configuración o estado)
// DELETE /api/questions/[id] — elimina pregunta y sus respuestas
import { db } from '@/lib/db'
import { jsonError, verifyAdmin, maybeAutoClose } from '@/lib/api-helpers'

const VALID_STATES = ['pending', 'open', 'revealed', 'closed']
const VALID_TYPES = ['multiple_choice', 'semaforo', 'word_cloud', 'decision_tree', 'open_text']

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()

    const question = await db.question.findUnique({ where: { id } })
    if (!question) return jsonError('Pregunta no encontrada', 404)

    const adminCode = req.headers.get('x-admin-code')
    const session = await verifyAdmin(question.sessionId, adminCode)
    if (!session) return jsonError('No autorizado', 401)

    const data: Record<string, unknown> = {}

    // ---- Cambio de estado (activar / mostrar resultados / cerrar) ----
    if ('state' in body) {
      if (!VALID_STATES.includes(body.state)) return jsonError('Estado no válido')
      data.state = body.state
      if (body.state === 'open') {
        data.openedAt = new Date()
        // Al activar una pregunta, las demás vuelven a pendiente/cerrado
        await db.question.updateMany({
          where: { sessionId: question.sessionId, state: 'open' },
          data: { state: 'closed' },
        })
        // La sesión pasa a "live" si estaba en borrador
        if (session.status === 'draft') {
          await db.session.update({ where: { id: session.id }, data: { status: 'live' } })
        }
      }
      if (body.state === 'revealed' && question.state === 'pending') {
        return jsonError('Primero debes activar la pregunta', 400)
      }
    }

    // ---- Contenido ----
    if ('title' in body && String(body.title).trim()) data.title = String(body.title).trim()
    if ('description' in body) data.description = body.description ? String(body.description) : null
    if ('imageUrl' in body) {
      const imageUrl = body.imageUrl ? String(body.imageUrl) : null
      if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 2_400_000) {
        return jsonError('La imagen es demasiado grande (máx. ~1.5 MB)', 413)
      }
      data.imageUrl = imageUrl
    }
    if ('timerSeconds' in body) {
      data.timerSeconds = body.timerSeconds
        ? Math.max(5, Math.min(3600, Number(body.timerSeconds)))
        : null
    }
    if ('config' in body && body.config && typeof body.config === 'object') {
      data.config = JSON.stringify(body.config)
    }
    if ('type' in body && VALID_TYPES.includes(body.type)) data.type = body.type

    const updated = await db.question.update({ where: { id }, data })
    const normalized = await maybeAutoClose(updated)
    return Response.json({ ok: true, state: normalized.state })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const question = await db.question.findUnique({ where: { id } })
  if (!question) return jsonError('Pregunta no encontrada', 404)

  const adminCode = req.headers.get('x-admin-code')
  const session = await verifyAdmin(question.sessionId, adminCode)
  if (!session) return jsonError('No autorizado', 401)

  await db.question.delete({ where: { id } })
  return Response.json({ ok: true })
}

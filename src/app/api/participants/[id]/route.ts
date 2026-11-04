// DELETE /api/participants/[id] — el docente elimina a un participante de la sesión
import { db } from '@/lib/db'
import { jsonError, verifyAdmin } from '@/lib/api-helpers'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const adminCode = req.headers.get('x-admin-code') || url.searchParams.get('admin')

  const participant = await db.participant.findUnique({ where: { id } })
  if (!participant) return jsonError('Participante no encontrado', 404)

  const session = await verifyAdmin(participant.sessionId, adminCode)
  if (!session) return jsonError('No autorizado', 401)

  await db.participant.delete({ where: { id } })
  return Response.json({ ok: true })
}

// POST /api/sessions/lookup — localiza una sesión con el código de administrador
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const adminCode = String(body.adminCode || '').trim().toUpperCase()
    if (!adminCode) return jsonError('Ingresa tu código de administrador')

    const session = await db.session.findUnique({ where: { adminCode } })
    if (!session) return jsonError('Código de administrador no válido', 404)

    return Response.json({ id: session.id, title: session.title })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

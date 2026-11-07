// POST /api/auth/login — inicia sesión del docente y deja la cookie de sesión
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import {
  verifyPassword,
  createSessionToken,
  sessionCookieString,
} from '@/lib/auth'

export async function POST(req: Request) {
  // Cuerpo: parseo separado para no confundir un JSON roto con un error interno
  let body: { email?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError('Ingresa tu correo y contraseña', 400)
  }

  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  if (!email || !password) return jsonError('Ingresa tu correo y contraseña', 400)

  try {
    const teacher = await db.teacher.findUnique({ where: { email } })
    if (!teacher || !verifyPassword(password, teacher.passwordHash)) {
      return jsonError('Correo o contraseña incorrectos', 401)
    }

    const token = createSessionToken(teacher)

    const res = Response.json({
      ok: true,
      // Token también en el cuerpo: el cliente lo guarda en localStorage y lo
      // envía como Bearer cuando las cookies de terceros están bloqueadas
      // (p. ej. dentro de un iframe de vista previa). Así la sesión no se cae.
      token,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        role: teacher.role || 'DOCENTE',
      },
    })
    const headers = new Headers(res.headers)
    // Cookie con SameSite=None+Secure en HTTPS (funciona en iframes embebidos)
    headers.append('Set-Cookie', sessionCookieString(req, token))
    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    console.error('[login] error:', err)
    // Diagnóstico visible (sin secretos): la causa real va en la respuesta para
    // poder depurar un deploy (p. ej. "Environment variable not found: DATABASE_URL",
    // cliente SQLite vs PostgreSQL, o BD inalcanzable).
    const detalle = err instanceof Error ? err.message.slice(0, 220) : 'desconocido'
    return Response.json(
      { error: 'Solicitud inválida', causa: 'configuracion-servidor', detalle },
      { status: 400 },
    )
  }
}

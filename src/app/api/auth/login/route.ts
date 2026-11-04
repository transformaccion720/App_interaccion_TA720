// POST /api/auth/login — inicia sesión del docente y deja la cookie de sesión
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import {
  verifyPassword,
  createSessionToken,
  sessionCookieString,
} from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) return jsonError('Ingresa tu correo y contraseña')

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
    return jsonError('Solicitud inválida', 400)
  }
}

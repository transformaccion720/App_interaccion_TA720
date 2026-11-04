// POST /api/auth/login — inicia sesión del docente y deja la cookie de sesión
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

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

    const res = Response.json({
      ok: true,
      teacher: { id: teacher.id, email: teacher.email, name: teacher.name },
    })
    const headers = new Headers(res.headers)
    headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${createSessionToken(teacher)}; Path=${SESSION_COOKIE_OPTIONS.path}; Max-Age=${SESSION_COOKIE_OPTIONS.maxAge}; HttpOnly; SameSite=Lax${SESSION_COOKIE_OPTIONS.secure ? '; Secure' : ''}`
    )
    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    console.error('[login] error:', err)
    return jsonError('Solicitud inválida', 400)
  }
}

// POST /api/auth/register — crea una cuenta docente nueva (email + contraseña)
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import { hashPassword, createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!name) return jsonError('Ingresa tu nombre')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Ingresa un correo válido')
    if (password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres')

    const exists = await db.teacher.findUnique({ where: { email } })
    if (exists) return jsonError('Ya existe una cuenta con ese correo', 409)

    const teacher = await db.teacher.create({
      data: { name, email, passwordHash: hashPassword(password) },
    })

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
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

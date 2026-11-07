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
    const msg = detalle.toLowerCase()
    let pista =
      'Error interno del servidor. Abre /api/health en el navegador para ver el estado del deploy.'
    if (/environment variable not found/.test(msg)) {
      const varName = (detalle.match(/Environment variable not found: (\w+)/i)?.[1] || 'DATABASE_URL').toUpperCase()
      pista = `La variable ${varName} no está configurada en este entorno de Vercel. Añádela en Settings → Environment Variables (marca Production Y Preview) y vuelve a desplegar.`
    } else if (/malformed|invalid|cannot parse|failed to parse|error parsing|couldn'?t parse/.test(msg)) {
      pista = 'La cadena de conexión no es válida. Casi siempre ocurre si el valor se pegó con comillas: en Vercel pega el valor SIN comillas y sin espacios extra.'
    } else if (/can'?t reach database|p1001|etimedout|econnrefused|connection terminated|too many connections/.test(msg)) {
      pista = 'No se pudo conectar a la base de datos. Verifica DATABASE_URL: debe incluir usuario, contraseña, host -pooler con .c-2, /neondb y ?sslmode=require. El diagnóstico (/api/health → db.tienePassword / db.nombreBD) muestra si el valor quedó incompleto.'
    } else if (/does not exist|p2021|p2022|table|relation/.test(msg)) {
      pista = 'La base de datos no tiene las tablas. Aplica el esquema: npx prisma db push usando la DIRECT_URL.'
    } else if (/sqlite|file:/.test(msg)) {
      pista = 'El deploy generó el cliente SQLite en vez de PostgreSQL. Asegúrate de que el último commit esté desplegado (vercel-build regenera el cliente).'
    }
    return Response.json(
      { error: 'Solicitud inválida', causa: 'configuracion-servidor', detalle, pista },
      { status: 400 },
    )
  }
}

// POST /api/auth/logout — cierra la sesión del docente
import { clearSessionCookieString } from '@/lib/auth'

export async function POST(req: Request) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  // Borra la cookie con los mismos atributos con los que se creó
  headers.append('Set-Cookie', clearSessionCookieString(req))
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

// POST /api/auth/logout — cierra la sesión del docente
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  const headers = new Headers()
  headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` },
  })
}

// Autenticación del panel docente: contraseñas con scrypt y sesión
// firmada (HMAC-SHA256) guardada en una cookie httpOnly.
// Los participantes no usan login: entran con el código o QR de la sesión.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'aulaviva_session'
const SESSION_DAYS = 30

function secret(): string {
  return process.env.AUTH_SECRET || 'aulaviva-dev-secret-cambiar-en-produccion'
}

// ---------- Atributos de la cookie (compatibles con iframes) ----------

// Detecta si la petición llega por HTTPS (directo o detrás de un proxy).
function isHttps(req: Request): boolean {
  const proto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase()
  if (proto) return proto === 'https'
  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

/*
 * IMPORTANTE: con SameSite=Lax el navegador NO envía la cookie cuando la
 * plataforma se usa embebida en un iframe (p. ej. la vista previa). Eso hacía
 * que la sesión se cerrara justo después de entrar. En HTTPS usamos
 * SameSite=None + Secure (válida también dentro de iframes); en HTTP local
 * mantenemos Lax porque los navegadores rechazan None sin Secure.
 */
export function sessionCookieString(req: Request, token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_DAYS * 24 * 3600}`,
    'HttpOnly',
  ]
  parts.push(isHttps(req) ? 'SameSite=None; Secure' : 'SameSite=Lax')
  return parts.join('; ')
}

export function clearSessionCookieString(req: Request): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly']
  parts.push(isHttps(req) ? 'SameSite=None; Secure' : 'SameSite=Lax')
  return parts.join('; ')
}

// ---------- Contraseñas ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// ---------- Token de sesión firmado ----------

export interface TeacherTokenPayload {
  sub: string
  email: string
  name: string
  exp: number // epoch en segundos
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signToken(payload: TeacherTokenPayload): string {
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token: string | undefined | null): TeacherTokenPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TeacherTokenPayload
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function createSessionToken(teacher: { id: string; email: string; name: string }): string {
  return signToken({
    sub: teacher.id,
    email: teacher.email,
    name: teacher.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600,
  })
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 3600,
  secure: process.env.NODE_ENV === 'production',
}

// ---------- Lectura del docente autenticado (en route handlers) ----------

export type TeacherRole = 'ADMIN' | 'DOCENTE' | 'MODERADOR'

/*
 * La sesión se resuelve con DOBLE mecanismo para que nunca se cierre sola:
 *  1. Cookie httpOnly (vía segura normal).
 *  2. Cabecera Authorization: Bearer <token> guardada en localStorage.
 * El respaldo Bearer es imprescindible cuando la plataforma se abre dentro de
 * un iframe de otro dominio (vista previa): los navegadores bloquean las
 * cookies de terceros y la cookie nunca se guarda, lo que desconectaba al
 * docente justo después de iniciar sesión. El token firmado es idéntico al de
 * la cookie y tiene la misma vigencia (30 días).
 */
function bearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export async function getAuthTeacher(): Promise<{
  id: string
  email: string
  name: string
  role: TeacherRole
} | null> {
  const store = await cookies()
  const hdrs = await headers()
  const token =
    store.get(SESSION_COOKIE)?.value || bearerToken(hdrs.get('authorization'))
  const payload = verifyToken(token)
  if (!payload) return null
  const teacher = await db.teacher.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!teacher) return null
  return { ...teacher, role: (teacher.role as TeacherRole) || 'DOCENTE' }
}

// Devuelve el docente autenticado solo si tiene el rol indicado (por defecto ADMIN).
export async function getAuthTeacherWithRole(...roles: TeacherRole[]) {
  const teacher = await getAuthTeacher()
  if (!teacher) return null
  if (roles.length > 0 && !roles.includes(teacher.role)) return null
  return teacher
}

// Autenticación del panel docente: contraseñas con scrypt y sesión
// firmada (HMAC-SHA256) guardada en una cookie httpOnly.
// Los participantes no usan login: entran con el código o QR de la sesión.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'aulaviva_session'
const SESSION_DAYS = 30

function secret(): string {
  return process.env.AUTH_SECRET || 'aulaviva-dev-secret-cambiar-en-produccion'
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

export async function getAuthTeacher(): Promise<{ id: string; email: string; name: string } | null> {
  const store = await cookies()
  const payload = verifyToken(store.get(SESSION_COOKIE)?.value)
  if (!payload) return null
  const teacher = await db.teacher.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  })
  return teacher
}

// Helpers de servidor para las APIs de AulaViva
import { db } from '@/lib/db'
import { getAuthTeacher } from '@/lib/auth'
import type { Question, Session } from '@prisma/client'

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

// Verificación clásica por código de administrador de la sesión (legado/compartido)
export async function verifyAdmin(sessionId: string, adminCode: string | null | undefined) {
  if (!adminCode) return null
  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session || session.adminCode !== adminCode.trim().toUpperCase()) return null
  return session
}

/**
 * Verificación unificada del panel docente:
 *  1. Cookie de sesión del docente (login con correo) — dueño de la sesión
 *     o sesiones sin dueño (demo).
 *  2. Código de administrador de la sesión (compatibilidad: URL ?admin= o
 *     cabecera x-admin-code).
 */
export async function verifyAdminAccess(
  sessionId: string,
  adminCode: string | null | undefined
): Promise<Session | null> {
  const teacher = await getAuthTeacher()
  if (teacher) {
    const session = await db.session.findUnique({ where: { id: sessionId } })
    if (session && (session.teacherId === teacher.id || session.teacherId === null)) {
      return session
    }
  }
  return verifyAdmin(sessionId, adminCode)
}

// Cierra automáticamente la pregunta activa si su temporizador expiró
export async function maybeAutoClose(question: Question): Promise<Question> {
  if (
    question.state === 'open' &&
    question.openedAt &&
    question.timerSeconds &&
    question.timerSeconds > 0
  ) {
    const deadline = question.openedAt.getTime() + question.timerSeconds * 1000
    if (Date.now() > deadline) {
      const updated = await db.question.update({
        where: { id: question.id },
        data: { state: 'closed' },
      })
      return updated
    }
  }
  return question
}

// Helpers de servidor para las APIs de AulaViva
import { db } from '@/lib/db'
import type { Question } from '@prisma/client'

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export async function verifyAdmin(sessionId: string, adminCode: string | null | undefined) {
  if (!adminCode) return null
  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session || session.adminCode !== adminCode.trim().toUpperCase()) return null
  return session
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

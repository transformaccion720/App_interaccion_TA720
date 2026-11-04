// Simula respuestas de 4 participantes al diagnóstico activo de una sesión.
// Uso: bun scripts/simulate-diag.ts <joinCode>
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FAKE = [
  {
    name: 'Carlos Ruiz',
    values: (p: string[]) => ({ [p[0]]: 'Frecuentemente', [p[1]]: 'Redactar correos y generar ideas para clase', [p[2]]: '3', [p[3]]: 'Que los alumnos hagan trampa en las tareas', [p[4]]: 'Herramientas concretas para planificar mis clases' }),
  },
  {
    name: 'Laura Gómez',
    values: (p: string[]) => ({ [p[0]]: 'Poco', [p[1]]: 'Casi nada, solo búsquedas simples', [p[2]]: '2', [p[3]]: 'La privacidad y la veracidad de la información', [p[4]]: 'Perder el miedo y aprender desde cero' }),
  },
  {
    name: 'Andrés Torres',
    values: (p: string[]) => ({ [p[0]]: 'A diario', [p[1]]: 'Programación y análisis de datos', [p[2]]: '5', [p[3]]: 'El impacto laboral a futuro', [p[4]]: 'Buenas prácticas y ética en el uso de IA' }),
  },
  {
    name: 'Paula Sánchez',
    values: (p: string[]) => ({ [p[0]]: 'Regular', [p[1]]: 'Estudios, resúmenes y traducciones', [p[2]]: '4', [p[3]]: 'Dependencia tecnológica y costo de las herramientas', [p[4]]: 'Práctica guiada con ejemplos reales' }),
  },
]

async function main() {
  const joinCode = process.argv[2]
  if (!joinCode) throw new Error('Falta el código: bun scripts/simulate-diag.ts <joinCode>')

  const session = await prisma.session.findUnique({ where: { joinCode } })
  if (!session) throw new Error('Sesión no encontrada')

  const question = await prisma.question.findFirst({
    where: { sessionId: session.id, type: 'diagnostico' },
    orderBy: { order: 'desc' },
  })
  if (!question) throw new Error('No hay pregunta de diagnóstico en la sesión')
  if (question.state !== 'open') {
    await prisma.question.update({ where: { id: question.id }, data: { state: 'open', openedAt: new Date() } })
  }

  const config = JSON.parse(question.config) as { prompts: { id: string }[] }
  const promptIds = config.prompts.map((p) => p.id)
  const { randomUUID } = await import('crypto')

  for (const f of FAKE) {
    let participant = await prisma.participant.findFirst({
      where: { sessionId: session.id, name: f.name },
    })
    if (!participant) {
      participant = await prisma.participant.create({
        data: { sessionId: session.id, name: f.name, token: randomUUID() },
      })
    }
    const payload = JSON.stringify({ values: f.values(promptIds) })
    await prisma.answer.upsert({
      where: { questionId_participantId: { questionId: question.id, participantId: participant.id } },
      create: { questionId: question.id, participantId: participant.id, payload },
      update: { payload },
    })
    await prisma.participant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } })
    console.log(`✓ ${f.name}`)
  }
  console.log('Listo: 4 respuestas simuladas en', joinCode)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

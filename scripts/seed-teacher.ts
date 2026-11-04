// Crea (o restablece) la cuenta docente de demostración.
// Uso: bun scripts/seed-teacher.ts
import { PrismaClient } from '@prisma/client'
import { scryptSync, randomBytes } from 'crypto'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'docente@aulaviva.app'
const DEMO_PASSWORD = 'AulaViva2026'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const existing = await prisma.teacher.findUnique({ where: { email: DEMO_EMAIL } })
  if (existing) {
    await prisma.teacher.update({
      where: { email: DEMO_EMAIL },
      data: { passwordHash: hashPassword(DEMO_PASSWORD), name: existing.name || 'Docente Demo' },
    })
    console.log(`Cuenta demo actualizada: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
    return
  }
  await prisma.teacher.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Docente Demo',
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  })
  console.log(`Cuenta demo creada: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

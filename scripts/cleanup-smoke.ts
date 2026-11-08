// Limpia las sesiones de prueba del smoke test local.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const t = await prisma.teacher.findUnique({ where: { email: 'docente@aulaviva.app' } })
  if (!t) {
    console.log('sin docente local')
    return
  }
  const del = await prisma.session.deleteMany({
    where: { teacherId: t.id, title: { in: ['Clase demo tabs', 'Sin fecha'] } },
  })
  console.log('sesiones de prueba eliminadas:', del.count)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

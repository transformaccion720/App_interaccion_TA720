// Limpieza: elimina las sesiones E2E de verificación (deja la demo para vista previa)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const stale = await prisma.session.findMany({
    where: { title: { startsWith: 'E2E Semáforo' } },
    select: { id: true, title: true },
  })
  for (const s of stale) {
    await prisma.session.delete({ where: { id: s.id } })
    console.log('eliminada:', s.title, s.id)
  }
  if (!stale.length) console.log('no había sesiones E2E')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

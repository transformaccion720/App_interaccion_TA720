// GET /api/health — diagnóstico de despliegue (público, sin datos sensibles):
// - proveedor del cliente Prisma generado (postgresql | sqlite)
// - conectividad real a la base de datos
// - presencia de AUTH_SECRET (sin revelar su valor)
// Útil para verificar un deploy en Vercel: si db.ok es false y el proveedor es
// "sqlite", el build no generó el cliente PostgreSQL (ver DEPLOY-NEON.md §4).
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  let provider = 'desconocido'
  try {
    // El DMMF expone el proveedor del cliente generado; el tipo público de
    // Prisma no lo declara, por eso el cast defensivo.
    const dmmf = (Prisma as unknown as {
      dmmf?: { datamodel?: { datasources?: { provider?: string }[] } }
    }).dmmf
    provider = dmmf?.datamodel?.datasources?.[0]?.provider || 'desconocido'
  } catch {
    // sin acceso al DMMF, seguimos con el valor por defecto
  }

  let dbOk = false
  let error: string | undefined
  try {
    await db.$queryRaw`SELECT 1`
    dbOk = true
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : 'error desconocido'
  }

  // Chequeo de esquema: si las tablas no están aplicadas, login fallará aunque
  // la conexión funcione. Contamos docentes (tabla mínima del sistema).
  let esquemaOk = false
  let docentes: number | null = null
  let esquemaError: string | undefined
  if (dbOk) {
    try {
      docentes = await db.teacher.count()
      esquemaOk = true
    } catch (err) {
      esquemaError = err instanceof Error ? err.message.slice(0, 200) : 'error desconocido'
    }
  }

  const url = (process.env.DATABASE_URL || '').trim()
  // Anatomía de la URL SIN secretos: detecta al instante un valor mal pegado
  // (sin contraseña, sin nombre de BD, host antiguo, comillas incluidas...).
  const urlInfo: Record<string, unknown> = {
    urlEsPostgres: /^postgres(ql)?:\/\//.test(url),
    urlLongitud: url.length,
  }
  try {
    const u = new URL(url)
    if (/^postgres(ql)?:$/.test(u.protocol)) {
      urlInfo.usuario = u.username || '(vacío)'
      urlInfo.tienePassword = u.password.length > 0
      urlInfo.passwordLongitud = u.password.length
      urlInfo.host = u.hostname
      urlInfo.nombreBD = u.pathname.slice(1) || '(vacío)'
      urlInfo.parametros = u.search || '(ninguno)'
    } else {
      urlInfo.esquemaDetectado = u.protocol
    }
  } catch {
    urlInfo.urlNoParseable = true
  }

  return Response.json(
    {
      ok: dbOk && esquemaOk,
      db: {
        ok: dbOk,
        provider,
        ...urlInfo,
        error,
      },
      esquema: { ok: esquemaOk, docentes, error: esquemaError },
      auth: { secretConfigurado: Boolean(process.env.AUTH_SECRET) },
      tiempo: new Date().toISOString(),
    },
    { status: dbOk && esquemaOk ? 200 : 503 },
  )
}

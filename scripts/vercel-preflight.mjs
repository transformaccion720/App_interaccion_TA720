#!/usr/bin/env node
// Preflight del build (se ejecuta en Vercel ANTES de compilar: ver package.json
// → script "vercel-build"). Valida que DATABASE_URL y AUTH_SECRET existan y que
// DATABASE_URL sea una cadena de conexión pooled de Neon. Si algo está mal, el
// build se DETIENE con un mensaje claro: es mejor un deploy fallido y visible
// que una app publicada donde nadie puede iniciar sesión.
// Nunca imprime secretos: solo longitudes, host y nombre de base de datos.

function fail(titulo, detalle) {
  const linea = '─'.repeat(64)
  console.error('')
  console.error(linea)
  console.error('✋  BUILD DETENIDO — ' + titulo)
  console.error(linea)
  console.error(detalle.trim())
  console.error(linea)
  console.error('')
  process.exit(1)
}

// ── DATABASE_URL ─────────────────────────────────────────────────────────────
const url = (process.env.DATABASE_URL || '').trim()

if (!url) {
  fail(
    'Falta la variable de entorno DATABASE_URL',
    `
Esta aplicación necesita una base de datos PostgreSQL en Neon.

1. Entra a console.neon.tech → tu proyecto → «Connection Details».
2. Copia la cadena «Pooled connection» (empieza con postgresql:// y termina
   con ?sslmode=require).
3. En Vercel: Settings → Environment Variables → añade DATABASE_URL con ese
   valor (SIN comillas), marcando Production + Preview + Development.
4. Vuelve a desplegar: Deployments → ⋮ → Redeploy.
`,
  )
}

if (!/^postgres(ql)?:\/\//i.test(url)) {
  let esquema = '(valor no parseable)'
  try {
    esquema = new URL(url).protocol
  } catch {}
  if (/^["'].*["']$/.test(url)) esquema = 'comillas'
  const pistaComillas = /["']/.test(url)
    ? '\nAdemás, el valor contiene comillas: en Vercel se pega SIN comillas.\n'
    : ''
  fail(
    'DATABASE_URL no es una cadena de conexión de PostgreSQL',
    `
El valor configurado empieza con «${esquema}» y mide ${url.length} caracteres.${pistaComillas}
Si empieza con «file:», se pegó una ruta de base SQLite de desarrollo
(p. ej. file:./prisma/dev.db): esa solo sirve para la demo local, no para producción.

Solución:
1. console.neon.tech → «Connection Details» → copia la «Pooled connection».
2. Vercel → Settings → Environment Variables → DATABASE_URL → Edit → pega el
   valor SIN comillas y sin espacios extra.
3. Deployments → ⋮ → Redeploy.
`,
  )
}

const u = new URL(url)
const problemas = []
if (!u.username)
  problemas.push('• No incluye el usuario (formato: postgresql://usuario:contraseña@host/base)')
if (!u.password)
  problemas.push('• No incluye la contraseña entre el usuario y el host')
if (!u.pathname.slice(1))
  problemas.push('• Falta el nombre de la base de datos al final (p. ej. /neondb)')
if (!u.hostname.endsWith('neon.tech'))
  problemas.push(`• El host «${u.hostname}» no pertenece a Neon (debe terminar en neon.tech)`)
if (problemas.length) {
  fail(
    'DATABASE_URL no parece una cadena de conexión válida de Neon',
    `
${problemas.join('\n')}

Anatomía esperada:
postgresql://usuario:contraseña@ep-xxxx-pooler.c-X.REGION.aws.neon.tech/neondb?sslmode=require

Cópiala de nuevo desde console.neon.tech → «Connection Details» → «Pooled
connection», pégala en Vercel SIN comillas y vuelve a desplegar.
`,
  )
}

if (!/sslmode=require/.test(u.search)) {
  console.warn('⚠️  DATABASE_URL no incluye ?sslmode=require — Neon normalmente lo necesita.')
}

// ── AUTH_SECRET ──────────────────────────────────────────────────────────────
if (!process.env.AUTH_SECRET) {
  fail(
    'Falta la variable de entorno AUTH_SECRET',
    `
AUTH_SECRET firma las sesiones de los docentes: sin ella nadie puede iniciar sesión.

1. Genera un valor seguro ejecutando:  openssl rand -hex 32
2. Vercel → Settings → Environment Variables → añade AUTH_SECRET (sin comillas),
   marcando Production + Preview + Development.
3. Deployments → ⋮ → Redeploy.
`,
  )
}

console.log(
  `✅ Preflight OK — DATABASE_URL de Neon (${url.length} caracteres, host ${u.hostname}, base ${u.pathname.slice(1)}) y AUTH_SECRET presentes.`,
)

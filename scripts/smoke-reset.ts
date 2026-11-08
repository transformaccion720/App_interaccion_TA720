// Smoke test: reiniciar el marcado de preguntas (resetAnswers)
// Uso: BASE=http://localhost:3111 npx tsx scripts/smoke-reset.ts
const BASE = process.env.BASE || 'http://localhost:3111'

let cookie = ''

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let body: any = null
  try {
    body = await res.json()
  } catch {}
  return { status: res.status, body }
}

function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗ FALLO'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  // 1. Login
  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'docente@aulaviva.app', password: 'AulaViva2026' }),
  })
  check('login docente demo', login.status === 200, `status=${login.status}`)

  // 2. Crear sesión con 2 preguntas
  const ses = (
    await api('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'SMOKE reset marcado' }),
    })
  ).body
  check('sesión creada', !!ses.id)

  const q1 = await api(`/api/sessions/${ses.id}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'multiple_choice',
      title: '¿Pregunta 1?',
      config: { options: ['A', 'B'], byQuestion: [] },
    }),
  })
  const q2 = await api(`/api/sessions/${ses.id}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'multiple_choice',
      title: '¿Pregunta 2?',
      config: { options: ['Sí', 'No'], byQuestion: [] },
    }),
  })
  check('2 preguntas creadas', q1.status === 201 || q1.status === 200, `q1=${q1.status}`)

  // 3. Unir un participante
  const join = await api('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: ses.joinCode, name: 'Alumno Reset' }),
  })
  check('participante se une', join.status === 200, `status=${join.status}`)

  // 4. Abrir pregunta 1 y responder
  const open = await api(`/api/questions/${q1.body.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'open' }),
  })
  check('pregunta 1 abierta', open.status === 200, `status=${open.status}`)

  const answer = await api('/api/questions/' + q1.body.id + '/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: join.body.token, payload: { option: 0 } }),
  })
  check('respuesta registrada', answer.status === 200 || answer.status === 201, `status=${answer.status}`)

  // revelar para tener estado intermedio
  await api(`/api/questions/${q1.body.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'revealed' }),
  })

  // 5. Reset
  const reset = await api(`/api/sessions/${ses.id}/manage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetAnswers: true }),
  })
  check(
    'reset responde ok',
    reset.status === 200 && reset.body.ok === true && reset.body.deletedAnswers === 1,
    `status=${reset.status} deleted=${reset.body.deletedAnswers}`
  )

  // 6. Verificar: respuestas borradas y preguntas en pending
  const mgmt = await api(`/api/sessions/${ses.id}/manage`)
  const qs = mgmt.body.questions || []
  const allPending = qs.every((q: any) => q.state === 'pending' && q.openedAt === null)
  const noAnswers = qs.every((q: any) => q.answeredCount === 0)
  check('todas las preguntas en pendiente', allPending, JSON.stringify(qs.map((q: any) => q.state)))
  check('sin respuestas registradas', noAnswers)

  // 7. El participante sigue existiendo (sync no da 404)
  const sync = await api('/api/participant/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: join.body.token }),
  })
  check('participante sigue en la sesión', sync.status === 200, `status=${sync.status}`)

  // 8. Limpieza directa en BD
  const { execSync } = await import('child_process')
  execSync(
    `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.session.delete({ where: { id: '${ses.id}' } }).then(async () => { console.log('limpia'); await p.\\$disconnect() })"`,
    { cwd: process.cwd(), stdio: 'inherit' }
  )

  console.log(process.exitCode ? '\n✗ Smoke reset con fallos' : '\n✔ Smoke reset completo: OK')
}

main().catch((e) => {
  console.error('✗ Error inesperado:', e.message)
  process.exit(1)
})

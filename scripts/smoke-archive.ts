// Smoke test: archivar / restaurar sesiones (API completa)
// Uso: BASE=http://localhost:3111 npx tsx scripts/smoke-archive.ts
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
  // 1. Login docente demo
  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'docente@aulaviva.app', password: 'AulaViva2026' }),
  })
  check('login docente demo', login.status === 200, `status=${login.status}`)

  // 2. Crea dos sesiones (draft y closed)
  const mk = async (title: string) =>
    (
      await api('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    ).body
  const draft = await mk('SMOKE archivar — borrador')
  const fini = await mk('SMOKE archivar — finalizada')
  check('crear sesión borrador', !!draft.id && !!draft.joinCode)
  check('crear sesión finalizada', !!fini.id && !!fini.joinCode)

  // cierra la segunda
  const close = await api(`/api/sessions/${fini.id}/manage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'closed' }),
  })
  check('cerrar sesión 2', close.status === 200 && close.body.status === 'closed')

  // 3. Archivar la de borrador
  const arch = await api(`/api/sessions/${draft.id}/manage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archivedAt: new Date().toISOString() }),
  })
  check('archivar sesión borrador', arch.status === 200, `status=${arch.status}`)

  // 4. El listado la muestra con archivedAt
  const list = await api('/api/sessions')
  const inList = list.body.sessions?.find((s: any) => s.id === draft.id)
  check('listado muestra archivedAt', !!inList?.archivedAt, `archivedAt=${inList?.archivedAt}`)

  // 5. Join rechazado para archivada
  const joinArch = await api('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: draft.joinCode, name: 'Alumno Test' }),
  })
  check(
    'join rechaza sesión archivada',
    joinArch.status === 409 && /no está disponible/i.test(joinArch.body.error || ''),
    `status=${joinArch.status} error=${joinArch.body.error}`
  )

  // 6. Join normal para la finalizada no archivada → debe decir "finalizó" (no archivada)
  const joinFini = await api('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: fini.joinCode, name: 'Alumno Test' }),
  })
  check(
    'join a finalizada sigue diciendo "finalizó"',
    joinFini.status === 409 && /finalizó/i.test(joinFini.body.error || ''),
    `status=${joinFini.status} error=${joinFini.body.error}`
  )

  // 7. archivedAt inválido → 400
  const bad = await api(`/api/sessions/${fini.id}/manage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archivedAt: 'no-es-fecha' }),
  })
  check('fecha de archivado inválida → 400', bad.status === 400, `status=${bad.status}`)

  // 8. Restaurar → archivedAt null y join permitido (draft admite entrar)
  const restore = await api(`/api/sessions/${draft.id}/manage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archivedAt: null }),
  })
  const list2 = await api('/api/sessions')
  const restored = list2.body.sessions?.find((s: any) => s.id === draft.id)
  check('restaurar limpia archivedAt', restore.status === 200 && restored?.archivedAt === null)

  const joinOk = await api('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: draft.joinCode, name: 'Alumno Test' }),
  })
  check('join acepta tras restaurar', joinOk.status === 200, `status=${joinOk.status}`)

  // 9. Limpieza: borrar las sesiones de prueba
  for (const s of [draft, fini]) {
    await api(`/api/sessions/${s.id}/manage`, { method: 'DELETE' })
  }
  const list3 = await api('/api/sessions')
  const quedan = list3.body.sessions?.filter(
    (s: any) => s.id === draft.id || s.id === fini.id
  )
  check('limpieza de sesiones de prueba', (quedan || []).length === 0)

  console.log(process.exitCode ? '\n✗ Smoke test con fallos' : '\n✔ Smoke test completo: OK')
}

main().catch((e) => {
  console.error('✗ Error inesperado:', e.message)
  process.exit(1)
})

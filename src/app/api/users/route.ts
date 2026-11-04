// Gestión interna de usuarios — SOLO para el administrador (rol ADMIN).
// GET    /api/users        → lista las cuentas (docentes y moderadores)
// POST   /api/users        → crea una cuenta (rol DOCENTE o MODERADOR)
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import { hashPassword, getAuthTeacherWithRole, TeacherRole } from '@/lib/auth'

const TEACHER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  _count: { select: { sessions: true } },
}

export async function GET() {
  const admin = await getAuthTeacherWithRole('ADMIN')
  if (!admin) return jsonError('No autorizado', 403)

  const users = await db.teacher.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: TEACHER_SELECT,
  })
  return Response.json({ users })
}

export async function POST(req: Request) {
  const admin = await getAuthTeacherWithRole('ADMIN')
  if (!admin) return jsonError('No autorizado', 403)

  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role: TeacherRole =
      body.role === 'MODERADOR' || body.role === 'ADMIN' ? body.role : 'DOCENTE'

    if (!name) return jsonError('El nombre es obligatorio')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Ingresa un correo válido')
    if (password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres')

    const exists = await db.teacher.findUnique({ where: { email } })
    if (exists) return jsonError('Ya existe una cuenta con ese correo', 409)

    const teacher = await db.teacher.create({
      data: { name, email, passwordHash: hashPassword(password), role },
      select: TEACHER_SELECT,
    })
    return Response.json({ ok: true, teacher })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

// POST /api/auth/register — crea cuentas para docentes o moderadores.
// SOLO el administrador (rol ADMIN) puede crear cuentas: el registro público
// está deshabilitado. Requiere sesión de admin iniciada.
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'
import { hashPassword, getAuthTeacher, TeacherRole } from '@/lib/auth'

const VALID_ROLES: TeacherRole[] = ['DOCENTE', 'MODERADOR', 'ADMIN']

export async function POST(req: Request) {
  try {
    const admin = await getAuthTeacher()
    if (!admin || admin.role !== 'ADMIN') {
      return jsonError('Solo el administrador puede crear cuentas', 403)
    }

    const body = await req.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role: TeacherRole = VALID_ROLES.includes(body.role) ? body.role : 'DOCENTE'

    if (!name) return jsonError('Ingresa el nombre de la persona')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Ingresa un correo válido')
    if (password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres')

    const exists = await db.teacher.findUnique({ where: { email } })
    if (exists) return jsonError('Ya existe una cuenta con ese correo', 409)

    const teacher = await db.teacher.create({
      data: { name, email, passwordHash: hashPassword(password), role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    return Response.json({ ok: true, teacher })
  } catch {
    return jsonError('Solicitud inválida', 400)
  }
}

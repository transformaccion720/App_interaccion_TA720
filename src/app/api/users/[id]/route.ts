// PATCH  /api/users/[id] — actualiza una cuenta (rol, nombre, restablecer contraseña)
// DELETE /api/users/[id] — elimina una cuenta (no puede borrar la propia)
// SOLO para el administrador (rol ADMIN).
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAuthTeacherWithRole('ADMIN')
  if (!admin) return jsonError('No autorizado', 403)

  const { id } = await ctx.params
  try {
    const body = await req.json()
    const data: {
      name?: string
      role?: TeacherRole
      passwordHash?: string
    } = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return jsonError('El nombre no puede quedar vacío')
      data.name = name
    }
    if (body.role !== undefined) {
      const role = String(body.role)
      if (!['ADMIN', 'DOCENTE', 'MODERADOR'].includes(role)) return jsonError('Rol no válido')
      if (id === admin.id && role !== 'ADMIN') {
        return jsonError('No puedes quitarte tu propio rol de administrador')
      }
      data.role = role as TeacherRole
    }
    if (body.password !== undefined) {
      const password = String(body.password)
      if (password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres')
      data.passwordHash = hashPassword(password)
    }

    if (Object.keys(data).length === 0) return jsonError('Nada que actualizar')

    const teacher = await db.teacher.update({
      where: { id },
      data,
      select: TEACHER_SELECT,
    })
    return Response.json({ ok: true, teacher })
  } catch {
    return jsonError('No se pudo actualizar la cuenta', 400)
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAuthTeacherWithRole('ADMIN')
  if (!admin) return jsonError('No autorizado', 403)

  const { id } = await ctx.params
  if (id === admin.id) return jsonError('No puedes eliminar tu propia cuenta', 400)

  try {
    await db.teacher.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch {
    return jsonError('No se pudo eliminar la cuenta', 400)
  }
}

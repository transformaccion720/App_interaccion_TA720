// GET /api/auth/me — devuelve el docente autenticado (o 401)
import { getAuthTeacher } from '@/lib/auth'

export async function GET() {
  const teacher = await getAuthTeacher()
  if (!teacher) return Response.json({ error: 'No autenticado' }, { status: 401 })
  return Response.json({ teacher })
}

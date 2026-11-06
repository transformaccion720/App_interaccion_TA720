// GET /api/sessions/[id]/export?admin=CODE — exporta todas las respuestas a CSV
import { db } from '@/lib/db'
import { jsonError, verifyAdminAccess } from '@/lib/api-helpers'
import {
  type DecisionTreeAnswer,
  type DiagnosticoAnswer,
  type MultipleChoiceAnswer,
  type OpenTextAnswer,
  type QuestionType,
  type SemaforoAnswer,
  type WordCloudAnswer,
} from '@/lib/types'

function csvCell(value: string): string {
  const v = value.replace(/"/g, '""').replace(/\r?\n/g, ' ')
  return `"${v}"`
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const session = await verifyAdminAccess(id, url.searchParams.get('admin'))
  if (!session) return jsonError('No autorizado', 401)

  const questions = await db.question.findMany({
    where: { sessionId: id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      answers: { include: { participant: { select: { name: true } } } },
    },
  })

  const rows: string[] = ['Pregunta;Tipo;Asistente;Respuesta;Actualizada']
  const typeLabel: Record<QuestionType, string> = {
    multiple_choice: 'Opción múltiple',
    semaforo: 'Semáforo',
    word_cloud: 'Nube de palabras',
    decision_tree: 'Árbol de decisiones',
    open_text: 'Abierta',
    diagnostico: 'Diagnóstico situacional',
  }

  for (const q of questions) {
    let config: Record<string, unknown> = {}
    try {
      config = JSON.parse(q.config || '{}')
    } catch { /* ignora */ }

    for (const a of q.answers) {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(a.payload || '{}')
      } catch { /* ignora */ }

      let answerText = ''
      const type = q.type as QuestionType
      if (type === 'multiple_choice') {
        const p = payload as unknown as MultipleChoiceAnswer
        const options = ((config.options as { id: string; text: string }[]) || [])
        answerText = (p.optionIds || [])
          .map((oid) => options.find((o) => o.id === oid)?.text || oid)
          .join(' | ')
      } else if (type === 'semaforo') {
        if (config.mode === 'single') {
          // Modo pregunta única: el color elegido con su etiqueta
          const p = payload as unknown as SemaforoAnswer
          const labels: Record<string, string> = {
            green: (config.labels as Record<string, string> | undefined)?.green || 'Verde',
            yellow: (config.labels as Record<string, string> | undefined)?.yellow || 'Amarillo',
            red: (config.labels as Record<string, string> | undefined)?.red || 'Rojo',
          }
          answerText = p.color ? labels[p.color] || p.color : ''
        } else if (config.mode === 'multi') {
          // Modo varias preguntas: color por cada pregunta
          const p = payload as unknown as SemaforoAnswer
          const items = ((config.items as { id: string; text: string }[]) || [])
          const labels: Record<string, string> = {
            green: (config.labels as Record<string, string> | undefined)?.green || 'Verde',
            yellow: (config.labels as Record<string, string> | undefined)?.yellow || 'Amarillo',
            red: (config.labels as Record<string, string> | undefined)?.red || 'Rojo',
          }
          answerText = Object.entries(p.colorVotes || {})
            .map(([itemId, color]) => {
              const item = items.find((i) => i.id === itemId)
              return `${item?.text || itemId}: ${labels[color] || color}`
            })
            .join(' | ')
        } else {
          const p = payload as unknown as SemaforoAnswer
          const items = ((config.items as { id: string; text: string }[]) || [])
          const voteLabel: Record<string, string> = { valid: 'Válido', partial: 'Parcial', invalid: 'No válido' }
          answerText = Object.entries(p.votes || {})
            .map(([itemId, vote]) => {
              const item = items.find((i) => i.id === itemId)
              return `${item?.text || itemId}: ${voteLabel[vote] || vote}`
            })
            .join(' | ')
        }
      } else if (type === 'word_cloud') {
        const p = payload as unknown as WordCloudAnswer
        answerText = (p.words || []).join(', ')
      } else if (type === 'decision_tree') {
        const p = payload as unknown as DecisionTreeAnswer
        const nodes = ((config.nodes as { id: string; text: string; options: { id: string; label: string; nextId: string | null }[] }[]) || [])
        const steps = (p.steps || []).map((s) => {
          const node = nodes.find((n) => n.id === s.nodeId)
          const opt = node?.options?.find((o) => o.id === s.optionId)
          return opt?.label || s.optionId
        })
        const leaf = p.leafOptionId
          ? nodes.flatMap((n) => n.options || []).find((o) => o.id === p.leafOptionId)
          : null
        // El último paso ya es la conclusión; se añade «⇒ conclusión» solo si difiere
        const stepsText = steps.join(' → ')
        answerText = leaf?.label && steps[steps.length - 1] !== leaf.label
          ? `${stepsText} ⇒ ${leaf.label}`
          : stepsText
        if (p.comment) answerText += ` | Comentario: ${p.comment}`
      } else if (type === 'open_text') {
        const p = payload as unknown as OpenTextAnswer
        answerText = p.text || ''
      } else if (type === 'diagnostico') {
        const p = payload as unknown as DiagnosticoAnswer
        const prompts = ((config.prompts as { id: string; label: string }[]) || [])
        answerText = Object.entries(p.values || {})
          .map(([pid, value]) => {
            const prompt = prompts.find((x) => x.id === pid)
            return `${prompt?.label || pid}: ${value}`
          })
          .join(' | ')
      }

      rows.push(
        [
          csvCell(`${q.order + 1}. ${q.title}`),
          csvCell(typeLabel[type] || type),
          csvCell(a.participant.name),
          csvCell(answerText),
          csvCell(a.updatedAt.toISOString()),
        ].join(';')
      )
    }
  }

  const csv = '\uFEFF' + rows.join('\r\n') // BOM para Excel
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aulaviva-${session.joinCode}-resultados.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

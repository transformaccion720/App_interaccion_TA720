// Agregación de resultados en el servidor (tipo por tipo)
import type {
  Answer,
  Question,
} from '@prisma/client'
import {
  type DecisionTreeAnswer,
  type DecisionTreeResults,
  type MultipleChoiceAnswer,
  type MultipleChoiceResults,
  type OpenTextAnswer,
  type OpenTextResults,
  type QuestionResults,
  type QuestionType,
  type SemaforoAnswer,
  type SemaforoResults,
  type SemaforoVote,
  type WordCloudAnswer,
  type WordCloudResults,
  type DecisionTreeConfig,
  type MultipleChoiceConfig,
  type SemaforoConfig,
} from './types'
import { isMeaningfulWord, normalizeWord } from './codes'

export function parseConfig<T>(question: Pick<Question, 'type' | 'config'>): T {
  try {
    return JSON.parse(question.config || '{}') as T
  } catch {
    return {} as T
  }
}

export function parsePayload<T>(answer: Pick<Answer, 'payload'>): T {
  try {
    return JSON.parse(answer.payload || '{}') as T
  } catch {
    return {} as T
  }
}

// Devuelve los resultados agregados de una pregunta con todas sus respuestas
export function aggregateResults(
  type: QuestionType,
  configRaw: string,
  answers: { payload: string; participantName?: string; updatedAt?: Date }[]
): QuestionResults | null {
  switch (type) {
    case 'multiple_choice':
      return {
        type: 'multiple_choice',
        data: aggregateMultipleChoice(configRaw, answers),
      }
    case 'semaforo':
      return { type: 'semaforo', data: aggregateSemaforo(configRaw, answers) }
    case 'word_cloud':
      return { type: 'word_cloud', data: aggregateWordCloud(answers) }
    case 'decision_tree':
      return { type: 'decision_tree', data: aggregateDecisionTree(configRaw, answers) }
    case 'open_text':
      return { type: 'open_text', data: aggregateOpenText(answers) }
    default:
      return null
  }
}

function aggregateMultipleChoice(
  configRaw: string,
  answers: { payload: string }[]
): MultipleChoiceResults {
  const config = parseConfig<MultipleChoiceConfig>({ type: 'multiple_choice', config: configRaw })
  const counts: Record<string, number> = {}
  for (const opt of config.options || []) counts[opt.id] = 0
  for (const a of answers) {
    const payload = parsePayload<MultipleChoiceAnswer>(a)
    for (const oid of payload.optionIds || []) {
      counts[oid] = (counts[oid] || 0) + 1
    }
  }
  return { total: answers.length, counts }
}

function aggregateSemaforo(
  configRaw: string,
  answers: { payload: string }[]
): SemaforoResults {
  const config = parseConfig<SemaforoConfig>({ type: 'semaforo', config: configRaw })
  const items = (config.items || []).map((item) => ({
    itemId: item.id,
    valid: 0,
    partial: 0,
    invalid: 0,
    overall: null as SemaforoVote | null,
  }))
  const byId = new Map(items.map((i) => [i.itemId, i]))
  for (const a of answers) {
    const payload = parsePayload<SemaforoAnswer>(a)
    for (const [itemId, vote] of Object.entries(payload.votes || {})) {
      const item = byId.get(itemId)
      if (!item) continue
      if (vote === 'valid') item.valid++
      else if (vote === 'partial') item.partial++
      else if (vote === 'invalid') item.invalid++
    }
  }
  for (const item of items) {
    const max = Math.max(item.valid, item.partial, item.invalid)
    if (max === 0) continue
    item.overall =
      max === item.valid ? 'valid' : max === item.partial ? 'partial' : 'invalid'
  }
  return { total: answers.length, items }
}

function aggregateWordCloud(
  answers: { payload: string }[]
): WordCloudResults {
  const freq = new Map<string, number>()
  for (const a of answers) {
    const payload = parsePayload<WordCloudAnswer>(a)
    for (const raw of payload.words || []) {
      const word = normalizeWord(raw)
      if (!isMeaningfulWord(word)) continue
      freq.set(word, (freq.get(word) || 0) + 1)
    }
  }
  const words = [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 60)
  return { total: answers.length, words }
}

function pathTextFor(
  config: DecisionTreeConfig,
  steps: { nodeId: string; optionId: string }[]
): string {
  const nodes = new Map((config.nodes || []).map((n) => [n.id, n]))
  const parts: string[] = []
  for (const step of steps || []) {
    const node = nodes.get(step.nodeId)
    const opt = node?.options?.find((o) => o.id === step.optionId)
    if (opt) parts.push(opt.label)
  }
  return parts.join(' → ')
}

function aggregateDecisionTree(
  configRaw: string,
  answers: { payload: string; participantName?: string; updatedAt?: Date }[]
): DecisionTreeResults {
  const config = parseConfig<DecisionTreeConfig>({ type: 'decision_tree', config: configRaw })
  const nodes = new Map((config.nodes || []).map((n) => [n.id, n]))
  const leafCounts = new Map<string, number>()
  const comments: DecisionTreeResults['comments'] = []

  for (const a of answers) {
    const payload = parsePayload<DecisionTreeAnswer>(a)
    if (payload.leafOptionId) {
      leafCounts.set(payload.leafOptionId, (leafCounts.get(payload.leafOptionId) || 0) + 1)
    }
    if (payload.comment && payload.comment.trim()) {
      const lastStep = payload.steps?.[payload.steps.length - 1]
      const node = lastStep ? nodes.get(lastStep.nodeId) : undefined
      const leaf = node?.options?.find((o) => o.id === lastStep?.optionId)
      comments.push({
        participant: a.participantName || 'Anónimo',
        leafLabel: leaf?.label || '—',
        pathText: pathTextFor(config, payload.steps || []),
        comment: payload.comment.trim(),
        at: (a.updatedAt || new Date()).toISOString(),
      })
    }
  }

  // Todas las opciones-conclusión del árbol (nextId === null)
  const allLeaves: { optionId: string; label: string; nodeText: string }[] = []
  for (const node of config.nodes || []) {
    for (const opt of node.options || []) {
      if (opt.nextId === null) {
        allLeaves.push({ optionId: opt.id, label: opt.label, nodeText: node.text })
      }
    }
  }

  const leaves: DecisionTreeResults['leaves'] = allLeaves
    .map((leaf) => ({
      optionId: leaf.optionId,
      label: leaf.label,
      pathText: '',
      count: leafCounts.get(leaf.optionId) || 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Texto de ruta para los comentarios
  for (const c of comments) c.pathText = c.pathText || '—'

  comments.sort((a, b) => b.at.localeCompare(a.at))

  return { total: answers.length, leaves, comments }
}

function aggregateOpenText(
  answers: { payload: string; participantName?: string; updatedAt?: Date }[]
): OpenTextResults {
  const items = answers.map((a) => {
    const payload = parsePayload<OpenTextAnswer>(a)
    return {
      participant: a.participantName || 'Anónimo',
      text: payload.text || '',
      at: (a.updatedAt || new Date()).toISOString(),
    }
  })
  items.sort((a, b) => b.at.localeCompare(a.at))
  return { total: answers.length, items }
}

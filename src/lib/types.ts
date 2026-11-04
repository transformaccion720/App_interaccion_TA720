// Tipos compartidos de AulaViva

export type QuestionType =
  | 'multiple_choice'
  | 'semaforo'
  | 'word_cloud'
  | 'decision_tree'
  | 'open_text'

export type QuestionState = 'pending' | 'open' | 'revealed' | 'closed'
export type SessionStatus = 'draft' | 'live' | 'closed'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Opción múltiple',
  semaforo: 'Semáforo',
  word_cloud: 'Nube de palabras',
  decision_tree: 'Árbol de decisiones',
  open_text: 'Pregunta abierta',
}

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  multiple_choice: '☑',
  semaforo: '🚦',
  word_cloud: '☁',
  decision_tree: '🌳',
  open_text: '✎',
}

// ---------- Configuraciones por tipo ----------

export interface ChoiceOption {
  id: string
  text: string
  correct?: boolean
}

export interface MultipleChoiceConfig {
  options: ChoiceOption[]
  multipleSelect?: boolean
  showCorrect?: boolean // resaltar la(s) correcta(s) en resultados
}

export interface SemaforoItem {
  id: string
  text: string
}

export interface SemaforoConfig {
  items: SemaforoItem[]
  allowPartial?: boolean // permitir el punto amarillo "Parcial"
}

export type SemaforoVote = 'valid' | 'partial' | 'invalid'

export interface WordCloudConfig {
  maxWords: number // palabras por participante (1-5)
}

export interface DecisionOption {
  id: string
  label: string
  nextId: string | null // null = este opción lleva a una conclusión
}

export interface DecisionNode {
  id: string
  text: string
  options: DecisionOption[]
}

export interface DecisionTreeConfig {
  rootId: string | null
  nodes: DecisionNode[]
}

export interface OpenTextConfig {
  maxLength: number
}

export type QuestionConfig =
  | MultipleChoiceConfig
  | SemaforoConfig
  | WordCloudConfig
  | DecisionTreeConfig
  | OpenTextConfig

// ---------- Cargas útiles de respuestas ----------

export interface MultipleChoiceAnswer {
  optionIds: string[]
}

export interface SemaforoAnswer {
  votes: Record<string, SemaforoVote> // itemId → voto
}

export interface WordCloudAnswer {
  words: string[]
}

export interface DecisionStep {
  nodeId: string
  optionId: string
}

export interface DecisionTreeAnswer {
  steps: DecisionStep[]
  leafOptionId: string | null // opción-conclusión elegida
  comment: string
}

export interface OpenTextAnswer {
  text: string
}

// ---------- Vistas serializadas para el cliente ----------

export interface ParticipantView {
  id: string
  name: string
  online: boolean
  lastSeenAt: string
  createdAt: string
  answeredActive: boolean
  totalAnswers: number
}

export interface QuestionPublic {
  id: string
  order: number
  title: string
  description: string | null
  imageUrl: string | null
  type: QuestionType
  state: QuestionState
  timerSeconds: number | null
  openedAt: string | null
}

// Config decodificada (para admin/editores y para participantes cuando procede)
export interface QuestionAdmin extends QuestionPublic {
  config: QuestionConfig
  answeredCount: number
}

// Resultados agregados por tipo
export interface MultipleChoiceResults {
  total: number
  counts: Record<string, number>
}

export interface SemaforoItemResults {
  itemId: string
  valid: number
  partial: number
  invalid: number
  overall: SemaforoVote | null
}

export interface SemaforoResults {
  total: number
  items: SemaforoItemResults[]
}

export interface WordCloudResults {
  total: number
  words: { word: string; count: number }[]
}

export interface DecisionLeafResults {
  optionId: string
  label: string
  pathText: string
  count: number
}

export interface DecisionCommentItem {
  participant: string
  leafLabel: string
  pathText: string
  comment: string
  at: string
}

export interface DecisionTreeResults {
  total: number
  leaves: DecisionLeafResults[]
  comments: DecisionCommentItem[]
}

export interface OpenTextResults {
  total: number
  items: { participant: string; text: string; at: string }[]
}

export type QuestionResults =
  | { type: 'multiple_choice'; data: MultipleChoiceResults }
  | { type: 'semaforo'; data: SemaforoResults }
  | { type: 'word_cloud'; data: WordCloudResults }
  | { type: 'decision_tree'; data: DecisionTreeResults }
  | { type: 'open_text'; data: OpenTextResults }

export interface AdminLive {
  session: {
    id: string
    title: string
    description: string | null
    joinCode: string
    adminCode: string
    maxParticipants: number
    status: SessionStatus
  }
  participants: ParticipantView[]
  onlineCount: number
  questions: QuestionAdmin[]
  activeQuestion: QuestionAdmin | null
  activeResults: QuestionResults | null
  resultsByQuestion: Record<string, QuestionResults> // resultados agregados de cada pregunta
  notAnsweredActive: string[] // nombres de quienes no han respondido la activa
  serverNow: string
}

export interface ParticipantSync {
  session: {
    id: string
    title: string
    status: SessionStatus
  }
  participantName: string
  question: QuestionPublic | null
  config: QuestionConfig | null // para pintar la pregunta
  myAnswer: MultipleChoiceAnswer | SemaforoAnswer | WordCloudAnswer | DecisionTreeAnswer | OpenTextAnswer | null
  results: QuestionResults | null // solo si state === 'revealed'
  answeredCount: number
  totalParticipants: number
  serverNow: string
}

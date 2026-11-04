// Utilidades: códigos de sesión, normalización de palabras, etc.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin caracteres ambiguos (0/O, 1/I/L)

export function generateCode(length: number): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

// Normaliza una palabra para la nube: minúsculas, sin acentos, sin signos
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacríticos
    .replace(/[^a-zñü0-9\s-]/gi, '')
    .replace(/\s+/g, ' ')
}

// Palabras vacías comunes en español (se excluyen de la nube)
export const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero',
  'que', 'en', 'del', 'al', 'con', 'por', 'para', 'sin', 'sobre', 'entre',
  'es', 'son', 'ser', 'esta', 'este', 'esto', 'estos', 'estas', 'muy', 'mas',
  'ya', 'no', 'si', 'se', 'su', 'sus', 'lo', 'le', 'les', 'me', 'mi', 'mis',
  'te', 'tu', 'tus', 'nos', 'nuestro', 'nuestra', 'como', 'cuando', 'donde',
  'cual', 'cuales', 'quien', 'quienes', 'porque', 'pues', 'aun', 'tambien',
  'hay', 'fue', 'han', 'ha', 'he', 'hemos', 'han', 'sido', 'estoy', 'estamos',
  'the', 'and', 'of', 'to', 'in', 'is', 'it', 'a', 'an', 'for', 'on', 'with',
])

export function isMeaningfulWord(word: string): boolean {
  return word.length >= 2 && !STOPWORDS.has(word)
}

// Formatea una fecha relativa simple en español
export function relativeTime(dateIso: string, nowIso?: string): string {
  const date = new Date(dateIso).getTime()
  const now = nowIso ? new Date(nowIso).getTime() : Date.now()
  const diff = Math.max(0, now - date)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace instantes'
  if (min === 1) return 'hace 1 min'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h === 1) return 'hace 1 h'
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hace 1 día' : `hace ${d} días`
}

export const ONLINE_WINDOW_MS = 25_000 // se considera "en línea" si emitió señal en los últimos 25 s

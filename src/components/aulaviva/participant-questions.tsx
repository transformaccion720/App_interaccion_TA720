'use client'

// Formularios de respuesta del participante para los 5 tipos de pregunta.
// Permiten cambiar la respuesta mientras la pregunta esté abierta.
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import {
  type DecisionStep,
  type DecisionTreeAnswer,
  type DecisionTreeConfig,
  type DiagnosticoAnswer,
  type DiagnosticoConfig,
  type DiagPrompt,
  type MultipleChoiceAnswer,
  type MultipleChoiceConfig,
  type OpenTextAnswer,
  type OpenTextConfig,
  type QuestionPublic,
  type SemaforoAnswer,
  type SemaforoColor,
  type SemaforoConfig,
  type SemaforoVote,
  type WordCloudAnswer,
  type WordCloudConfig,
} from '@/lib/types'
import { CheckCircle2, XCircle, CircleDashed, X, CornerUpLeft, Send, CheckCheck, ClipboardList } from 'lucide-react'

export function ParticipantQuestion({
  question,
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  question: QuestionPublic
  config: unknown
  myAnswer: unknown
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <MultipleChoiceForm config={config as MultipleChoiceConfig} myAnswer={myAnswer as MultipleChoiceAnswer | null} onSubmit={onSubmit} submitting={submitting} />
      )
    case 'semaforo':
      return <SemaforoForm config={config as SemaforoConfig} myAnswer={myAnswer as SemaforoAnswer | null} onSubmit={onSubmit} submitting={submitting} />
    case 'word_cloud':
      return <WordCloudForm config={config as WordCloudConfig} myAnswer={myAnswer as WordCloudAnswer | null} onSubmit={onSubmit} submitting={submitting} />
    case 'decision_tree':
      return <DecisionTreeForm config={config as DecisionTreeConfig} myAnswer={myAnswer as DecisionTreeAnswer | null} onSubmit={onSubmit} submitting={submitting} />
    case 'open_text':
      return <OpenTextForm config={config as OpenTextConfig} myAnswer={myAnswer as OpenTextAnswer | null} onSubmit={onSubmit} submitting={submitting} />
    case 'diagnostico':
      return <DiagnosticoForm config={config as DiagnosticoConfig} myAnswer={myAnswer as DiagnosticoAnswer | null} onSubmit={onSubmit} submitting={submitting} />
  }
}

function SubmitButton({ disabled, submitting, label }: { disabled?: boolean; submitting: boolean; label?: string }) {
  return (
    <Button size="lg" className="w-full sm:w-auto min-h-11" disabled={disabled || submitting} onClick={() => undefined} type="submit">
      {submitting ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Enviando…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          {label || 'Enviar respuesta'}
        </span>
      )}
    </Button>
  )
}

// ------------------- Opción múltiple -------------------
function MultipleChoiceForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: MultipleChoiceConfig
  myAnswer: MultipleChoiceAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  const [selected, setSelected] = useState<string[]>(myAnswer?.optionIds || [])

  const options = config?.options || []
  const multiple = !!config?.multipleSelect

  function toggle(optionId: string) {
    if (multiple) {
      setSelected((prev) => (prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]))
    } else {
      setSelected([optionId])
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!selected.length) return
        onSubmit({ optionIds: selected } satisfies MultipleChoiceAnswer)
      }}
    >
      <div className="grid gap-2.5" role="group" aria-label="Opciones de respuesta">
        {options.map((opt, i) => {
          const active = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              aria-pressed={active}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-base font-medium transition-colors min-h-11 ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-900'
                  : 'border-border bg-card hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                  active ? 'border-brand-600 bg-brand-600 text-white' : 'border-muted-foreground/40 text-muted-foreground'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {opt.text}
              {multiple && active && <CheckCheck className="ml-auto h-4 w-4 text-brand-600" />}
            </button>
          )
        })}
      </div>
      {multiple && (
        <p className="text-xs text-muted-foreground">Puedes seleccionar varias opciones.</p>
      )}
      <SubmitButton disabled={!selected.length} submitting={submitting} />
    </form>
  )
}

// ------------------- Semáforo -------------------
const VOTE_BUTTONS: { vote: SemaforoVote; label: string; icon: typeof CheckCircle2; classes: string; active: string }[] = [
  {
    vote: 'valid',
    label: 'Válida',
    icon: CheckCircle2,
    classes: 'border-viva-300 hover:bg-viva-50',
    active: 'border-viva-600 bg-viva-600 text-white',
  },
  {
    vote: 'partial',
    label: 'Parcial',
    icon: CircleDashed,
    classes: 'border-energy-300 hover:bg-energy-50',
    active: 'border-energy-500 bg-energy-500 text-white',
  },
  {
    vote: 'invalid',
    label: 'No válida',
    icon: XCircle,
    classes: 'border-red-300 hover:bg-red-50',
    active: 'border-red-600 bg-red-600 text-white',
  },
]

// Tarjetas de color del modo 'single': verde · amarillo · rojo
const COLOR_CARDS: {
  color: SemaforoColor
  fallback: string
  dot: string
  active: string
  hover: string
}[] = [
  {
    color: 'green',
    fallback: 'Verde',
    dot: 'bg-viva-500',
    active: 'border-viva-600 bg-viva-50 text-viva-900 ring-2 ring-viva-600/30',
    hover: 'hover:border-viva-400 hover:bg-viva-50/50',
  },
  {
    color: 'yellow',
    fallback: 'Amarillo',
    dot: 'bg-energy-500',
    active: 'border-energy-600 bg-energy-50 text-energy-900 ring-2 ring-energy-600/30',
    hover: 'hover:border-energy-500 hover:bg-energy-50/50',
  },
  {
    color: 'red',
    fallback: 'Rojo',
    dot: 'bg-red-500',
    active: 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-600/30',
    hover: 'hover:border-red-400 hover:bg-red-50/50',
  },
]

function SemaforoForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: SemaforoConfig
  myAnswer: SemaforoAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  // Modo 'single': una consigna → tres tarjetas de color
  if (config?.mode === 'single') {
    const [color, setColor] = useState<SemaforoColor | null>(myAnswer?.color || null)
    const labels = config.labels || {}
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!color) return
          onSubmit({ color } satisfies SemaforoAnswer)
        }}
      >
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Elige un color">
          {COLOR_CARDS.map((c) => {
            const active = color === c.color
            return (
              <button
                key={c.color}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setColor(c.color)}
                className={`flex min-h-24 flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-2 py-4 transition-colors ${
                  active ? c.active : `border-border bg-card ${c.hover}`
                }`}
              >
                <span className={`h-8 w-8 rounded-full ${c.dot} ${active ? 'ring-4 ring-white/60' : ''}`} aria-hidden />
                <span className="text-sm font-bold leading-tight text-center">
                  {labels[c.color] || c.fallback}
                </span>
                {active && <CheckCircle2 className="h-4 w-4" aria-hidden />}
              </button>
            )
          })}
        </div>
        <SubmitButton disabled={!color} submitting={submitting} label={color ? 'Enviar respuesta' : 'Elige un color'} />
      </form>
    )
  }

  // Modo 'multi': N preguntas → un color por cada una
  if (config?.mode === 'multi') {
    const [colorVotes, setColorVotes] = useState<Record<string, SemaforoColor>>(myAnswer?.colorVotes || {})
    const labels = config.labels || {}
    const items = config.items || []
    const allVoted = items.length > 0 && items.every((i) => colorVotes[i.id])
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!allVoted) {
            toast({ title: 'Falta marcar el color en algunas preguntas', description: 'Cada pregunta necesita un color antes de enviar.', variant: 'destructive' })
            return
          }
          onSubmit({ colorVotes } satisfies SemaforoAnswer)
        }}
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <fieldset key={item.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
              <legend className="sr-only">Pregunta {idx + 1}</legend>
              <p className="text-sm font-medium leading-snug">
                <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                {item.text}
              </p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Color para: ${item.text}`}>
                {COLOR_CARDS.map((c) => {
                  const active = colorVotes[item.id] === c.color
                  return (
                    <button
                      key={c.color}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setColorVotes((prev) => ({ ...prev, [item.id]: c.color }))}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-1 py-2.5 transition-colors ${
                        active ? c.active : `border-border bg-card ${c.hover}`
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-full ${c.dot}`} aria-hidden />
                      <span className="text-[11px] font-bold leading-tight text-center">
                        {labels[c.color] || c.fallback}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <SubmitButton
          disabled={!allVoted}
          submitting={submitting}
          label={allVoted ? `Enviar ${items.length} respuesta${items.length === 1 ? '' : 's'}` : 'Marca un color en cada pregunta'}
        />
      </form>
    )
  }

  // Modo 'items' (legacy): cada afirmación se evalúa una a una
  const [votes, setVotes] = useState<Record<string, SemaforoVote>>(myAnswer?.votes || {})

  const items = config?.items || []
  const allVoted = items.every((i) => votes[i.id])

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!allVoted) {
          toast({ title: 'Falta evaluar algunas afirmaciones', description: 'Marca todas antes de enviar.', variant: 'destructive' })
          return
        }
        onSubmit({ votes } satisfies SemaforoAnswer)
      }}
    >
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-xl border p-4 space-y-3 bg-card">
            <p className="text-sm font-medium leading-snug">
              <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
              {item.text}
            </p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Evaluar: ${item.text}`}>
              {VOTE_BUTTONS.map((b) => {
                const Icon = b.icon
                const active = votes[item.id] === b.vote
                return (
                  <button
                    key={b.vote}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVotes((prev) => ({ ...prev, [item.id]: b.vote }))}
                    className={`flex min-h-11 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg border-2 px-2 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                      active ? b.active : `bg-card text-muted-foreground ${b.classes}`
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <SubmitButton disabled={!allVoted} submitting={submitting} label={allVoted ? 'Enviar evaluación' : 'Evalúa todas las afirmaciones'} />
    </form>
  )
}

// ------------------- Nube de palabras -------------------
function WordCloudForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: WordCloudConfig
  myAnswer: WordCloudAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  const maxWords = Math.max(1, Math.min(5, config?.maxWords || 3))
  const [words, setWords] = useState<string[]>(myAnswer?.words || [])
  const [draft, setDraft] = useState('')

  function addWord() {
    const w = draft.trim()
    if (!w) return
    if (w.length > 24) {
      toast({ title: 'Palabra demasiado larga', description: 'Usa palabras clave de máximo 24 caracteres.', variant: 'destructive' })
      return
    }
    if (words.length >= maxWords) {
      toast({ title: `Máximo ${maxWords} palabras`, variant: 'destructive' })
      return
    }
    if (words.some((x) => x.toLowerCase() === w.toLowerCase())) {
      toast({ title: 'Ya escribiste esa palabra' })
      return
    }
    setWords([...words, w])
    setDraft('')
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const final = draft.trim() && words.length < maxWords ? [...words, draft.trim()] : words
        if (!final.length) {
          toast({ title: 'Escribe al menos una palabra', variant: 'destructive' })
          return
        }
        onSubmit({ words: final } satisfies WordCloudAnswer)
      }}
    >
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addWord()
            }
          }}
          placeholder="Escribe una palabra clave…"
          maxLength={24}
          aria-label="Nueva palabra clave"
          className="h-11"
        />
        <Button type="button" variant="secondary" className="h-11" onClick={addWord} disabled={words.length >= maxWords}>
          Añadir
        </Button>
      </div>

      {words.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Palabras agregadas">
          {words.map((w, i) => (
            <Badge key={i} variant="secondary" className="bg-brand-100 text-brand-900 hover:bg-brand-100 py-1.5 px-3 text-sm gap-1.5">
              {w}
              <button type="button" aria-label={`Quitar ${w}`} onClick={() => setWords(words.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {words.length}/{maxWords} palabras {draft.trim() && words.length < maxWords ? '· se enviará también lo que escribiste' : ''}
      </p>
      <SubmitButton submitting={submitting} />
    </form>
  )
}

// ------------------- Árbol de decisiones -------------------
function DecisionTreeForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: DecisionTreeConfig
  myAnswer: DecisionTreeAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  const nodes = useMemo(() => new Map((config?.nodes || []).map((n) => [n.id, n])), [config])
  // Se inicializan una vez por montaje: el componente se remonta al cambiar de pregunta
  const [steps, setSteps] = useState<DecisionStep[]>(myAnswer?.steps || [])
  const [comment, setComment] = useState(myAnswer?.comment || '')
  const [finished, setFinished] = useState(!!myAnswer?.leafOptionId)

  // Nodo actual: recorre desde la raíz según los pasos dados
  const current = useMemo(() => {
    if (finished) return null
    let nodeId = config?.rootId || null
    for (const step of steps) {
      const node = nodeId ? nodes.get(nodeId) : null
      if (!node) return null
      const opt = node.options.find((o) => o.id === step.optionId)
      if (!opt) return null
      nodeId = opt.nextId
    }
    return nodeId ? nodes.get(nodeId) || null : null
  }, [steps, nodes, config, finished])

  const leafOption = useMemo(() => {
    if (!finished) return null
    const last = steps[steps.length - 1]
    if (!last) return null
    const node = nodes.get(last.nodeId)
    return node?.options.find((o) => o.id === last.optionId) || null
  }, [finished, steps, nodes])

  if (!config?.rootId || !nodes.get(config.rootId)) {
    return <p className="text-sm text-muted-foreground">Esta pregunta aún no tiene un árbol configurado.</p>
  }

  function choose(optionId: string, nextId: string | null) {
    if (!current) return
    const newSteps = [...steps, { nodeId: current.id, optionId }]
    setSteps(newSteps)
    if (nextId === null) setFinished(true)
  }

  function goBack() {
    if (finished) {
      setFinished(false)
      setSteps(steps.slice(0, -1))
    } else {
      setSteps(steps.slice(0, -1))
    }
  }

  function restart() {
    setSteps([])
    setComment('')
    setFinished(false)
  }

  const labels = steps.map((s) => {
    const node = nodes.get(s.nodeId)
    return node?.options.find((o) => o.id === s.optionId)?.label || '…'
  })

  return (
    <div className="space-y-4">
      {/* Ruta recorrida */}
      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Ruta recorrida">
          {labels.map((l, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>→</span>}
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{l}</span>
            </span>
          ))}
        </div>
      )}

      {current && (
        <div className="space-y-3">
          <p className="text-base font-semibold leading-snug">{current.text}</p>
          <div className="grid gap-2.5">
            {current.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.id, opt.nextId)}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left text-base font-medium transition-colors hover:border-brand-500 hover:bg-brand-50/40 min-h-11"
              >
                {opt.nextId === null && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />}
                {opt.label}
              </button>
            ))}
          </div>
          {steps.length > 0 && !finished && (
            <Button type="button" variant="ghost" size="sm" onClick={goBack}>
              <CornerUpLeft className="h-4 w-4 mr-1" /> Volver un paso
            </Button>
          )}
        </div>
      )}

      {finished && leafOption && (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-brand-600 bg-brand-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">Conclusión</p>
            <p className="text-lg font-bold text-brand-900 leading-snug">{leafOption.label}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="decision-comment" className="text-sm font-medium">
              Comentario (opcional): ¿por qué llegaste a esta conclusión?
            </label>
            <Textarea
              id="decision-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explica brevemente tu razonamiento…"
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              size="lg"
              className="flex-1 min-h-11"
              disabled={submitting}
              onClick={() =>
                onSubmit({ steps, leafOptionId: leafOption.id, comment: comment.trim() } satisfies DecisionTreeAnswer)
              }
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar recorrido
            </Button>
            <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={restart} disabled={submitting}>
              Reiniciar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------- Pregunta abierta -------------------
function OpenTextForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: OpenTextConfig
  myAnswer: OpenTextAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  const maxLength = Math.max(10, Math.min(1000, config?.maxLength || 300))
  const [text, setText] = useState(myAnswer?.text || '')

  const valid = text.trim().length > 0

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({ text: text.trim() } satisfies OpenTextAnswer)
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxLength))}
        placeholder="Escribe tu respuesta…"
        rows={5}
        aria-label="Tu respuesta"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {text.length}/{maxLength} caracteres
        </p>
      </div>
      <SubmitButton disabled={!valid} submitting={submitting} />
    </form>
  )
}

// ------------------- Diagnóstico situacional -------------------
function DiagnosticoForm({
  config,
  myAnswer,
  onSubmit,
  submitting,
}: {
  config: DiagnosticoConfig
  myAnswer: DiagnosticoAnswer | null
  onSubmit: (payload: Record<string, unknown>) => void
  submitting: boolean
}) {
  const prompts = config?.prompts || []
  const [values, setValues] = useState<Record<string, string>>(myAnswer?.values || {})

  const allAnswered = prompts.every((p) => (values[p.id] || '').trim())
  const progress = prompts.length > 0 ? prompts.filter((p) => (values[p.id] || '').trim()).length : 0

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!allAnswered) {
          toast({ title: 'Faltan preguntas por responder', description: 'Completa todas para enviar tu diagnóstico.', variant: 'destructive' })
          return
        }
        onSubmit({ values } satisfies DiagnosticoAnswer)
      }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        {progress} de {prompts.length} preguntas completadas
      </div>

      {prompts.map((prompt, idx) => (
        <fieldset key={prompt.id} className="space-y-2.5 rounded-xl border p-4 bg-card">
          <legend className="sr-only">Pregunta {idx + 1}</legend>
          <p className="text-sm font-medium leading-snug">
            <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
            {prompt.label}
          </p>
          <DiagPromptInput prompt={prompt} value={values[prompt.id] || ''} onChange={(v) => setValues((prev) => ({ ...prev, [prompt.id]: v }))} />
        </fieldset>
      ))}

      <SubmitButton
        disabled={!allAnswered}
        submitting={submitting}
        label={allAnswered ? 'Enviar diagnóstico' : `Responde las ${prompts.length} preguntas`}
      />
    </form>
  )
}

function DiagPromptInput({
  prompt,
  value,
  onChange,
}: {
  prompt: DiagPrompt
  value: string
  onChange: (v: string) => void
}) {
  if (prompt.inputType === 'text') {
    const maxLength = Math.max(10, Math.min(1000, prompt.maxLength || 300))
    return (
      <div className="space-y-1.5">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={prompt.placeholder || 'Escribe tu respuesta…'}
          rows={3}
          aria-label={prompt.label}
        />
        <p className="text-xs text-muted-foreground text-right">
          {value.length}/{maxLength}
        </p>
      </div>
    )
  }

  if (prompt.inputType === 'choice') {
    const options = prompt.options || []
    return (
      <div className="grid gap-2" role="radiogroup" aria-label={prompt.label}>
        {options.map((opt, i) => {
          const active = value === opt
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors min-h-11 ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-900'
                  : 'border-border bg-card hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  active ? 'border-brand-600 bg-brand-600 text-white' : 'border-muted-foreground/40 text-muted-foreground'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  // Escala 1-5
  const scaleValue = Number(value) || 0
  const scaleColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-energy-500', 'bg-lime-600', 'bg-viva-600']
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={prompt.label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = scaleValue === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} de 5`}
              onClick={() => onChange(String(n))}
              className={`flex min-h-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors ${
                active
                  ? `border-transparent ${scaleColors[n]} text-white`
                  : 'border-border bg-card text-muted-foreground hover:border-brand-300'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{prompt.minLabel || '1'}</span>
        <span>{prompt.maxLabel || '5'}</span>
      </div>
    </div>
  )
}

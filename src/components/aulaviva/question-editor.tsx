'use client'

// Editor de preguntas para el panel docente: crea y edita los 5 tipos,
// con adjuntos (imagen) y temporizador opcional.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  type DecisionNode,
  type DecisionTreeConfig,
  type MultipleChoiceConfig,
  type OpenTextConfig,
  type QuestionAdmin,
  type QuestionType,
  type SemaforoConfig,
  type WordCloudConfig,
  QUESTION_TYPE_LABELS,
} from '@/lib/types'
import {
  CheckSquare,
  TrafficCone,
  Cloud,
  Network,
  MessageSquareText,
  Plus,
  Trash2,
  ImagePlus,
  X,
  Save,
  Timer,
  CircleCheck,
} from 'lucide-react'

export const TYPE_META: Record<QuestionType, { icon: typeof CheckSquare; desc: string }> = {
  multiple_choice: { icon: CheckSquare, desc: 'Opciones con selección única o múltiple' },
  semaforo: { icon: TrafficCone, desc: 'Afirmaciones para evaluar como válidas, parciales o no válidas' },
  word_cloud: { icon: Cloud, desc: 'Lluvia de palabras clave en vivo' },
  decision_tree: { icon: Network, desc: 'Recorrido guiado por pasos hasta una conclusión' },
  open_text: { icon: MessageSquareText, desc: 'Respuestas escritas en texto libre' },
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export interface EditorDraft {
  type: QuestionType
  title: string
  description: string
  imageUrl: string
  timerSeconds: string
  config: MultipleChoiceConfig & SemaforoConfig & WordCloudConfig & DecisionTreeConfig & OpenTextConfig
}

export function emptyDraft(type: QuestionType): EditorDraft {
  return {
    type,
    title: '',
    description: '',
    imageUrl: '',
    timerSeconds: '',
    config: {
      options: [],
      multipleSelect: false,
      showCorrect: true,
      items: [],
      allowPartial: true,
      maxWords: 3,
      rootId: null,
      nodes: [],
      maxLength: 300,
    },
  }
}

export function draftFromQuestion(q: QuestionAdmin): EditorDraft {
  const base = emptyDraft(q.type)
  return {
    type: q.type,
    title: q.title,
    description: q.description || '',
    imageUrl: q.imageUrl || '',
    timerSeconds: q.timerSeconds ? String(q.timerSeconds) : '',
    config: { ...base.config, ...(q.config as EditorDraft['config']) },
  }
}

export function QuestionEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  saveLabel,
}: {
  draft: EditorDraft
  onChange: (d: EditorDraft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saveLabel: string
}) {
  const d = draft
  const set = (patch: Partial<EditorDraft>) => onChange({ ...d, ...patch })
  const setConfig = (patch: Partial<EditorDraft['config']>) => onChange({ ...d, config: { ...d.config, ...patch } })

  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickImage(file: File) {
    if (file.size > 1_500_000) {
      toast({ title: 'Imagen demasiado grande', description: 'Usa una imagen de máximo 1.5 MB o una URL.', variant: 'destructive' })
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      set({ imageUrl: String(reader.result) })
      setUploading(false)
    }
    reader.onerror = () => {
      toast({ title: 'No se pudo leer la imagen', variant: 'destructive' })
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  function canSave(): boolean {
    if (!d.title.trim()) return false
    if (d.type === 'multiple_choice') {
      const opts = d.config.options.filter((o) => o.text.trim())
      return opts.length >= 2
    }
    if (d.type === 'semaforo') return d.config.items.filter((i) => i.text.trim()).length >= 1
    if (d.type === 'word_cloud') return d.config.maxWords >= 1
    if (d.type === 'open_text') return d.config.maxLength >= 10
    if (d.type === 'decision_tree') {
      const nodes = d.config.nodes
      return !!d.config.rootId && nodes.length >= 1 && nodes.every((n) => n.text.trim() && n.options.length >= 1 && n.options.every((o) => o.label.trim()))
    }
    return true
  }

  return (
    <div className="space-y-5">
      {/* Campos comunes */}
      <div className="space-y-1.5">
        <Label htmlFor="q-title">Enunciado de la pregunta *</Label>
        <Input
          id="q-title"
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Escribe aquí tu pregunta…"
          maxLength={300}
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-desc">Descripción o indicaciones (opcional)</Label>
        <Textarea
          id="q-desc"
          value={d.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Contexto, instrucciones…"
          rows={2}
          maxLength={400}
        />
      </div>

      {/* Adjunto */}
      <div className="space-y-1.5">
        <Label>Imagen de apoyo (opcional)</Label>
        {d.imageUrl ? (
          <div className="relative rounded-lg border overflow-hidden bg-muted/30">
            <img src={d.imageUrl} alt="Imagen adjunta" className="max-h-52 w-full object-contain" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={() => set({ imageUrl: '' })}
              aria-label="Quitar imagen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImagePlus className="h-4 w-4 mr-2" /> {uploading ? 'Cargando…' : 'Subir imagen'}
            </Button>
            <Input
              placeholder="…o pega una URL de imagen"
              value={d.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              className="h-10"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickImage(f)
                e.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-timer" className="flex items-center gap-1.5">
          <Timer className="h-4 w-4" /> Temporizador (opcional, cierra automáticamente)
        </Label>
        <Input
          id="q-timer"
          type="number"
          min={5}
          max={3600}
          value={d.timerSeconds}
          onChange={(e) => set({ timerSeconds: e.target.value })}
          placeholder="Ej.: 60 segundos"
          className="h-10 w-44"
        />
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Configuración · {QUESTION_TYPE_LABELS[d.type]}
        </p>
        {d.type === 'multiple_choice' && <MultipleEditor draft={d} setConfig={setConfig} />}
        {d.type === 'semaforo' && <SemaforoEditor draft={d} setConfig={setConfig} />}
        {d.type === 'word_cloud' && <WordCloudEditor draft={d} setConfig={setConfig} />}
        {d.type === 'decision_tree' && <DecisionEditor draft={d} setConfig={setConfig} />}
        {d.type === 'open_text' && <OpenTextEditor draft={d} setConfig={setConfig} />}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSave} disabled={saving || !canSave()}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando…' : saveLabel}
        </Button>
      </div>
    </div>
  )
}

// ------------------- Opción múltiple -------------------
function MultipleEditor({
  draft,
  setConfig,
}: {
  draft: EditorDraft
  setConfig: (p: Partial<EditorDraft['config']>) => void
}) {
  const options = draft.config.options
  function update(i: number, patch: Partial<{ text: string; correct: boolean }>) {
    const next = options.map((o, j) => (i === j ? { ...o, ...patch } : o))
    setConfig({ options: next })
  }
  return (
    <div className="space-y-3">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold text-muted-foreground">
            {String.fromCharCode(65 + i)}
          </span>
          <Input
            value={opt.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder={`Opción ${String.fromCharCode(65 + i)}`}
            maxLength={150}
            className="h-10"
          />
          <button
            type="button"
            title={opt.correct ? 'Es respuesta correcta' : 'Marcar como correcta'}
            aria-pressed={!!opt.correct}
            onClick={() => update(i, { correct: !opt.correct })}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              opt.correct ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border text-muted-foreground hover:border-emerald-400'
            }`}
          >
            <CircleCheck className="h-4.5 w-4.5" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfig({ options: options.filter((_, j) => j !== i) })}
            aria-label={`Eliminar opción ${String.fromCharCode(65 + i)}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {options.length < 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfig({ options: [...options, { id: uid(), text: '' }] })}
        >
          <Plus className="h-4 w-4 mr-1" /> Añadir opción
        </Button>
      )}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mc-multi" className="font-normal">
            Permitir seleccionar varias opciones
          </Label>
          <Switch
            id="mc-multi"
            checked={!!draft.config.multipleSelect}
            onCheckedChange={(v) => setConfig({ multipleSelect: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mc-correct" className="font-normal">
            Resaltar la(s) respuesta(s) correcta(s) en los resultados
          </Label>
          <Switch
            id="mc-correct"
            checked={!!draft.config.showCorrect}
            onCheckedChange={(v) => setConfig({ showCorrect: v })}
          />
        </div>
      </div>
    </div>
  )
}

// ------------------- Semáforo -------------------
function SemaforoEditor({
  draft,
  setConfig,
}: {
  draft: EditorDraft
  setConfig: (p: Partial<EditorDraft['config']>) => void
}) {
  const items = draft.config.items
  function update(i: number, text: string) {
    setConfig({ items: items.map((it, j) => (i === j ? { ...it, text } : it)) })
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cada afirmación será evaluada por los alumnos con el semáforo: 🟢 Válida · 🟡 Parcial · 🔴 No válida.
      </p>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              draft.config.allowPartial ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {i + 1}
          </span>
          <Input
            value={item.text}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Afirmación ${i + 1}`}
            maxLength={250}
            className="h-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfig({ items: items.filter((_, j) => j !== i) })}
            aria-label={`Eliminar afirmación ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {items.length < 10 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfig({ items: [...items, { id: uid(), text: '' }] })}>
          <Plus className="h-4 w-4 mr-1" /> Añadir afirmación
        </Button>
      )}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Label htmlFor="sf-partial" className="font-normal">
          Incluir la opción amarilla «Parcial»
        </Label>
        <Switch id="sf-partial" checked={!!draft.config.allowPartial} onCheckedChange={(v) => setConfig({ allowPartial: v })} />
      </div>
    </div>
  )
}

// ------------------- Nube de palabras -------------------
function WordCloudEditor({
  draft,
  setConfig,
}: {
  draft: EditorDraft
  setConfig: (p: Partial<EditorDraft['config']>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="wc-max">Palabras por participante (1-5)</Label>
        <Select
          value={String(draft.config.maxWords || 3)}
          onValueChange={(v) => setConfig({ maxWords: Number(v) })}
        >
          <SelectTrigger id="wc-max" className="w-32 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} {n === 1 ? 'palabra' : 'palabras'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Las palabras se agrupan automáticamente (sin acentos ni mayúsculas) y las más repetidas se muestran más grandes.
      </p>
    </div>
  )
}

// ------------------- Pregunta abierta -------------------
function OpenTextEditor({
  draft,
  setConfig,
}: {
  draft: EditorDraft
  setConfig: (p: Partial<EditorDraft['config']>) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="ot-max">Longitud máxima de la respuesta</Label>
      <Input
        id="ot-max"
        type="number"
        min={10}
        max={1000}
        value={draft.config.maxLength || 300}
        onChange={(e) => setConfig({ maxLength: Math.max(10, Math.min(1000, Number(e.target.value) || 300)) })}
        className="h-10 w-40"
      />
      <p className="text-xs text-muted-foreground">Las respuestas se muestran en el panel con el nombre de cada participante.</p>
    </div>
  )
}

// ------------------- Árbol de decisiones -------------------
function DecisionEditor({
  draft,
  setConfig,
}: {
  draft: EditorDraft
  setConfig: (p: Partial<EditorDraft['config']>) => void
}) {
  const nodes = draft.config.nodes
  const rootId = draft.config.rootId

  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: n.text ? (n.text.length > 40 ? n.text.slice(0, 40) + '…' : n.text) : '(sin texto)' })),
    [nodes]
  )

  function addNode() {
    const node: DecisionNode = { id: uid(), text: '', options: [{ id: uid(), label: '', nextId: null }] }
    setConfig({ nodes: [...nodes, node], rootId: rootId || node.id })
  }

  function updateNode(i: number, patch: Partial<DecisionNode>) {
    setConfig({ nodes: nodes.map((n, j) => (i === j ? { ...n, ...patch } : n)) })
  }

  function removeNode(i: number) {
    const removed = nodes[i]
    const next = nodes.filter((_, j) => j !== i)
    // Limpia referencias al nodo eliminado
    for (const n of next) {
      n.options = n.options.map((o) => (o.nextId === removed.id ? { ...o, nextId: null } : o))
    }
    setConfig({ nodes: next, rootId: rootId === removed.id ? next[0]?.id || null : rootId })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Cada <strong>nodo</strong> es un paso con opciones. Una opción puede llevar a otro nodo o
        terminar el recorrido como <Badge variant="secondary" className="bg-teal-100 text-teal-800">conclusión</Badge>.
        Al final, los participantes pueden dejar un comentario.
      </p>

      <div className="space-y-1.5">
        <Label>Nodo inicial (raíz)</Label>
        <Select value={rootId || ''} onValueChange={(v) => setConfig({ rootId: v })}>
          <SelectTrigger className="w-full sm:w-80 h-10">
            <SelectValue placeholder="Selecciona el nodo inicial" />
          </SelectTrigger>
          <SelectContent>
            {nodeOptions.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {nodes.map((node, i) => (
          <div key={node.id} className="rounded-xl border p-4 space-y-3 bg-card">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {rootId === node.id ? 'RAÍZ' : `NODO ${i + 1}`}
              </Badge>
              {rootId === node.id && node.options.length > 0 && (
                <span className="text-xs text-muted-foreground">Punto de partida del recorrido</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeNode(i)}
                aria-label="Eliminar nodo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <Input
              value={node.text}
              onChange={(e) => updateNode(i, { text: e.target.value })}
              placeholder="Pregunta o paso de este nodo…"
              maxLength={250}
              className="h-10"
            />

            <div className="space-y-2">
              {node.options.map((opt, j) => (
                <div key={opt.id} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      updateNode(i, {
                        options: node.options.map((o, k) => (k === j ? { ...o, label: e.target.value } : o)),
                      })
                    }
                    placeholder={`Opción ${j + 1}`}
                    maxLength={200}
                    className="h-10 flex-1"
                  />
                  <Select
                    value={opt.nextId || '__end__'}
                    onValueChange={(v) =>
                      updateNode(i, {
                        options: node.options.map((o, k) =>
                          k === j ? { ...o, nextId: v === '__end__' ? null : v } : o
                        ),
                      })
                    }
                  >
                    <SelectTrigger className="h-10 sm:w-56 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__end__">⏹ Conclusión (fin del recorrido)</SelectItem>
                      {nodeOptions
                        .filter((n) => n.id !== node.id)
                        .map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            ↳ Ir a: {n.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => updateNode(i, { options: node.options.filter((_, k) => k !== j) })}
                    aria-label="Eliminar opción"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {node.options.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateNode(i, { options: [...node.options, { id: uid(), label: '', nextId: null }] })}
                >
                  <Plus className="h-4 w-4 mr-1" /> Añadir opción
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addNode}>
          <Plus className="h-4 w-4 mr-1" /> Añadir nodo
        </Button>
      </div>
    </div>
  )
}

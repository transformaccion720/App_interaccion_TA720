'use client'

// Pestaña "Preguntas": lista de preguntas con CRUD, reordenar y editor.
import { useState } from 'react'
import type { AdminLive, QuestionAdmin, QuestionType } from '@/lib/types'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ICONS } from '@/lib/types'
import {
  type EditorDraft,
  TYPE_META,
  emptyDraft,
  draftFromQuestion,
  QuestionEditor,
} from './question-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
  Copy,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-muted text-muted-foreground' },
  open: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-800' },
  revealed: { label: 'Resultados visibles', cls: 'bg-violet-100 text-violet-800' },
  closed: { label: 'Cerrada', cls: 'bg-amber-100 text-amber-800' },
}

export function QuestionsTab({
  live,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onActivate,
  busyQuestion,
}: {
  live: AdminLive
  onCreate: (type: QuestionType, draft: EditorDraft) => Promise<boolean>
  onUpdate: (q: QuestionAdmin, draft: EditorDraft) => Promise<boolean>
  onDelete: (q: QuestionAdmin) => Promise<void>
  onReorder: (ids: string[]) => Promise<void>
  onActivate: (q: QuestionAdmin) => void
  busyQuestion: string | null
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorType, setEditorType] = useState<QuestionType | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<QuestionAdmin | null>(null)
  const [draft, setDraft] = useState<EditorDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuestionAdmin | null>(null)

  const questions = live.questions

  function openCreate(type: QuestionType) {
    setEditorMode('create')
    setEditorType(type)
    setEditingQuestion(null)
    setDraft(emptyDraft(type))
    setEditorOpen(true)
  }

  function openEdit(q: QuestionAdmin) {
    setEditorMode('edit')
    setEditingQuestion(q)
    setDraft(draftFromQuestion(q))
    setEditorOpen(true)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    let ok = false
    if (editorMode === 'create' && editorType) {
      ok = await onCreate(editorType, draft)
    } else if (editorMode === 'edit' && editingQuestion) {
      ok = await onUpdate(editingQuestion, draft)
    }
    setSaving(false)
    if (ok) {
      setEditorOpen(false)
      setDraft(null)
    }
  }

  async function move(q: QuestionAdmin, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= questions.length) return
    const ids = questions.map((x) => x.id)
    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]
    await onReorder(ids)
  }

  return (
    <div className="space-y-4">
      {/* Selector de nuevo tipo */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Añadir una pregunta</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(Object.keys(TYPE_META) as QuestionType[]).map((type) => {
            const Meta = TYPE_META[type]
            const Icon = Meta.icon
            return (
              <button
                key={type}
                type="button"
                onClick={() => openCreate(type)}
                className="group flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors hover:border-teal-400 hover:bg-teal-50/50 min-h-11"
              >
                <Icon className="h-5 w-5 text-teal-700" />
                <span className="text-sm font-semibold leading-tight">{QUESTION_TYPE_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground leading-tight">{Meta.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista */}
      {questions.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground bg-card">
          Aún no hay preguntas. Añade la primera con los botones de arriba.
        </div>
      )}

      <div className="space-y-2.5">
        {questions.map((q, i) => {
          const stateBadge = STATE_BADGE[q.state]
          const Icon = TYPE_META[q.type].icon
          return (
            <div key={q.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-sm">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="font-medium text-sm truncate max-w-full">{q.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[11px]">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  <Badge variant="secondary" className={`text-[11px] ${stateBadge.cls}`}>{stateBadge.label}</Badge>
                  <span className="text-xs text-muted-foreground">{q.answeredCount} respuestas</span>
                  {q.imageUrl && <span className="text-xs text-muted-foreground">· con imagen</span>}
                  {q.timerSeconds && <span className="text-xs text-muted-foreground">· ⏱ {q.timerSeconds}s</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {q.state === 'pending' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onActivate(q)}
                    disabled={busyQuestion === q.id}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Activar
                  </Button>
                )}
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => move(q, -1)}
                    disabled={i === 0}
                    aria-label="Subir pregunta"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => move(q, 1)}
                    disabled={i === questions.length - 1}
                    aria-label="Bajar pregunta"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)} aria-label="Editar pregunta">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(q)}
                  aria-label="Eliminar pregunta"
                  disabled={busyQuestion === q.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Diálogo editor */}
      <Dialog open={editorOpen} onOpenChange={(open) => !open && setEditorOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editorMode === 'create' ? `Nueva pregunta · ${editorType ? QUESTION_TYPE_LABELS[editorType] : ''}` : 'Editar pregunta'}
            </DialogTitle>
            <DialogDescription>
              {editorMode === 'edit' && editingQuestion && editingQuestion.answeredCount > 0
                ? 'Ojo: esta pregunta ya tiene respuestas registradas.'
                : 'Configura el enunciado y su contenido.'}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <QuestionEditor
              draft={draft}
              onChange={setDraft}
              onSave={save}
              onCancel={() => setEditorOpen(false)}
              saving={saving}
              saveLabel={editorMode === 'create' ? 'Crear pregunta' : 'Guardar cambios'}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta pregunta?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.title}» y sus {deleteTarget?.answeredCount} respuestas se borrarán definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await onDelete(deleteTarget)
                setDeleteTarget(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

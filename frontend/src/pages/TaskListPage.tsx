import { useEffect, useMemo, useState } from 'react'
import { CaretDown, CaretRight, CheckCircle, Circle, DotsThreeCircle, Plus, Trash } from '@phosphor-icons/react'
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  reopenTask,
  startTask,
  updateTask,
  type ChecklistItem,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from '../lib/tasksApi'
import { Button, Panel, SectionLabel } from '../components/ui'

const PRIORITY_ORDER: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: 'var(--rose)',
  HIGH: 'var(--warm)',
  MEDIUM: 'var(--cyan)',
  LOW: 'var(--ink-faint)',
}

function emptyRequest(t?: TaskItem) {
  return {
    title: t?.title ?? '',
    notes: t?.notes ?? null,
    priority: t?.priority ?? ('MEDIUM' as TaskPriority),
    tags: t?.tags ?? null,
    dueDate: t?.dueDate ?? null,
    checklist: t?.checklist ?? [],
  }
}

export function TaskListPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM')
  const [newDueDate, setNewDueDate] = useState('')
  const [newTags, setNewTags] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [newChecklistText, setNewChecklistText] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const refresh = () => listTasks().then(setTasks)
  useEffect(() => { refresh() }, [])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) (t.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((tag) => set.add(tag))
    return Array.from(set).sort()
  }, [tasks])

  const visibleTasks = useMemo(() => {
    if (!tagFilter) return tasks
    return tasks.filter((t) => (t.tags ?? '').split(',').map((s) => s.trim()).includes(tagFilter))
  }, [tasks, tagFilter])

  async function add() {
    if (!newTitle.trim()) return
    await createTask({
      title: newTitle.trim(),
      notes: null,
      priority: newPriority,
      tags: newTags.trim() || null,
      dueDate: newDueDate ? new Date(newDueDate).toISOString() : null,
      checklist: [],
    })
    setNewTitle('')
    setNewPriority('MEDIUM')
    setNewDueDate('')
    setNewTags('')
    refresh()
  }

  async function cycleStatus(t: TaskItem) {
    if (t.status === 'TODO') await startTask(t.id)
    else if (t.status === 'IN_PROGRESS') await completeTask(t.id)
    else await reopenTask(t.id)
    refresh()
  }

  async function saveTitle(t: TaskItem) {
    if (editTitle.trim()) await updateTask(t.id, { ...emptyRequest(t), title: editTitle.trim() })
    setEditingId(null)
    refresh()
  }

  async function setPriority(t: TaskItem, priority: TaskPriority) {
    await updateTask(t.id, { ...emptyRequest(t), priority })
    refresh()
  }

  async function setDueDate(t: TaskItem, value: string) {
    await updateTask(t.id, { ...emptyRequest(t), dueDate: value ? new Date(value).toISOString() : null })
    refresh()
  }

  async function setTags(t: TaskItem, value: string) {
    await updateTask(t.id, { ...emptyRequest(t), tags: value.trim() || null })
    refresh()
  }

  async function addChecklistItem(t: TaskItem) {
    if (!newChecklistText.trim()) return
    const checklist: ChecklistItem[] = [...t.checklist, { text: newChecklistText.trim(), done: false }]
    await updateTask(t.id, { ...emptyRequest(t), checklist })
    setNewChecklistText('')
    refresh()
  }

  async function toggleChecklistItem(t: TaskItem, index: number) {
    const checklist = t.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c))
    await updateTask(t.id, { ...emptyRequest(t), checklist })
    refresh()
  }

  async function removeChecklistItem(t: TaskItem, index: number) {
    const checklist = t.checklist.filter((_, i) => i !== index)
    await updateTask(t.id, { ...emptyRequest(t), checklist })
    refresh()
  }

  async function remove(id: number, title: string) {
    if (!window.confirm(`Delete task "${title}"? This can't be undone.`)) return
    await deleteTask(id)
    refresh()
  }

  const groups: { label: string; status: TaskStatus }[] = [
    { label: 'In progress', status: 'IN_PROGRESS' },
    { label: 'To do', status: 'TODO' },
    { label: 'Done', status: 'DONE' },
  ]

  return (
    <div className="flex h-full gap-4">
      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className="devtools-input flex-1"
                placeholder="Add a task…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <Button variant="primary" onClick={add} disabled={!newTitle.trim()}>
                <Plus size={14} weight="bold" /> Add
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <select className="devtools-input w-auto" value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)}>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input type="date" className="devtools-input w-auto" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              <input
                className="devtools-input w-auto flex-1"
                placeholder="tags, comma, separated"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
              />
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setTagFilter(null)}
                className={`rounded-full px-2.5 py-1 text-[10.5px] ${tagFilter === null ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'}`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] ${tagFilter === tag ? 'bg-glass-strong text-cyan' : 'text-ink-faint hover:bg-glass'}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {visibleTasks.length === 0 && <div className="p-4 text-center text-sm text-ink-faint">No tasks yet — add one above.</div>}

          {groups.map(({ label, status }) => {
            const items = visibleTasks
              .filter((t) => t.status === status)
              .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
            if (items.length === 0) return null
            return (
              <div key={status} className="flex flex-col gap-1.5">
                <SectionLabel>{label} ({items.length})</SectionLabel>
                {items.map((t) => {
                  const overdue = t.dueDate && t.status !== 'DONE' && new Date(t.dueDate).getTime() < Date.now()
                  const doneCount = t.checklist.filter((c) => c.done).length
                  const expanded = expandedId === t.id
                  return (
                    <div key={t.id} className="group flex flex-col gap-2 rounded-xl border border-rule-soft bg-glass px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <button onClick={() => cycleStatus(t)} className="mt-0.5 shrink-0 text-ink-faint hover:text-cyan">
                          <StatusIcon status={t.status} />
                        </button>

                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} title={t.priority} />

                        <div className="flex flex-1 flex-col gap-0.5">
                          {editingId === t.id ? (
                            <input
                              autoFocus
                              className="devtools-input py-1"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => saveTitle(t)}
                              onKeyDown={(e) => e.key === 'Enter' && saveTitle(t)}
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingId(t.id); setEditTitle(t.title) }}
                              className={`text-left text-sm ${t.status === 'DONE' ? 'text-ink-faint line-through' : 'text-ink'}`}
                            >
                              {t.title}
                            </button>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-faint">
                            <span>{timingLine(t)}</span>
                            {t.dueDate && (
                              <span className={overdue ? 'font-medium text-rose' : ''}>
                                · due {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {(t.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((tag) => (
                              <span key={tag} className="rounded-full bg-glass-strong px-1.5 py-0.5 text-cyan">#{tag}</span>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedId(expanded ? null : t.id)}
                          className="mt-0.5 flex shrink-0 items-center gap-1 text-[10.5px] text-ink-faint hover:text-ink-soft"
                        >
                          {expanded ? <CaretDown size={11} weight="bold" /> : <CaretRight size={11} weight="bold" />}
                          {t.checklist.length > 0 && `${doneCount}/${t.checklist.length}`}
                        </button>

                        <button onClick={() => remove(t.id, t.title)} className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-rose group-hover:opacity-100">
                          <Trash size={13} weight="light" />
                        </button>
                      </div>

                      {expanded && (
                        <div className="ml-9 flex flex-col gap-2 border-t border-rule-soft pt-2">
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
                              Priority
                              <select
                                className="devtools-input w-auto py-1"
                                value={t.priority}
                                onChange={(e) => setPriority(t, e.target.value as TaskPriority)}
                              >
                                {PRIORITY_ORDER.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
                              Due
                              <input
                                type="date"
                                className="devtools-input w-auto py-1"
                                value={t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ''}
                                onChange={(e) => setDueDate(t, e.target.value)}
                              />
                            </label>
                            <input
                              className="devtools-input flex-1 py-1"
                              placeholder="tags, comma, separated"
                              defaultValue={t.tags ?? ''}
                              onBlur={(e) => setTags(t, e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            {t.checklist.map((c, i) => (
                              <div key={i} className="group/item flex items-center gap-2 text-xs">
                                <button onClick={() => toggleChecklistItem(t, i)} className="shrink-0 text-ink-faint hover:text-cyan">
                                  {c.done ? <CheckCircle size={14} weight="fill" className="text-emerald" /> : <Circle size={14} weight="light" />}
                                </button>
                                <span className={c.done ? 'flex-1 text-ink-faint line-through' : 'flex-1 text-ink-soft'}>{c.text}</span>
                                <button
                                  onClick={() => removeChecklistItem(t, i)}
                                  className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-rose group-hover/item:opacity-100"
                                >
                                  <Trash size={11} weight="light" />
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                className="devtools-input flex-1 py-1 text-xs"
                                placeholder="Add checklist item…"
                                value={expandedId === t.id ? newChecklistText : ''}
                                onChange={(e) => setNewChecklistText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addChecklistItem(t)}
                              />
                              <Button variant="ghost" onClick={() => addChecklistItem(t)}>
                                <Plus size={12} weight="bold" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'DONE') return <CheckCircle size={18} weight="fill" className="text-emerald" />
  if (status === 'IN_PROGRESS') return <DotsThreeCircle size={18} weight="fill" className="text-cyan" />
  return <Circle size={18} weight="light" />
}

function timingLine(t: TaskItem): string {
  const created = fmt(t.createdAt)
  if (t.status === 'DONE' && t.completedAt && t.startedAt) {
    return `Started ${fmt(t.startedAt)} · Done ${fmt(t.completedAt)} · took ${duration(t.startedAt, t.completedAt)}`
  }
  if (t.status === 'IN_PROGRESS' && t.startedAt) {
    return `Started ${fmt(t.startedAt)} · running for ${duration(t.startedAt, new Date().toISOString())}`
  }
  return `Created ${created}`
}

function fmt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

function duration(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  const mins = Math.max(0, Math.round(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 24) return `${hours}h ${rem}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

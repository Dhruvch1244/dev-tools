import { useEffect, useMemo, useState } from 'react'
import { ClockCounterClockwise, Plus, Terminal, Trash } from '@phosphor-icons/react'
import { parsePlaceholders, renderTemplate } from '../lib/commandTemplates'
import {
  addCommandHistory,
  clearCommandHistory,
  createCommandTemplate,
  deleteCommandHistory,
  deleteCommandTemplate,
  listCommandHistory,
  listCommandTemplates,
  updateCommandTemplate,
  type CommandHistoryEntry,
  type CommandTemplate,
} from '../lib/commandTemplatesApi'
import { Button, Panel, SectionLabel, ErrorBanner, CopyButton } from '../components/ui'
import { ResizablePanel } from '../components/ResizablePanel'

const SAMPLE_TEMPLATE = 'aws s3 cp <source=./file.txt> <dest=s3://my-bucket/file.txt>'

export function CommandTemplatesPage() {
  const [templates, setTemplates] = useState<CommandTemplate[]>([])
  const [history, setHistory] = useState<CommandHistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTemplate, setEditTemplate] = useState('')

  const [values, setValues] = useState<Record<string, string>>({})

  const refresh = () => {
    listCommandTemplates().then(setTemplates)
    listCommandHistory().then(setHistory)
  }
  useEffect(() => { refresh() }, [])

  const selected = templates.find((t) => t.id === selectedId) ?? null
  const placeholders = useMemo(() => (selected ? parsePlaceholders(selected.template) : []), [selected])

  const rendered = selected ? renderTemplate(selected.template, values) : ''

  function defaultValuesFor(t: CommandTemplate): Record<string, string> {
    const next: Record<string, string> = {}
    for (const p of parsePlaceholders(t.template)) next[p.name] = p.defaultValue
    return next
  }

  function selectTemplate(t: CommandTemplate) {
    setSelectedId(t.id)
    setEditing(false)
    setValues(defaultValuesFor(t))
  }

  function startNew() {
    setEditName('')
    setEditTemplate(SAMPLE_TEMPLATE)
    setSelectedId(null)
    setValues({})
    setEditing(true)
  }

  function startEdit(t: CommandTemplate) {
    setEditName(t.name)
    setEditTemplate(t.template)
    setSelectedId(t.id)
    setEditing(true)
  }

  async function saveTemplate() {
    if (!editName.trim() || !editTemplate.trim()) return
    setError(null)
    try {
      const saved = selectedId != null
        ? await updateCommandTemplate(selectedId, editName.trim(), editTemplate)
        : await createCommandTemplate(editName.trim(), editTemplate)
      setEditing(false)
      await refresh()
      setSelectedId(saved.id)
      // keep any values that still match a placeholder name, fill in the rest with defaults
      setValues((prev) => {
        const defaults = defaultValuesFor(saved)
        const merged: Record<string, string> = {}
        for (const key of Object.keys(defaults)) merged[key] = prev[key] ?? defaults[key]
        return merged
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function removeTemplate(id: number) {
    if (!window.confirm('Delete this template?')) return
    await deleteCommandTemplate(id)
    if (selectedId === id) setSelectedId(null)
    refresh()
  }

  async function generate() {
    if (!selected || !rendered.trim()) return
    await addCommandHistory(selected.name, rendered, JSON.stringify(values))
    refresh()
  }

  function rerunHistoryEntry(h: CommandHistoryEntry) {
    const template = templates.find((t) => t.name === h.templateName)
    if (!template) return
    setSelectedId(template.id)
    setEditing(false)
    if (h.valuesJson) {
      try {
        setValues(JSON.parse(h.valuesJson))
      } catch {
        /* older history entry without saved values — leave defaults */
      }
    }
  }

  async function removeHistoryEntry(id: number) {
    await deleteCommandHistory(id)
    refresh()
  }

  async function clearAllHistory() {
    if (!window.confirm('Clear all command history?')) return
    await clearCommandHistory()
    refresh()
  }

  return (
    <div className="flex h-full gap-4">
      <ResizablePanel storageKey="command-templates" className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col gap-2 p-3">
            <SectionLabel>Templates</SectionLabel>
            <Button variant="primary" onClick={startNew}>
              <Plus size={14} weight="bold" /> New template
            </Button>
          </div>
        </Panel>
        <Panel className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
            {templates.length === 0 && <div className="px-1 py-1 text-xs text-ink-faint">No templates yet.</div>}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                  selectedId === t.id && !editing ? 'bg-glass-strong text-ink' : 'text-ink-faint hover:bg-glass'
                }`}
              >
                <Terminal size={13} weight="light" className="shrink-0" />
                <span className="flex-1 truncate">{t.name}</span>
                <Trash
                  size={12}
                  weight="light"
                  className="shrink-0 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); removeTemplate(t.id) }}
                />
              </button>
            ))}
          </div>
        </Panel>
      </ResizablePanel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          {error && <ErrorBanner message={error} />}

          {editing ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-panel p-4">
              <SectionLabel>{selectedId != null ? 'Edit template' : 'New template'}</SectionLabel>
              <input className="devtools-input" placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <textarea
                className="devtools-input resize-none font-mono text-xs"
                rows={3}
                spellCheck={false}
                placeholder="aws s3 cp <source=./file.txt> <dest=s3://bucket/file.txt>"
                value={editTemplate}
                onChange={(e) => setEditTemplate(e.target.value)}
              />
              <div className="text-[10.5px] text-ink-faint">
                Wrap variable parts in <code className="rounded bg-glass px-1">&lt;name&gt;</code> or{' '}
                <code className="rounded bg-glass px-1">&lt;name=default value&gt;</code> — each unique name becomes an editable field.
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={saveTemplate} disabled={!editName.trim() || !editTemplate.trim()}>Save</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : !selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
              Select a template, or create a new one.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-ink">{selected.name}</div>
                <Button variant="ghost" onClick={() => startEdit(selected)}>Edit</Button>
              </div>
              <div className="rounded-xl border border-rule-soft bg-glass px-3 py-2 font-mono text-[11.5px] text-ink-faint">
                {selected.template}
              </div>

              {placeholders.length > 0 && (
                <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-panel p-3">
                  <SectionLabel>Fields</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {placeholders.map((p) => (
                      <label key={p.name} className="flex flex-col gap-1 text-xs text-ink-soft">
                        {p.name}
                        <input
                          className="devtools-input font-mono"
                          value={values[p.name] ?? ''}
                          onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <SectionLabel>Generated command</SectionLabel>
                  <div className="flex items-center gap-2">
                    <CopyButton text={rendered} />
                    <Button variant="primary" onClick={generate} disabled={!rendered.trim()}>Add to history</Button>
                  </div>
                </div>
                <div className="rounded-xl border border-rule bg-panel px-3 py-2.5 font-mono text-[13px] text-ink">
                  {rendered || <span className="text-ink-faint">—</span>}
                </div>
              </div>
            </>
          )}

          <div className="mt-2 flex flex-col gap-2 border-t border-rule-soft pt-3">
            <div className="flex items-center justify-between">
              <SectionLabel>History</SectionLabel>
              {history.length > 0 && <Button variant="ghost" onClick={clearAllHistory}>Clear all</Button>}
            </div>
            {history.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <ClockCounterClockwise size={14} weight="light" /> Generated commands show up here for reuse.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((h) => {
                  const canRerun = h.valuesJson != null && templates.some((t) => t.name === h.templateName)
                  return (
                    <div key={h.id} className="group flex items-center gap-2 rounded-lg bg-glass px-2.5 py-1.5">
                      <span className="shrink-0 rounded-full bg-glass-strong px-2 py-0.5 text-[10px] text-ink-faint">{h.templateName}</span>
                      <button
                        onClick={() => canRerun && rerunHistoryEntry(h)}
                        disabled={!canRerun}
                        title={canRerun ? 'Reopen this template with these exact field values' : 'Template no longer exists or predates re-run support'}
                        className={`flex-1 truncate text-left font-mono text-[11.5px] ${canRerun ? 'text-ink-soft hover:text-cyan' : 'cursor-default text-ink-soft'}`}
                      >
                        {h.renderedCommand}
                      </button>
                      <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <CopyButton text={h.renderedCommand} label="" />
                      </span>
                      <button onClick={() => removeHistoryEntry(h.id)} className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-rose group-hover:opacity-100">
                        <Trash size={12} weight="light" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

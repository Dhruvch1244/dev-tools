async function jsonFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? 'Request failed')
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export type CommandTemplate = { id: number; name: string; template: string; createdAt: string }
export type CommandHistoryEntry = { id: number; templateName: string; renderedCommand: string; createdAt: string }

export const listCommandTemplates = () => jsonFetch<CommandTemplate[]>('/api/command-templates', 'GET')
export const createCommandTemplate = (name: string, template: string) =>
  jsonFetch<CommandTemplate>('/api/command-templates', 'POST', { name, template })
export const updateCommandTemplate = (id: number, name: string, template: string) =>
  jsonFetch<CommandTemplate>(`/api/command-templates/${id}`, 'PUT', { name, template })
export const deleteCommandTemplate = (id: number) => jsonFetch<void>(`/api/command-templates/${id}`, 'DELETE')

export const listCommandHistory = () => jsonFetch<CommandHistoryEntry[]>('/api/command-templates/history', 'GET')
export const addCommandHistory = (templateName: string, renderedCommand: string) =>
  jsonFetch<CommandHistoryEntry>('/api/command-templates/history', 'POST', { templateName, renderedCommand })
export const deleteCommandHistory = (id: number) => jsonFetch<void>(`/api/command-templates/history/${id}`, 'DELETE')
export const clearCommandHistory = () => jsonFetch<void>('/api/command-templates/history', 'DELETE')

export type SlashCommand = {
  id: string
  label: string
  hint: string
  /** Plain-text commands: inserted directly, {cursor} marks where the caret should land after. */
  template?: string | (() => string)
  /** Special commands handled by the caller instead of simple text insertion (image picker, task picker). */
  special?: 'image' | 'task-ref'
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'table', label: 'Table 3×3', hint: 'markdown table', template: '| {cursor} | Col 2 | Col 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n' },
  { id: 'table-2', label: 'Table 2×2', hint: 'markdown table', template: '| {cursor} | Col 2 |\n| --- | --- |\n|  |  |\n' },
  { id: 'table-row', label: 'Table row', hint: 'append a blank row', template: '|  |  |  |\n{cursor}' },
  { id: 'task', label: 'To-do', hint: 'Checklist item', template: '- [ ] {cursor}' },
  { id: 'bullet', label: 'Bulleted list', hint: '', template: '- {cursor}' },
  { id: 'numbered', label: 'Numbered list', hint: '', template: '1. {cursor}' },
  { id: 'h1', label: 'Heading 1', hint: '', template: '# {cursor}' },
  { id: 'h2', label: 'Heading 2', hint: '', template: '## {cursor}' },
  { id: 'h3', label: 'Heading 3', hint: '', template: '### {cursor}' },
  { id: 'quote', label: 'Quote', hint: '', template: '> {cursor}' },
  { id: 'code', label: 'Code block', hint: 'syntax highlighted', template: '```\n{cursor}\n```' },
  { id: 'bold', label: 'Bold', hint: '', template: '**{cursor}**' },
  { id: 'italic', label: 'Italic', hint: '', template: '*{cursor}*' },
  { id: 'strikethrough', label: 'Strikethrough', hint: '', template: '~~{cursor}~~' },
  { id: 'inline-code', label: 'Inline code', hint: '', template: '`{cursor}`' },
  { id: 'link', label: 'Link', hint: '', template: '[{cursor}](https://)' },
  { id: 'details', label: 'Collapsible section', hint: 'click to expand', template: '<details>\n<summary>{cursor}</summary>\n\n\n</details>\n' },
  { id: 'divider', label: 'Divider', hint: 'Horizontal rule', template: '---\n{cursor}' },
  {
    id: 'date',
    label: "Today's date",
    hint: '',
    template: () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + '{cursor}',
  },
  { id: 'image', label: 'Image', hint: 'Upload from disk', special: 'image' },
  { id: 'task-ref', label: 'Link a task', hint: 'Live status from Task List', special: 'task-ref' },
  { id: 'color-red', label: 'Red text', hint: 'Colored text', template: '{color:#f43f5e}{cursor}{/color}' },
  { id: 'color-orange', label: 'Orange text', hint: 'Colored text', template: '{color:#f97316}{cursor}{/color}' },
  { id: 'color-green', label: 'Green text', hint: 'Colored text', template: '{color:#22c55e}{cursor}{/color}' },
  { id: 'color-cyan', label: 'Cyan text', hint: 'Colored text', template: '{color:#2fe6f2}{cursor}{/color}' },
  { id: 'color-violet', label: 'Violet text', hint: 'Colored text', template: '{color:#a78bfa}{cursor}{/color}' },
  { id: 'highlight', label: 'Highlight', hint: 'Marker-style highlight', template: '{highlight}{cursor}{/highlight}' },
]

export const COLOR_PRESETS: { name: string; value: string }[] = [
  { name: 'Red', value: '#f43f5e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Cyan', value: '#2fe6f2' },
  { name: 'Violet', value: '#a78bfa' },
  { name: 'Gray', value: '#9ba1b0' },
]

export function colorMarkdown(color: string, text: string): string {
  return `{color:${color}}${text}{/color}`
}

/** Resolves a template that may be a function (for dynamic content like today's date). */
export function resolveTemplate(cmd: SlashCommand): string {
  return typeof cmd.template === 'function' ? cmd.template() : cmd.template ?? ''
}

export function imageMarkdown(alt: string, dataUrl: string): string {
  return `![${alt}](${dataUrl})`
}

export function taskRefMarkdown(id: number): string {
  return `[[task:${id}]]`
}

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy } from '@phosphor-icons/react'

const spring = { type: 'spring', stiffness: 400, damping: 28 } as const

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`panel-shell ${className}`}>
      <div className="panel-core flex h-full flex-col">
        {children}
      </div>
    </div>
  )
}

export function Button({
  variant = 'default',
  className = '',
  children,
  disabled,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  const base =
    'relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-center px-4 py-2 text-[0.9375rem] font-semibold tracking-tight transition-colors disabled:opacity-35 disabled:cursor-not-allowed'
  const variants: Record<string, string> = {
    default: 'bg-glass text-ink ring-1 ring-glass-strong hover:ring-glass-strong hover:bg-glass-strong',
    primary: 'btn-primary bg-cyan text-[var(--on-accent)] shadow-[var(--shadow-accent)] hover:brightness-110',
    ghost: 'text-ink-soft hover:text-ink hover:bg-glass',
  }
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      spellCheck={false}
      className="w-full min-w-0 flex-1 resize-none rounded-2xl border border-rule bg-panel p-4 font-mono text-[0.9375rem] leading-relaxed text-ink shadow-[var(--shadow-inset)] outline-none transition-shadow focus:border-cyan/50 focus:shadow-[var(--focus-ring)]"
      {...props}
    />
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      disabled={!text}
    >
      <motion.span
        key={copied ? 'check' : 'copy'}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className="inline-flex items-center gap-1.5"
      >
        {copied ? <Check size={14} weight="bold" className="text-emerald" /> : <Copy size={14} weight="light" />}
        {copied ? 'Copied' : label}
      </motion.span>
    </Button>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="min-w-0 rounded-2xl border border-rose/25 bg-rose/[0.08] px-3.5 py-2.5 text-sm text-rose [overflow-wrap:anywhere]"
    >
      {message}
    </motion.div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink-soft">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || undefined}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? 'bg-cyan' : 'bg-ink/15'}`}
      >
        <motion.span
          layout
          transition={spring}
          className="absolute top-0.5 h-3 w-3 rounded-full bg-surface shadow"
          style={{ left: checked ? '14px' : '2px' }}
        />
      </button>
      {label}
    </label>
  )
}

/** Labelled form row: a small caps label above any control, with an optional hint underneath. */
export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[0.8125rem] leading-snug text-ink-faint">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input spellCheck={false} {...rest} className={`devtools-input ${className}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`devtools-input cursor-pointer ${className}`}>
      {children}
    </select>
  )
}

/** Segmented control — a row of mutually exclusive pills with a sliding highlight. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  size = 'md',
}: {
  value: T
  options: { id: T; label: ReactNode }[]
  onChange: (v: T) => void
  id: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-glass p-1 ring-1 ring-glass-strong">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`relative rounded-xl ${size === 'sm' ? 'px-2.5 py-1 text-[0.8125rem]' : 'px-3.5 py-1.5 text-[0.875rem]'} font-semibold transition-colors ${
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-panel)] ring-1 ring-rule"
              />
            )}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const TONES = {
  cyan: 'bg-cyan/12 text-cyan ring-cyan/30',
  emerald: 'bg-emerald/12 text-emerald ring-emerald/30',
  rose: 'bg-rose/12 text-rose ring-rose/30',
  warm: 'bg-warm/12 text-warm ring-warm/30',
  violet: 'bg-violet/12 text-violet ring-violet/30',
  muted: 'bg-glass text-ink-soft ring-rule',
} as const
export type Tone = keyof typeof TONES

export function Badge({ tone = 'muted', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ring-1 ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function StatTile({ label, value, tone = 'cyan', hint }: { label: string; value: ReactNode; tone?: Tone; hint?: ReactNode }) {
  const color = { cyan: 'text-cyan', emerald: 'text-emerald', rose: 'text-rose', warm: 'text-warm', violet: 'text-violet', muted: 'text-ink' }[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="min-w-0 rounded-2xl border border-rule-soft bg-glass px-4 py-3"
    >
      <div className="truncate text-[0.75rem] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className={`font-display mt-1 truncate text-[2rem] ${color}`}>{value}</div>
      {hint && <div className="truncate text-[0.8125rem] text-ink-faint">{hint}</div>}
    </motion.div>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <div className="text-[1rem] font-semibold text-ink-soft">{title}</div>
      {children && <div className="max-w-md text-[0.875rem] leading-relaxed text-ink-faint">{children}</div>}
    </div>
  )
}

/** Monospace output block with a copy button in its corner. */
export function CodeOut({ text, label, className = '' }: { text: string; label?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {label ? <SectionLabel>{label}</SectionLabel> : <span />}
        <CopyButton text={text} />
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-rule bg-panel p-4 font-mono text-[0.875rem] leading-relaxed text-ink shadow-[var(--shadow-inset)]">
        {text || ' '}
      </pre>
    </div>
  )
}

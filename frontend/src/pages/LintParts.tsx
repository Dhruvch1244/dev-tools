import { motion } from 'framer-motion'
import { Info, Warning, XCircle } from '@phosphor-icons/react'

export function FindingRow({ level, where, message, i }: { level: 'error' | 'warn' | 'info'; where: string; message: string; i: number }) {
  const ring = level === 'error' ? 'bg-rose/[0.07] ring-rose/30' : level === 'warn' ? 'bg-warm/[0.07] ring-warm/30' : 'bg-glass ring-rule-soft'
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.6) }} className={`flex gap-3 rounded-2xl px-4 py-3 ring-1 ${ring}`}>
      {level === 'error' ? <XCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-rose" /> : level === 'warn' ? <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-warm" /> : <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-cyan" />}
      <div className="min-w-0 text-[0.9375rem] leading-relaxed text-ink-soft">
        <span className="mr-2 break-all font-mono text-[0.8125rem] text-ink-faint">{where}</span>
        {message}
      </div>
    </motion.div>
  )
}

export function Score({ errors, warns }: { errors: number; warns: number }) {
  const score = Math.max(0, 100 - errors * 15 - warns * 5)
  const tone = score >= 85 ? 'text-emerald' : score >= 60 ? 'text-warm' : 'text-rose'
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--rule)" strokeWidth="3" />
        <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={tone} strokeDasharray="97.4" initial={{ strokeDashoffset: 97.4 }} animate={{ strokeDashoffset: 97.4 * (1 - score / 100) }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
      </svg>
      <div>
        <div className={`font-display text-[2.2rem] leading-none ${tone}`}>{score}</div>
        <div className="text-[0.8125rem] text-ink-faint">hygiene score</div>
      </div>
    </div>
  )
}

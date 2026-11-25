/**
 * App-wide appearance knobs that aren't colours: text size (drives the root font-size, so every
 * rem-based size AND spacing scales together), UI font, and how much motion the app shows.
 */

export type TextSize = 's' | 'm' | 'l' | 'xl' | 'xxl'
export type MotionLevel = 'off' | 'calm' | 'lively' | 'crazy'

export const TEXT_SIZES: { id: TextSize; label: string; px: number }[] = [
  { id: 's', label: 'S', px: 15 },
  { id: 'm', label: 'M', px: 16 },
  { id: 'l', label: 'L', px: 17 },
  { id: 'xl', label: 'XL', px: 18.5 },
  { id: 'xxl', label: 'XXL', px: 20 },
]

export const UI_FONTS: { id: string; name: string; stack: string }[] = [
  { id: 'hanken', name: 'Hanken Grotesk', stack: '"Hanken Grotesk", system-ui, "Segoe UI", sans-serif' },
  { id: 'space-grotesk', name: 'Space Grotesk', stack: '"Space Grotesk", system-ui, "Segoe UI", sans-serif' },
  { id: 'space-mono', name: 'Space Mono', stack: '"Space Mono", ui-monospace, monospace' },
  { id: 'system', name: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
]

export const MOTION_LEVELS: { id: MotionLevel; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'no animation at all' },
  { id: 'calm', label: 'Calm', hint: 'gentle fades only' },
  { id: 'lively', label: 'Lively', hint: 'animated backdrops, transitions' },
  { id: 'crazy', label: 'Crazy', hint: 'sparks, 3D tilt, the works' },
]

const KEYS = { text: 'devtools.text-size', ui: 'devtools.ui-font', motion: 'devtools.motion' }

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — still applies for this session */
  }
}

function emit() {
  window.dispatchEvent(new CustomEvent('devtools:appearance'))
}

export function getTextSize(): TextSize {
  const v = get(KEYS.text) as TextSize | null
  return v && TEXT_SIZES.some((t) => t.id === v) ? v : 'l'
}
export function applyTextSize(id: TextSize) {
  const t = TEXT_SIZES.find((x) => x.id === id) ?? TEXT_SIZES[2]
  document.documentElement.style.fontSize = `${t.px}px`
  document.documentElement.dataset.textSize = t.id
  set(KEYS.text, t.id)
  emit()
}

export function getUiFont(): string {
  const v = get(KEYS.ui)
  return v && UI_FONTS.some((f) => f.id === v) ? v : UI_FONTS[0].id
}
export function applyUiFont(id: string) {
  const f = UI_FONTS.find((x) => x.id === id) ?? UI_FONTS[0]
  document.documentElement.style.setProperty('--user-font-ui', f.stack)
  set(KEYS.ui, f.id)
  emit()
}

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function getMotion(): MotionLevel {
  const v = get(KEYS.motion) as MotionLevel | null
  if (v && MOTION_LEVELS.some((m) => m.id === v)) return v
  return prefersReduced() ? 'calm' : 'lively'
}
export function applyMotion(id: MotionLevel) {
  document.documentElement.dataset.motion = id
  set(KEYS.motion, id)
  emit()
}

/** Particle-count / speed multiplier the animated backdrops use. */
export function motionFactor(level: MotionLevel = getMotion()): number {
  return { off: 0, calm: 0.45, lively: 1, crazy: 1.9 }[level]
}

export function applyAllAppearance() {
  applyTextSize(getTextSize())
  applyUiFont(getUiFont())
  applyMotion(getMotion())
}

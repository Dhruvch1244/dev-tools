export type ThemeColors = {
  void: string
  surface: string
  panel: string
  ink: string
  inkSoft: string
  inkFaint: string
  rule: string
  ruleSoft: string
  cyan: string
  emerald: string
  rose: string
  warm: string
  violet: string
}

/** Animated backdrop a theme paints behind the app (see components/Backdrop.tsx). */
export type FxKind =
  | 'glow'
  | 'constellation'
  | 'synthwave'
  | 'matrix'
  | 'aurora'
  | 'cyber'
  | 'lava'
  | 'ocean'
  | 'warp'
  | 'fireflies'
  | 'arcade'
  | 'petals'
  | 'blobs'
  | 'snow'
  | 'disco'
  | 'none'

export type Theme = {
  id: string
  name: string
  swatch: [string, string, string]
  scheme?: 'light' | 'dark'
  colors: ThemeColors
  /** Animated backdrop. Defaults to 'glow' on dark themes, 'none' on light ones. */
  fx?: FxKind
  /** One-line personality shown in the picker for animated "world" themes. */
  tagline?: string
}

const c = (
  void_: string, surface: string, panel: string, ink: string, inkSoft: string, inkFaint: string,
  rule: string, ruleSoft: string, cyan: string, emerald: string, rose: string, warm: string, violet: string,
): ThemeColors => ({ void: void_, surface, panel, ink, inkSoft, inkFaint, rule, ruleSoft, cyan, emerald, rose, warm, violet })

/** Animated "worlds" — same tools, wildly different lens. Listed first in the picker. */
export const WORLD_THEMES: Theme[] = [
  {
    id: 'constellation', name: 'Constellation', fx: 'constellation', tagline: 'Everything is a graph. Find the edges.',
    swatch: ['#07080c', '#28e0ec', '#ff2e7e'],
    colors: c('#07080c', '#0d0f16', '#131623', '#f2f4f8', '#a8afc0', '#737b90', 'rgba(255,255,255,0.17)', 'rgba(255,255,255,0.06)', '#28e0ec', '#34e8ab', '#ff2e7e', '#f2b45e', '#9a6bff'),
  },
  {
    id: 'synthwave', name: 'Synthwave', fx: 'synthwave', tagline: 'Neon sun, endless grid, zero bugs.',
    swatch: ['#160430', '#ff3cac', '#2de2e6'],
    colors: c('#12002a', '#1b0738', '#260c4a', '#fdf0ff', '#d6b8f0', '#9c7fc0', 'rgba(255,120,240,0.26)', 'rgba(255,120,240,0.08)', '#2de2e6', '#72f1b8', '#ff3cac', '#ffd319', '#c86bff'),
  },
  {
    id: 'matrix', name: 'Phosphor Rain', fx: 'matrix', tagline: 'Green rain, root access, no exit code.',
    swatch: ['#000400', '#00ff66', '#d7ff3b'],
    colors: c('#000400', '#020b04', '#06150a', '#d4ffe0', '#7fe39b', '#4c9e64', 'rgba(0,255,102,0.24)', 'rgba(0,255,102,0.08)', '#00ff66', '#3dff8a', '#ff5c5c', '#d7ff3b', '#00e0b0'),
  },
  {
    id: 'aurora', name: 'Aurora', fx: 'aurora', tagline: 'Northern lights over a quiet terminal.',
    swatch: ['#030712', '#5eead4', '#a78bfa'],
    colors: c('#030712', '#0a1122', '#111b31', '#eef2ff', '#b6c0dc', '#7a86a6', 'rgba(180,200,255,0.2)', 'rgba(180,200,255,0.07)', '#5eead4', '#4ade80', '#f472b6', '#fcd34d', '#a78bfa'),
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', fx: 'cyber', tagline: 'Neon, chrome and zero-downtime deploys.',
    swatch: ['#0a0a0f', '#fcee0a', '#ff2a6d'],
    colors: c('#0a0a0f', '#12121b', '#1b1b28', '#f8f8f0', '#c8c8d6', '#8a8aa0', 'rgba(252,238,10,0.24)', 'rgba(252,238,10,0.07)', '#00f0ff', '#05ffa1', '#ff2a6d', '#fcee0a', '#e040fb'),
  },
  {
    id: 'lava', name: 'Lava Lamp', fx: 'lava', tagline: 'Slow, warm, hypnotic blobs of focus.',
    swatch: ['#160605', '#ff7a45', '#ff4d8d'],
    colors: c('#140505', '#1e0b09', '#2b120e', '#fff3ea', '#e6c3b2', '#b08a7a', 'rgba(255,170,130,0.22)', 'rgba(255,170,130,0.07)', '#ffb347', '#9be564', '#ff4d6d', '#ffd166', '#ff6bb5'),
  },
  {
    id: 'ocean', name: 'Deep Ocean', fx: 'ocean', tagline: 'Bubbles rise, latency sinks.',
    swatch: ['#010b17', '#38bdf8', '#2dd4bf'],
    colors: c('#010b17', '#05172c', '#0a2442', '#e8f6ff', '#a9c8de', '#6f90aa', 'rgba(120,200,255,0.22)', 'rgba(120,200,255,0.07)', '#38bdf8', '#2dd4bf', '#fb7185', '#fbbf24', '#818cf8'),
  },
  {
    id: 'hyperspace', name: 'Hyperspace', fx: 'warp', tagline: 'Punch it. Ship to prod at lightspeed.',
    swatch: ['#000000', '#7dd3fc', '#c084fc'],
    colors: c('#000000', '#07070d', '#10101b', '#ffffff', '#c2c6d6', '#878ca3', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', '#7dd3fc', '#86efac', '#fb7185', '#fde68a', '#c084fc'),
  },
  {
    id: 'fireflies', name: 'Firefly Forest', fx: 'fireflies', tagline: 'Late-night debugging under glowing trees.',
    swatch: ['#050d08', '#ffe066', '#7ee787'],
    colors: c('#050d08', '#0b1a10', '#12271a', '#ecf8e6', '#b4cdb0', '#7c977a', 'rgba(200,255,170,0.2)', 'rgba(200,255,170,0.07)', '#b9f27c', '#7ee787', '#ff8c69', '#ffe066', '#c3a6ff'),
  },
  {
    id: 'arcade', name: 'Arcade', fx: 'arcade', tagline: 'Level 404 → 200 OK. Insert coin.',
    swatch: ['#0b0420', '#00e5ff', '#ff00aa'],
    colors: c('#0b0420', '#140a33', '#1e1048', '#ffffff', '#cdbff5', '#9282c4', 'rgba(0,229,255,0.24)', 'rgba(0,229,255,0.08)', '#00e5ff', '#00ff9c', '#ff00aa', '#ffe600', '#b388ff'),
  },
  {
    id: 'disco', name: 'Disco Night', fx: 'disco', tagline: 'Spinning lights. Ship it on the dance floor.',
    swatch: ['#0d0221', '#ff006e', '#ffbe0b'],
    colors: c('#0d0221', '#170634', '#220b4a', '#fff7fb', '#dcc3ea', '#a48bbb', 'rgba(255,0,110,0.25)', 'rgba(255,0,110,0.08)', '#3ad7ff', '#06d6a0', '#ff006e', '#ffbe0b', '#a45bff'),
  },
  {
    id: 'snowfall', name: 'Snowfall', fx: 'snow', tagline: 'Code freeze, but make it cosy.',
    swatch: ['#0f1720', '#9ad1ff', '#e4f2ff'],
    colors: c('#0d151e', '#152030', '#1c2b3d', '#f0f6fc', '#b9c8d8', '#7f91a5', 'rgba(200,225,255,0.2)', 'rgba(200,225,255,0.07)', '#9ad1ff', '#86e1b4', '#ff8fa3', '#ffd28a', '#b8a8ff'),
  },
  {
    id: 'sakura', name: 'Sakura', fx: 'petals', scheme: 'light', tagline: 'Petals drift past while tests pass.',
    swatch: ['#fdf2f5', '#c2185b', '#7b1fa2'],
    colors: c('#fcf0f4', '#ffffff', '#fff7fa', '#2b1a22', '#5f4350', '#7f6170', 'rgba(120,30,70,0.16)', 'rgba(120,30,70,0.07)', '#b0124f', '#2e7d32', '#c2185b', '#a35a00', '#7b1fa2'),
  },
  {
    id: 'bubblegum', name: 'Bubblegum Pop', fx: 'blobs', scheme: 'light', tagline: 'Pastel blobs, loud ideas.',
    swatch: ['#f5f0ff', '#6d28d9', '#db2777'],
    colors: c('#f3eeff', '#ffffff', '#faf7ff', '#1f1635', '#4a3f6b', '#6e6390', 'rgba(60,30,120,0.15)', 'rgba(60,30,120,0.07)', '#6d28d9', '#047857', '#db2777', '#a45200', '#7c3aed'),
  },
]

export const THEMES: Theme[] = [
  ...WORLD_THEMES,
  // Paper: the flagship light theme. Warm off-white "desk" behind pure-white cards, near-black
  // ink, and a single deep-teal accent. Every text tier clears WCAG AA (4.5:1) on both the card
  // and the desk, and the accent pairs are darkened versions of the dark theme's hues so status
  // colours read the same across schemes without neon glare on white.
  {
    id: 'light',
    name: 'Paper',
    swatch: ['#f6f5f1', '#0f6f86', '#5b3fd0'],
    scheme: 'light',
    colors: {
      void: '#f6f5f1', surface: '#ffffff', panel: '#fbfaf8',
      ink: '#17181c', inkSoft: '#4a4d57', inkFaint: '#6b6e78',
      rule: 'rgba(23,24,28,0.13)', ruleSoft: 'rgba(23,24,28,0.07)',
      cyan: '#0f6f86', emerald: '#0b7a55', rose: '#c0264b', warm: '#a8560b', violet: '#5b3fd0',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    swatch: ['#fdf6e3', '#268bd2', '#2aa198'],
    scheme: 'light',
    colors: {
      void: '#eee8d5', surface: '#fdf6e3', panel: '#f5efdc',
      ink: '#073642', inkSoft: '#586e75', inkFaint: '#93a1a1',
      rule: 'rgba(7,54,66,0.22)', ruleSoft: 'rgba(7,54,66,0.07)',
      cyan: '#2aa198', emerald: '#859900', rose: '#dc322f', warm: '#b58900', violet: '#6c71c4',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    swatch: ['#eff1f5', '#1e66f5', '#8839ef'],
    scheme: 'light',
    colors: {
      void: '#e6e9ef', surface: '#eff1f5', panel: '#e6e9ef',
      ink: '#4c4f69', inkSoft: '#5c5f77', inkFaint: '#8c8fa1',
      rule: 'rgba(76,79,105,0.20)', ruleSoft: 'rgba(76,79,105,0.06)',
      cyan: '#04a5e5', emerald: '#40a02b', rose: '#d20f39', warm: '#df8e1d', violet: '#8839ef',
    },
  },
  {
    id: 'one-light',
    name: 'One Light',
    swatch: ['#fafafa', '#4078f2', '#a626a4'],
    scheme: 'light',
    colors: {
      void: '#eaeaeb', surface: '#fafafa', panel: '#f0f0f1',
      ink: '#383a42', inkSoft: '#5c5f66', inkFaint: '#a0a1a7',
      rule: 'rgba(56,58,66,0.20)', ruleSoft: 'rgba(56,58,66,0.06)',
      cyan: '#0184bc', emerald: '#50a14f', rose: '#e45649', warm: '#c18401', violet: '#a626a4',
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    swatch: ['#eceff4', '#5e81ac', '#b48ead'],
    scheme: 'light',
    colors: {
      void: '#e5e9f0', surface: '#eceff4', panel: '#e5e9f0',
      ink: '#2e3440', inkSoft: '#4c566a', inkFaint: '#7b88a1',
      rule: 'rgba(46,52,64,0.20)', ruleSoft: 'rgba(46,52,64,0.06)',
      cyan: '#5e81ac', emerald: '#8fbcbb', rose: '#bf616a', warm: '#d08770', violet: '#b48ead',
    },
  },
  {
    id: 'void',
    name: 'Void',
    swatch: ['#050506', '#2fe6f2', '#9a6bff'],
    colors: {
      void: '#050506', surface: '#0b0c11', panel: '#101218',
      ink: '#f2f4f8', inkSoft: '#9ba1b0', inkFaint: '#5c6274',
      rule: 'rgba(255,255,255,0.18)', ruleSoft: 'rgba(255,255,255,0.05)',
      cyan: '#2fe6f2', emerald: '#34e8ab', rose: '#ff6f8f', warm: '#f2b45e', violet: '#9a6bff',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    swatch: ['#282a36', '#bd93f9', '#ff79c6'],
    colors: {
      void: '#191a21', surface: '#282a36', panel: '#333545',
      ink: '#f8f8f2', inkSoft: '#c6c8d1', inkFaint: '#6272a4',
      rule: 'rgba(255,255,255,0.19)', ruleSoft: 'rgba(255,255,255,0.05)',
      cyan: '#8be9fd', emerald: '#50fa7b', rose: '#ff5555', warm: '#f1fa8c', violet: '#bd93f9',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    swatch: ['#2e3440', '#88c0d0', '#b48ead'],
    colors: {
      void: '#242933', surface: '#2e3440', panel: '#3b4252',
      ink: '#eceff4', inkSoft: '#d8dee9', inkFaint: '#767e93',
      rule: 'rgba(216,222,233,0.20)', ruleSoft: 'rgba(216,222,233,0.06)',
      cyan: '#88c0d0', emerald: '#a3be8c', rose: '#bf616a', warm: '#ebcb8b', violet: '#b48ead',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    swatch: ['#1a1b26', '#7dcfff', '#bb9af7'],
    colors: {
      void: '#13141c', surface: '#1a1b26', panel: '#232433',
      ink: '#c0caf5', inkSoft: '#9aa5d1', inkFaint: '#565f89',
      rule: 'rgba(192,202,245,0.19)', ruleSoft: 'rgba(192,202,245,0.05)',
      cyan: '#7dcfff', emerald: '#9ece6a', rose: '#f7768e', warm: '#e0af68', violet: '#bb9af7',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    swatch: ['#282828', '#fabd2f', '#fe8019'],
    colors: {
      void: '#1d2021', surface: '#282828', panel: '#3c3836',
      ink: '#ebdbb2', inkSoft: '#bdae93', inkFaint: '#928374',
      rule: 'rgba(235,219,178,0.20)', ruleSoft: 'rgba(235,219,178,0.06)',
      cyan: '#8ec07c', emerald: '#b8bb26', rose: '#fb4934', warm: '#fabd2f', violet: '#d3869b',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    swatch: ['#1e1e2e', '#89dceb', '#cba6f7'],
    colors: {
      void: '#11111b', surface: '#1e1e2e', panel: '#313244',
      ink: '#cdd6f4', inkSoft: '#a6adc8', inkFaint: '#6c7086',
      rule: 'rgba(205,214,244,0.20)', ruleSoft: 'rgba(205,214,244,0.06)',
      cyan: '#89dceb', emerald: '#a6e3a1', rose: '#f38ba8', warm: '#f9e2af', violet: '#cba6f7',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    swatch: ['#002b36', '#2aa198', '#6c71c4'],
    colors: {
      void: '#00212b', surface: '#002b36', panel: '#073642',
      ink: '#eee8d5', inkSoft: '#93a1a1', inkFaint: '#586e75',
      rule: 'rgba(147,161,161,0.24)', ruleSoft: 'rgba(147,161,161,0.08)',
      cyan: '#2aa198', emerald: '#859900', rose: '#dc322f', warm: '#b58900', violet: '#6c71c4',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    swatch: ['#2d2a2e', '#78dce8', '#ab9df2'],
    colors: {
      void: '#221f22', surface: '#2d2a2e', panel: '#3a373b',
      ink: '#fcfcfa', inkSoft: '#c1c0c0', inkFaint: '#727072',
      rule: 'rgba(252,252,250,0.20)', ruleSoft: 'rgba(252,252,250,0.06)',
      cyan: '#78dce8', emerald: '#a9dc76', rose: '#ff6188', warm: '#ffd866', violet: '#ab9df2',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    swatch: ['#282c34', '#56b6c2', '#c678dd'],
    colors: {
      void: '#21252b', surface: '#282c34', panel: '#333842',
      ink: '#abb2bf', inkSoft: '#8f96a3', inkFaint: '#5c6370',
      rule: 'rgba(171,178,191,0.20)', ruleSoft: 'rgba(171,178,191,0.06)',
      cyan: '#56b6c2', emerald: '#98c379', rose: '#e06c75', warm: '#e5c07b', violet: '#c678dd',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    swatch: ['#191724', '#9ccfd8', '#c4a7e7'],
    colors: {
      void: '#141220', surface: '#191724', panel: '#26233a',
      ink: '#e0def4', inkSoft: '#b9b6d3', inkFaint: '#6e6a86',
      rule: 'rgba(224,222,244,0.20)', ruleSoft: 'rgba(224,222,244,0.06)',
      cyan: '#9ccfd8', emerald: '#31748f', rose: '#eb6f92', warm: '#f6c177', violet: '#c4a7e7',
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    swatch: ['#2d353b', '#83c092', '#e69875'],
    colors: {
      void: '#232a2e', surface: '#2d353b', panel: '#374247',
      ink: '#d3c6aa', inkSoft: '#a8b39e', inkFaint: '#7a8478',
      rule: 'rgba(211,198,170,0.20)', ruleSoft: 'rgba(211,198,170,0.06)',
      cyan: '#7fbbb3', emerald: '#a7c080', rose: '#e67e80', warm: '#dbbc7f', violet: '#d699b6',
    },
  },
]

const VAR_MAP: Record<keyof ThemeColors, string> = {
  void: '--void', surface: '--surface', panel: '--panel',
  ink: '--ink', inkSoft: '--ink-soft', inkFaint: '--ink-faint',
  rule: '--rule', ruleSoft: '--rule-soft',
  cyan: '--cyan', emerald: '--emerald', rose: '--rose', warm: '--warm', violet: '--violet',
}

const STORAGE_KEY = 'devtools.theme'

/** Pseudo-theme: follow the OS light/dark preference, switching live when it changes. */
export const SYSTEM_THEME_ID = 'system'
const SYSTEM_LIGHT_ID = 'light'
const SYSTEM_DARK_ID = 'constellation'

const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

function resolveTheme(id: string): Theme {
  const concrete = id === SYSTEM_THEME_ID ? (darkQuery?.matches === false ? SYSTEM_LIGHT_ID : SYSTEM_DARK_ID) : id
  return THEMES.find((t) => t.id === concrete) ?? THEMES.find((t) => t.id === SYSTEM_DARK_ID) ?? THEMES[0]
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function paint(theme: Theme) {
  const el = document.documentElement
  for (const key of Object.keys(theme.colors) as (keyof ThemeColors)[]) {
    el.style.setProperty(VAR_MAP[key], theme.colors[key])
  }
  const scheme = theme.scheme ?? 'dark'
  const fx: FxKind = theme.fx ?? (scheme === 'dark' ? 'glow' : 'none')
  el.style.setProperty('color-scheme', scheme)
  el.dataset.scheme = scheme
  el.dataset.fx = fx
  el.dataset.theme = theme.id
  window.dispatchEvent(new CustomEvent('devtools:themechange', { detail: { scheme, fx, id: theme.id } }))
}

darkQuery?.addEventListener('change', () => {
  if (getStoredTheme() === SYSTEM_THEME_ID) paint(resolveTheme(SYSTEM_THEME_ID))
})

export function applyTheme(id: string) {
  const stored = id === SYSTEM_THEME_ID ? SYSTEM_THEME_ID : resolveTheme(id).id
  paint(resolveTheme(stored))
  try {
    localStorage.setItem(STORAGE_KEY, stored)
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

/** New installs follow the OS preference instead of forcing dark. */
export function getStoredTheme(): string {
  return safeGet(STORAGE_KEY) ?? SYSTEM_THEME_ID
}

export function getCurrentScheme(): 'dark' | 'light' {
  return resolveTheme(getStoredTheme()).scheme === 'light' ? 'light' : 'dark'
}

export function getCurrentTheme(): Theme {
  return resolveTheme(getStoredTheme())
}

export function getCurrentFx(): FxKind {
  const t = getCurrentTheme()
  return t.fx ?? ((t.scheme ?? 'dark') === 'dark' ? 'glow' : 'none')
}

/** Next/previous theme in picker order — Alt+T hops through them. */
export function cycleTheme(delta = 1): Theme {
  const current = getCurrentTheme()
  const idx = THEMES.findIndex((t) => t.id === current.id)
  const next = THEMES[(idx + delta + THEMES.length) % THEMES.length]
  applyTheme(next.id)
  return next
}

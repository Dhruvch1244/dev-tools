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
    colors: c('#07080c', '#0d0f16', '#131623', '#f2f4f8', '#a8afc0', '#80869a', 'rgba(255,255,255,0.17)', 'rgba(255,255,255,0.06)', '#28e0ec', '#34e8ab', '#ff2e7e', '#f2b45e', '#9a6bff'),
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
    colors: c('#030712', '#0a1122', '#111b31', '#eef2ff', '#b6c0dc', '#7b87a7', 'rgba(180,200,255,0.2)', 'rgba(180,200,255,0.07)', '#5eead4', '#4ade80', '#f472b6', '#fcd34d', '#a78bfa'),
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', fx: 'cyber', tagline: 'Neon, chrome and zero-downtime deploys.',
    swatch: ['#0a0a0f', '#fcee0a', '#ff2a6d'],
    colors: c('#0a0a0f', '#12121b', '#1b1b28', '#f8f8f0', '#c8c8d6', '#8a8aa0', 'rgba(252,238,10,0.24)', 'rgba(252,238,10,0.07)', '#00f0ff', '#05ffa1', '#ff3474', '#fcee0a', '#e040fb'),
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
    colors: c('#0d0221', '#170634', '#220b4a', '#fff7fb', '#dcc3ea', '#a48bbb', 'rgba(255,0,110,0.25)', 'rgba(255,0,110,0.08)', '#3ad7ff', '#06d6a0', '#ff2382', '#ffbe0b', '#a761ff'),
  },
  {
    id: 'snowfall', name: 'Snowfall', fx: 'snow', tagline: 'Code freeze, but make it cosy.',
    swatch: ['#0f1720', '#9ad1ff', '#e4f2ff'],
    colors: c('#0d151e', '#152030', '#1c2b3d', '#f0f6fc', '#b9c8d8', '#8697aa', 'rgba(200,225,255,0.2)', 'rgba(200,225,255,0.07)', '#9ad1ff', '#86e1b4', '#ff8fa3', '#ffd28a', '#b8a8ff'),
  },
  {
    id: 'sakura', name: 'Sakura', fx: 'petals', scheme: 'light', tagline: 'Petals drift past while tests pass.',
    swatch: ['#fdf2f5', '#c2185b', '#7b1fa2'],
    colors: c('#fcf0f4', '#ffffff', '#fff7fa', '#2b1a22', '#5f4350', '#7a5d6c', 'rgba(120,30,70,0.16)', 'rgba(120,30,70,0.07)', '#b0124f', '#2b742e', '#c2185b', '#995400', '#7b1fa2'),
  },
  {
    id: 'bubblegum', name: 'Bubblegum Pop', fx: 'blobs', scheme: 'light', tagline: 'Pastel blobs, loud ideas.',
    swatch: ['#f5f0ff', '#6d28d9', '#db2777'],
    colors: c('#f3eeff', '#ffffff', '#faf7ff', '#1f1635', '#4a3f6b', '#685e89', 'rgba(60,30,120,0.15)', 'rgba(60,30,120,0.07)', '#6d28d9', '#047253', '#bc1f65', '#9e4f00', '#7a36ed'),
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
      ink: '#17181c', inkSoft: '#4a4d57', inkFaint: '#646770',
      rule: 'rgba(23,24,28,0.13)', ruleSoft: 'rgba(23,24,28,0.07)',
      cyan: '#0f6f86', emerald: '#0a7451', rose: '#c0264b', warm: '#a0520a', violet: '#5b3fd0',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    swatch: ['#fdf6e3', '#268bd2', '#2aa198'],
    scheme: 'light',
    colors: {
      void: '#eee8d5', surface: '#fdf6e3', panel: '#f5efdc',
      ink: '#073642', inkSoft: '#47585e', inkFaint: '#556262',
      rule: 'rgba(7,54,66,0.22)', ruleSoft: 'rgba(7,54,66,0.07)',
      cyan: '#1c6a64', emerald: '#586600', rose: '#ba2220', warm: '#785a00', violet: '#4f56b8',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    swatch: ['#eff1f5', '#1e66f5', '#8839ef'],
    scheme: 'light',
    colors: {
      void: '#e6e9ef', surface: '#eff1f5', panel: '#e6e9ef',
      ink: '#3e4157', inkSoft: '#52556a', inkFaint: '#5e6173',
      rule: 'rgba(76,79,105,0.20)', ruleSoft: 'rgba(76,79,105,0.06)',
      cyan: '#036992', emerald: '#2c701e', rose: '#c30e35', warm: '#895712', violet: '#7e29ee',
    },
  },
  {
    id: 'one-light',
    name: 'One Light',
    swatch: ['#fafafa', '#4078f2', '#a626a4'],
    scheme: 'light',
    colors: {
      void: '#eaeaeb', surface: '#fafafa', panel: '#f0f0f1',
      ink: '#383a42', inkSoft: '#54565d', inkFaint: '#606169',
      rule: 'rgba(56,58,66,0.20)', ruleSoft: 'rgba(56,58,66,0.06)',
      cyan: '#016894', emerald: '#376e36', rose: '#ba291c', warm: '#845a01', violet: '#a626a4',
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    swatch: ['#eceff4', '#5e81ac', '#b48ead'],
    scheme: 'light',
    colors: {
      void: '#e5e9f0', surface: '#eceff4', panel: '#e5e9f0',
      ink: '#2e3440', inkSoft: '#4c566a', inkFaint: '#556077',
      rule: 'rgba(46,52,64,0.20)', ruleSoft: 'rgba(46,52,64,0.06)',
      cyan: '#456286', emerald: '#3e6766', rose: '#a0414b', warm: '#984a32', violet: '#7d5375',
    },
  },
  {
    id: 'void',
    name: 'Void',
    swatch: ['#050506', '#2fe6f2', '#9a6bff'],
    colors: {
      void: '#050506', surface: '#0b0c11', panel: '#101218',
      ink: '#f2f4f8', inkSoft: '#9ba1b0', inkFaint: '#7d8397',
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
      ink: '#f8f8f2', inkSoft: '#c6c8d1', inkFaint: '#97a1c2',
      rule: 'rgba(255,255,255,0.19)', ruleSoft: 'rgba(255,255,255,0.05)',
      cyan: '#8be9fd', emerald: '#50fa7b', rose: '#ff7878', warm: '#f1fa8c', violet: '#bd93f9',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    swatch: ['#2e3440', '#88c0d0', '#b48ead'],
    colors: {
      void: '#242933', surface: '#2e3440', panel: '#3b4252',
      ink: '#eceff4', inkSoft: '#d8dee9', inkFaint: '#a9aebb',
      rule: 'rgba(216,222,233,0.20)', ruleSoft: 'rgba(216,222,233,0.06)',
      cyan: '#88c0d0', emerald: '#a3be8c', rose: '#d9a1a6', warm: '#ebcb8b', violet: '#c4a7bf',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    swatch: ['#1a1b26', '#7dcfff', '#bb9af7'],
    colors: {
      void: '#13141c', surface: '#1a1b26', panel: '#232433',
      ink: '#c0caf5', inkSoft: '#9aa5d1', inkFaint: '#858db3',
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
      ink: '#ebdbb2', inkSoft: '#c7baa3', inkFaint: '#ada296',
      rule: 'rgba(235,219,178,0.20)', ruleSoft: 'rgba(235,219,178,0.06)',
      cyan: '#8ec07c', emerald: '#b8bb26', rose: '#fc7d6e', warm: '#fabd2f', violet: '#d68fa3',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    swatch: ['#1e1e2e', '#89dceb', '#cba6f7'],
    colors: {
      void: '#11111b', surface: '#1e1e2e', panel: '#313244',
      ink: '#cdd6f4', inkSoft: '#acb3cc', inkFaint: '#989bac',
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
      ink: '#eee8d5', inkSoft: '#a7b3b3', inkFaint: '#879da5',
      rule: 'rgba(147,161,161,0.24)', ruleSoft: 'rgba(147,161,161,0.08)',
      cyan: '#2daba2', emerald: '#8ea300', rose: '#e87977', warm: '#c29300', violet: '#9195d4',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    swatch: ['#2d2a2e', '#78dce8', '#ab9df2'],
    colors: {
      void: '#221f22', surface: '#2d2a2e', panel: '#3a373b',
      ink: '#fcfcfa', inkSoft: '#c1c0c0', inkFaint: '#a4a2a4',
      rule: 'rgba(252,252,250,0.20)', ruleSoft: 'rgba(252,252,250,0.06)',
      cyan: '#78dce8', emerald: '#a9dc76', rose: '#ff7597', warm: '#ffd866', violet: '#ab9df2',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    swatch: ['#282c34', '#56b6c2', '#c678dd'],
    colors: {
      void: '#21252b', surface: '#282c34', panel: '#333842',
      ink: '#c5cad3', inkSoft: '#b5bac2', inkFaint: '#9ca2ad',
      rule: 'rgba(171,178,191,0.20)', ruleSoft: 'rgba(171,178,191,0.06)',
      cyan: '#56b6c2', emerald: '#98c379', rose: '#e6878f', warm: '#e5c07b', violet: '#cd88e1',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    swatch: ['#191724', '#9ccfd8', '#c4a7e7'],
    colors: {
      void: '#141220', surface: '#191724', panel: '#26233a',
      ink: '#e0def4', inkSoft: '#b9b6d3', inkFaint: '#8e8aa3',
      rule: 'rgba(224,222,244,0.20)', ruleSoft: 'rgba(224,222,244,0.06)',
      cyan: '#9ccfd8', emerald: '#4097bb', rose: '#eb6f92', warm: '#f6c177', violet: '#c4a7e7',
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    swatch: ['#2d353b', '#83c092', '#e69875'],
    colors: {
      void: '#232a2e', surface: '#2d353b', panel: '#374247',
      ink: '#ded5c0', inkSoft: '#c0c8b9', inkFaint: '#a8afa7',
      rule: 'rgba(211,198,170,0.20)', ruleSoft: 'rgba(211,198,170,0.06)',
      cyan: '#7fbbb3', emerald: '#a7c080', rose: '#eb9597', warm: '#dbbc7f', violet: '#d79db9',
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

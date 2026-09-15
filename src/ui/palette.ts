export const palette = {
  bgVoid: '#08060c',
  bgBase: '#0f0c1a',
  bgPanel: '#161225',
  bgPanelAlt: '#1f1a33',
  bgOverlay: '#050308',

  borderDim: '#3a3355',
  borderBright: '#6a5fa8',

  textPrimary: '#f4f1fa',
  textSecondary: '#b9b2d6',
  textMuted: '#756e94',
  textDisabled: '#4a4460',
  textInverse: '#0f0c1a',

  neonPink: '#ff2e88',
  neonCyan: '#2ee6ff',
  neonPurple: '#a855f7',
  neonAmber: '#ffb02e',
  neonGreen: '#39ff8f',
  neonRed: '#ff3b3b',

  success: '#4ee08a',
  warning: '#ffcc33',
  danger: '#ff4d4d',
  info: '#3ec6ff',

  heatLow: '#4ee08a',
  heatMid: '#ffcc33',
  heatHigh: '#ff7a33',
  heatCritical: '#ff2e2e',

  factionPlayer: '#2ee6ff',
  factionRivalA: '#ff2e88',
  factionRivalB: '#a855f7',
  factionNeutral: '#5a5470',

  rainOverlay: '#1a2340',
  scanline: '#00ffcc',
} as const;

export type PaletteToken = keyof typeof palette;

export function paletteColorNumber(token: PaletteToken): number {
  return Number.parseInt(palette[token].slice(1), 16);
}

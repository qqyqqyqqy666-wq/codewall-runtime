/**
 * Centralizes the initial dark terminal color and typography tokens for the runtime.
 */
export const darkTerminalTheme = {
  background: '#050816',
  backgroundHex: 0x050816,
  text: '#f8fafc',
  gridLine: 'rgba(148, 163, 184, 0.08)',
  fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
  particlePalette: ['#5eead4', '#60a5fa', '#f8fafc'],
} as const;

export type DarkTerminalTheme = typeof darkTerminalTheme;

export function applyDarkTerminalTheme(target: HTMLElement): void {
  const root = target.ownerDocument.documentElement;

  root.style.setProperty('--codewall-background', darkTerminalTheme.background);
  root.style.setProperty('--codewall-text', darkTerminalTheme.text);
  root.style.setProperty('--codewall-grid-line', darkTerminalTheme.gridLine);
  root.style.setProperty('--codewall-font-mono', darkTerminalTheme.fontFamily);
  root.style.setProperty('--codewall-accent', darkTerminalTheme.particlePalette[0]);
  root.style.setProperty('--codewall-secondary', darkTerminalTheme.particlePalette[1]);
}

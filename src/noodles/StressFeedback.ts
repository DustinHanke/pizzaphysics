/** Shared thresholds for physics warnings, UI, and optional mobile haptics. */
export type StressBand = 'safe' | 'caution' | 'critical' | 'broken';
export function stressBand(risk: number, torn = false): StressBand {
  if (torn) return 'broken';
  if (risk >= .7) return 'critical';
  if (risk >= .27) return 'caution';
  return 'safe';
}

/** navigator.vibrate works in some Android browsers, not iOS Safari.
 * Optional and rate limited; there is no attempt to emulate haptics via sound. */
export class StressHaptics {
  enabled = true;
  readonly supported: boolean;
  private lastTime = -Infinity;
  private lastBand: StressBand = 'safe';
  constructor(
    private readonly vibration: ((duration: number | number[]) => boolean) | null =
      typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
        ? navigator.vibrate.bind(navigator)
        : null,
  ) {
    this.supported = this.vibration !== null;
  }
  reset() {
    this.lastTime = -Infinity;
    this.lastBand = 'safe';
  }
  pulse(risk: number, torn: boolean, nowMs: number): boolean {
    const band = stressBand(risk, torn);
    if (band === 'safe') this.lastBand = 'safe';
    if (!this.enabled || !this.vibration || band === 'safe') return false;
    const newlyCritical = band === 'critical' && this.lastBand !== 'critical';
    const newlyBroken = band === 'broken' && this.lastBand !== 'broken';
    const interval = band === 'caution' ? 1600 : band === 'critical' ? 800 : Infinity;
    const due = nowMs - this.lastTime >= interval;
    if (!(newlyCritical || newlyBroken || due)) return false;
    this.lastBand = band;
    this.lastTime = nowMs;
    const pattern: number | number[] =
      band === 'broken' ? [45, 70, 95] :
      band === 'critical' ? [32, 55, 32] : 20;
    try { return Boolean(this.vibration(pattern)); } catch { return false; }
  }
}

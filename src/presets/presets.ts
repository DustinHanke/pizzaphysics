export type Parameters = { mozzarella: number; stretch: number; strength: number; viscosity: number; stiffness: number; gravity: number; temperature: number; sag: number };
export const presets: Record<string, Omit<Parameters, 'mozzarella'>> = {
  neapolitan: { stretch: 65, strength: 58, viscosity: 62, stiffness: 40, gravity: 65, temperature: 78, sag: 1 },
};
export const params = { ...presets.neapolitan, mozzarella:100 };
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const warmth = () => (params.temperature - 20) / 80;

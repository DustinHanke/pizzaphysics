/** Mobile changes render detail only; collision and deformable solvers stay identical. */
export const quality={mobile:typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches};

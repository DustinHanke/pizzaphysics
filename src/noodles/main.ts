import '../style.css';
import './noodles.css';
import * as T from 'three';
import { createScene } from '../scene/createScene';
import { NoodleWorld } from './NoodleWorld';
import { NoodleRenderer } from './NoodleRenderer';
import { NoodleInteraction } from './NoodleInteraction';
import { mountNoodleUI } from './NoodleUI';

const world = new NoodleWorld();
mountNoodleUI(world.settings);

async function start() {
  const canvas = document.querySelector('#scene') as HTMLCanvasElement;
  const { scene, camera, renderer, resolution, key } = await createScene(canvas);
  const noodles = new NoodleRenderer(scene);
  const hint = document.querySelector('#hint')!;
  const controller = new NoodleInteraction(canvas, camera, world, noodles.grips, () => hint.classList.add('hidden'));
  const reset = () => {
    controller.release();
    world.reset();
    noodles.update(world);
    hint.classList.remove('hidden');
  };
  const fold = () => {
    controller.release();
    const didFold = world.fold();
    if (!didFold) {
      const status = document.querySelector('#status')!;
      status.textContent = world.strandCount >= 8 ? 'EIGHT STRANDS — MAXIMUM FOR THIS STUDY' : 'PULL LONGER BEFORE FOLDING';
    } else {
      noodles.update(world);
      hint.classList.add('hidden');
    }
  };

  document.querySelector('#reset')!.addEventListener('click', reset);
  document.querySelector('#fold')!.addEventListener('click', fold);
  document.querySelector('#camera-reset')!.addEventListener('click', () => controller.resetView());
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyR') reset();
    if (e.code === 'KeyF') fold();
    if (e.code === 'KeyC') controller.resetView();
  });

  const fields = Object.fromEntries(['length', 'strands', 'thickness', 'stretch', 'tension', 'tension-bar', 'status', 'fps', 'physics'].map(id => [id, document.getElementById(id)!]));
  let previous = performance.now(), lastUI = 0, frames = 0, elapsed = 0, smoothedPhysics = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  noodles.update(world);
  const frame = (now: number) => {
    const frameSeconds = (now - previous) / 1000;
    const dt = Math.min(frameSeconds, .05);
    previous = now;
    if (document.hidden) return;
    if (resolution.update(frameSeconds)) renderer.setPixelRatio(resolution.ratio);
    world.advance(dt);
    smoothedPhysics = smoothedPhysics * .94 + world.timeMs * .06;
    controller.update(reducedMotion ? Math.max(dt, .1) : dt);
    noodles.update(world);
    key.shadow.needsUpdate = true;
    renderer.render(scene, camera);
    frames++;
    elapsed += frameSeconds;
    if (now - lastUI >= 200) {
      fields.length.textContent = (world.totalLength * 10).toFixed(0);
      fields.strands.textContent = String(world.strandCount);
      fields.thickness.textContent = world.diameterMm.toFixed(1);
      fields.stretch.textContent = String(Math.round(world.drawRatio * 100));
      fields.tension.textContent = `${world.tension}%`;
      fields['tension-bar'].style.width = `${world.tension}%`;
      fields['tension-bar'].style.background = world.tension > 78 ? '#b94d2c' : '#777e5c';
      fields.status.textContent = world.strandCount === 8
        ? 'EIGHT STRANDS — KEEP PULLING'
        : world.tension > 78
          ? 'DOUGH UNDER TENSION — PULL SLOWLY'
          : world.drawRatio > 1.35
            ? 'READY TO FOLD — DOUBLE YOUR STRANDS'
            : 'DOUGH READY TO PULL';
      fields.fps.textContent = String(Math.round(frames / Math.max(.001, elapsed)));
      fields.physics.textContent = smoothedPhysics.toFixed(1);
      lastUI = now;
      frames = 0;
      elapsed = 0;
    }
  };
  renderer.setAnimationLoop(frame);
  document.querySelector('#loading')!.classList.add('done');
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    controller.release();
    document.querySelector('#error')!.removeAttribute('hidden');
  });
}

start().catch(error => {
  console.error('Noodle Physics could not initialize', error);
  document.querySelector('#loading')!.classList.add('done');
  document.querySelector('#error')!.removeAttribute('hidden');
});

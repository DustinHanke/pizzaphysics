import '../style.css';
import './noodles.css';
import * as T from 'three';
import { createScene } from '../scene/createScene';
import { quality } from '../performance/quality';
import { NoodleWorld } from './NoodleWorld';
import { NoodleRenderer } from './NoodleRenderer';
import { NoodleInteraction } from './NoodleInteraction';
import { mountNoodleUI } from './NoodleUI';
import { stressBand, StressHaptics } from './StressFeedback';

const world = new NoodleWorld();
mountNoodleUI(world.settings);

async function start() {
  const canvas = document.querySelector('#scene') as HTMLCanvasElement;
  const { scene, camera, renderer, resolution, key } = await createScene(canvas);
  const noodles = new NoodleRenderer(scene);
  // Do not change the shared Pizza Physics renderer: the larger Noodle
  // workspace needs its own wider key-light shadow frustum.
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.needsUpdate = true;
  // A restrained raking fill emphasizes the PBR normal map's flour and creases
  // without changing the shared Pizza Physics lighting implementation.
  const doughFill = new T.DirectionalLight('#fff9ec', .27);
  doughFill.position.set(1.5, 5.5, 4);
  scene.add(doughFill);
  const hint = document.querySelector('#hint')!;
  const stressVignette = document.querySelector('#stress-vignette') as HTMLDivElement;
  const stressCallout = document.querySelector('#stress-callout') as HTMLDivElement;
  const calloutTitle = document.querySelector('#stress-callout-title')!;
  const calloutDescription = document.querySelector('#stress-callout-description')!;
  const haptics = new StressHaptics();
  const hapticRow = document.querySelector('#haptics-setting') as HTMLLabelElement;
  const hapticCheckbox = document.querySelector('#haptics-enabled') as HTMLInputElement;
  hapticRow.hidden = !haptics.supported;
  hapticCheckbox.addEventListener('change', () => { haptics.enabled = hapticCheckbox.checked; });
  const controller = new NoodleInteraction(canvas, camera, world, noodles.grips,
    () => hint.classList.add('hidden'),
    () => { if (world.fold()) { noodles.update(world); hint.classList.add('hidden'); } },
    (leftActive, rightActive, hovered) => noodles.setGripState(leftActive, rightActive, hovered),
    () => haptics.pulse(world.failureRisk, world.torn, performance.now()));
  const reset = () => {
    controller.release();
    world.reset();
    haptics.reset();
    lastStressBand = 'safe';
    stressVignette.style.setProperty('--stress-intensity', '0');
    stressCallout.hidden = true;
    noodles.update(world);
    hint.classList.remove('hidden');
    noodles.setGripState();
  };
  const fold = () => {
    if (world.torn) {
      document.querySelector('#status')!.textContent = 'THE DOUGH HAS SNAPPED — PRESS FRESH START';
      return;
    }
    controller.release();
    const didFold = world.fold();
    if (!didFold) {
      const status = document.querySelector('#status')!;
      status.textContent = world.strandCount >= 16 ? 'SIXTEEN STRANDS — KEEP REFINING YOUR PULL' : 'PULL LONGER BEFORE FOLDING';
    } else {
      noodles.update(world);
      hint.classList.add('hidden');
    }
  };

  document.querySelector('#reset')!.addEventListener('click', reset);
  document.querySelector('#snap')!.addEventListener('click', () => world.snap());
  document.querySelector('#fold')!.addEventListener('click', fold);
  document.querySelector('#camera-reset')!.addEventListener('click', () => controller.resetView());
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyR') reset();
    if (e.code === 'KeyS') world.snap();
    if (e.code === 'KeyF') fold();
    if (e.code === 'KeyC') controller.resetView();
  });

  const fields = Object.fromEntries(['length', 'strands', 'thickness', 'stretch', 'tension', 'tension-bar', 'resistance', 'resistance-bar', 'relaxation', 'relaxation-bar', 'uniformity', 'uniformity-bar', 'strength', 'strength-bar', 'tear-notice', 'success', 'status', 'fps', 'physics'].map(id => [id, document.getElementById(id)!]));
  let previous = performance.now(), lastUI = 0, lastShadow = 0, frames = 0, elapsed = 0, smoothedPhysics = 0;
  let lastStressBand = 'safe';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  noodles.update(world);
  const frame = (now: number) => {
    const frameSeconds = (now - previous) / 1000;
    const dt = Math.min(frameSeconds, .05);
    previous = now;
    if (document.hidden) return;
    if (resolution.update(frameSeconds)) renderer.setPixelRatio(resolution.ratio);
    world.advance(dt);
    const risk = world.failureRisk;
    const band = stressBand(risk, world.torn);
    // UI edge treatment follows the measured physical failure risk, not a
    // decorative animation or fixed count of seconds since the first pull.
    const vignetteOpacity = band === 'safe' ? 0 : band === 'caution'
      ? .28 + Math.max(0, risk - .27) * .83
      : band === 'critical' ? .64 + Math.max(0, risk - .7) * 1.05 : .85;
    stressVignette.dataset.level = band;
    stressVignette.style.setProperty('--stress-intensity', String(Math.min(1, vignetteOpacity)));
    if (band !== lastStressBand) {
      lastStressBand = band;
      stressCallout.hidden = band === 'safe';
      stressCallout.dataset.level = band;
      if (band === 'caution') {
        calloutTitle.textContent = 'EASE THE PULL';
        calloutDescription.textContent = 'The gluten is straining — move more slowly.';
      } else if (band === 'critical') {
        calloutTitle.textContent = 'DANGER — SLOW DOWN';
        calloutDescription.textContent = 'The noodle is close to tearing.';
      } else if (band === 'broken') {
        calloutTitle.textContent = 'DOUGH SNAPPED';
        calloutDescription.textContent = 'Use Fresh start to try again.';
      }
    }
    // Some mobile browsers accept vibration only after a user gesture;
    // gesture callbacks also try this path synchronously.
    haptics.pulse(risk, world.torn, now);
    smoothedPhysics = smoothedPhysics * .94 + world.timeMs * .06;
    controller.update(reducedMotion ? Math.max(dt, .1) : dt);
    noodles.update(world);
    if (!quality.mobile || now - lastShadow >= 1000 / 30) {
      key.shadow.needsUpdate = true;
      lastShadow = now;
    }
    renderer.render(scene, camera);
    frames++;
    elapsed += frameSeconds;
    if (now - lastUI >= 200) {
      fields.length.textContent = (world.totalLength * 10).toFixed(0);
      fields.strands.textContent = String(world.strandCount);
      fields.thickness.textContent = world.diameterMm.toFixed(1);
      fields.stretch.textContent = String(Math.round(world.drawRatio * 100));
      fields.tension.textContent = `${world.tension}%`;
      const resistance = Math.round(world.resistance * 100);
      fields.resistance.textContent = `${resistance}%`;
      fields['resistance-bar'].style.width = `${resistance}%`;
      fields['resistance-bar'].style.background = resistance > 65 ? '#b58348' : '#879077';
      const relaxation = Math.round(world.relaxation * 100);
      fields.relaxation.textContent = `${relaxation}%`;
      fields['relaxation-bar'].style.width = `${relaxation}%`;
      fields.uniformity.textContent = `${world.uniformity}%`;
      fields['uniformity-bar'].style.width = `${world.uniformity}%`;
      fields['uniformity-bar'].style.background = world.uniformity < 65 ? '#b94d2c' : '#718766';
      fields.strength.textContent = `${world.integrity}%`;
      fields['strength-bar'].style.width = `${world.integrity}%`;
      fields['strength-bar'].style.background = world.integrity < 45 ? '#b94d2c' : '#718766';
      fields['tear-notice'].hidden = !world.torn;
      fields['tension-bar'].style.width = `${world.tension}%`;
      fields['tension-bar'].style.background = world.tension > 78 ? '#b94d2c' : '#777e5c';
      document.querySelector('#fold')!.classList.toggle('ready', world.canFold);
      fields.success.hidden = !world.batchReady;
      fields.status.textContent = world.torn
        ? 'DOUGH TORN — TRY A MORE CONTROLLED PULL'
        : world.folding
        ? 'FOLDING — KEEP YOUR HANDS STEADY'
        : world.batchReady
          ? 'BATCH COMPLETE — SIXTEEN EVENLY PULLED STRANDS'
          : world.uniformity < 65
            ? 'UNEVEN DOUGH — SLOW DOWN AND STRETCH GENTLY'
            : world.minDiameterMm < world.diameterMm * .72
              ? 'THIN SPOT DETECTED — REDUCE TENSION'
              : world.tension > 78
                ? 'HIGH TENSION — PULL MORE SLOWLY'
                : world.relaxation > .52 && world.resistance > .14
                  ? 'GLUTEN RELAXED — CONTINUE THE PULL GENTLY'
                  : world.resistance > .58
                    ? 'HEAVY DOUGH — HOLD STEADY TO SOFTEN IT'
                    : world.resistance > .22
                      ? 'FEEL THE RESISTANCE — SLOW DOWN AND HOLD'
                : world.canFold
                  ? 'READY TO FOLD — DOUBLE YOUR STRANDS'
                  : world.strandCount === 16
                    ? 'SIXTEEN STRANDS — EVEN OUT YOUR PULL'
                    : 'PULL, HOLD AND RELEASE — WORK WITH THE DOUGH';
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

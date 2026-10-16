import type { NoodleSettings } from './NoodleWorld';

/** Same editorial studio layout and control primitives used by Pizza Physics. */
export function mountNoodleUI(settings: NoodleSettings) {
  document.querySelector('#app')!.innerHTML = `
  <main class="experiment noodle-experiment">
    <header class="masthead">
      <h1 class="wordmark">Noodle<span>Physics</span><i aria-hidden="true">.</i></h1>
      <div class="intro"><p>The art of the pull.</p><span>Fresh dough. A little physics.</span></div>
      <span class="project-tag">PULL / FOLD / REPEAT</span>
    </header>
    <section class="stage" aria-label="Hand-pulled noodle interaction">
      <div class="stage-caption"><span>HAND-PULLED NOODLES — EXPERIMENT 01</span><span>Made to be stretched.</span></div>
      <canvas id="scene" tabindex="0" aria-label="Interactive strand of dough. Drag either dough grip to stretch. Drag empty space to orbit, scroll to zoom. Press F to fold and R to reset."></canvas>
      <div class="pull-hint" id="hint"><span class="hint-mark" aria-hidden="true">↔</span><span>Grab either end. Pull the dough.</span></div>
    </section>
    <div class="stage-actions">
      <span class="gesture-note">Drag either end to pull · Empty space to orbit · Scroll to zoom</span>
      <div class="view-actions">
        <button id="camera-reset" title="Reset camera (C)">Reset view</button>
        <button id="fold" title="Fold and double the strands (F)">Fold dough <span aria-hidden="true">↶</span></button>
        <button id="reset" title="Start with fresh dough (R)">Fresh start <span aria-hidden="true">↻</span></button>
      </div>
    </div>
    <section class="telemetry" aria-label="Live measurements">
      <div class="section-heading"><span class="indicator"></span> THE PULL, IN NUMBERS</div>
      <dl>
        <div><dt>Draw length</dt><dd><span id="length">0</span><small>cm</small></dd></div>
        <div><dt>Strands</dt><dd id="strands">1</dd></div>
        <div><dt>Thickness</dt><dd><span id="thickness">9.0</span><small>mm</small></dd></div>
        <div class="secondary"><dt>Dough extension</dt><dd><span id="stretch">100</span><small>%</small></dd></div>
      </dl>
      <div class="integrity"><div><span>Pull tension</span><span id="tension">0%</span></div><div class="track"><i id="tension-bar"></i></div></div>
      <p id="status" role="status">DOUGH READY TO PULL</p>
    </section>
    <aside class="controls">
      <div class="controls-intro"><span class="small-label">A STUDY IN HAND-PULLED DOUGH</span><h2>Stretch.<br><em>Fold.</em></h2><p>Draw the dough until it grows thin, then fold to double the strands. A simple approximation of the real craft.</p></div>
      <button class="controls-toggle" aria-expanded="true" aria-controls="control-body"><span>Adjust the feel</span><span class="toggle-symbol">−</span></button>
      <div id="control-body"></div>
      <p class="specimen-note">Pulled, never extruded.<br><span>Flour · Water · Patience</span></p>
    </aside>
    <footer><span>NOODLE PHYSICS <i>—</i> A little food for curiosity. <i>·</i> <a href="https://pizza.dustinhanke.de" target="_blank" rel="noopener noreferrer">Try Pizza Physics</a></span>
      <span class="performance"><span id="fps">—</span> FPS <i>/</i> <span id="physics">—</span> MS PHYSICS</span></footer>
    <div id="loading" class="loading"><div>NOODLE PHYSICS<span>.</span></div><p>PREPARING DOUGH</p><i></i></div>
    <div id="error" hidden><h2>The kitchen needs a different browser.</h2><p>Try a current browser with WebGL 2 or WebGPU enabled.</p><button id="reload">TRY AGAIN</button></div>
  </main>`;
  const rows: [keyof NoodleSettings, string, string][] = [
    ['plasticity', 'DOUGH EXTENSIBILITY', '%'],
    ['softness', 'DOUGH SOFTNESS', '%'],
    ['gravity', 'GRAVITY', '%'],
  ];
  const panel = document.querySelector('#control-body')!;
  panel.innerHTML = rows.map(([key, label, unit]) => `<div class="control-row"><label for="${key}-input">${label}</label><output id="${key}-output" for="${key}-input">${settings[key]}${unit}</output><input id="${key}-input" type="range" min="0" max="100" value="${settings[key]}" aria-label="${label.toLowerCase()}"></div>`).join('');
  for (const [key, , unit] of rows) {
    const input = document.getElementById(`${key}-input`) as HTMLInputElement;
    const output = document.getElementById(`${key}-output`)!;
    const update = () => {
      settings[key] = input.valueAsNumber;
      output.textContent = `${settings[key]}${unit}`;
      input.style.setProperty('--fill', `${settings[key]}%`);
    };
    input.addEventListener('input', update);
    update();
  }
  const toggle = document.querySelector('.controls-toggle')!;
  function expand(value: boolean) {
    toggle.setAttribute('aria-expanded', String(value));
    document.querySelector('.controls')!.classList.toggle('collapsed', !value);
    document.querySelector('.toggle-symbol')!.textContent = value ? '−' : '+';
  }
  toggle.addEventListener('click', () => expand(toggle.getAttribute('aria-expanded') !== 'true'));
  if (innerWidth <= 900) expand(false);
  document.querySelector('#reload')!.addEventListener('click', () => location.reload());
}

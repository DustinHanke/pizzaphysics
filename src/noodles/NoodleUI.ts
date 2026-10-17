import type { NoodleSettings } from './NoodleWorld';

/** Same editorial studio layout and control primitives used by Pizza Physics. */
export function mountNoodleUI(settings: NoodleSettings) {
  document.querySelector('#app')!.innerHTML = `
  <main class="experiment noodle-experiment">
    <header class="masthead">
      <h1 class="wordmark">Noodle<span>Physics</span><i aria-hidden="true">.</i></h1>
      <div class="intro"><p>One dough. A thousand possibilities.</p><span>A hands-on study in stretching &amp; folding.</span></div>
      <span class="project-tag">PULL / FOLD / REPEAT</span>
    </header>
    <section class="stage" aria-label="Hand-pulled noodle interaction">
      <div class="stage-caption"><span>LĀMIÀN / THE DOUGH STUDY · Nº 02</span><span>From a single pull.</span></div>
      <canvas id="scene" tabindex="0" aria-label="Interactive fresh noodle dough. Use two fingertips simultaneously to stretch both highlighted ends. Drag empty space to orbit, scroll to zoom. Press S to swing, F to fold and R to reset."></canvas>
      <div id="stress-vignette" class="stress-vignette" aria-hidden="true"></div>
      <div id="stress-callout" class="stress-callout" role="status" aria-live="polite" hidden><span id="stress-callout-title">SLOW DOWN</span><small id="stress-callout-description">Ease the tension to protect the dough.</small></div>
      <div class="pull-hint" id="hint"><span class="hint-mark" aria-hidden="true">↔</span><span>Use two fingers to pull both ends apart.</span></div>
    </section>
    <div class="stage-actions">
      <span class="gesture-note">Two fingers: pull both ends independently · Fold when ready · Scroll to zoom</span>
      <div class="view-actions">
        <button id="camera-reset" title="Reset camera (C)">Reset view</button>
        <button id="snap" title="Snap the dough (S)">Swing <span aria-hidden="true">↝</span></button>
        <button id="fold" title="Fold and double the strands (F)">Fold &amp; double <span aria-hidden="true">↶</span></button>
        <button id="reset" title="Start with fresh dough (R)">Fresh start <span aria-hidden="true">↻</span></button>
      </div>
    </div>
    <section class="telemetry" aria-label="Live measurements">
      <div class="section-heading"><span class="indicator"></span> THE PULL, IN NUMBERS</div>
      <dl>
        <div><dt>Total dough length</dt><dd><span id="length">0</span><small>cm</small></dd></div>
        <div><dt>Strands</dt><dd id="strands">1</dd></div>
        <div><dt>Avg. diameter</dt><dd><span id="thickness">27.2</span><small>mm</small></dd></div>
        <div class="secondary"><dt>Elongation</dt><dd><span id="stretch">100</span><small>%</small></dd></div>
      </dl>
      <div class="integrity"><div><span>Pull tension</span><span id="tension">0%</span></div><div class="track"><i id="tension-bar"></i></div></div>
      <div class="integrity noodle-uniformity"><div><span>Pull quality</span><span id="uniformity">100%</span></div><div class="track"><i id="uniformity-bar"></i></div></div>
      <div class="integrity noodle-strength"><div><span>Dough strength</span><span id="strength">100%</span></div><div class="track"><i id="strength-bar"></i></div></div>
      <label class="noodle-haptics-setting" id="haptics-setting" hidden><input type="checkbox" id="haptics-enabled" checked> Vibrate when dough is under strain <span>(supported devices)</span></label>
      <p id="status" role="status">GENTLY PULL BOTH HANDS APART</p>
      <p class="batch-goal">THE NOODLE STUDY <span>→ 16 STRANDS · UNDER 10 MM · 65% UNIFORMITY</span></p>
      <div class="noodle-success" id="success" hidden><span>THE STUDY IS COMPLETE</span><strong>Sixteen strands. One piece of dough.</strong><p>A balanced hand-pulled batch — ready to cook. Start again and aim for an even smoother pull.</p></div>
      <div class="noodle-tear" id="tear-notice" hidden><span>THE DOUGH SNAPPED</span><strong>Too much tension, too quickly.</strong><p>The broken ends now move independently. Choose <b>Fresh start</b> to try a gentler, more even pull.</p></div>
    </section>
    <aside class="controls">
      <div class="controls-intro"><span class="small-label">A STUDY IN HAND-PULLED DOUGH</span><h2>The perfect<br><em>pull.</em></h2><p>Pull with both hands and keep the thickness even. A sudden, forceful yank can tear the gluten network. Watch the dough strength, then fold when the dough is ready. Reach 16 strands with consistent texture to finish the study.</p></div>
      <button class="controls-toggle" aria-expanded="true" aria-controls="control-body"><span>Adjust the feel</span><span class="toggle-symbol">−</span></button>
      <div id="control-body"></div>
      <p class="specimen-note">Feel the dough yield.<br><span>01 Pull evenly · 02 Swing gently · 03 Fold · 04 Refine</span></p>
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

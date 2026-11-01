/* The expert's room in the paid apps: Olaf's study above the Workshop, Ivy's room at the top of the Glasshouse,
   Juno's gable room in Tuck's house. Rendered in the Busy Studio (busy-studio/scripts/places/experts.py) with
   its depth and its lights, morning, day and evening; the expert stands in it live (shared/scene.js, the same
   engine as the guides on the home screens) and acts out what the AI is doing:

     waiting for Claude, a tool running  → Thinking      the answer streaming in → Writing
     the turn done                       → Nodding       something saved or made  → Happy
     opening the page                    → Waving

   The paid build copies this file with the expert's room (scene.js) and model (<name>.glb.js) into
   apps/<name>/room/. Loaded after shared/ai.js:
     <script src="room/room.js" data-expert="ivy" data-size="1.28"></script>
   Without WebGL, or with reduced motion, the still room shows with the expert's drawn pose. The room sits above
   <main>, so it stays while the page redraws and during a conversation. Nothing here talks to the AI itself. */
(function () {
  'use strict';
  const me = document.currentScript;
  if (!me) return;
  const NAME = me.dataset.expert, SIZE = +me.dataset.size || 1;
  const BASE = me.src.replace(/room\.js(\?.*)?$/, '');
  const root = (document.body && document.body.dataset.root) || '../../';
  const h = new Date().getHours(), tod = h >= 5 && h < 11 ? '-morning' : h >= 11 && h < 17 ? '' : '-evening';
  const load = (src) => new Promise((ok, no) => { const t = document.createElement('script'); t.src = src; t.onload = ok; t.onerror = () => no(new Error('could not load ' + src)); document.head.append(t); });

  const css = document.createElement('style');
  css.textContent = `
    .expert-room { position: relative; max-width: var(--wrap, 1180px); margin: 18px auto 0; width: calc(100% - 32px); aspect-ratio: 16 / 6.2; overflow: hidden;
      border: 2px solid var(--border); border-radius: 26px; box-shadow: var(--shadow); background: #16141F; }
    .expert-room .place-frame { position: absolute; left: 0; top: -22%; width: 100%; aspect-ratio: 16 / 9; }
    .expert-room .place-frame > img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .expert-room .place-frame .scene-canvas { position: absolute; left: 0; top: 0; }
    .expert-room .place-frame.scene-plate > img { visibility: hidden; }
    .expert-room .pose { position: absolute; right: 31%; bottom: 4%; height: 80%; width: auto; filter: drop-shadow(0 6px 10px rgba(0,0,0,.35)); }
    .expert-room.live .pose { display: none; }
    .expert-room .expert-say { position: absolute; left: 0; top: 0; margin: 0; padding: 7px 12px; border: 2px solid var(--border); border-radius: 14px;
      background: var(--surface); color: var(--ink); font-weight: 700; font-size: .85rem; box-shadow: var(--shadow-sm); white-space: nowrap;
      transform: translate(calc(var(--head-x, 70%) - 100% - 14px), calc(var(--head-y, 30%) - 50%)); transition: opacity .2s; }
    .expert-room .expert-say[hidden] { display: block; opacity: 0; }
    .expert-room .expert-tip { position: absolute; left: 0; top: 0; max-width: min(320px, 46%); margin: 0; padding: 10px 14px; border: 2px solid var(--border);
      border-radius: 16px; background: var(--surface); color: var(--ink); box-shadow: var(--shadow); font-size: .9rem; line-height: 1.3;
      transform: translate(calc(var(--head-x, 62%) - 100% - 18px), calc(var(--head-y, 34%) - 70%)); transition: opacity .2s; }
    .expert-room .expert-tip b { display: block; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
    .expert-room .expert-tip button { margin-top: 8px; }
    .expert-room.busy .expert-tip, .expert-room .expert-tip[hidden] { opacity: 0; pointer-events: none; }
    @media (max-width: 640px) { .expert-room .expert-tip { font-size: .78rem; padding: 7px 10px; } .expert-room .expert-tip button { padding: 4px 10px; font-size: .78rem; } }
    @media (max-width: 640px) { .expert-room { aspect-ratio: 16 / 8; border-radius: 18px; } .expert-room .place-frame { top: -12%; } }`;
  document.head.append(css);

  let stage = null, fig = null;
  const SAY = { Thinking: 'Thinking…', Writing: 'Writing…', Nodding: 'Done', Happy: 'Saved!' };
  function state(move) {
    if (fig) fig.classList.toggle('busy', move === 'Thinking' || move === 'Writing');
    const say = fig && fig.querySelector('.expert-say');
    if (say) { say.textContent = SAY[move] || ''; say.hidden = !SAY[move]; }
    if (stage && stage.playing !== move) stage.play(move);
  }

  // What the AI is doing, from the shared AI client: every expert talks to Claude through BW.ai.once.
  let endTimer = null, made = false;
  function wrapAi() {
    if (!window.BW || !BW.ai || !BW.ai.once || BW.ai.once.__room) return;
    const once = BW.ai.once.bind(BW.ai);
    const wrapped = async function (o = {}) {
      clearTimeout(endTimer);
      state('Thinking');
      let writing = false;
      const onText = o.onText, onStatus = o.onStatus;
      const opts = { ...o,
        onText: (t) => { if (!writing && t && t.trim()) { writing = true; state('Writing'); } if (onText) onText(t); },
        onStatus: (t) => { const tool = /^🛠️ (.+)…$/.exec(t || ''); if (tool) { writing = false; state('Thinking'); if (/(add|update|create|save|write)/i.test(tool[1])) made = true; } if (onStatus) onStatus(t); } };
      try { return await once(opts); } finally {
        // A turn can take several calls (tools in between): it's done when no new call follows soon.
        endTimer = setTimeout(() => { state(made ? 'Happy' : 'Nodding'); made = false; setTimeout(() => { const say = fig && fig.querySelector('.expert-say'); if (say) say.hidden = true; }, 2600); }, 1400);
      }
    };
    wrapped.__room = true;
    BW.ai.once = wrapped;
  }

  async function mount() {
    const main = document.getElementById('main');
    if (!main || document.querySelector('.expert-room')) return;
    fig = document.createElement('figure');
    fig.className = 'expert-room';
    fig.setAttribute('aria-hidden', 'true');
    fig.innerHTML = `<div class="place-frame"><img src="${BASE}${NAME}${tod}.jpg" alt=""></div><img class="pose" src="${BASE}${NAME}-hello.png" alt=""><p class="expert-say" hidden></p><div class="expert-tip" hidden></div>`;
    main.before(fig);
    wrapAi();
    try {
      if (!window.BusyScene) await load(root + 'shared/scene.js');
      if (!BusyScene.canGL() || BusyScene.reduced()) return;
      if (!window.BusyThree) await load(root + 'shared/vendor/three-busy.js');
      await load(BASE + 'scene.js');
      await load(BASE + NAME + '.glb.js');
      stage = await BusyScene.stage(fig.querySelector('.place-frame'), window.BusyScenes[NAME], window.BusyGLB[NAME], {
        size: SIZE, hello: 'Waving', loops: ['Idle', 'Thinking', 'Writing'],
        onFrame: (head) => { if (head) { fig.style.setProperty('--head-x', Math.round(head.x) + 'px'); fig.style.setProperty('--head-y', Math.round(head.y + fig.querySelector('.place-frame').offsetTop) + 'px'); } },
      });
      fig.classList.add('live');
    } catch (e) { console.info(`${NAME} stays drawn:`, e && e.message); }
  }
  // The page tells the room what to suggest: the expert says it, with a button that starts it.
  window.BusyRoom = {
    say(text, label, onClick) {
      const tip = fig && fig.querySelector('.expert-tip');
      if (!tip) return;
      if (!text) { tip.hidden = true; return; }
      tip.innerHTML = `<b>${NAME[0].toUpperCase() + NAME.slice(1)}</b>${BW.esc(text)}${label ? `<br><button class="btn btn-primary btn-sm" type="button">${BW.esc(label)}</button>` : ''}`;
      const b = tip.querySelector('button');
      if (b && onClick) b.onclick = onClick;
      tip.hidden = false;
    },
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();

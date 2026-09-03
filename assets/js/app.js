import * as THREE from 'three';
import {
  scene, renderer, camera, buttons, carts, state, bag, root,
  tween, tweenVec3, params,
  drawBootArt, drawScreenMessage, screenCtx, screenCanvas, screenTex, setLed,
  slotWorldPos, rootWorldQuat, bagHomeWorld,
  onFrame
} from './scene.js';

/* ================= SFX (WebAudio synth, no assets) ================= */
const SFX = (() => {
  let ctx = null, master = null;
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g, t0, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(type, f0, f1, dur, peak, when = 0) {
    const c = ensure(), t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    env(g, t0, 0.005, peak, dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function noiseBurst(dur, freq, peak, when = 0) {
    const c = ensure(), t0 = c.currentTime + when;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain(); env(g, t0, 0.003, peak, dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }
  return {
    unlock: ensure,
    tick()  { noiseBurst(0.03, 2400, 0.25); tone('square', 210, 160, 0.05, 0.06); },
    insert(){ noiseBurst(0.05, 900, 0.4); tone('sine', 130, 70, 0.12, 0.5); },
    lock()  { noiseBurst(0.025, 3200, 0.5); tone('sine', 320, 240, 0.05, 0.25); },
    eject() { tone('sine', 90, 150, 0.10, 0.4); noiseBurst(0.09, 1400, 0.3, 0.02); },
    boot()  { tone('sine', 660, 660, 0.10, 0.25); tone('sine', 990, 990, 0.14, 0.22, 0.11); },
    error() { tone('sawtooth', 140, 90, 0.35, 0.3); }
  };
})();
addEventListener('pointerdown', () => SFX.unlock(), { once: false });
addEventListener('keydown', () => SFX.unlock(), { once: false });

/* ================= EmulatorJS bridge ================= */
let live = false, ejsCanvas = null, bootWatchdog = 0;

function bootRom(cart) {
  stopEmulator();
  drawScreenMessage('LOADING', cart.rom.name.toUpperCase().slice(0, 24));
  const mount = document.getElementById('ejs-mount');
  mount.innerHTML = '';
  window.EJS_player = '#ejs-mount';
  window.EJS_core = 'gba';
  window.EJS_gameName = cart.rom.name.replace(/\.[^.]+$/, '');
  window.EJS_pathtodata = 'assets/emulator/';
  window.EJS_startOnLoaded = true;
  window.EJS_disableCue = true;
  window.EJS_volume = 0.9;
  window.EJS_Buttons = {
    playPause: false, restart: false, mute: false, saveState: false, loadState: false,
    quickSave: false, quickLoad: false, screenshot: false, fullscreen: false, settings: false,
    cheat: false, gamepad: false, screenRecord: false, saveSavFiles: false, loadSavFiles: false,
    virtualGamepad: false, menu: false, volume: false, shader: false, netplay: false,
    fastForward: false, slowMotion: false, saveStateSlot: false, stretch: false
  };
  window.EJS_onGameStart = () => {
    live = true;
    ejsCanvas = document.querySelector('#ejs-mount canvas');
    setLed(true);
    SFX.boot();
  };
  window.EJS_gameUrl = URL.createObjectURL(new Blob([cart.rom.data], { type: 'application/octet-stream' }));
  const s = document.createElement('script');
  s.src = 'assets/emulator/loader.js';
  s.dataset.ejs = '1';
  document.body.appendChild(s);
  clearTimeout(bootWatchdog);
  bootWatchdog = setTimeout(() => {
    if (!live) {
      drawScreenMessage('CARTRIDGE ERROR', '读取失败 · 请更换有效的 .gba ROM', true);
      SFX.error();
      setTimeout(() => ejectActive(), 2000);
    }
  }, 20000);
}

function stopEmulator() {
  clearTimeout(bootWatchdog);
  if (window.EJS_emulator) {
    try { window.EJS_emulator.gameManager.saveSaveFiles(); } catch (e) {}
    try { window.EJS_emulator.remove(); } catch (e) {}
    window.EJS_emulator = null;
  }
  document.querySelectorAll('script[data-ejs]').forEach(x => x.remove());
  document.getElementById('ejs-mount').innerHTML = '';
  live = false;
  ejsCanvas = null;
  setLed(false);
}

onFrame(() => {
  if (live && ejsCanvas && ejsCanvas.width > 0) {
    screenCtx.imageSmoothingEnabled = false;
    screenCtx.drawImage(ejsCanvas, 0, 0, 480, 320);
    screenTex.needsUpdate = true;
  }
});

/* ================= per-ROM saves (IndexedDB) ================= */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('gba3d', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('states');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function romKey() { return state.activeCart && state.activeCart.rom ? state.activeCart.rom.name : null; }
function flash(msg) {
  const el = document.getElementById('flash');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}
async function saveState() {
  if (!live || !romKey()) return flash('先插入卡带再存档');
  try {
    const st = window.EJS_emulator.gameManager.getState();
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction('states', 'readwrite');
      tx.objectStore('states').put(st, romKey());
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    flash('已存档 · ' + romKey());
  } catch (e) { flash('存档失败'); }
}
async function loadState() {
  if (!live || !romKey()) return flash('先插入卡带再读档');
  try {
    const db = await idb();
    const st = await new Promise((res, rej) => {
      const tx = db.transaction('states', 'readonly');
      const q = tx.objectStore('states').get(romKey());
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    if (!st) return flash('没有该 ROM 的存档');
    window.EJS_emulator.gameManager.loadState(new Uint8Array(st));
    flash('已读档');
  } catch (e) { flash('读档失败'); }
}

/* ================= cart flights ================= */
let busy = false;

function ejectFlight(cart, done) {
  SFX.eject();
  const mesh = cart.mesh;
  scene_attach(mesh);
  const p0 = mesh.position.clone(), q0 = mesh.quaternion.clone();
  const hover = slotWorldPos(true);
  const home = bagHomeWorld(cart);
  tweenVec3(mesh.position, p0, hover, 420, () => {
    tween(520, (e) => {
      mesh.position.lerpVectors(hover, home.pos, e);
      mesh.quaternion.slerpQuaternions(q0, home.quat, e);
    }, () => {
      bag.attach(mesh);
      mesh.position.copy(cart.home.pos);
      mesh.rotation.copy(cart.home.rot);
      cart.state = 'bag';
      if (state.activeCart === cart) state.activeCart = null;
      done && done();
    });
  });
}

function insertFlight(cart, done) {
  const mesh = cart.mesh;
  scene_attach(mesh);
  const p0 = mesh.position.clone(), q0 = mesh.quaternion.clone();
  const hover = slotWorldPos(true);
  const slot = slotWorldPos(false);
  const qSlot = rootWorldQuat();
  SFX.insert();
  tween(620, (e) => {
    mesh.position.lerpVectors(p0, hover, e);
    mesh.quaternion.slerpQuaternions(q0, qSlot, e);
  }, () => {
    tween(340, (e) => {
      mesh.position.lerpVectors(hover, slot, e);
    }, () => {
      root.attach(mesh);
      mesh.position.set(0.07, 0.472, 0);
      mesh.rotation.set(0, 0, 0);
      cart.state = 'inserted';
      state.activeCart = cart;
      SFX.lock();
      done && done();
    });
  });
}

function scene_attach(mesh) { scene.attach(mesh); }

function playCart(cart) {
  if (busy || cart.state !== 'bag' || !cart.rom) return;
  busy = true;
  const cur = state.activeCart;
  const doInsert = () => insertFlight(cart, () => { bootRom(cart); busy = false; });
  if (cur && cur.state === 'inserted') ejectFlight(cur, doInsert);
  else doInsert();
}

function ejectActive() {
  const cur = state.activeCart;
  if (!cur || cur.state !== 'inserted' || busy) return;
  busy = true;
  ejectFlight(cur, () => {
    stopEmulator();
    drawBootArt();
    busy = false;
  });
}

/* ================= ROM assignment ================= */
let pendingCart = null;

function handleRomFile(file, targetCart) {
  if (!/\.(gba|zip)$/i.test(file.name)) {
    drawScreenMessage('UNSUPPORTED FORMAT', '仅支持 .gba / .zip ROM', true);
    SFX.error();
    return;
  }
  file.arrayBuffer().then(buf => {
    const cart = targetCart
      || carts.find(c => !c.rom && c.state === 'bag')
      || carts.find(c => c.state === 'bag')
      || state.activeCart;
    cart.rom = { name: file.name, data: buf };
    const t = file.name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 10);
    cart.name = t;
    cart.mesh.userData.setLabel(t, 'USER ROM \u00B7 .GBA', '#b9c8e8', '#2b3a5e', 'dbdbdbd');
    playCart(cart);
  });
}

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handleRomFile(f);
});

const fileInput = document.getElementById('romFile');
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) handleRomFile(f, pendingCart);
  fileInput.value = '';
  pendingCart = null;
});

/* ================= input bridge ================= */
function pressButton(name) {
  const b = buttons[name];
  if (!b || b.pressed) return;
  b.pressed = true;
  b.press();
  SFX.tick();
  if (live && b.index >= 0) {
    try { window.EJS_emulator.gameManager.simulateInput(0, b.index, 1); } catch (e) {}
  }
}
function releaseButton(name) {
  const b = buttons[name];
  if (!b || !b.pressed) return;
  b.pressed = false;
  b.release();
  if (live && b.index >= 0) {
    try { window.EJS_emulator.gameManager.simulateInput(0, b.index, 0); } catch (e) {}
  }
}

const KEY2BTN = {
  ArrowUp: 'dpad', ArrowDown: 'dpad', ArrowLeft: 'dpad', ArrowRight: 'dpad',
  KeyZ: 'a', KeyX: 'b', KeyQ: 'l', KeyE: 'r', KeyV: 'select', Enter: 'start'
};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const b = KEY2BTN[e.code];
  if (b) { pressButton(b); e.preventDefault(); }
});
addEventListener('keyup', (e) => {
  const b = KEY2BTN[e.code];
  if (b) releaseButton(b);
});

/* pointer: buttons press + cart clicks */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let downInfo = null;

function pickAt(x, y) {
  ptr.x = (x / innerWidth) * 2 - 1;
  ptr.y = -(y / innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const objs = [];
  Object.values(buttons).forEach(b => objs.push(...b.meshes));
  carts.forEach(c => c.mesh.traverse(m => { if (m.isMesh) objs.push(m); }));
  const hit = ray.intersectObjects(objs, false)[0];
  if (!hit) return null;
  const bn = hit.object.userData.buttonName;
  if (bn) return { type: 'button', name: bn };
  const cart = carts.find(c => { let found = false; c.mesh.traverse(m => { if (m === hit.object) found = true; }); return found; });
  if (cart) return { type: 'cart', cart };
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), pick: pickAt(e.clientX, e.clientY) };
  if (downInfo.pick && downInfo.pick.type === 'button') pressButton(downInfo.pick.name);
});
addEventListener('pointerup', (e) => {
  Object.keys(buttons).forEach(releaseButton);
  if (!downInfo) return;
  const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
  const isClick = (dx * dx + dy * dy) < 36 && (performance.now() - downInfo.t) < 500;
  if (isClick && downInfo.pick && downInfo.pick.type === 'cart') {
    const cart = downInfo.pick.cart;
    if (cart.state === 'inserted') ejectActive();
    else if (cart.rom) playCart(cart);
    else { pendingCart = cart; fileInput.click(); }
  }
  downInfo = null;
});

/* hover cursor */
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const p = pickAt(e.clientX, e.clientY);
  renderer.domElement.style.cursor = p ? 'pointer' : '';
});

/* ================= HUD ================= */
document.getElementById('btnImport').addEventListener('click', (e) => {
  pendingCart = null;
  fileInput.click();
  e.currentTarget.blur();
});
document.getElementById('btnEject').addEventListener('click', (e) => { ejectActive(); e.currentTarget.blur(); });
document.getElementById('btnSave').addEventListener('click', (e) => { saveState(); e.currentTarget.blur(); });
document.getElementById('btnLoad').addEventListener('click', (e) => { loadState(); e.currentTarget.blur(); });

/* ================= debug hook ================= */
if (params.get('debug') === '1') {
  window.G3DTEST = {
    handleRomFile, playCart, ejectActive, saveState, loadState,
    carts, state, buttons,
    isLive: () => live,
    screenPixels: () => {
      const d = screenCtx.getImageData(0, 0, 480, 320).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 401) sum += d[i];
      return sum;
    }
  };
}

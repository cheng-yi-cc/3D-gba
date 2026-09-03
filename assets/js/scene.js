import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from '../vendor/three/geometries/RoundedBoxGeometry.js';

export const params = new URLSearchParams(location.search);
export const DEBUG = params.get('debug') === '1';
const AUTOROT = params.get('aa') !== '0';
const YAW = parseFloat(params.get('yaw') ?? '-90') * Math.PI / 180;

/* ================= renderer / scene / camera ================= */
const app = document.getElementById('app');
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#ede8df');
scene.fog = new THREE.Fog('#ede8df', 8, 15);

export const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 40);
camera.position.set(
  parseFloat(params.get('cx') ?? '0.1'),
  parseFloat(params.get('cy') ?? '0.78'),
  parseFloat(params.get('cz') ?? '3.15')
);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0.15, 0.32, 0);
controls.minDistance = 0.7;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.52;
if (params.get('tx')) controls.target.set(
  parseFloat(params.get('tx')),
  parseFloat(params.get('ty') ?? '0.32'),
  parseFloat(params.get('tz') ?? '0')
);
controls.autoRotate = AUTOROT;
controls.autoRotateSpeed = 0.45;
let idleTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
});
controls.addEventListener('end', () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (AUTOROT) controls.autoRotate = true; }, 4000);
});

/* ================= lights ================= */
scene.add(new THREE.HemisphereLight('#fffaf0', '#c9c2b4', 1.12));

const key = new THREE.DirectionalLight('#fff4e2', 2.5);
key.position.set(2.4, 3.4, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3; key.shadow.camera.right = 3;
key.shadow.camera.top = 3;  key.shadow.camera.bottom = -3;
key.shadow.bias = -0.0004;
key.shadow.radius = 7;
scene.add(key);

const fill = new THREE.DirectionalLight('#dfe9f5', 0.8);
fill.position.set(-2.6, 1.6, 2.6);
scene.add(fill);

const rim = new THREE.DirectionalLight('#ffffff', 0.55);
rim.position.set(-1.4, 2.6, -2.6);
scene.add(rim);

/* ================= ground ================= */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 72),
  new THREE.ShadowMaterial({ opacity: 0.26 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const pad = new THREE.Mesh(
  new THREE.CylinderGeometry(1.9, 1.98, 0.035, 96),
  new THREE.MeshStandardMaterial({ color: '#e3ddcf', roughness: 0.94 })
);
pad.position.y = 0.017;
pad.receiveShadow = true;
pad.castShadow = true;
scene.add(pad);

/* ================= shared materials ================= */
export const MAT = {
  shellDark:  new THREE.MeshPhysicalMaterial({ color: '#232329', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
  buttonLight: new THREE.MeshPhysicalMaterial({ color: '#cfc9e2', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  pill:       new THREE.MeshPhysicalMaterial({ color: '#5a5570', roughness: 0.45, clearcoat: 0.3 }),
  cartShell:  new THREE.MeshPhysicalMaterial({ color: '#d8d5da', roughness: 0.55 }),
  felt:       new THREE.MeshStandardMaterial({ color: '#2c2b31', roughness: 0.96 }),
  feltInner:  new THREE.MeshStandardMaterial({ color: '#1c1b20', roughness: 1.0 }),
  walnut:     new THREE.MeshPhysicalMaterial({ color: '#262126', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  glass:      new THREE.MeshPhysicalMaterial({ color: '#05070c', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 })
};

export const INDIGO = new THREE.Color('#6a5aa1');
export const F = 0.176;

/* ================= canvas helpers ================= */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function labelTexture(title, subtitle, bg, fg, blocks) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#f2f0ec';
    g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(30, 34, w - 60, 108, 16); g.fill();
    g.fillStyle = fg;
    g.font = '700 58px system-ui, "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(title, 52, 92);
    g.fillStyle = '#8a857c';
    g.font = '500 30px system-ui, sans-serif';
    g.fillText(subtitle, 52, 190);
    if (blocks) {
      const cols = { a: '#a8c8a0', b: '#8f86c2', c: '#d8c89a', d: '#9ab4c8' };
      blocks.split('').forEach((ch, i) => {
        g.fillStyle = cols[ch] || '#ccc';
        g.globalAlpha = 0.85;
        g.fillRect(300 + (i % 7) * 26, 158 + Math.floor(i / 7) * 26, 18, 18);
        g.globalAlpha = 1;
      });
    }
  });
}

/* ================= tween engine ================= */
const tweens = [];
export function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
export function tween(dur, onUpdate, onDone, ease = easeInOut) {
  tweens.push({ t0: performance.now(), dur, onUpdate, onDone, ease });
}
function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    let k = (now - tw.t0) / tw.dur;
    if (k >= 1) k = 1;
    tw.onUpdate(tw.ease(k), k === 1);
    if (k === 1) {
      tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}
export function tweenVec3(v, from, to, dur, onDone, ease) {
  from = from.clone(); to = to.clone();
  tween(dur, (e) => v.lerpVectors(from, to, e), onDone, ease);
}

/* ================= GBA ================= */
export const gba = new THREE.Group();
gba.position.set(-0.32, 0.036, -0.16);
gba.rotation.y = YAW;
scene.add(gba);

export const gbaLean = new THREE.Group();
gba.add(gbaLean);

export let root = null;
export const buttons = {};   /* name -> {index, group, press(), release(), meshes[]} */
export const carts = [];     /* cart objects */
export const state = { activeCart: null };

/* ---- screen: single live canvas texture ---- */
export const screenCanvas = document.createElement('canvas');
screenCanvas.width = 480; screenCanvas.height = 320;
export const screenCtx = screenCanvas.getContext('2d');
export const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 8;

export function drawBootArt() {
  const g = screenCtx, w = 480, h = 320;
  const bezel = g.createLinearGradient(0, 0, 0, h);
  bezel.addColorStop(0, '#11141c'); bezel.addColorStop(1, '#0a0d13');
  g.fillStyle = bezel; g.fillRect(0, 0, w, h);
  const aw = 330, ah = 220;
  const ax = (w - aw) / 2, ay = (h - ah) / 2;
  const grd = g.createLinearGradient(ax, ay, ax + aw, ay + ah);
  grd.addColorStop(0, '#3d3568'); grd.addColorStop(0.55, '#5a4e93'); grd.addColorStop(1, '#3b7a8c');
  g.fillStyle = grd;
  g.beginPath(); g.roundRect(ax, ay, aw, ah, 6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 1;
  for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(ax + aw * i / 12, ay); g.lineTo(ax + aw * i / 12, ay + ah); g.stroke(); }
  for (let j = 1; j < 8; j++) { g.beginPath(); g.moveTo(ax, ay + ah * j / 8); g.lineTo(ax + aw, ay + ah * j / 8); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = '700 40px system-ui, "Segoe UI", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('3D \u00B7 GBA', w / 2, h / 2 - 12);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = '500 15px system-ui, sans-serif';
  g.fillText('MUSEUM EXHIBIT \u00B7 INSERT CARTRIDGE', w / 2, h / 2 + 28);
  screenTex.needsUpdate = true;
}

export function drawScreenMessage(title, sub, err = false) {
  const g = screenCtx, w = 480, h = 320;
  g.fillStyle = err ? '#1a0d10' : '#10131a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = err ? '#e0524d' : '#8fd0c0';
  g.beginPath(); g.roundRect(40, 60, w - 80, 6, 3); g.fill();
  g.fillStyle = err ? '#ffb3b0' : '#e8f4f0';
  g.font = '700 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(title, w / 2, h / 2 - 8);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = '500 16px system-ui, sans-serif';
  g.fillText(sub, w / 2, h / 2 + 34);
  screenTex.needsUpdate = true;
}
drawBootArt();

/* ---- cart mesh factory ---- */
export function makeCartMesh(title, sub, bg, fg, blocks) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.17, 0.30, 3, 0.018), MAT.cartShell);
  body.castShadow = true;
  grp.add(body);
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.095),
    new THREE.MeshBasicMaterial({ map: labelTexture(title, sub, bg, fg, blocks) })
  );
  lbl.rotation.y = Math.PI / 2;
  lbl.position.set(0.0275, 0.02, 0);
  grp.add(lbl);
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.012, 0.02), MAT.cartShell);
    r.position.set(0, -0.062, 0.105 + i * 0.028);
    grp.add(r);
  }
  grp.userData.setLabel = (t, s, b, f, bl) => {
    lbl.material.map.dispose();
    lbl.material.map = labelTexture(t, s, b, f, bl);
    lbl.material.needsUpdate = true;
  };
  return grp;
}

new GLTFLoader().load('./assets/models/gba.glb', (g) => {
  root = g.scene;
  root.updateMatrixWorld(true);

  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const old = o.material;
      o.material = new THREE.MeshPhysicalMaterial({
        color: INDIGO,
        normalMap: old.normalMap || null,
        roughnessMap: old.roughnessMap || null,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: 0.4,
        clearcoat: 0.3,
        clearcoatRoughness: 0.32
      });
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = 1.0 / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(s);
  box.setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  gbaLean.add(root);

  gbaLean.rotation.z = 0.20;

  buildOverlayButtons(root);
  buildScreen(root);
  buildPowerLed(root);
  buildStand();
  buildBag();
  onModelReady.forEach(cb => cb());
});

const onModelReady = [];
export function whenModelReady(cb) { if (root) cb(); else onModelReady.push(cb); }

/* ---- buttons ---- */
function registerButton(name, index, group, meshes, pressFn, releaseFn) {
  buttons[name] = { index, group, meshes, press: pressFn, release: releaseFn, pressed: false };
  meshes.forEach(m => { m.userData.buttonName = name; });
}

function sink(group, depth, dir) {
  const from = group.position.clone();
  const to = from.clone();
  to.x += (dir || 1) * -depth;
  tween(90, (e) => group.position.lerpVectors(from, to, e), null, easeOut);
}
function unsink(group, saved) {
  const from = group.position.clone();
  tween(140, (e) => group.position.lerpVectors(from, saved, e), null, easeOut);
}

function buildOverlayButtons(rt) {
  const btn = new THREE.Group();
  rt.add(btn);

  /* D-pad */
  const dpad = new THREE.Group();
  dpad.position.set(F - 0.006, 0.130, 0.487);
  const b1 = new THREE.Mesh(new RoundedBoxGeometry(0.030, 0.044, 0.152, 3, 0.013), MAT.shellDark);
  const b2 = new THREE.Mesh(new RoundedBoxGeometry(0.030, 0.152, 0.044, 3, 0.013), MAT.shellDark);
  b1.castShadow = b2.castShadow = true;
  dpad.add(b1, b2);
  btn.add(dpad);
  const dpadHome = dpad.position.clone();
  registerButton('dpad', -1, dpad, [b1, b2],
    () => sink(dpad, 0.008), () => unsink(dpad, dpadHome));

  /* A / B */
  function roundBtn(y, z, letter, name, index) {
    const grp = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(0.047, 0.004, 6, 28);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, MAT.buttonLight);
    m.castShadow = true;
    m.position.set(F - 0.030, 0, 0);
    grp.add(m);
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.024, 24),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: canvasTexture(128, 128, (g, w, h) => {
          g.clearRect(0, 0, w, h);
          g.fillStyle = '#4a4658';
          g.font = '700 70px Georgia, serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(letter, w / 2, h / 2 + 4);
        })
      })
    );
    decal.rotation.y = Math.PI / 2;
    decal.position.x = F + 0.0168;
    grp.add(decal);
    grp.position.set(0, y, z);
    btn.add(grp);
    const home = grp.position.clone();
    registerButton(name, index, grp, [m, decal],
      () => sink(grp, 0.009), () => unsink(grp, home));
  }
  roundBtn(0.130, -0.552, 'A', 'a', 8);
  roundBtn(0.111, -0.410, 'B', 'b', 0);

  /* Start / Select */
  function pill(z, y, name, index) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.013, 0.020, 0.062, 2, 0.008), MAT.pill);
    m.castShadow = true;
    m.position.set(F + 0.001, y, z);
    m.rotation.x = -0.40;
    btn.add(m);
    const home = m.position.clone();
    registerButton(name, index, m, [m],
      () => sink(m, 0.006), () => unsink(m, home));
  }
  pill(0.403, -0.038, 'select', 2);
  pill(0.399, -0.121, 'start', 3);

  /* L / R shoulders */
  function shoulder(z, name, index) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(0.05, 0.030, 0.115, 3, 0.013),
      new THREE.MeshPhysicalMaterial({ color: INDIGO, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.32 })
    );
    m.castShadow = true;
    m.position.set(0.135, 0.205, z);
    m.rotation.z = 0.35;
    btn.add(m);
    const home = m.position.clone();
    const from = home.clone();
    const to = home.clone(); to.y -= 0.008;
    registerButton(name, index, m, [m],
      () => tween(90, (e) => m.position.lerpVectors(from, to, e), null, easeOut),
      () => tween(140, (e) => m.position.lerpVectors(to, from, e), null, easeOut));
  }
  shoulder(-0.52, 'l', 10);
  shoulder(0.52, 'r', 11);
}

/* ---- screen glass ---- */
function buildScreen(rt) {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.585, 0.30), MAT.glass);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(F + 0.004, 0.105, 0);
  rt.add(glass);

  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.271),
    new THREE.MeshBasicMaterial({ map: screenTex })
  );
  scr.rotation.y = Math.PI / 2;
  scr.position.set(F + 0.0055, 0.105, 0);
  rt.add(scr);
}

/* ---- power LED ---- */
let ledMesh = null;
function buildPowerLed(rt) {
  ledMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#5a6a60' })
  );
  ledMesh.position.set(F + 0.008, 0.298, -0.30);
  rt.add(ledMesh);
}
export function setLed(on) {
  if (ledMesh) ledMesh.material.color.set(on ? '#8cffab' : '#5a6a60');
}

/* ---- stand ---- */
function buildStand() {
  const grp = new THREE.Group();
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.30, 1.0, 3, 0.015), MAT.walnut);
  back.position.set(-0.150, 0.14, 0);
  back.rotation.z = 0.20;
  back.castShadow = true;
  grp.add(back);
  gba.add(grp);
}

/* ---- bag + carts ---- */
export const bag = new THREE.Group();
const BAG = { W: 0.78, D: 0.40, H: 0.24 };

function buildBag() {
  const shell = new THREE.Mesh(new RoundedBoxGeometry(BAG.W, BAG.H, BAG.D, 4, 0.045), MAT.felt);
  shell.position.y = BAG.H / 2 + 0.035;
  shell.castShadow = shell.receiveShadow = true;
  bag.add(shell);

  const cavity = new THREE.Mesh(new RoundedBoxGeometry(BAG.W - 0.10, 0.14, BAG.D - 0.075, 3, 0.035), MAT.feltInner);
  cavity.position.y = BAG.H + 0.035 - 0.048;
  bag.add(cavity);

  const flap = new THREE.Mesh(new RoundedBoxGeometry(BAG.W - 0.02, 0.13, 0.025, 3, 0.012), MAT.felt);
  flap.position.set(0, 0.085, BAG.D / 2 + 0.014);
  flap.rotation.x = -0.18;
  flap.castShadow = true;
  bag.add(flap);

  const slots = [-0.24, -0.08, 0.08, 0.24];
  const defs = [
    { id: 'cascade7', title: 'CASCADE7', sub: 'PUZZLE \u00B7 \u2190 \u2192 A', bg: '#aecfa4', fg: '#33502d', blocks: 'abcacbc' },
    { id: 'gbarca',   title: 'GBARCA',   sub: 'RACING \u00B7 60 FPS',      bg: '#b3a5d6', fg: '#3a2f55', blocks: 'cbabcbc' },
    { id: 'tetrahex', title: 'TETRAHEX', sub: 'BLOCKS \u00B7 MARATHON',    bg: '#d6c8a0', fg: '#4f4128', blocks: 'bacabab' },
    { id: 'minigba',  title: 'MINIGBA',  sub: 'BUILT-IN DEMO \u00B7 3:2',  bg: '#9fd0c5', fg: '#2e4a44', blocks: 'abcdcba' }
  ];
  defs.forEach((d, i) => {
    const mesh = makeCartMesh(d.title, d.sub, d.bg, d.fg, d.blocks);
    const home = {
      pos: new THREE.Vector3(slots[i], BAG.H + 0.028, 0.0),
      rot: new THREE.Euler(-0.30, (slots[i] < 0 ? 1 : -1) * 0.05, 0)
    };
    const cart = {
      id: d.id, name: d.title, mesh, home, rom: null,
      state: 'bag', slotIndex: i
    };
    mesh.position.copy(home.pos);
    mesh.rotation.copy(home.rot);
    bag.add(mesh);
    carts.push(cart);
  });

  bag.position.set(0.64, 0, -0.02);
  bag.rotation.y = -0.35;
  scene.add(bag);

  /* MINIGBA starts inserted in the GBA */
  const mini = carts.find(c => c.id === 'minigba');
  insertIntoSlotInstant(mini);
}

export function insertIntoSlotInstant(cart) {
  cart.mesh.position.set(0.07, 0.472, 0);
  cart.mesh.rotation.set(0, 0, 0);
  if (cart.mesh.parent !== root) root.add(cart.mesh);
  cart.state = 'inserted';
  state.activeCart = cart;
}

/* world helpers for cart flights */
export function slotWorldPos(hover = false) {
  return root.localToWorld(new THREE.Vector3(0.07, hover ? 0.66 : 0.472, 0));
}
export function rootWorldQuat() {
  return root.getWorldQuaternion(new THREE.Quaternion());
}
export function bagHomeWorld(cart) {
  const p = cart.home.pos.clone();
  bag.updateMatrixWorld();
  return { pos: p.applyMatrix4(bag.matrixWorld), quat: new THREE.Quaternion().setFromEuler(cart.home.rot).premultiply(bag.getWorldQuaternion(new THREE.Quaternion())) };
}

/* ================= loop ================= */
const frameCbs = [];
export function onFrame(cb) { frameCbs.push(cb); }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  const now = performance.now();
  runTweens(now);
  controls.update();
  frameCbs.forEach(cb => cb(now));
  renderer.render(scene, camera);
});

import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from '../vendor/three/geometries/RoundedBoxGeometry.js';

export const params = new URLSearchParams(location.search);
export const DEBUG = params.get('debug') === '1';
// 自动巡览开关：?aa=0 强制默认关；否则读 localStorage 记忆，无记忆则默认开
const AA_FORCE_OFF = params.get('aa') === '0';
const STORED_ROT = (() => { try { return localStorage.getItem('gba3d-autorotate'); } catch (e) { return null; } })();
let autoRotateEnabled = AA_FORCE_OFF ? false : (STORED_ROT === null ? true : STORED_ROT === '1');
export const AUTOROT = autoRotateEnabled;
let isPlaying = false;
let dragging = false;
export function isAutoRotateEnabled() { return autoRotateEnabled; }
export function isPlayingGame() { return isPlaying; }
export function setPlaying(v) {
  isPlaying = !!v;
  applyAutoRotate();
}
export function setAutoRotateEnabled(v) {
  autoRotateEnabled = !!v;
  try { localStorage.setItem('gba3d-autorotate', autoRotateEnabled ? '1' : '0'); } catch (e) {}
  applyAutoRotate();
}
function applyAutoRotate() {
  controls.autoRotate = autoRotateEnabled && !isPlaying && !dragging;
}
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
controls.autoRotate = autoRotateEnabled;
controls.autoRotateSpeed = 0.45;
let idleTimer = null;
controls.addEventListener('start', () => {
  dragging = true;
  controls.autoRotate = false;
  clearTimeout(idleTimer);
});
controls.addEventListener('end', () => {
  dragging = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { applyAutoRotate(); }, 4000);
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
  shellDark:    new THREE.MeshPhysicalMaterial({ color: '#222226', roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
  buttonOrange: new THREE.MeshPhysicalMaterial({ color: '#af3822', roughness: 0.40, clearcoat: 0.35, clearcoatRoughness: 0.28 }),
  pillGreen:    new THREE.MeshPhysicalMaterial({ color: '#384534', roughness: 0.65, clearcoat: 0.15, clearcoatRoughness: 0.40 }),
  shoulderDark: new THREE.MeshPhysicalMaterial({ color: '#232227', roughness: 0.42, clearcoat: 0.28, clearcoatRoughness: 0.35 }),
  cartShell:    new THREE.MeshPhysicalMaterial({ color: '#d8d5da', roughness: 0.55 }),
  felt:         new THREE.MeshStandardMaterial({ color: '#2c2b31', roughness: 0.96 }),
  feltInner:    new THREE.MeshStandardMaterial({ color: '#1c1b20', roughness: 1.0 }),
  walnut:       new THREE.MeshPhysicalMaterial({ color: '#262126', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  glass:        new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.05, depthWrite: false })
};

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
  // 经典复古暗绿色微发光液晶屏背景
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#121815');
  bg.addColorStop(1, '#0c120e');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // 液晶微像素网格
  g.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 6) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  for (let y = 0; y < h; y += 6) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }

  // 内部金色圆角框
  const aw = 380, ah = 230;
  const ax = (w - aw) / 2, ay = (h - ah) / 2;
  const grd = g.createLinearGradient(ax, ay, ax + aw, ay + ah);
  grd.addColorStop(0, '#1c2620');
  grd.addColorStop(0.5, '#25332b');
  grd.addColorStop(1, '#1a241e');
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(ax, ay, aw, ah, 10);
  g.fill();
  g.strokeStyle = 'rgba(218, 178, 90, 0.35)';
  g.lineWidth = 1.5;
  g.stroke();

  // 标题与提示
  g.fillStyle = '#d4af37';
  g.font = '700 36px system-ui, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('3D \u00B7 GBA', w / 2, h / 2 - 20);

  g.fillStyle = '#e8d89a';
  g.font = '700 13px system-ui, sans-serif';
  g.fillText('ZELDA CONCEPT \u00B7 LIMITED EDITION', w / 2, h / 2 + 18);

  g.fillStyle = 'rgba(230, 220, 190, 0.65)';
  g.font = '500 12px system-ui, sans-serif';
  g.fillText('CLICK CARTRIDGE TO INSERT & PLAY', w / 2, h / 2 + 44);

  screenTex.needsUpdate = true;
}

export function drawScreenMessage(title, sub, err = false) {
  const g = screenCtx, w = 480, h = 320;
  g.fillStyle = err ? '#1a0d10' : '#0e1411';
  g.fillRect(0, 0, w, h);
  g.fillStyle = err ? '#e0524d' : '#d4af37';
  g.beginPath(); g.roundRect(40, 60, w - 80, 6, 3); g.fill();
  g.fillStyle = err ? '#ffb3b0' : '#f4ebd0';
  g.font = '700 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(title, w / 2, h / 2 - 8);
  g.fillStyle = 'rgba(255,255,255,0.65)';
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

// 真孔标定（root 局部系，与拾取同系，由 baseColor 纹理+几何反推，精度 0.001；键帽浮雕字母已按官方标准重绘：右上 A / 左下 B）
// A/B 红键顶面圆心（直径 0.082），D-pad 十字中心（总长 0.166/臂半宽 0.025，硬切缝），
// Select/Start 绿键（直径 0.036，垂直同列 Z=0.3927），L/R 肩键（顶边大曲板中心）。
const TRUE_POS = {
  a: [0.183834, 0.142394, -0.543761],
  b: [0.183419, 0.100668, -0.425457],
  dpad: [0.176, 0.114083, 0.483594],
  select: [0.183328, -0.068942, 0.392699],
  start: [0.183328, -0.142511, 0.392699],
  l: [0.0776, 0.360519, 0.469188],
  r: [0.0797, 0.359695, -0.467844]
};
// 原模型顶点按压（忠实形状：不加任何可见块，不永久改机壳；静息零变形）
// root 局部系：rx=S*px, ry=S*pz, rz=-S*py；前键压 -X，肩键压 -Y，D-pad 另加小倾角。
const CHAIN_S = 1.046477198600769;
const PRESS_DEPTH = { a: 0.0075, b: 0.0075, select: 0.006, start: 0.006, l: 0.008, r: 0.008 };
const FRONT_PX = 0.173;    // 仅凸起键顶/上侧壁，机壳平面与凹槽刻字不动
const SHOULDER_RY = 0.295;
let pressAttr = null, pressBase = null;
const pressSets = {};
function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
// 肩键颜色锁定：只让黑色肩键板动，白色外壳权重归零（采样 baseColor，2048 一次性读入）
let shoulderSampler = null;
function getShoulderSampler(mesh) {
  if (shoulderSampler) return shoulderSampler;
  try {
    const img = mesh.material?.map?.image;
    const uv = mesh.geometry?.attributes?.uv;
    if (!img || !uv || !img.width) return null;
    const S = Math.min(2048, img.naturalWidth || img.width);
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    shoulderSampler = { data: d, S };
    return shoulderSampler;
  } catch (e) { return null; }
}
function shoulderDark(i, uvAttr, samp) {
  const u = uvAttr.getX(i), v = uvAttr.getY(i);
  const x = Math.min(samp.S - 1, Math.max(0, (u * samp.S) | 0));
  const y = Math.min(samp.S - 1, Math.max(0, (v * samp.S) | 0));
  const o = (y * samp.S + x) * 4;
  const bright = (samp.data[o] + samp.data[o + 1] + samp.data[o + 2]) / 3;
  return 1 - smooth01((bright - 110) / 40);
}
function classifyPressVerts(mesh) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return;
  pressAttr = pos;
  pressBase = new Float32Array(pos.array);
  const uvAttr = mesh.geometry?.attributes?.uv;
  const samp = (uvAttr && mesh.material?.map?.image) ? getShoulderSampler(mesh) : null;
  const buckets = { a: [], b: [], select: [], start: [], l: [], r: [], dpad: [] };
  const bws = { a: [], b: [], select: [], start: [], l: [], r: [], dpad: [] };
  const A = TRUE_POS.a, B = TRUE_POS.b, DP = TRUE_POS.dpad;
  const SE = TRUE_POS.select, ST = TRUE_POS.start, L = TRUE_POS.l, R = TRUE_POS.r;
  const arr = pos.array;
  for (let i = 0; i < pos.count; i++) {
    const px = arr[i * 3], py = arr[i * 3 + 1], pz = arr[i * 3 + 2];
    const rx = CHAIN_S * px, ry = CHAIN_S * pz, rz = -CHAIN_S * py;
    if (rx > FRONT_PX) {
      const dA = Math.hypot(ry - A[1], rz - A[2]);
      const dB = Math.hypot(ry - B[1], rz - B[2]);
      const dSe = Math.hypot(ry - SE[1], rz - SE[2]);
      const dSt = Math.hypot(ry - ST[1], rz - ST[2]);
      const dyD = Math.abs(ry - DP[1]), dzD = Math.abs(rz - DP[2]);
      // D-pad 硬切分离：全臂宽 0.025（含侧壁），0.0006 窄 feather 藏缝底，黑框权重归零静止
      const wV = (1 - smooth01((dzD - 0.025) / 0.0006)) * (1 - smooth01((dyD - 0.083) / 0.001));
      const wH = (1 - smooth01((dyD - 0.025) / 0.0006)) * (1 - smooth01((dzD - 0.083) / 0.001));
      const cands = [
        ['dpad', Math.max(wV, wH)],
        ['a', 1 - smooth01((dA - 0.0415) / 0.002)],
        ['b', 1 - smooth01((dB - 0.0415) / 0.002)],
        ['select', 1 - smooth01((dSe - 0.0185) / 0.002)],
        ['start', 1 - smooth01((dSt - 0.0185) / 0.002)]
      ];
      let best = null, bestW = 0.001;
      for (const [id, w] of cands) if (w > bestW) { best = id; bestW = w; }
      if (best) { buckets[best].push(i); bws[best].push(bestW); }
    } else if (ry > SHOULDER_RY) {
      let wL = (1 - smooth01((Math.abs(rx - L[0]) - 0.065) / 0.010)) * (1 - smooth01((Math.abs(rz - L[2]) - 0.125) / 0.012));
      let wR = (1 - smooth01((Math.abs(rx - R[0]) - 0.065) / 0.010)) * (1 - smooth01((Math.abs(rz - R[2]) - 0.125) / 0.012));
      if (samp && (wL > 0.001 || wR > 0.001)) {
        const dk = shoulderDark(i, uvAttr, samp);
        wL *= dk; wR *= dk;
      }
      if (wL > 0.001 && wL >= wR) { buckets.l.push(i); bws.l.push(wL); }
      else if (wR > 0.001) { buckets.r.push(i); bws.r.push(wR); }
    }
  }
  for (const id of Object.keys(buckets)) {
    pressSets[id] = { idx: new Uint32Array(buckets[id]), w: new Float32Array(bws[id]) };
  }
}
function applySinglePress(id, amt) {
  if (!pressAttr || !pressSets[id]) return;
  const set = pressSets[id];
  const depth = PRESS_DEPTH[id] || 0.006;
  const arr = pressAttr.array;
  if (id === 'l' || id === 'r') {
    for (let j = 0; j < set.idx.length; j++) {
      const i = set.idx[j];
      arr[i * 3 + 2] = pressBase[i * 3 + 2] - (depth * amt * set.w[j]) / CHAIN_S;
    }
  } else {
    for (let j = 0; j < set.idx.length; j++) {
      const i = set.idx[j];
      arr[i * 3] = pressBase[i * 3] - (depth * amt * set.w[j]) / CHAIN_S;
    }
  }
  pressAttr.needsUpdate = true;
}
const dpadCur = { ry: 0, rz: 0 };
function applyDpadPress() {
  // 刚体跷跷板：整个十字架绕中心做纯旋转，无整体下沉，内部权重为1处完全刚体
  if (!pressAttr || !pressSets.dpad) return;
  const DP = TRUE_POS.dpad;
  const cx = DP[0], cy = DP[1], cz = DP[2];
  const cRy = Math.cos(dpadCur.ry), sRy = Math.sin(dpadCur.ry);
  const cRz = Math.cos(dpadCur.rz), sRz = Math.sin(dpadCur.rz);
  const set = pressSets.dpad;
  const arr = pressAttr.array;
  for (let j = 0; j < set.idx.length; j++) {
    const i = set.idx[j], w = set.w[j];
    const bx = pressBase[i * 3], by = pressBase[i * 3 + 1], bz = pressBase[i * 3 + 2];
    const rx = CHAIN_S * bx, ry = CHAIN_S * bz, rz = -CHAIN_S * by;
    const dx = rx - cx, dy = ry - cy, dz = rz - cz;
    const x1 = dx * cRz - dy * sRz, y1 = dx * sRz + dy * cRz;
    const x2 = x1 * cRy + dz * sRy, y2 = y1, z2 = -x1 * sRy + dz * cRy;
    const ox = (x2 - dx) * w, oy = (y2 - dy) * w, oz = (z2 - dz) * w;
    arr[i * 3] = bx + ox / CHAIN_S;
    arr[i * 3 + 1] = by + (-oz) / CHAIN_S;
    arr[i * 3 + 2] = bz + oy / CHAIN_S;
  }
  pressAttr.needsUpdate = true;
}
function updateDpadPress() {
  const tRz = (buttons['up']?.pressed ? 0.15 : 0) + (buttons['down']?.pressed ? -0.15 : 0);
  const tRy = (buttons['left']?.pressed ? -0.15 : 0) + (buttons['right']?.pressed ? 0.15 : 0);
  const to = { ry: tRy, rz: tRz };
  const from = { ry: dpadCur.ry, rz: dpadCur.rz };
  tween(70, (k) => {
    dpadCur.ry = from.ry + (to.ry - from.ry) * k;
    dpadCur.rz = from.rz + (to.rz - from.rz) * k;
    applyDpadPress();
  }, null, easeOut);
}
function vertexPress(id, dur) {
  const b = buttons[id];
  const from = (b && b.amt) || 0;
  tween(dur, (k) => {
    const a = from + (1 - from) * k;
    if (b) b.amt = a;
    applySinglePress(id, a);
  }, null, easeOut);
}
function vertexRelease(id, dur) {
  const b = buttons[id];
  const from = (b && b.amt) || 0;
  tween(dur, (k) => {
    const a = from * (1 - k);
    if (b) b.amt = a;
    applySinglePress(id, a);
  }, null, easeOut);
}
// 已废弃的静态索引集（左偏且 Select 错位，已不再使用，仅保留避免误删）：
const BUTTON_VERTICES_DEPRECATED = new Uint16Array([
  8241, 8242, 8497, 8498, 8499, 8506, 8507, 8508, 8509, 8513, 8514, 8515, 8518, 8519, 8520, 8521, 8522, 8523, 8535, 8536,
  8538, 8539, 8540, 8541, 8542, 8543, 8544, 8546, 8548, 8549, 8550, 8558, 8559, 8560, 8564, 8565, 8566, 13391, 13394, 13395,
  13396, 13442, 13443, 13444, 13445, 13446, 13448, 13449, 13450, 13467, 13468, 19023, 19038, 19046, 19050, 19053, 19069, 19113, 19114, 19116,
  19117, 19118, 19122, 19123, 19124, 19125, 19126, 19127, 19128, 19129, 19130, 19131, 19132, 19133, 19134, 19135, 19136, 19137, 19138, 19139,
  19140, 19141, 19142, 19143, 19144, 19145, 19148, 19149, 19153, 19173, 19174, 19175, 19176, 19177, 19178, 19179, 19180, 19181, 19182, 19183,
  19184, 19185, 19186, 19187, 19189, 19190, 19191, 19192, 19193, 19194, 19195, 19196, 19197, 19198, 19199, 19201, 19202, 19203, 19204, 19205,
  19206, 19207, 19212, 19213, 19215, 19217, 19230, 19233, 19234, 19235, 19236, 19238, 19240, 19241, 19242, 19244, 19245, 19246, 19247, 19248,
  19249, 19250, 19251, 19252, 19275, 19276, 19277, 19278, 19279, 19280, 19284, 19285, 19287, 19288, 19290, 19291, 19306, 19308, 19309, 19310,
  19311, 19312, 19313, 19314, 19343, 19344, 19345, 19432, 19433, 19435, 19436, 19437, 19438, 19439, 19440, 19441, 19442, 19443, 19444, 19445,
  19446, 19447, 19448, 19449, 19450, 19451, 19452, 19453, 19455, 19456, 19465, 19485, 19489, 19491, 19495, 19496, 19497, 19499, 19500, 19501,
  19502, 19503, 19504, 19505, 19506, 19507, 19508, 19509, 19510, 19511, 19512, 19513, 19514, 19515, 19516, 19517, 19518, 19519, 19520, 19521,
  19522, 19526, 19535, 19536, 19537, 19538, 19539, 19540, 19541, 19542, 19543, 19544, 19545, 19546, 19547, 19548, 19549, 19550, 19551, 19552,
  19553, 19554, 19555, 19556, 19557, 19558, 19559, 19560, 19561, 19562, 19563, 19564, 19565, 19566, 19567, 19568, 19569, 19570, 19571, 19573,
  19574, 19575, 19576, 19577, 19578, 19579, 19580, 19581, 19582, 19583, 19584, 19585, 19586, 19587, 19588, 19589, 19590, 19591, 19592, 19593,
  19594, 19595, 19598, 19599, 19600, 19601, 19604, 19605, 19606, 19607, 19608, 19609, 19610, 19611, 19612, 19613, 19614, 19615, 19616, 19617,
  19622, 19626, 19627, 19629, 19663, 19664, 19665, 19666, 19667, 19668, 19669, 19670, 19671, 19672, 19673, 19674, 19675, 19676, 19677, 19678,
  19679, 19683, 19688, 19689, 19690, 19691, 19692, 19693, 19694, 19695, 19696, 19697, 19698, 19699, 19700, 19701, 19702, 19703, 19704, 19705,
  19706, 19707, 19708, 19709, 19710, 19711, 19712, 19713, 19714, 19715, 19716, 19717, 19718, 19719, 19720, 19721, 19722, 19723, 19724, 19725,
  19726, 19727, 19728, 19729, 19730, 19731, 19732, 19733, 19734, 19735, 19736, 19737, 19738, 19739, 19740, 19741, 19742, 19743, 19744, 19745,
  19746, 19747, 19748, 19749, 19750, 19751, 19752, 19753, 19754, 19755, 19756, 19757, 19758, 19759, 19760, 19761, 19762, 19763, 19764, 19765,
  19767, 19768, 19769, 19771, 19772, 19773, 19774, 19775, 19776, 19777, 19778, 19779, 19780, 19781, 19782, 19783, 19784, 19785, 19786, 19787,
  19788, 19789, 19790, 19791, 19792, 19793, 19794, 19795, 19796, 19797, 19798, 19799, 19800, 19801, 19802, 19803, 19804, 19805, 19806, 19807,
  19808, 19809, 19810, 19811, 19812, 19813, 19814, 19815, 19816, 19817, 19818, 19819, 19820, 19821, 19822, 19824, 19825, 19826, 19827, 19828,
  19829, 19830, 19831, 19832, 19833, 19834, 19835, 19836, 19837, 19838, 19839, 19840, 19841, 19842, 19843, 19844, 19845, 19846, 19847, 19848,
  19849, 19850, 19851, 19852, 19853, 19854, 19855, 19856, 19857, 19858, 19859, 19860, 19861, 19862, 19863, 19864, 19865, 19866, 19867, 19868,
  19869, 19870, 19871, 19872, 19873, 19874, 19875, 19876, 19877, 19878, 19879, 19880, 19881, 19882, 19883, 19884, 19885, 19886, 19887, 19888,
  19889, 19890, 19891, 19892, 19893, 19894, 19895, 19896, 19897, 19899, 19900, 19901, 19902, 19903, 19904, 19905, 19908, 19910, 19911, 19912,
  19913, 19914, 19915, 19916, 19917, 19919, 19920, 19921, 19922, 19923, 19924, 19925, 19926, 19927, 19928, 19929, 19930, 19931, 19932, 19933,
  19936, 19937, 19939, 19940, 19941, 19942, 19943, 19944, 19946, 19947, 19948, 19949, 19950, 19951, 19952, 19953, 19954, 19955, 19956, 19957,
  19958, 19963, 19970, 19971, 19972, 19973, 19974, 19975, 19976, 19977, 19978, 19979, 19980, 19981, 19982, 19983, 19984, 19985, 19986, 19987,
  19988, 19989, 19990, 19992, 19993, 19994, 19995, 19996, 19997, 19998, 19999, 20001, 20002, 20003, 20004, 20005, 20006, 20007, 20008, 20015,
  20016, 20017, 20018, 20019, 20020, 20021, 20022, 20023, 20024, 20025, 20026, 20027, 20028, 20029, 20030, 20031, 20032, 20033, 20034, 20035,
  20036, 20037, 20038, 20039, 20040, 20041, 20042, 20043, 20044, 20045, 20046, 20047, 20048, 20049, 20050, 20051, 20053, 20054, 20055, 20056,
  20057, 20058, 20059, 20060, 20061, 20062, 20063, 20064, 20065, 20066, 20067, 20068, 20069, 20070, 20071, 20072, 20073, 20074, 20075, 20076,
  20077, 20078, 20079, 20081, 20083, 20084, 20085, 20088, 20091, 20092, 20093, 20094, 20095, 20096, 20097, 20098, 20099, 20101, 20102, 20103,
  20104, 20105, 20106, 20107, 20108, 20109, 20110, 20111, 20112, 20113, 20114, 20115, 20116, 20117, 20118, 20119, 20120, 20121, 20122, 20123,
  20124, 20125, 20126, 20127, 20128, 20129, 20130, 20131, 20132, 20133, 20134, 20135, 20136, 20143, 20157, 20216, 20217, 20218, 20219, 20220,
  20221, 20222, 20223, 20224, 20225, 20226, 20239, 20240, 20242, 20251, 20252, 20253, 20254, 20255, 20256, 20260, 20263, 20264, 20266, 20278,
  20281, 20282, 20283, 20284, 20285, 20302, 20304, 20305, 20306, 20313, 20314, 20319, 20320, 20321, 20322, 20323, 20324, 20325, 20326, 20327,
  20328, 20329, 20330, 20331, 20332, 20333, 20334, 20335, 20336, 20337, 20338, 20339, 20340, 20341, 20342, 20345, 20346, 20347, 20348, 20349,
  20350, 20351, 20352, 20353, 20354, 20355, 20356, 20357, 20358, 20359, 20360, 20361, 20362, 20363, 20364, 20365, 20366, 20367, 20368, 20369,
  20370, 20371, 20372, 20373, 20374, 20375, 20376, 20377, 20378, 20379, 20380, 20381, 20382, 20383, 20384, 20385, 20386, 20391, 20392, 20393,
  20398, 20401, 20406, 20407, 20410, 20413, 20416, 20419, 20422, 20425, 20428, 20431, 20434, 20439, 20440, 20441, 20446, 20449, 20454, 20455,
  20458, 20461, 20464, 20469, 20470, 20473, 20476, 20479, 20482,
]);

new GLTFLoader().load('./assets/models/gba.glb?v=20260905', (g) => {
  root = g.scene;
  root.updateMatrixWorld(true);

  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const old = o.material;
      o.material = new THREE.MeshPhysicalMaterial({
        map: old.map,
        normalMap: old.normalMap || null,
        roughnessMap: old.roughnessMap || null,
        metalnessMap: old.metalnessMap || null,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.46,
        metalness: 0.05,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32
      });

      // 分类原模型按键顶点（只记录权重，不永久改机壳；静息零变形）
      classifyPressVerts(o);
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

  /* D-pad：用原模型黑十字（箭头/中心凹点都在原几何纹理上），不重建条块；四向独立不可见拾取 */
  const dpadPick = new THREE.Group();
  dpadPick.position.set(TRUE_POS.dpad[0], TRUE_POS.dpad[1], TRUE_POS.dpad[2]);
  btn.add(dpadPick);

  // 四向独立不可见拾取盒（视觉隐藏但可射线命中，保持 up(4)/down(5)/left(6)/right(7) 解耦）
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  function dpadHit(sx, sy, sz, px, py, pz) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), hitMat);
    h.position.set(px, py, pz);
    dpadPick.add(h);
    return h;
  }
  const mUp = dpadHit(0.04, 0.062, 0.032, 0, 0.052, 0);
  const mDown = dpadHit(0.04, 0.062, 0.032, 0, -0.052, 0);
  const mLeft = dpadHit(0.04, 0.032, 0.062, 0, 0, 0.052);
  const mRight = dpadHit(0.04, 0.032, 0.062, 0, 0, -0.052);

  registerButton('up', 4, dpadPick, [mUp], updateDpadPress, updateDpadPress);
  registerButton('down', 5, dpadPick, [mDown], updateDpadPress, updateDpadPress);
  registerButton('left', 6, dpadPick, [mLeft], updateDpadPress, updateDpadPress);
  registerButton('right', 7, dpadPick, [mRight], updateDpadPress, updateDpadPress);

  /* A / B（Nintendo 左 B 右 A；用原模型红键，不加圆柱/贴字；不可见拾取+原顶点下沉） */
  // 不可见拾取体（opacity 0）+ 原顶点按压，下同 Select/Start/肩键共用
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  function pressPick(id, index, cx, cy, cz, sx, sy, sz, downDur, upDur) {
    const pick = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), pickMat);
    pick.position.set(cx, cy, cz);
    btn.add(pick);
    registerButton(id, index, pick, [pick],
      () => vertexPress(id, downDur),
      () => vertexRelease(id, upDur));
  }
  // 右 A：高位靠右；左 B：低位靠左（红键直径 0.082，拾取盒稍放大到 0.095）
  pressPick('a', 8, TRUE_POS.a[0], TRUE_POS.a[1], TRUE_POS.a[2], 0.03, 0.095, 0.095, 75, 110);
  pressPick('b', 0, TRUE_POS.b[0], TRUE_POS.b[1], TRUE_POS.b[2], 0.03, 0.095, 0.095, 75, 110);

  /* Select / Start：用原模型绿键（垂直同列 Z=0.3927，Select 上 Start 下），不加绿圆柱；不可见拾取+原顶点下沉 */
  pressPick('select', 2, TRUE_POS.select[0], TRUE_POS.select[1], TRUE_POS.select[2], 0.03, 0.05, 0.05, 70, 100);
  pressPick('start', 3, TRUE_POS.start[0], TRUE_POS.start[1], TRUE_POS.start[2], 0.03, 0.05, 0.05, 70, 100);

  /* L / R 肩键：用原模型顶边大曲板（带 L/R 浮雕），不加小方块；不可见拾取+原顶点下沉 */
  pressPick('l', 10, TRUE_POS.l[0], TRUE_POS.l[1], TRUE_POS.l[2], 0.16, 0.10, 0.28, 90, 140);
  pressPick('r', 11, TRUE_POS.r[0], TRUE_POS.r[1], TRUE_POS.r[2], 0.16, 0.10, 0.28, 90, 140);
}

/* ---- screen glass ---- */
function buildScreen(rt) {
  // GBA 屏幕：精确覆盖原模内部自带的静态 Zelda 截图（宽 0.52，高 0.271），100% 杜绝四周漏底，同时完美避让底部 GBA 标与左下林克插画
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.271),
    new THREE.MeshBasicMaterial({ map: screenTex })
  );
  scr.rotation.y = Math.PI / 2;
  scr.position.set(F + 0.0055, 0.105, 0);
  rt.add(scr);

  // 高透物理保护镜片，带真实镜面反光与清漆高光，不遮挡原模自带图文
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.525, 0.276), MAT.glass);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(F + 0.007, 0.105, 0);
  rt.add(glass);
}

/* ---- power LED ---- */
let ledMesh = null;
function buildPowerLed(rt) {
  ledMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#5a4e28' })
  );
  // 灯座真孔：由 baseColor 灯罩 UV 反推几何中心 (root 局部系)，与 POWER 刻字对齐
  ledMesh.position.set(F, 0.2993, -0.4206);
  rt.add(ledMesh);
}
export function setLed(on) {
  if (ledMesh) ledMesh.material.color.set(on ? '#ffd043' : '#5a4e28');
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
    {
      id: 'apotris',
      title: 'APOTRIS',
      sub: 'PUZZLE \u00B7 14 MODES',
      desc: '俄罗斯方块 \u00B7 14种模式',
      bg: '#1d3557',
      fg: '#a8dadc',
      blocks: 'abcdcba',
      romPath: './assets/roms/apotris.gba'
    },
    {
      id: 'auntflora',
      title: 'AUNTFLORA',
      sub: 'MANSION \u00B7 PUZZLE',
      desc: '弗洛拉庄园 \u00B7 推理解谜',
      bg: '#4a3b5c',
      fg: '#f4e4c1',
      blocks: 'cbabcbc',
      romPath: './assets/roms/auntflora.gba'
    },
    {
      id: 'powder',
      title: 'POWDER',
      sub: 'ROGUELIKE \u00B7 DUNGEON',
      desc: '粉末地牢 \u00B7 Roguelike',
      bg: '#2b2d42',
      fg: '#e9c46a',
      blocks: 'bacabab',
      romPath: './assets/roms/powder.gba'
    },
    {
      id: 'voltorb',
      title: 'VOLTORB',
      sub: 'ESCAPE \u00B7 72 LEVELS',
      desc: '雷电球大逃亡 \u00B7 72关',
      bg: '#e09f3e',
      fg: '#3a0ca3',
      blocks: 'abcadcb',
      romPath: './assets/roms/voltorb.gba'
    }
  ];
  defs.forEach((d, i) => {
    const mesh = makeCartMesh(d.title, d.sub, d.bg, d.fg, d.blocks);
    const home = {
      pos: new THREE.Vector3(slots[i], BAG.H + 0.028, 0.0),
      rot: new THREE.Euler(-0.30, (slots[i] < 0 ? 1 : -1) * 0.05, 0)
    };
    const cart = {
      id: d.id, name: d.title, sub: d.sub, desc: d.desc, mesh, home, rom: null,
      romPath: d.romPath,
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
}

export function insertIntoSlotInstant(cart) {
  cart.mesh.position.set(0.07, 0.472, 0);
  cart.mesh.rotation.set(0, 0, 0);
  if (cart.mesh.parent !== root) root.add(cart.mesh);
  cart.state = 'inserted';
  state.activeCart = cart;
  setPlaying(true);
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

import * as THREE from 'three';

// 受转轴约束的刚体：只有支点旋转，网格的顶点、法线和 UV 始终不改写。
// 临界阻尼弹簧的解析解保留速度；反向输入不会叠加尚未结束的 tween。
export function advanceSpring(spring, target, frequency, dt) {
  const offset = spring.value - target;
  const momentum = spring.velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  spring.value = target + (offset + momentum * dt) * decay;
  spring.velocity = (spring.velocity - frequency * momentum * dt) * decay;
  if (Math.abs(spring.value - target) < 1e-6 && Math.abs(spring.velocity) < 1e-5) {
    spring.value = target;
    spring.velocity = 0;
  }
}

const spring = () => ({ value: 0, velocity: 0 });
const DPAD_MAX_ANGLE = 0.085;
const SHOULDER_TRAVEL = 0.008;

export function createButtonRig(rt, positions) {
  const parts = {};
  rt.updateMatrixWorld(true);
  const toRoot = rt.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  for (const [id, name] of Object.entries({ dpad: 'Button_DPad', l: 'Button_L', r: 'Button_R' })) {
    const model = rt.getObjectByName(name);
    if (!model) throw new Error(`GBA 模型缺少独立按键 ${name}，请更新 gba.glb`);
    const vertices = [];
    const bounds = new THREE.Box3();
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      const matrix = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
      const attr = mesh.geometry.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        point.fromBufferAttribute(attr, i).applyMatrix4(matrix);
        bounds.expandByPoint(point);
        vertices.push(point.clone());
      }
    });
    const pivot = new THREE.Group();
    pivot.name = `ButtonPivot_${id}`;
    pivot.position.fromArray(positions[id]);
    let angle = 0;
    if (id === 'dpad') {
      // 支点在键帽中心下方，侧壁深入固定框内，允许受压臂下倾、对侧抬起。
      pivot.position.x -= 0.010;
    } else {
      const side = id === 'l' ? 1 : -1;
      const innerZ = side > 0 ? bounds.min.z : bounds.max.z;
      const width = bounds.max.z - bounds.min.z;
      const end = vertices.filter(v => Math.abs(v.z - innerZ) < width * 0.025);
      // 内侧端的几何中心确定铰链高度；转轴沿前后方向 X 穿过内侧端。
      pivot.position.y = (Math.min(...end.map(v => v.y)) + Math.max(...end.map(v => v.y))) / 2;
      pivot.position.z = innerZ;
      angle = side * Math.asin(SHOULDER_TRAVEL / width);
    }
    rt.add(pivot);
    pivot.attach(model);
    parts[id] = { pivot, model, angle, motion: spring() };
  }
  const tiltY = spring(), tiltZ = spring();
  const axis = new THREE.Vector3();

  return {
    parts,
    attachPick(id, pick) { parts[id].pivot.attach(pick); },
    update(dt, buttons) {
      const vertical = Number(!!buttons.up?.pressed) - Number(!!buttons.down?.pressed);
      const horizontal = Number(!!buttons.right?.pressed) - Number(!!buttons.left?.pressed);
      const length = Math.max(1, Math.hypot(vertical, horizontal));
      advanceSpring(tiltY, horizontal * DPAD_MAX_ANGLE / length, 85, dt);
      advanceSpring(tiltZ, vertical * DPAD_MAX_ANGLE / length, 85, dt);
      const tilt = Math.hypot(tiltY.value, tiltZ.value);
      if (tilt === 0) parts.dpad.pivot.quaternion.identity();
      else {
        axis.set(0, tiltY.value / tilt, tiltZ.value / tilt);
        parts.dpad.pivot.quaternion.setFromAxisAngle(axis, Math.min(tilt, DPAD_MAX_ANGLE));
      }
      for (const id of ['l', 'r']) {
        const part = parts[id];
        const pressed = !!buttons[id]?.pressed;
        advanceSpring(part.motion, pressed ? 1 : 0, pressed ? 95 : 65, dt);
        // 机械限位：只允许从静息位置向下转动，不越过机壳止挡。
        part.pivot.rotation.x = part.angle * THREE.MathUtils.clamp(part.motion.value, 0, 1);
      }
    }
  };
}

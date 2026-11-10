import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const V2 = THREE.Vector2;
const ROAD_W = 10.5;
const ROAD_L = 420;
const TILE = 12;
const LANE = 3.5;
const DAY = new THREE.Color("#e9e5dc"), NIGHT = new THREE.Color("#040b1c");
const G_DAY = new THREE.Color("#d9d4c8"), G_NIGHT = new THREE.Color("#060d1d");
const S_DAY = new THREE.Color("#c4bfb4"), S_NIGHT = new THREE.Color("#141b2b");

function materials() {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    white: phys({ color: 0xf1f1ee, metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    blue: phys({ color: 0x1b4596, metalness: 0.55, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: phys({ color: 0x06080c, metalness: 0.4, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }),
    screen: phys({ color: 0x8fb4e0, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.28 }),
    trim: std({ color: 0x0d0e11, roughness: 0.55, metalness: 0.2 }),
    tyre: std({ color: 0x121212, roughness: 0.9, side: THREE.DoubleSide }),
    rim: std({ color: 0x23262b, metalness: 0.85, roughness: 0.3 }),
    alloy: std({ color: 0xb8bec6, metalness: 1, roughness: 0.22 }),
    chrome: std({ color: 0xdfe3e8, metalness: 1, roughness: 0.1 }),
    canvas: std({ color: 0x17191d, roughness: 0.92 }),
    steel: std({ color: 0x4d5258, metalness: 0.55, roughness: 0.48 }),
    seat: std({ color: 0x1a1a1c, roughness: 0.7 }),
    head: std({ color: 0xffffff, emissive: 0xeaf3ff, emissiveIntensity: 2.6 }),
    tail: std({ color: 0x330000, emissive: 0xff1c1c, emissiveIntensity: 2.2 }),
    box: std({ color: 0xc69760, roughness: 0.85 }),
  };
}

function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}
function at(m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; }
function extrude(shape, depth, mat, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 28, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat);
}
function archLine(s, y, arches, xEnd) {
  for (const [cx, r] of arches) { s.lineTo(cx - r, y); s.absarc(cx, y, r, Math.PI, 0, true); }
  s.lineTo(xEnd, y);
}
const rbox = (w, h, d, r, mat) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
const cyl = (r1, r2, h, mat, seg = 24) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
function tube(points, r, mat, seg = 40) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(c, seg, r, 10), mat);
}

function wheel(M, r, w, { rim = M.rim, spokes = 5, thin = false } = {}) {
  const g = new THREE.Group(), spin = new THREE.Group();
  g.add(spin);
  const ri = thin ? r * 0.8 : r * 0.64, h = w / 2;
  const prof = [new V2(ri, -h * 0.85), new V2(r * 0.94, -h), new V2(r, -h * 0.55), new V2(r, h * 0.55), new V2(r * 0.94, h), new V2(ri, h * 0.85)];
  const tyre = mesh(new THREE.LatheGeometry(prof, 44), M.tyre);
  tyre.rotation.x = Math.PI / 2;
  spin.add(tyre);
  if (thin) {
    spin.add(at(cyl(r * 0.16, r * 0.16, w * 1.3, M.alloy), 0, 0, 0, Math.PI / 2));
    spin.add(at(mesh(new THREE.TorusGeometry(ri, 0.018, 8, 40), M.alloy), 0, 0, 0));
    for (let i = 0; i < spokes; i++) {
      const s = at(mesh(new THREE.BoxGeometry(ri * 2, 0.035, 0.03), M.rim), 0, 0, 0, 0, 0, (i / spokes) * Math.PI);
      spin.add(s);
    }
    return { g, spin, r };
  }
  spin.add(at(cyl(ri, ri, w * 0.62, M.trim, 32), 0, 0, 0, Math.PI / 2));
  for (const side of [-1, 1]) {
    const face = new THREE.Group();
    face.position.z = side * w * 0.33;
    face.add(at(cyl(ri * 0.28, ri * 0.28, 0.04, rim), 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const s = mesh(new THREE.BoxGeometry(ri * 0.9, ri * 0.2, 0.04), rim);
      s.position.set(Math.cos(a) * ri * 0.5, Math.sin(a) * ri * 0.5, 0);
      s.rotation.z = a + 0.18;
      face.add(s);
    }
    face.add(at(mesh(new THREE.TorusGeometry(ri * 0.97, 0.025, 8, 40), rim), 0, 0, 0));
    spin.add(face);
  }
  return { g, spin, r };
}

function headlightSpot(x, y) {
  const sp = new THREE.SpotLight(0xfff0d8, 0, 48, 0.42, 0.65, 1.4);
  sp.position.set(x, y, 0);
  sp.target.position.set(x + 14, 0, 0);
  return sp;
}

function buildSasa(M) {
  const g = new THREE.Group(), wheels = [];
  const s = new THREE.Shape();
  s.moveTo(-2.32, 0.46);
  s.quadraticCurveTo(-2.3, 0.3, -2.12, 0.3);
  archLine(s, 0.3, [[-1.45, 0.44], [1.45, 0.44]], 2.18);
  s.quadraticCurveTo(2.4, 0.3, 2.42, 0.5);
  s.quadraticCurveTo(2.46, 0.66, 2.18, 0.72);
  s.quadraticCurveTo(1.5, 0.84, 0.8, 0.98);
  s.lineTo(-1.6, 1.0);
  s.quadraticCurveTo(-2.15, 1.0, -2.33, 0.88);
  s.quadraticCurveTo(-2.42, 0.7, -2.32, 0.46);
  g.add(extrude(s, 1.78, M.white, 0.08));

  const c = new THREE.Shape();
  c.moveTo(0.95, 0.95);
  c.quadraticCurveTo(0.45, 1.24, 0.05, 1.41);
  c.quadraticCurveTo(-0.5, 1.5, -1.0, 1.4);
  c.quadraticCurveTo(-1.6, 1.2, -1.98, 0.97);
  c.lineTo(0.95, 0.95);
  g.add(extrude(c, 1.42, M.glass, 0.1));
  for (const z of [-0.79, 0.79]) {
    g.add(tube([[1.02, 0.98, z], [0.5, 1.27, z * 0.99], [0.05, 1.45, z * 0.97], [-0.5, 1.52, z * 0.96], [-1.05, 1.43, z * 0.97], [-1.65, 1.2, z * 0.99], [-2.02, 1.0, z]], 0.045, M.white));
    g.add(at(rbox(0.07, 0.42, 0.06, 0.02, M.white), -0.32, 1.2, z * 1.0, 0, 0, -0.12));
  }
  for (const z of [-0.62, 0.62]) g.add(at(rbox(0.1, 0.06, 0.48, 0.025, M.head), 2.33, 0.66, z, 0, z > 0 ? 0.38 : -0.38));
  g.add(at(rbox(0.06, 0.07, 1.56, 0.03, M.tail), -2.39, 0.86, 0));
  g.add(at(rbox(0.07, 0.12, 1.2, 0.04, M.trim), 2.47, 0.42, 0));
  for (const z of [-1, 1]) {
    g.add(at(rbox(0.22, 0.12, 0.17, 0.05, M.white), 0.72, 1.07, z * 0.98));
    g.add(at(rbox(0.2, 0.025, 0.02, 0.01, M.trim), 0.15, 0.9, z * 0.975));
    g.add(at(rbox(0.2, 0.025, 0.02, 0.01, M.trim), -0.85, 0.9, z * 0.975));
  }
  g.add(at(mesh(new THREE.BoxGeometry(4.3, 0.16, 1.6), M.trim), 0, 0.26, 0));
  for (const z of [-0.975, 0.975]) g.add(at(rbox(1.9, 0.09, 0.05, 0.02, M.trim), 0, 0.36, z));
  for (const x of [-1.45, 1.45]) {
    const liner = mesh(new THREE.CylinderGeometry(0.43, 0.43, 1.66, 28, 1, true), M.trim);
    liner.material = M.trim.clone(); liner.material.side = THREE.DoubleSide;
    g.add(at(liner, x, 0.3, 0, Math.PI / 2));
    for (const z of [-0.84, 0.84]) {
      const w = wheel(M, 0.345, 0.26, { spokes: 10 });
      w.g.position.set(x, 0.345, z); if (z < 0) w.g.rotation.y = Math.PI;
      g.add(w.g); wheels.push(w);
    }
  }
  return { g, wheels, spot: headlightSpot(2.45, 0.66), len: 4.9, wid: 2.0 };
}

function buildXL(M) {
  const g = new THREE.Group(), wheels = [];
  const s = new THREE.Shape();
  s.moveTo(-2.44, 0.42);
  s.quadraticCurveTo(-2.42, 0.3, -2.28, 0.3);
  archLine(s, 0.3, [[-1.6, 0.47], [1.6, 0.47]], 2.3);
  s.quadraticCurveTo(2.52, 0.3, 2.55, 0.55);
  s.lineTo(2.54, 0.95);
  s.quadraticCurveTo(2.52, 1.17, 2.2, 1.19);
  s.lineTo(-2.28, 1.19);
  s.quadraticCurveTo(-2.46, 1.18, -2.46, 1.0);
  s.lineTo(-2.44, 0.42);
  g.add(extrude(s, 1.84, M.blue, 0.09));
  const c = new THREE.Shape();
  c.moveTo(2.22, 1.13);
  c.quadraticCurveTo(1.96, 1.38, 1.74, 1.82);
  c.quadraticCurveTo(1.62, 1.96, 1.3, 1.97);
  c.lineTo(-2.18, 1.97);
  c.quadraticCurveTo(-2.4, 1.96, -2.42, 1.75);
  c.lineTo(-2.44, 1.13);
  c.lineTo(2.22, 1.13);
  g.add(extrude(c, 1.7, M.glass, 0.1));
  g.add(at(rbox(0.06, 0.05, 1.56, 0.02, M.head), 2.62, 1.0, 0));
  for (const z of [-0.66, 0.66]) g.add(at(rbox(0.06, 0.12, 0.34, 0.03, M.head), 2.6, 0.86, z));
  g.add(at(rbox(0.06, 0.06, 1.7, 0.02, M.tail), -2.54, 1.02, 0));
  g.add(at(rbox(0.07, 0.16, 1.3, 0.05, M.trim), 2.62, 0.45, 0));
  for (const z of [-1, 1]) g.add(at(rbox(0.22, 0.13, 0.17, 0.05, M.blue), 1.75, 1.3, z * 1.04));
  g.add(at(mesh(new THREE.BoxGeometry(4.6, 0.16, 1.66), M.trim), 0, 0.26, 0));
  for (const x of [-1.6, 1.6]) {
    const liner = mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.74, 28, 1, true), M.trim.clone());
    liner.material.side = THREE.DoubleSide;
    g.add(at(liner, x, 0.3, 0, Math.PI / 2));
    for (const z of [-0.88, 0.88]) {
      const w = wheel(M, 0.37, 0.27, { spokes: 6 });
      w.g.position.set(x, 0.37, z); if (z < 0) w.g.rotation.y = Math.PI;
      g.add(w.g); wheels.push(w);
    }
  }
  return { g, wheels, spot: headlightSpot(2.6, 0.86), len: 5.1, wid: 2.1 };
}

function buildKirikuu(M) {
  const g = new THREE.Group(), wheels = [];
  const s = new THREE.Shape();
  s.moveTo(0.42, 0.42);
  archLine(s, 0.42, [[1.15, 0.4]], 1.74);
  s.quadraticCurveTo(1.86, 0.42, 1.86, 0.6);
  s.lineTo(1.86, 1.08);
  s.lineTo(0.42, 1.08);
  s.lineTo(0.42, 0.42);
  g.add(extrude(s, 1.44, M.blue, 0.07));
  const c = new THREE.Shape();
  c.moveTo(0.44, 1.02);
  c.lineTo(1.86, 1.02);
  c.lineTo(1.66, 1.82);
  c.lineTo(0.44, 1.82);
  c.lineTo(0.44, 1.02);
  g.add(extrude(c, 1.42, M.glass, 0.07));
  g.add(at(rbox(1.36, 0.14, 1.6, 0.06, M.blue), 1.06, 1.9, 0));
  g.add(at(rbox(0.12, 0.84, 1.6, 0.04, M.blue), 0.5, 1.45, 0));
  for (const z of [-0.79, 0.79]) g.add(at(rbox(0.1, 0.86, 0.06, 0.03, M.blue), 1.78, 1.45, z, 0, 0, 0.24));
  g.add(at(rbox(0.06, 0.04, 1.2, 0.02, M.head), 1.95, 0.98, 0));
  for (const z of [-0.6, 0.6]) g.add(at(rbox(0.06, 0.12, 0.26, 0.03, M.head), 1.94, 0.84, z));
  g.add(at(rbox(0.07, 0.18, 1.2, 0.04, M.trim), 1.95, 0.52, 0));
  for (const z of [-1, 1]) g.add(at(rbox(0.16, 0.2, 0.08, 0.03, M.trim), 1.72, 1.32, z * 0.85));
  g.add(at(mesh(new THREE.BoxGeometry(2.55, 0.1, 1.56), M.steel), -0.86, 0.8, 0));
  g.add(at(mesh(new THREE.BoxGeometry(2.55, 0.36, 0.05), M.steel), -0.86, 1.03, 0.76));
  g.add(at(mesh(new THREE.BoxGeometry(2.55, 0.36, 0.05), M.steel), -0.86, 1.03, -0.76));
  g.add(at(mesh(new THREE.BoxGeometry(0.05, 0.36, 1.56), M.steel), -2.12, 1.03, 0));
  g.add(at(mesh(new THREE.BoxGeometry(0.05, 0.62, 1.56), M.steel), 0.38, 1.16, 0));
  for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(0.03, 0.03, 1.5), M.steel), 0.36, 1.5, -0.6 + i * 0.4));
  g.add(at(rbox(0.6, 0.5, 0.6, 0.03, M.box), -0.4, 1.1, -0.3, 0, 0.1));
  g.add(at(rbox(0.5, 0.4, 0.5, 0.03, M.box), -1.15, 1.05, 0.35, 0, -0.2));
  g.add(at(rbox(0.45, 0.35, 0.45, 0.03, M.box), -0.5, 1.53, -0.25, 0, 0.3));
  g.add(at(rbox(0.06, 0.08, 0.2, 0.02, M.tail), -2.16, 0.95, 0.6));
  g.add(at(rbox(0.06, 0.08, 0.2, 0.02, M.tail), -2.16, 0.95, -0.6));
  g.add(at(mesh(new THREE.BoxGeometry(3.9, 0.14, 1.1), M.trim), -0.1, 0.5, 0));
  for (const [x, r] of [[1.15, 0.33], [-1.3, 0.33]]) {
    for (const z of [-0.66, 0.66]) {
      const w = wheel(M, r, 0.22, { spokes: 5 });
      w.g.position.set(x, r, z); if (z < 0) w.g.rotation.y = Math.PI;
      g.add(w.g); wheels.push(w);
    }
  }
  return { g, wheels, spot: headlightSpot(1.98, 0.84), len: 4.4, wid: 1.8 };
}

function buildBajaji(M) {
  const g = new THREE.Group(), wheels = [];
  const s = new THREE.Shape();
  s.moveTo(-1.32, 0.42);
  archLine(s, 0.36, [[-0.72, 0.32]], 0.55);
  s.quadraticCurveTo(1.0, 0.36, 1.26, 0.58);
  s.quadraticCurveTo(1.4, 0.8, 1.36, 1.08);
  s.lineTo(0.98, 1.1);
  s.quadraticCurveTo(0.6, 0.86, 0.1, 0.84);
  s.lineTo(-1.08, 0.86);
  s.quadraticCurveTo(-1.32, 0.9, -1.34, 1.05);
  s.lineTo(-1.32, 0.42);
  g.add(extrude(s, 1.22, M.blue, 0.06));
  const r = new THREE.Shape();
  r.moveTo(1.24, 1.88);
  r.quadraticCurveTo(0.2, 2.06, -1.36, 1.94);
  r.lineTo(-1.36, 1.86);
  r.quadraticCurveTo(0.2, 1.98, 1.2, 1.8);
  r.lineTo(1.24, 1.88);
  g.add(extrude(r, 1.28, M.canvas, 0.05));
  g.add(at(rbox(0.06, 0.92, 1.3, 0.03, M.canvas), -1.33, 1.42, 0));
  for (const z of [-0.6, 0.6]) {
    g.add(at(cyl(0.025, 0.025, 0.86, M.trim, 10), 1.2, 1.46, z, 0, 0, 0.12));
    g.add(at(cyl(0.025, 0.025, 1.06, M.trim, 10), -0.25, 1.4, z));
  }
  g.add(at(mesh(new THREE.BoxGeometry(0.03, 0.66, 1.08), M.screen, false), 1.21, 1.46, 0, 0, 0, 0.12));
  g.add(at(rbox(0.1, 0.1, 1.12, 0.03, M.trim), 1.17, 1.81, 0));
  g.add(at(rbox(0.5, 0.14, 1.12, 0.05, M.seat), -0.68, 0.96, 0));
  g.add(at(rbox(0.12, 0.42, 1.12, 0.05, M.seat), -0.98, 1.2, 0, 0, 0, 0.12));
  g.add(at(rbox(0.32, 0.12, 0.34, 0.04, M.seat), 0.35, 0.96, 0));
  g.add(at(cyl(0.02, 0.02, 0.62, M.chrome, 10), 0.72, 1.18, 0, Math.PI / 2));
  g.add(at(cyl(0.11, 0.11, 0.05, M.head, 24), 1.37, 0.78, 0, 0, 0, Math.PI / 2));
  g.add(at(mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 24), M.chrome), 1.39, 0.78, 0, 0, Math.PI / 2));
  for (const z of [-0.42, 0.42]) g.add(at(rbox(0.05, 0.06, 0.16, 0.02, M.head), 1.33, 1.0, z));
  g.add(at(rbox(0.05, 0.06, 0.18, 0.02, M.tail), -1.38, 0.74, 0.46));
  g.add(at(rbox(0.05, 0.06, 0.18, 0.02, M.tail), -1.38, 0.74, -0.46));
  const f = mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24, Math.PI), M.blue);
  f.scale.z = 1.6; g.add(at(f, 1.08, 0.3, 0));
  g.add(at(cyl(0.03, 0.03, 0.5, M.chrome, 10), 1.12, 0.52, 0, 0, 0, -0.2));
  {
    const w = wheel(M, 0.26, 0.17, { spokes: 5 });
    w.g.position.set(1.08, 0.26, 0); g.add(w.g); wheels.push(w);
  }
  for (const z of [-0.56, 0.56]) {
    const w = wheel(M, 0.26, 0.17, { spokes: 5 });
    w.g.position.set(-0.72, 0.26, z); if (z < 0) w.g.rotation.y = Math.PI;
    g.add(w.g); wheels.push(w);
  }
  return { g, wheels, spot: headlightSpot(1.42, 0.8), len: 2.9, wid: 1.4 };
}

function buildBoda(M) {
  const g = new THREE.Group(), wheels = [];
  for (const x of [-0.72, 0.74]) {
    const w = wheel(M, 0.33, 0.11, { thin: true, spokes: 9 });
    w.g.position.set(x, 0.33, 0); g.add(w.g); wheels.push(w);
  }
  g.add(tube([[0.5, 1.04, 0], [0.32, 0.72, 0], [0.12, 0.42, 0], [-0.2, 0.42, 0], [-0.32, 0.62, 0]], 0.04, M.trim));
  g.add(tube([[0.48, 1.0, 0], [0.1, 0.96, 0], [-0.35, 0.9, 0], [-0.75, 0.9, 0]], 0.035, M.trim));
  for (const z of [-0.09, 0.09]) {
    g.add(tube([[-0.28, 0.46, z], [-0.5, 0.4, z], [-0.72, 0.33, z]], 0.028, M.trim, 12));
    g.add(tube([[-0.42, 0.88, z], [-0.58, 0.62, z], [-0.72, 0.36, z]], 0.035, M.chrome, 12));
    g.add(at(cyl(0.028, 0.028, 0.74, M.chrome, 10), 0.63, 0.68, z, 0, 0, 0.32));
  }
  g.add(at(rbox(0.42, 0.34, 0.26, 0.06, M.trim), 0.05, 0.56, 0));
  g.add(at(cyl(0.11, 0.11, 0.28, M.steel, 20), 0.18, 0.5, 0, Math.PI / 2));
  const tank = mesh(new THREE.SphereGeometry(1, 28, 18), M.blue);
  tank.scale.set(0.34, 0.15, 0.19); g.add(at(tank, 0.24, 1.04, 0, 0, 0, -0.12));
  g.add(at(rbox(0.72, 0.1, 0.28, 0.05, M.seat), -0.34, 1.02, 0, 0, 0, 0.04));
  g.add(at(rbox(0.34, 0.2, 0.22, 0.06, M.blue), -0.28, 0.82, 0));
  g.add(at(rbox(0.32, 0.03, 0.26, 0.01, M.trim), -0.78, 1.06, 0));
  g.add(at(cyl(0.018, 0.018, 0.72, M.chrome, 10), 0.5, 1.22, 0, Math.PI / 2));
  for (const z of [-0.34, 0.34]) {
    g.add(at(cyl(0.024, 0.024, 0.12, M.seat, 10), 0.5, 1.22, z, Math.PI / 2));
    g.add(at(cyl(0.008, 0.008, 0.26, M.chrome, 6), 0.48, 1.35, z * 0.75, 0, 0, -0.2));
    g.add(at(rbox(0.04, 0.06, 0.1, 0.015, M.trim), 0.45, 1.48, z * 0.75));
  }
  g.add(at(cyl(0.1, 0.1, 0.08, M.head, 24), 0.68, 1.05, 0, 0, 0, Math.PI / 2));
  g.add(at(mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 24), M.chrome), 0.71, 1.05, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.045, 0.06, 0.9, M.chrome, 16), -0.35, 0.42, 0.16, 0, 0, Math.PI / 2 - 0.12));
  const guard = mesh(new THREE.TorusGeometry(0.37, 0.04, 6, 20, Math.PI * 0.55), M.blue);
  guard.scale.z = 1.5; g.add(at(guard, 0.74, 0.33, 0, 0, 0, Math.PI * 0.25));
  g.add(at(rbox(0.04, 0.05, 0.12, 0.01, M.tail), -0.94, 1.04, 0));
  g.add(at(cyl(0.012, 0.012, 0.3, M.chrome, 6), -0.1, 0.17, 0.12, 0, 0, 0.5));
  return { g, wheels, spot: headlightSpot(0.72, 1.05), len: 2.1, wid: 0.8 };
}

function extractWheels(holder, H) {
  holder.updateMatrixWorld(true);
  const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const comps = [];

  const meshes = [];
  holder.traverse((o) => { if (o.isMesh && o.visible && !o.isSkinnedMesh && o.geometry?.attributes.position) meshes.push(o); });
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
    const idx = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i);
    m4.multiplyMatrices(toHolder, mesh.matrixWorld);
    const P = new Float32Array(n * 3), weld = new Map(), rep = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      const key = `${Math.round(v.x * 4000)},${Math.round(v.y * 4000)},${Math.round(v.z * 4000)}`;
      const r = weld.get(key);
      if (r === undefined) { weld.set(key, i); rep[i] = i; } else rep[i] = r;
    }
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const unite = (a, b) => { a = find(rep[a]); b = find(rep[b]); if (a !== b) parent[a] = b; };
    for (let t = 0; t < idx.length; t += 3) { unite(idx[t], idx[t + 1]); unite(idx[t + 1], idx[t + 2]); }
    const byRoot = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const root = find(rep[idx[t]]);
      let c = byRoot.get(root);
      if (!c) { c = { mesh, tris: [], box: new THREE.Box3() }; byRoot.set(root, c); comps.push(c); }
      c.tris.push(t);
      for (let k = 0; k < 3; k++) { const i = idx[t + k]; c.box.expandByPoint(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); }
    }
    mesh.userData.idx = idx;
  }

  const size = new THREE.Vector3(), ctr = new THREE.Vector3();
  const wheels = [];
  for (const c of comps) {
    c.box.getSize(size);
    const d = Math.max(size.y, size.z);
    if (d < 0.3 || d > 0.6 * H) continue;
    if (Math.abs(size.y - size.z) > 0.12 * d || size.x > 0.75 * d) continue;
    if (c.box.min.y > 0.1 * H) continue;
    c.box.getCenter(ctr);
    const near = wheels.find((w) => w.c.distanceTo(ctr) < 0.15);
    if (near) { near.box.union(c.box); near.r = Math.max(near.r, d / 2); }
    else wheels.push({ c: ctr.clone(), r: d / 2, box: c.box.clone(), parts: [] });
  }
  if (!wheels.length) return [];

  const inside = new THREE.Box3();
  for (const c of comps) {
    for (const w of wheels) {
      inside.copy(w.box).expandByScalar(0.03);
      if (inside.containsBox(c.box)) { w.parts.push(c); c.taken = true; break; }
    }
  }

  if (wheels.length === 2) {
    const z0 = Math.min(wheels[0].c.z, wheels[1].c.z), z1 = Math.max(wheels[0].c.z, wheels[1].c.z);
    for (const c of comps) {
      if (c.taken || c.box.min.y > 0.03) continue;
      const cz = (c.box.min.z + c.box.max.z) / 2;
      if (cz > z0 + 0.15 && cz < z1 - 0.15) c.drop = true;
    }
  }

  const out = [];
  for (const w of wheels) {
    const pivot = new THREE.Group();
    w.box.getCenter(pivot.position);
    holder.add(pivot);
    pivot.updateMatrixWorld(true);
    const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
    const perMesh = new Map();
    for (const c of w.parts) { if (!perMesh.has(c.mesh)) perMesh.set(c.mesh, []); perMesh.get(c.mesh).push(c); }
    for (const [mesh, parts] of perMesh) {
      const src = mesh.userData.idx, list = [];
      for (const c of parts) for (const t of c.tris) list.push(src[t], src[t + 1], src[t + 2]);
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(mesh.geometry.attributes)) geo.setAttribute(name, attr);
      geo.setIndex(list);
      const wm = new THREE.Mesh(geo, mesh.material);
      wm.castShadow = true; wm.receiveShadow = true;
      new THREE.Matrix4().multiplyMatrices(toPivot, mesh.matrixWorld).decompose(wm.position, wm.quaternion, wm.scale);
      pivot.add(wm);
    }
    out.push({ spin: pivot, r: w.r, axis: "x" });
  }
  for (const mesh of meshes) {
    const src = mesh.userData.idx, keep = [];
    const mine = comps.filter((c) => c.mesh === mesh);
    if (!mine.some((c) => c.taken || c.drop)) continue;
    for (const c of mine) if (!c.taken && !c.drop) for (const t of c.tris) keep.push(src[t], src[t + 1], src[t + 2]);
    if (!keep.length) { mesh.visible = false; continue; }
    const geo = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) geo.setAttribute(name, attr);
    geo.setIndex(keep);
    mesh.geometry = geo;
  }
  if (wheels.length === 2) {
    const [f, r] = [...wheels].sort((a, b) => a.c.z - b.c.z);
    const bf = f.c.y - f.r, br = r.c.y - r.r;
    if (Math.abs(bf - br) > 0.01) {
      const th = Math.atan((bf - br) / (f.c.z - r.c.z));
      const tilt = new THREE.Group();
      [...holder.children].forEach((o) => tilt.add(o));
      tilt.rotation.x = th;
      tilt.position.y = -Math.min(bf * Math.cos(th) - f.c.z * Math.sin(th), br * Math.cos(th) - r.c.z * Math.sin(th));
      holder.add(tilt);
    }
  }
  return out;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function roadTexture() {
  const px = 512 / ROAD_W, py = 1024 / TILE;
  return canvasTex(512, 1024, (x, w, h) => {
    x.fillStyle = "#34373c"; x.fillRect(0, 0, w, h);
    const d = x.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 34 + (Math.random() < 0.02 ? 30 : 0);
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    }
    x.putImageData(d, 0, 0);
    x.fillStyle = "rgba(0,0,0,.12)";
    for (const lane of [-LANE / 2, LANE / 2]) for (const o of [-0.85, 0.85]) x.fillRect(w / 2 + (lane + o) * px - 0.35 * px, 0, 0.7 * px, h);
    x.fillStyle = "#e9e6de";
    for (const e of [-3.6, 3.6]) x.fillRect(w / 2 + e * px - 0.08 * px, 0, 0.16 * px, h);
    x.fillStyle = "#f2bf3c";
    x.fillRect(w / 2 - 0.07 * px, 0, 0.14 * px, 3 * py);
  });
}
function radial(stops) {
  return canvasTex(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
}

export function createSwoop3D(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = "swoop__canvas";
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = DAY.clone();
  scene.fog = new THREE.Fog(DAY.clone(), 40, 170);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0x8db8ff, 0);
  rim.position.set(7, 6, 16);
  scene.add(hemi, sun, sun.target, rim);

  const world = new THREE.Group();
  world.position.x = LANE / 2;
  scene.add(world);
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, ROAD_L / TILE);
  roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const road = mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.62, metalness: 0.05 }), false);
  road.rotation.x = -Math.PI / 2;
  road.position.z = 40;
  world.add(road);
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.8 });
  const walkMat = new THREE.MeshStandardMaterial({ color: S_DAY.clone(), roughness: 0.9 });
  for (const side of [-1, 1]) {
    world.add(at(mesh(new THREE.BoxGeometry(0.3, 0.16, ROAD_L), kerbMat, false), side * (ROAD_W / 2 + 0.15), 0.08, 40));
    world.add(at(mesh(new THREE.BoxGeometry(3.4, 0.12, ROAD_L), walkMat, false), side * (ROAD_W / 2 + 2), 0.06, 40));
  }
  const groundMat = new THREE.MeshStandardMaterial({ color: G_DAY.clone(), roughness: 1 });
  const ground = mesh(new THREE.PlaneGeometry(900, 900), groundMat, false);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01;
  scene.add(ground);

  const lampHead = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd7a0, emissiveIntensity: 0 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.6, roughness: 0.4 });
  const poolMat = new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(255,210,150,1)"], [0.45, "rgba(255,190,120,.35)"], [1, "rgba(255,190,120,0)"]]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowMat = new THREE.SpriteMaterial({ map: radial([[0, "rgba(255,230,190,1)"], [0.2, "rgba(255,200,140,.5)"], [1, "rgba(255,200,140,0)"]]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamps = [];
  const SPACING = 26, PER_SIDE = 9, SPAN = SPACING * PER_SIDE;
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 12);
  for (let i = 0; i < PER_SIDE * 2; i++) {
    const side = i % 2 ? 1 : -1;
    const lamp = new THREE.Group();
    const px = side * (ROAD_W / 2 + 0.7);
    lamp.add(at(mesh(poleGeo, poleMat), px, 3.2, 0));
    lamp.add(at(mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), poleMat), px - side * 0.9, 6.35, 0));
    lamp.add(at(rbox(0.7, 0.1, 0.26, 0.04, lampHead), px - side * 1.7, 6.3, 0));
    const glow = new THREE.Sprite(glowMat); glow.scale.set(2.6, 2.6, 1); glow.position.set(px - side * 1.7, 6.15, 0);
    lamp.add(glow);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(px - side * 2.6, 0.02, 0);
    lamp.add(pool);
    lamp.position.z = -70 + Math.floor(i / 2) * SPACING + (side > 0 ? SPACING / 2 : 0);
    world.add(lamp); lamps.push(lamp);
  }

  const cityGeo = new THREE.BufferGeometry();
  const pts = [], cols = [];
  const warm = new THREE.Color("#ffcf8a"), cool = new THREE.Color("#cfe0ff");
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 160;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 20) continue;
    pts.push(x, Math.random() ** 3 * 22, z);
    const c = Math.random() < 0.7 ? warm : cool; cols.push(c.r, c.g, c.b);
  }
  cityGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  cityGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const cityMat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(cityGeo, cityMat));

  const M = materials();
  const shadowTex = radial([[0, "rgba(0,0,0,.75)"], [0.55, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]);
  const builders = [buildSasa, buildBoda, buildBajaji, buildXL, buildKirikuu];
  const fleet = builders.map((b, i) => {
    const v = b(M);
    const wrap = new THREE.Group();
    v.g.rotation.y = Math.PI / 2;
    wrap.add(v.g);
    v.g.add(v.spot, v.spot.target);
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(v.len + 0.8, v.wid + 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    cs.rotation.x = -Math.PI / 2; cs.rotation.z = Math.PI / 2; cs.position.y = 0.015;
    wrap.add(cs);
    v.g.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow && true; } });
    wrap.position.z = i === 0 ? 0 : 200;
    scene.add(wrap);
    return { ...v, wrap };
  });

  const MODELS = [
    { key: "sasa", len: 4.8 }, { key: "boda", len: 2.05 }, { key: "bajaji", len: 2.65 },
    { key: "xl", len: 4.9 }, { key: "kirikuu", len: 3.4 },
  ];
  const MODEL_FIX = {};
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  MODELS.forEach(({ key, len }, i) => {
    gltf.loadAsync(`/models/${key}.glb`).then(({ scene: model }) => {
      const f = fleet[i];
      const holder = new THREE.Group();
      holder.add(model);
      model.rotation.y = Math.PI + (MODEL_FIX[key]?.rotY || 0);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3(), mb = new THREE.Box3(), sz = new THREE.Vector3();
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        mb.setFromObject(o, true).getSize(sz);
        if (sz.y < 1e-3 * Math.max(sz.x, sz.z)) o.visible = false;
      });
      const measure = () => {
        holder.updateMatrixWorld(true); box.makeEmpty();
        model.traverse((o) => { if (o.isMesh && o.visible) box.union(mb.setFromObject(o, true)); });
      };
      measure();
      model.scale.multiplyScalar(len / box.getSize(sz).z);
      measure();
      const c = box.getCenter(new THREE.Vector3());
      model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
      measure();
      const nose = box.min.z, h = box.max.y;
      f.spot.position.set(0, h * 0.42, nose + 0.1);
      f.spot.target.position.set(0, 0, nose - 14);
      holder.add(f.spot, f.spot.target);
      f.wrap.remove(f.g);
      f.wrap.add(holder);
      f.g = holder;
      f.wheels = extractWheels(holder, h);
    }).catch(() => { });
  });

  const rig = { phi: 0.03, theta: Math.PI, r: 30, lookY: 0.3, hero: 0, N: 0, speed: 13 };
  const slots = fleet.map((f, i) => ({ x: 0, z: i === 0 ? 0 : 200 }));
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  const look = new THREE.Vector3(), sph = new THREE.Spherical();
  let W = 1, H = 1, t = 0;
  const tmp = new THREE.Color();

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  function apply(dt) {
    const N = rig.N, mobile = W <= 860;
    tmp.copy(DAY).lerp(NIGHT, N); scene.background.copy(tmp); scene.fog.color.copy(tmp);
    groundMat.color.copy(G_DAY).lerp(G_NIGHT, N);
    walkMat.color.copy(S_DAY).lerp(S_NIGHT, N);
    hemi.intensity = THREE.MathUtils.lerp(1.6, 0.5, N);
    hemi.color.setHSL(0.6, N * 0.5, THREE.MathUtils.lerp(1, 0.7, N));
    sun.intensity = THREE.MathUtils.lerp(2.4, 0.55, N);
    sun.color.setHSL(0.6, N * 0.6, THREE.MathUtils.lerp(1, 0.78, N));
    rim.intensity = 3 * N;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.9, 0.6, N);
    lampHead.emissiveIntensity = 3 * N;
    poolMat.opacity = 0.55 * N; glowMat.opacity = N; cityMat.opacity = N;
    const lit = THREE.MathUtils.smoothstep(N, 0.3, 0.8);
    M.head.emissiveIntensity = 0.6 + 2.4 * lit;
    M.tail.emissiveIntensity = 0.8 + 1.8 * lit;

    const d = rig.speed * dt;
    roadTex.offset.y = (roadTex.offset.y + d / TILE) % 1;
    for (const l of lamps) { l.position.z += d; if (l.position.z > SPAN - 70) l.position.z -= SPAN; }
    fleet.forEach((f, i) => {
      const s = slots[i];
      f.wrap.position.set(s.x, 0, s.z);
      f.wrap.visible = s.z < 150;
      f.spot.intensity = f.wrap.visible ? 900 * lit : 0;
      if (f.wrap.visible) for (const w of f.wheels) w.spin.rotation[w.axis || "z"] -= Math.min(d / w.r, 0.24);
      f.g.position.y = Math.sin(t * 9 + i) * 0.006;
    });

    pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const sway = rig.hero;
    const fit = Math.max(1, 0.9 / camera.aspect);
    sph.set(rig.r * fit, Math.min(1.45, rig.phi + pointer.sy * 0.08 * sway + Math.sin(t * 0.5) * 0.006 * sway), rig.theta - pointer.sx * 0.22 * sway);
    look.set(0, rig.lookY, 0);
    camera.position.setFromSpherical(sph).add(look);
    camera.lookAt(look);
    const ox = mobile ? 0 : -0.15 * rig.hero * W, oy = mobile ? -0.14 * rig.hero * H : 0;
    camera.setViewOffset(W, H, ox, oy, W, H);
    sun.position.set(camera.position.x * 0 - 8, 18, 6);
  }

  let running = false;
  function frame(time, deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000; t += dt;
    apply(dt);
    renderer.render(scene, camera);
  }
  function renderOnce() { apply(0); renderer.render(scene, camera); }

  resize();
  addEventListener("resize", () => { resize(); if (!running) renderOnce(); });

  return {
    rig, slots,
    start(ticker) { if (running) return; running = true; ticker.add(frame); },
    stop(ticker) { if (!running) return; running = false; ticker.remove(frame); },
    renderOnce, resize,
  };
}

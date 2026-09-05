import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const materials = {
  default: new THREE.MeshStandardMaterial({ color: 0x8e8e93, roughness: 0.4, metalness: 0.1 }),
  cube: new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.45, metalness: 0.1 }),
  domino: new THREE.MeshStandardMaterial({ color: 0x0a84ff, roughness: 0.2, metalness: 0.2 }),
  slope: new THREE.MeshStandardMaterial({ color: 0xff9f0a, roughness: 0.3, metalness: 0.05 }),
  seesaw: new THREE.MeshStandardMaterial({ color: 0xbf5af2, roughness: 0.4, metalness: 0.1 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x5e5ce6, roughness: 0.3, metalness: 0.2 }),
  startBall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 }),
  sphere: new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.2, metalness: 0.4 }),
  goal: new THREE.MeshStandardMaterial({ color: 0x30d158, roughness: 0.5, metalness: 0.0 }),
  flag: new THREE.MeshStandardMaterial({ color: 0xffd60a, side: THREE.DoubleSide })
};

export const physicsMaterial = new CANNON.Material('physicsMaterial');
export const dominoMaterial = new CANNON.Material('dominoMaterial');

export const defaultContactMaterial = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
  friction: 0.2,
  restitution: 0.3
});

export const dominoGroundContactMaterial = new CANNON.ContactMaterial(dominoMaterial, physicsMaterial, {
  friction: 0.6,
  restitution: 0.2
});

export const dominoDominoContactMaterial = new CANNON.ContactMaterial(dominoMaterial, dominoMaterial, {
  friction: 0.1,
  restitution: 0.5
});

export function createStartBall(x, y, z) {
  const geo = new THREE.SphereGeometry(0.35, 32, 32);
  const mesh = new THREE.Mesh(geo, materials.startBall);
  mesh.castShadow = true;
  mesh.position.set(x, y, z);

  mesh.userData = {
    type: 'startBall',
    fixed: false,
    locked: false,
    mass: 2.0,
    initialPos: new THREE.Vector3(x, y, z),
    initialRot: new THREE.Euler(0, 0, 0),
    initialScale: new THREE.Vector3(1, 1, 1),
    body: null
  };
  return mesh;
}

export function createGoalHole(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const holeMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.01, 0.7, 32),
    materials.goal
  );
  holeMesh.rotation.x = -Math.PI / 2;
  holeMesh.position.y = 0.02;
  group.add(holeMesh);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 2.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  pole.position.set(0, 1.1, 0);
  pole.castShadow = true;
  group.add(pole);

  const flagGeo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 2.1, 0,
    0.6, 1.85, 0,
    0, 1.6, 0
  ]);
  flagGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  flagGeo.computeVertexNormals();
  const flagMesh = new THREE.Mesh(flagGeo, materials.flag);
  group.add(flagMesh);

  group.userData = {
    type: 'goalHole',
    fixed: true,
    locked: false,
    initialPos: new THREE.Vector3(x, y, z),
    initialRot: new THREE.Euler(0, 0, 0),
    initialScale: new THREE.Vector3(1, 1, 1),
    body: null
  };
  return group;
}

export function createPartMesh(type) {
  let mesh;
  switch (type) {
    case 'cube':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.cube);
      mesh.userData.shape = 'box';
      mesh.userData.size = [1, 1, 1];
      break;
    case 'sphere':
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), materials.sphere);
      mesh.userData.shape = 'sphere';
      mesh.userData.radius = 0.5;
      break;
    case 'cylinder':
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), materials.default);
      mesh.userData.shape = 'cylinder';
      mesh.userData.size = [0.5, 0.5, 1];
      break;
    case 'domino':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.55), materials.domino);
      mesh.userData.shape = 'box';
      mesh.userData.size = [0.14, 1.25, 0.55];
      break;
    case 'rail': {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 3.0), materials.rail);
      base.castShadow = true;
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 3.0), materials.rail);
      leftWall.position.set(-0.55, 0.175, 0);
      leftWall.castShadow = true;
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 3.0), materials.rail);
      rightWall.position.set(0.55, 0.175, 0);
      rightWall.castShadow = true;
      group.add(base, leftWall, rightWall);
      mesh = group;
      mesh.userData.shape = 'compositeRail';
      break;
    }
    case 'slope': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(2.5, 0);
      shape.lineTo(0, 1.2);
      shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
      geom.center();
      mesh = new THREE.Mesh(geom, materials.slope);
      mesh.userData.shape = 'slope';
      mesh.userData.size = [2.5, 1.2, 1.2];
      break;
    }
    case 'seesaw':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 4.0), materials.seesaw);
      mesh.userData.shape = 'box';
      mesh.userData.size = [1.0, 0.1, 4.0];
      break;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.type = type;
  mesh.userData.fixed = (type === 'rail' || type === 'slope');
  mesh.userData.locked = false;
  mesh.userData.mass = (type === 'domino') ? 3.0 : 1.0;
  mesh.userData.initialPos = new THREE.Vector3();
  mesh.userData.initialRot = new THREE.Euler();
  mesh.userData.initialScale = new THREE.Vector3(1, 1, 1);
  mesh.userData.body = null;
  return mesh;
}

export function buildCannonBody(obj) {
  if (obj.userData.type === 'goalHole') return null;

  let body;
  const uData = obj.userData;
  const isDomino = uData.type === 'domino';
  const defaultMass = isDomino ? 3.0 : 1.0;
  const mass = uData.fixed ? 0 : (uData.mass ?? defaultMass);
  const scale = obj.scale;

  if (uData.type === 'startBall') {
    const radius = 0.35 * scale.x;
    body = new CANNON.Body({
      mass: uData.mass ?? 2.0,
      shape: new CANNON.Sphere(radius),
      material: physicsMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    body.ccdSpeedThreshold = 0.5;
    body.ccdIterations = 5;
  } else if (uData.shape === 'box') {
    const s = uData.size;
    body = new CANNON.Body({
      mass: mass,
      shape: new CANNON.Box(new CANNON.Vec3((s[0] * scale.x) / 2, (s[1] * scale.y) / 2, (s[2] * scale.z) / 2)),
      material: isDomino ? dominoMaterial : physicsMaterial,
      linearDamping: isDomino ? 0.001 : 0.01,
      angularDamping: isDomino ? 0.0005 : 0.05
    });
  } else if (uData.shape === 'sphere') {
    body = new CANNON.Body({
      mass: mass,
      shape: new CANNON.Sphere(uData.radius * scale.x),
      material: physicsMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    body.ccdSpeedThreshold = 0.5;
    body.ccdIterations = 5;
  } else if (uData.shape === 'cylinder') {
    const s = uData.size;
    body = new CANNON.Body({
      mass: mass,
      shape: new CANNON.Cylinder(s[0] * scale.x, s[1] * scale.x, s[2] * scale.y, 16),
      material: physicsMaterial
    });
  } else if (uData.shape === 'slope') {
    const s = uData.size;
    const w = s[0] * scale.x;
    const h = s[1] * scale.y;
    const d = s[2] * scale.z;

    body = new CANNON.Body({ mass: mass, material: physicsMaterial });

    const rampLength = Math.hypot(w, h);
    const angle = Math.atan2(h, w);
    const rampThickness = 0.25 * scale.y;

    const rampShape = new CANNON.Box(new CANNON.Vec3(rampLength / 2, rampThickness / 2, d / 2));
    const rampQuat = new CANNON.Quaternion();
    rampQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -angle);

    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    const rampOffset = new CANNON.Vec3(nx * (rampThickness / 2), ny * (rampThickness / 2), 0);
    body.addShape(rampShape, rampOffset, rampQuat);

    const baseBlock = new CANNON.Box(new CANNON.Vec3(w / 4, h / 4, d / 2));
    body.addShape(baseBlock, new CANNON.Vec3(-w / 4, -h / 4, 0));
  } else if (uData.shape === 'compositeRail') {
    body = new CANNON.Body({ mass: mass, material: physicsMaterial });
    const baseShape = new CANNON.Box(new CANNON.Vec3((1.2 * scale.x) / 2, (0.1 * scale.y) / 2, (3.0 * scale.z) / 2));
    const wallShape = new CANNON.Box(new CANNON.Vec3((0.1 * scale.x) / 2, (0.35 * scale.y) / 2, (3.0 * scale.z) / 2));
    body.addShape(baseShape, new CANNON.Vec3(0, 0, 0));
    body.addShape(wallShape, new CANNON.Vec3(-0.55 * scale.x, 0.175 * scale.y, 0));
    body.addShape(wallShape, new CANNON.Vec3(0.55 * scale.x, 0.175 * scale.y, 0));
  }

  if (body) {
    body.position.copy(obj.position);
    body.quaternion.copy(obj.quaternion);
  }
  return body;
}
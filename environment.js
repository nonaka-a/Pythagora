import * as THREE from 'three';

export let sunLight;

export function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#bda07b';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankHeight = 64;
  for (let y = 0; y < 1024; y += plankHeight) {
    ctx.fillStyle = (y / plankHeight) % 2 === 0 ? '#b2956f' : '#c3a580';
    ctx.fillRect(0, y, 1024, plankHeight);

    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(0, y + i * 16, 1024, 2);
    }

    ctx.strokeStyle = '#856641';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  for (let x = 0; x < 1024; x += 256) {
    ctx.strokeStyle = '#856641';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

export function buildRichApartmentRoom(scene) {
  const hemiLight = new THREE.HemisphereLight(0xe8f0f8, 0xd0c4b2, 0.8);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff6e5, 1.5);
  setShadowMode('natural');
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 70;
  sunLight.shadow.camera.left = -16;
  sunLight.shadow.camera.right = 16;
  sunLight.shadow.camera.top = 16;
  sunLight.shadow.camera.bottom = -16;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const ceilingLight = new THREE.PointLight(0xffecd1, 0.6, 25);
  ceilingLight.position.set(0, 11, 0);
  scene.add(ceilingLight);

  const floorGeo = new THREE.PlaneGeometry(32, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture(),
    roughness: 0.3,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f7, roughness: 0.9 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x48484a, roughness: 0.5 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 0.4), wallMat);
  backWall.position.set(0, 7, -16);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(32, 0.3, 0.45), baseboardMat);
  bbBack.position.set(0, 0.15, -15.95);
  scene.add(bbBack);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 32), wallMat);
  rightWall.position.set(16, 7, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  const bbRight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 32), baseboardMat);
  bbRight.position.set(15.95, 0.15, 0);
  scene.add(bbRight);

  // 左壁（全面ワイドパノラマ窓構造）
  const leftWallUpper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 32), wallMat);
  leftWallUpper.position.set(-16, 12.75, 0);
  scene.add(leftWallUpper);

  const leftWallLower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.0, 32), wallMat);
  leftWallLower.position.set(-16, 1.0, 0);
  scene.add(leftWallLower);

  const leftWallPillarN = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 2), wallMat);
  leftWallPillarN.position.set(-16, 6.75, -15);
  scene.add(leftWallPillarN);

  const leftWallPillarS = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 2), wallMat);
  leftWallPillarS.position.set(-16, 6.75, 15);
  scene.add(leftWallPillarS);

  // 窓サッシフレーム（4連窓）
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4 });
  const fHBottom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 28), frameMat);
  fHBottom.position.set(-16, 2.1, 0);
  const fHTop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 28), frameMat);
  fHTop.position.set(-16, 11.4, 0);
  const fHMid = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 28), frameMat);
  fHMid.position.set(-16, 6.75, 0);
  scene.add(fHBottom, fHTop, fHMid);

  for (let z = -14; z <= 14; z += 7) {
    const fV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 9.5, 0.2), frameMat);
    fV.position.set(-16, 6.75, z);
    scene.add(fV);
  }

  // ガラス面
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.2
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(28, 9.5), glassMat);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(-15.95, 6.75, 0);
  scene.add(glass);

  // 外景（空と光）
  const skyGeo = new THREE.PlaneGeometry(80, 40);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xbedcf0 });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(-28, 12, 0);
  sky.rotation.y = Math.PI / 2;
  scene.add(sky);
}

export function setShadowMode(mode) {
  if (!sunLight) return;
  if (mode === 'natural') {
    sunLight.position.set(-18, 22, -8);
    sunLight.target.position.set(0, 0, 0);
  } else if (mode === 'topdown') {
    sunLight.position.set(0, 26, 0);
    sunLight.target.position.set(0, 0, 0);
  }
}
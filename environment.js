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
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xddd2c4, 1.2);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff8ee, 1.1);
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

  const wallMat = new THREE.MeshStandardMaterial({ 
    color: 0xf6f6f7, 
    roughness: 0.9, 
    side: THREE.FrontSide 
  });
  const baseboardMat = new THREE.MeshStandardMaterial({ 
    color: 0x48484a, 
    roughness: 0.5, 
    side: THREE.FrontSide 
  });
  const frameMat = new THREE.MeshStandardMaterial({ 
    color: 0x1c1c1e, 
    roughness: 0.4, 
    side: THREE.FrontSide 
  });

  const backWallGeo = new THREE.PlaneGeometry(32, 14);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 7, -16);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const bbBackGeo = new THREE.PlaneGeometry(32, 0.3);
  const bbBack = new THREE.Mesh(bbBackGeo, baseboardMat);
  bbBack.position.set(0, 0.15, -15.98);
  scene.add(bbBack);

  // 奥壁の室内ドア構築 (裏側からはカリングされて見えない構造)
  const doorGroup = new THREE.Group();
  doorGroup.position.set(6.5, 0, -15.95);

  const doorFrameMat = new THREE.MeshStandardMaterial({ 
    color: 0x3a3028, 
    roughness: 0.6, 
    side: THREE.FrontSide 
  });
  const doorPanelMat = new THREE.MeshStandardMaterial({ 
    color: 0x5a4838, 
    roughness: 0.5, 
    side: THREE.FrontSide 
  });
  const trimMat = new THREE.MeshStandardMaterial({ 
    color: 0x47382a, 
    roughness: 0.5, 
    side: THREE.FrontSide 
  });
  const doorHandleMat = new THREE.MeshStandardMaterial({ 
    color: 0xd4af37, 
    metalness: 0.8, 
    roughness: 0.2, 
    side: THREE.FrontSide 
  });

  const totalDoorW = 4.6;
  const totalDoorH = 9.2;
  const frameThickness = 0.25;

  // 外枠 (Boxジオメトリ＋FrontSideで部屋の内側のみレンダリング)
  const fPostLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, totalDoorH, 0.08), doorFrameMat);
  fPostLeft.position.set(-totalDoorW / 2 + frameThickness / 2, totalDoorH / 2, 0.04);
  fPostLeft.castShadow = true;

  const fPostRight = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, totalDoorH, 0.08), doorFrameMat);
  fPostRight.position.set(totalDoorW / 2 - frameThickness / 2, totalDoorH / 2, 0.04);
  fPostRight.castShadow = true;

  const fTop = new THREE.Mesh(new THREE.BoxGeometry(totalDoorW, frameThickness, 0.08), doorFrameMat);
  fTop.position.set(0, totalDoorH - frameThickness / 2, 0.04);
  fTop.castShadow = true;

  // 扉本体
  const innerW = totalDoorW - frameThickness * 2;
  const innerH = totalDoorH - frameThickness;
  const doorBody = new THREE.Mesh(new THREE.PlaneGeometry(innerW, innerH), doorPanelMat);
  doorBody.position.set(0, innerH / 2, 0.01);
  doorBody.castShadow = true;

  // 扉の彫り込みパネル装飾
  const panelUpper = new THREE.Mesh(new THREE.PlaneGeometry(innerW * 0.82, innerH * 0.52), trimMat);
  panelUpper.position.set(0, innerH * 0.68, 0.02);

  const panelLower = new THREE.Mesh(new THREE.PlaneGeometry(innerW * 0.82, innerH * 0.3), trimMat);
  panelLower.position.set(0, innerH * 0.22, 0.02);

  // レバーハンドル & ノブ
  const handleY = 4.0;
  const handleX = -innerW * 0.38;

  const handlePlate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), doorHandleMat);
  handlePlate.position.set(handleX, handleY, 0.025);

  const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12), doorHandleMat);
  handleStem.rotation.x = Math.PI / 2;
  handleStem.position.set(handleX, handleY, 0.06);

  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.03), doorHandleMat);
  handleBar.position.set(handleX - 0.16, handleY, 0.1);
  handleBar.castShadow = true;

  doorGroup.add(
    fPostLeft, fPostRight, fTop,
    doorBody, panelUpper, panelLower,
    handlePlate, handleStem, handleBar
  );
  scene.add(doorGroup);

  const rightWallGeo = new THREE.PlaneGeometry(32, 14);
  const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(16, 7, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  const bbRightGeo = new THREE.PlaneGeometry(32, 0.3);
  const bbRight = new THREE.Mesh(bbRightGeo, baseboardMat);
  bbRight.rotation.y = -Math.PI / 2;
  bbRight.position.set(15.98, 0.15, 0);
  scene.add(bbRight);

  const createInnerPlane = (w, h, x, y, z, mat) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, y, z);
    return mesh;
  };

  const leftWallUpper = createInnerPlane(32, 2.5, -16, 12.75, 0, wallMat);
  const leftWallLower = createInnerPlane(32, 2.0, -16, 1.0, 0, wallMat);
  const leftWallPillarN = createInnerPlane(2, 9.5, -16, 6.75, -15, wallMat);
  const leftWallPillarS = createInnerPlane(2, 9.5, -16, 6.75, 15, wallMat);
  scene.add(leftWallUpper, leftWallLower, leftWallPillarN, leftWallPillarS);

  const fHBottom = createInnerPlane(28, 0.2, -15.98, 2.1, 0, frameMat);
  const fHTop = createInnerPlane(28, 0.2, -15.98, 11.4, 0, frameMat);
  const fHMid = createInnerPlane(28, 0.15, -15.98, 6.75, 0, frameMat);
  scene.add(fHBottom, fHTop, fHMid);

  for (let z = -14; z <= 14; z += 7) {
    const fV = createInnerPlane(0.2, 9.5, -15.98, 6.75, z, frameMat);
    scene.add(fV);
  }

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.2,
    side: THREE.DoubleSide
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(28, 9.5), glassMat);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(-15.95, 6.75, 0);
  scene.add(glass);
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
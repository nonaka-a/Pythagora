import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import * as CANNON from 'cannon-es';

import { buildRichApartmentRoom, setShadowMode } from './environment.js';
import { 
  createStartBall, 
  createGoalHole, 
  createPartMesh, 
  buildCannonBody, 
  physicsMaterial, 
  defaultContactMaterial,
  dominoGroundContactMaterial,
  dominoDominoContactMaterial
} from './parts.js';
import { 
  loadAllSlots, 
  saveSlot, 
  deleteSlot, 
  updateSlotName, 
  serializeRegisteredObjects 
} from './storage.js';

let scene, camera, renderer, world, orbit, transformControl;
let isPlaying = false;
let selectedObject = null;
let registeredObjects = [];
let startBall = null;
let goalHole = null;
let goalTimeoutId = null;
let isGoalReached = false;

const DEFAULT_CAM_POS = new THREE.Vector3(0, 9, 15);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 2, 0);

const historyStack = [];
const MAX_HISTORY = 40;

init();
animate();

function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa3c2db);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.copy(DEFAULT_CAM_POS);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  world = new CANNON.World();
  world.gravity.set(0, -20.0, 0);
  world.addContactMaterial(defaultContactMaterial);
  world.addContactMaterial(dominoGroundContactMaterial);
  world.addContactMaterial(dominoDominoContactMaterial);

  buildRichApartmentRoom(scene);

  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: physicsMaterial
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  orbit.target.copy(DEFAULT_CAM_TARGET);
  orbit.enablePan = true;
  orbit.screenSpacePanning = true;
  orbit.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };

  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.size = 0.75;
  
  let scaleStart = new THREE.Vector3();
  transformControl.addEventListener('mouseDown', () => {
    recordHistoryState();
    if (selectedObject) scaleStart.copy(selectedObject.scale);
  });
  transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
  });
  transformControl.addEventListener('change', () => {
    if (selectedObject) {
      if (transformControl.getMode() === 'scale' && document.getElementById('prop-uniform-scale').checked) {
        const ratio = selectedObject.scale.x / (scaleStart.x || 1);
        selectedObject.scale.y = scaleStart.y * ratio;
        selectedObject.scale.z = scaleStart.z * ratio;
      }
      updateInspectorFromObject(selectedObject);
    }
  });
  scene.add(transformControl);

  setupStaticStage();
  setupEvents();
  setupUIEvents();
  setupCameraWidget();
  renderSlotsUI();
}

function setupStaticStage() {
  startBall = createStartBall(-4, 5, 0);
  scene.add(startBall);
  registeredObjects.push(startBall);

  goalHole = createGoalHole(4, 0, 0);
  scene.add(goalHole);
  registeredObjects.push(goalHole);
}

function recordHistoryState() {
  if (isPlaying) return;
  const snapshot = serializeRegisteredObjects(registeredObjects);
  historyStack.push({
    snapshot,
    selectedUuid: selectedObject ? selectedObject.uuid : null
  });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
}

function undo() {
  if (isPlaying || historyStack.length === 0) return;
  const lastState = historyStack.pop();
  applySnapshotData(lastState.snapshot, lastState.selectedUuid);
}

function applySnapshotData(snapshotData, selectUuid = null) {
  const currentUuids = new Set(snapshotData.map(s => s.uuid));
  for (let i = registeredObjects.length - 1; i >= 0; i--) {
    const obj = registeredObjects[i];
    if (obj !== startBall && obj !== goalHole && !currentUuids.has(obj.uuid)) {
      scene.remove(obj);
      registeredObjects.splice(i, 1);
    }
  }

  for (const s of snapshotData) {
    let obj = registeredObjects.find(o => o.uuid === s.uuid);
    if (!obj) {
      if (s.type === 'startBall') {
        obj = startBall;
      } else if (s.type === 'goalHole') {
        obj = goalHole;
      } else {
        obj = createPartMesh(s.type);
        obj.uuid = s.uuid;
        registeredObjects.push(obj);
        scene.add(obj);
      }
    }
    obj.position.set(...s.position);
    obj.rotation.set(...s.rotation);
    obj.scale.set(...s.scale);
    obj.userData.fixed = s.fixed;
    obj.userData.mass = s.mass;
  }

  const target = registeredObjects.find(o => o.uuid === selectUuid);
  selectObject(target || null);
}

function addPart(type) {
  recordHistoryState();
  const mesh = createPartMesh(type);
  mesh.position.set(0, 2, 0);
  mesh.userData.initialPos = mesh.position.clone();
  mesh.userData.initialRot = mesh.rotation.clone();
  mesh.userData.initialScale = mesh.scale.clone();

  scene.add(mesh);
  registeredObjects.push(mesh);
  selectObject(mesh);
}

function duplicateSelectedObject() {
  if (!selectedObject || isPlaying) return;
  if (selectedObject === startBall || selectedObject === goalHole) return;

  recordHistoryState();
  const uData = selectedObject.userData;
  const clone = createPartMesh(uData.type);

  clone.position.copy(selectedObject.position).add(new THREE.Vector3(0.5, 0, 0.5));
  clone.rotation.copy(selectedObject.rotation);
  clone.scale.copy(selectedObject.scale);
  clone.userData.fixed = uData.fixed;
  clone.userData.mass = uData.mass;

  scene.add(clone);
  registeredObjects.push(clone);
  selectObject(clone);
}

function buildPhysicsBodies() {
  for (const obj of registeredObjects) {
    const body = buildCannonBody(obj);
    if (body) {
      world.addBody(body);
      obj.userData.body = body;
    }
  }
}

function destroyPhysicsBodies() {
  for (const obj of registeredObjects) {
    if (obj.userData.body) {
      world.removeBody(obj.userData.body);
      obj.userData.body = null;
    }
  }
}

function startSimulation() {
  if (isPlaying) return;
  isGoalReached = false;
  saveInitialStates();
  buildPhysicsBodies();
  transformControl.detach();
  isPlaying = true;
  document.getElementById('btn-mode-toggle').innerText = 'ストップ';
  document.getElementById('btn-mode-toggle').classList.replace('primary', 'danger');
  document.getElementById('goal-banner').style.display = 'none';
  if (goalTimeoutId) {
    clearTimeout(goalTimeoutId);
    goalTimeoutId = null;
  }
}

function stopSimulation() {
  if (!isPlaying) return;
  destroyPhysicsBodies();
  restoreInitialStates();
  isPlaying = false;
  isGoalReached = false;
  document.getElementById('btn-mode-toggle').innerText = 'スタート';
  document.getElementById('btn-mode-toggle').classList.replace('danger', 'primary');
  document.getElementById('goal-banner').style.display = 'none';
  if (goalTimeoutId) {
    clearTimeout(goalTimeoutId);
    goalTimeoutId = null;
  }
  if (selectedObject) transformControl.attach(selectedObject);
}

function saveInitialStates() {
  for (const obj of registeredObjects) {
    obj.userData.initialPos.copy(obj.position);
    obj.userData.initialRot.copy(obj.rotation);
    obj.userData.initialScale.copy(obj.scale);
  }
}

function restoreInitialStates() {
  for (const obj of registeredObjects) {
    obj.position.copy(obj.userData.initialPos);
    obj.rotation.copy(obj.userData.initialRot);
    obj.scale.copy(obj.userData.initialScale);
  }
}

function selectObject(obj) {
  if (isPlaying) return;
  selectedObject = obj;
  if (obj) {
    transformControl.attach(obj);
    document.getElementById('no-selection').style.display = 'none';
    document.getElementById('selection-panel').style.display = 'flex';
    document.getElementById('item-name').innerText = obj.userData.type.toUpperCase();
    const isGoal = obj.userData.type === 'goalHole';
    const isStart = obj.userData.type === 'startBall';
    document.getElementById('fixed-row').style.display = (isGoal || isStart) ? 'none' : 'flex';
    document.getElementById('scale-container').style.display = isGoal ? 'none' : 'block';
    document.getElementById('mass-container').style.display = isGoal ? 'none' : 'flex';
    document.getElementById('btn-duplicate').style.display = (isGoal || isStart) ? 'none' : 'block';
    updateInspectorFromObject(obj);
  } else {
    transformControl.detach();
    document.getElementById('no-selection').style.display = 'block';
    document.getElementById('selection-panel').style.display = 'none';
  }
}

function updateInspectorFromObject(obj) {
  document.getElementById('prop-px').value = obj.position.x.toFixed(2);
  document.getElementById('prop-py').value = obj.position.y.toFixed(2);
  document.getElementById('prop-pz').value = obj.position.z.toFixed(2);

  document.getElementById('prop-rx').value = THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1);
  document.getElementById('prop-ry').value = THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1);
  document.getElementById('prop-rz').value = THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1);

  document.getElementById('prop-sx').value = obj.scale.x.toFixed(2);
  document.getElementById('prop-sy').value = obj.scale.y.toFixed(2);
  document.getElementById('prop-sz').value = obj.scale.z.toFixed(2);

  const massVal = obj.userData.mass ?? 1.0;
  document.getElementById('prop-mass').value = massVal;
  document.getElementById('mass-val-display').innerText = Number(massVal).toFixed(1);

  document.getElementById('prop-fixed').checked = !!obj.userData.fixed;
}

function updateObjectFromInspector(e) {
  if (!selectedObject) return;

  const px = parseFloat(document.getElementById('prop-px').value) || 0;
  const py = parseFloat(document.getElementById('prop-py').value) || 0;
  const pz = parseFloat(document.getElementById('prop-pz').value) || 0;
  selectedObject.position.set(px, py, pz);

  const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-rx').value) || 0);
  const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-ry').value) || 0);
  const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('prop-rz').value) || 0);
  selectedObject.rotation.set(rx, ry, rz);

  const isUniform = document.getElementById('prop-uniform-scale').checked;
  let sx = Math.max(0.1, parseFloat(document.getElementById('prop-sx').value) || 1);
  let sy = Math.max(0.1, parseFloat(document.getElementById('prop-sy').value) || 1);
  let sz = Math.max(0.1, parseFloat(document.getElementById('prop-sz').value) || 1);

  if (isUniform && e && (e.target.id === 'prop-sx' || e.target.id === 'prop-sy' || e.target.id === 'prop-sz')) {
    const val = Math.max(0.1, parseFloat(e.target.value) || 1);
    sx = val;
    sy = val;
    sz = val;
    document.getElementById('prop-sx').value = val.toFixed(2);
    document.getElementById('prop-sy').value = val.toFixed(2);
    document.getElementById('prop-sz').value = val.toFixed(2);
  }

  selectedObject.scale.set(sx, sy, sz);

  const mass = parseFloat(document.getElementById('prop-mass').value) || 1.0;
  selectedObject.userData.mass = mass;
  document.getElementById('mass-val-display').innerText = mass.toFixed(1);

  selectedObject.userData.fixed = document.getElementById('prop-fixed').checked;
}

function checkGoalCondition() {
  if (!isPlaying || !goalHole || isGoalReached) return;

  const candidateBalls = registeredObjects.filter(obj => 
    obj.userData.type === 'startBall' || obj.userData.type === 'sphere'
  );
  const holePos = goalHole.position;

  for (const ball of candidateBalls) {
    const ballPos = ball.position;
    const dist = Math.hypot(ballPos.x - holePos.x, ballPos.z - holePos.z);

    if (dist < 0.65 && ballPos.y < 0.6) {
      isGoalReached = true;

      if (ball.userData.body) {
        const b = ball.userData.body;
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
        b.type = CANNON.Body.STATIC;
        b.updateMassProperties();
      }

      const banner = document.getElementById('goal-banner');
      banner.style.display = 'block';

      if (goalTimeoutId) clearTimeout(goalTimeoutId);
      goalTimeoutId = setTimeout(() => {
        banner.style.display = 'none';
        goalTimeoutId = null;
      }, 3000);
      break;
    }
  }
}

function renderSlotsUI() {
  const slots = loadAllSlots();
  const container = document.getElementById('slots-container');
  container.innerHTML = '';

  slots.forEach(slot => {
    const item = document.createElement('div');
    item.className = 'slot-item';

    const header = document.createElement('div');
    header.className = 'slot-item-header';

    const titleInput = document.createElement('input');
    titleInput.className = 'slot-title-input';
    titleInput.value = slot.name;
    titleInput.addEventListener('change', (e) => {
      updateSlotName(slot.id, e.target.value.trim() || `スロット ${slot.id + 1}`);
    });

    const dateSpan = document.createElement('span');
    dateSpan.className = 'slot-date';
    dateSpan.innerText = slot.updatedAt ? slot.updatedAt : 'データなし';

    header.appendChild(titleInput);
    header.appendChild(dateSpan);

    const actions = document.createElement('div');
    actions.className = 'slot-actions';

    const btnSave = document.createElement('button');
    btnSave.className = 'btn small primary';
    btnSave.innerText = 'ここに保存';
    btnSave.addEventListener('click', () => {
      if (isPlaying) stopSimulation();
      saveSlot(slot.id, titleInput.value, serializeRegisteredObjects(registeredObjects));
      renderSlotsUI();
    });

    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn small';
    btnLoad.innerText = '読み込み';
    btnLoad.disabled = !slot.data;
    btnLoad.addEventListener('click', () => {
      if (isPlaying) stopSimulation();
      recordHistoryState();
      applySnapshotData(slot.data);
      document.getElementById('modal-slots').classList.remove('open');
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn small danger';
    btnDelete.innerText = '削除';
    btnDelete.disabled = !slot.data;
    btnDelete.addEventListener('click', () => {
      deleteSlot(slot.id);
      renderSlotsUI();
    });

    actions.appendChild(btnSave);
    actions.appendChild(btnLoad);
    actions.appendChild(btnDelete);

    item.appendChild(header);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

function panCamera(dx, dy) {
  const factor = 0.8;
  const panOffset = new THREE.Vector3();
  const eye = new THREE.Vector3().subVectors(camera.position, orbit.target);
  
  const right = new THREE.Vector3().crossVectors(camera.up, eye).normalize();
  const up = new THREE.Vector3().clone(camera.up).normalize();

  panOffset.addScaledVector(right, dx * factor);
  panOffset.addScaledVector(up, dy * factor);

  camera.position.add(panOffset);
  orbit.target.add(panOffset);
}

function zoomCamera(delta) {
  const dir = new THREE.Vector3().subVectors(camera.position, orbit.target);
  const currentDist = dir.length();
  const newDist = THREE.MathUtils.clamp(currentDist + delta, 3, 40);
  dir.setLength(newDist);
  camera.position.copy(orbit.target).add(dir);
}

function setCameraPreset(view) {
  const target = orbit.target.clone();
  if (view === 'top') {
    camera.position.set(target.x, target.y + 20, target.z + 0.01);
  } else if (view === 'front') {
    camera.position.set(target.x, target.y + 2, target.z + 18);
  } else if (view === 'side') {
    camera.position.set(target.x + 18, target.y + 2, target.z);
  }
}

function setupCameraWidget() {
  document.getElementById('cam-pan-up').addEventListener('click', () => panCamera(0, 1));
  document.getElementById('cam-pan-down').addEventListener('click', () => panCamera(0, -1));
  document.getElementById('cam-pan-left').addEventListener('click', () => panCamera(-1, 0));
  document.getElementById('cam-pan-right').addEventListener('click', () => panCamera(1, 0));

  document.getElementById('cam-reset').addEventListener('click', () => {
    camera.position.copy(DEFAULT_CAM_POS);
    orbit.target.copy(DEFAULT_CAM_TARGET);
  });

  document.getElementById('cam-zoom-in').addEventListener('click', () => zoomCamera(-2.5));
  document.getElementById('cam-zoom-out').addEventListener('click', () => zoomCamera(2.5));

  document.getElementById('cam-view-top').addEventListener('click', () => setCameraPreset('top'));
  document.getElementById('cam-view-front').addEventListener('click', () => setCameraPreset('front'));
  document.getElementById('cam-view-side').addEventListener('click', () => setCameraPreset('side'));
}

function setupEvents() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (isPlaying) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(registeredObjects, true);
    if (intersects.length > 0) {
      let topObj = intersects[0].object;
      while (topObj.parent && topObj.parent !== scene) {
        topObj = topObj.parent;
      }
      if (topObj !== selectedObject) {
        selectObject(topObj);
      }
    }
  });
}

function setupUIEvents() {
  document.querySelectorAll('.part-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isPlaying) addPart(btn.getAttribute('data-type'));
    });
  });

  document.getElementById('btn-mode-toggle').addEventListener('click', () => {
    if (isPlaying) stopSimulation();
    else startSimulation();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    stopSimulation();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    undo();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (isPlaying) stopSimulation();
    recordHistoryState();
    const itemsToRemove = registeredObjects.filter(o => o !== startBall && o !== goalHole);
    for (const item of itemsToRemove) {
      scene.remove(item);
    }
    registeredObjects = [startBall, goalHole];
    selectObject(null);
  });

  document.getElementById('btn-duplicate').addEventListener('click', () => {
    duplicateSelectedObject();
  });

  document.getElementById('gizmo-trans').addEventListener('click', (e) => {
    setGizmoMode('translate', e.target);
  });
  document.getElementById('gizmo-rot').addEventListener('click', (e) => {
    setGizmoMode('rotate', e.target);
  });
  document.getElementById('gizmo-scale').addEventListener('click', (e) => {
    setGizmoMode('scale', e.target);
  });

  const inputs = document.querySelectorAll('#selection-panel input');
  inputs.forEach(input => {
    input.addEventListener('focus', () => recordHistoryState());
    input.addEventListener('input', updateObjectFromInspector);
  });

  document.getElementById('btn-delete').addEventListener('click', () => {
    if (!selectedObject || selectedObject === startBall || selectedObject === goalHole) return;
    recordHistoryState();
    scene.remove(selectedObject);
    registeredObjects = registeredObjects.filter(o => o !== selectedObject);
    selectObject(null);
  });

  const modalSlots = document.getElementById('modal-slots');
  document.getElementById('btn-slots-open').addEventListener('click', () => {
    renderSlotsUI();
    modalSlots.classList.add('open');
  });
  document.getElementById('btn-slots-close').addEventListener('click', () => {
    modalSlots.classList.remove('open');
  });

  const modalSettings = document.getElementById('modal-settings');
  document.getElementById('btn-settings-open').addEventListener('click', () => {
    modalSettings.classList.add('open');
  });
  document.getElementById('btn-settings-close').addEventListener('click', () => {
    modalSettings.classList.remove('open');
  });

  document.getElementById('shadow-natural').addEventListener('click', (e) => {
    setShadowMode('natural');
    document.getElementById('shadow-topdown').classList.remove('active');
    e.target.classList.add('active');
  });
  document.getElementById('shadow-topdown').addEventListener('click', (e) => {
    setShadowMode('topdown');
    document.getElementById('shadow-natural').classList.remove('active');
    e.target.classList.add('active');
  });
}

function setGizmoMode(mode, targetBtn) {
  transformControl.setMode(mode);
  document.querySelectorAll('.mode-switch .mode-btn').forEach(btn => btn.classList.remove('active'));
  targetBtn.classList.add('active');
}

function animate() {
  requestAnimationFrame(animate);

  if (isPlaying) {
    world.step(1 / 60, 1 / 60, 3);

    for (const obj of registeredObjects) {
      if (obj.userData.body) {
        obj.position.copy(obj.userData.body.position);
        obj.quaternion.copy(obj.userData.body.quaternion);
      }
    }
    checkGoalCondition();
  }

  orbit.update();
  renderer.render(scene, camera);
}
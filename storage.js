const STORAGE_KEY = 'pythagora_machine_slots_v1';
const TOTAL_SLOTS = 5;

export function loadAllSlots() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const initial = [];
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      initial.push({
        id: i,
        name: `スロット ${i + 1}`,
        updatedAt: null,
        data: null
      });
    }
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveAllSlots(slots) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export function saveSlot(slotId, name, serializedObjects) {
  const slots = loadAllSlots();
  const index = slots.findIndex(s => s.id === slotId);
  if (index !== -1) {
    slots[index].name = name;
    slots[index].updatedAt = new Date().toLocaleString('ja-JP');
    slots[index].data = serializedObjects;
    saveAllSlots(slots);
  }
}

export function updateSlotName(slotId, newName) {
  const slots = loadAllSlots();
  const index = slots.findIndex(s => s.id === slotId);
  if (index !== -1) {
    slots[index].name = newName;
    saveAllSlots(slots);
  }
}

export function deleteSlot(slotId) {
  const slots = loadAllSlots();
  const index = slots.findIndex(s => s.id === slotId);
  if (index !== -1) {
    slots[index].updatedAt = null;
    slots[index].data = null;
    saveAllSlots(slots);
  }
}

export function serializeRegisteredObjects(registeredObjects) {
  return registeredObjects.map(obj => ({
    uuid: obj.uuid,
    type: obj.userData.type,
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    fixed: !!obj.userData.fixed,
    locked: !!obj.userData.locked,
    mass: obj.userData.mass ?? 1.0,
    shape: obj.userData.shape,
    size: obj.userData.size ? [...obj.userData.size] : null,
    radius: obj.userData.radius
  }));
}
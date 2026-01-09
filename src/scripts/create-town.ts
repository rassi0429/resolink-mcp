import { ResoniteLinkClient } from '../client.js';

// Convert Euler angles (degrees) to quaternion
function eulerToQuaternion(yaw: number): { x: number; y: number; z: number; w: number } {
  const toRad = Math.PI / 180;
  const cy = Math.cos(yaw * toRad / 2);
  const sy = Math.sin(yaw * toRad / 2);
  return { x: 0, y: sy, z: 0, w: cy };
}

async function createBox(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  smoothness: number = 0.3,
  metallic: number = 0,
  emissive?: { r: number; g: number; b: number }
): Promise<void> {
  await client.addSlot({ parentId, name, position, scale, isActive: true });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return;
  const slotId = slot.id;

  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.BoxCollider' });

  const slotData = await client.getSlot({ slotId, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return;

  const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxMesh');
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
  if (!mesh || !renderer || !material) return;

  await client.updateComponent({ id: renderer.id!, members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any });
  await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any });

  const rendererData = await client.getComponent(renderer.id!);
  if (rendererData.success) {
    const materials = (rendererData.data.members as any)?.Materials;
    if (materials?.elements?.[0]) {
      await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: materials.elements[0].id, targetId: material.id }] } } as any });
    }
  }

  const members: any = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Smoothness: { $type: 'float', value: smoothness },
    Metallic: { $type: 'float', value: metallic },
  };
  if (emissive) members.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  await client.updateComponent({ id: material.id!, members });
}

interface HouseStyle {
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number; // Y-axis rotation in degrees (0 = door facing +Z)
  wallColor: { r: number; g: number; b: number };
  roofColor: { r: number; g: number; b: number };
  doorColor: { r: number; g: number; b: number };
  width: number;
  depth: number;
  height: number;
  hasPorch: boolean;
  hasChimney: boolean;
  hasFence: boolean;
}

async function createHouse(client: ResoniteLinkClient, style: HouseStyle): Promise<void> {
  console.log(`    ${style.name}`);

  const rotation = eulerToQuaternion(style.rotation);
  await client.addSlot({ name: style.name, position: style.position, rotation, isActive: true });
  const house = await client.findSlotByName(style.name, 'Root', 1);
  if (!house?.id) return;
  const houseId = house.id;

  const { wallColor, roofColor, doorColor, width: W, depth: D, height: H } = style;
  const T = 0.15;
  const darkWood = { r: 0.3, g: 0.18, b: 0.1 };
  const lightWood = { r: 0.6, g: 0.42, b: 0.28 };
  const stone = { r: 0.5, g: 0.5, b: 0.48 };
  const glass = { r: 0.7, g: 0.85, b: 0.95 };
  const white = { r: 0.95, g: 0.95, b: 0.95 };
  const warmLight = { r: 1, g: 0.85, b: 0.6 };

  // Foundation & Floor
  await createBox(client, houseId, 'Foundation', { x: 0, y: -0.08, z: 0 }, { x: W + 0.3, y: 0.16, z: D + 0.3 }, stone, 0.25);
  await createBox(client, houseId, 'Floor', { x: 0, y: 0.02, z: 0 }, { x: W - 0.1, y: 0.04, z: D - 0.1 }, lightWood, 0.5);

  // Walls
  await createBox(client, houseId, 'Wall_Front', { x: 0, y: H/2, z: D/2 }, { x: W, y: H, z: T }, wallColor, 0.25);
  await createBox(client, houseId, 'Wall_Back', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, wallColor, 0.25);
  await createBox(client, houseId, 'Wall_Left', { x: -W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, wallColor, 0.25);
  await createBox(client, houseId, 'Wall_Right', { x: W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, wallColor, 0.25);

  // Door
  await createBox(client, houseId, 'Door_Frame', { x: 0, y: 1.3, z: D/2 - 0.02 }, { x: 1.1, y: 2.6, z: 0.1 }, white, 0.45);
  await createBox(client, houseId, 'Door', { x: 0, y: 1.25, z: D/2 - 0.04 }, { x: 0.9, y: 2.3, z: 0.05 }, doorColor, 0.35);

  // Windows
  await createBox(client, houseId, 'Win_FL', { x: -W/2 + 1, y: 1.8, z: D/2 + 0.02 }, { x: 0.8, y: 1, z: 0.06 }, white, 0.5);
  await createBox(client, houseId, 'Win_FL_Glass', { x: -W/2 + 1, y: 1.8, z: D/2 + 0.04 }, { x: 0.65, y: 0.85, z: 0.02 }, glass, 0.95);
  await createBox(client, houseId, 'Win_FR', { x: W/2 - 1, y: 1.8, z: D/2 + 0.02 }, { x: 0.8, y: 1, z: 0.06 }, white, 0.5);
  await createBox(client, houseId, 'Win_FR_Glass', { x: W/2 - 1, y: 1.8, z: D/2 + 0.04 }, { x: 0.65, y: 0.85, z: 0.02 }, glass, 0.95);

  // Roof
  await createBox(client, houseId, 'Roof_L', { x: -W/4 - 0.3, y: H + 0.8, z: 0 }, { x: W/2 + 1, y: 0.1, z: D + 0.5 }, roofColor, 0.3);
  await createBox(client, houseId, 'Roof_R', { x: W/4 + 0.3, y: H + 0.8, z: 0 }, { x: W/2 + 1, y: 0.1, z: D + 0.5 }, roofColor, 0.3);
  await createBox(client, houseId, 'Gable_F', { x: 0, y: H + 0.7, z: D/2 + 0.06 }, { x: W + 0.1, y: 1.4, z: 0.06 }, wallColor, 0.25);
  await createBox(client, houseId, 'Gable_B', { x: 0, y: H + 0.7, z: -D/2 - 0.06 }, { x: W + 0.1, y: 1.4, z: 0.06 }, wallColor, 0.25);

  if (style.hasPorch) {
    await createBox(client, houseId, 'Porch_Floor', { x: 0, y: 0.06, z: D/2 + 0.8 }, { x: W - 0.5, y: 0.12, z: 1.4 }, lightWood, 0.4);
    await createBox(client, houseId, 'Porch_Roof', { x: 0, y: 2.5, z: D/2 + 0.8 }, { x: W - 0.3, y: 0.08, z: 1.6 }, roofColor, 0.3);
  }

  if (style.hasChimney) {
    await createBox(client, houseId, 'Chimney', { x: W/4, y: H + 1.8, z: -D/4 }, { x: 0.5, y: 1.2, z: 0.5 }, { r: 0.55, g: 0.3, b: 0.2 }, 0.2);
  }

  if (style.hasFence) {
    for (let i = 0; i < 5; i++) {
      await createBox(client, houseId, `Fence_${i}`, { x: -W/2 + i * W/4, y: 0.35, z: D/2 + 2 }, { x: 0.05, y: 0.7, z: 0.05 }, white, 0.45);
    }
    await createBox(client, houseId, 'Fence_Rail', { x: 0, y: 0.5, z: D/2 + 2 }, { x: W, y: 0.04, z: 0.04 }, white, 0.45);
  }

  await createBox(client, houseId, 'Light', { x: 0, y: H - 0.3, z: 0 }, { x: 0.25, y: 0.12, z: 0.25 }, warmLight, 0.2, 0, warmLight);
}

// === CAR ===
async function createCar(client: ResoniteLinkClient, parentId: string, position: {x: number, y: number, z: number}, rotationDeg: number, color: {r: number, g: number, b: number}, name: string): Promise<void> {
  const rotation = eulerToQuaternion(rotationDeg);
  await client.addSlot({ parentId, name, position, rotation, isActive: true });
  const car = await client.findSlotByName(name, parentId, 1);
  if (!car?.id) return;
  const carId = car.id;

  const black = { r: 0.05, g: 0.05, b: 0.05 };
  const glass = { r: 0.6, g: 0.7, b: 0.8 };
  const chrome = { r: 0.8, g: 0.8, b: 0.82 };

  // Body
  await createBox(client, carId, 'Body', { x: 0, y: 0.5, z: 0 }, { x: 1.8, y: 0.5, z: 4 }, color, 0.7);
  await createBox(client, carId, 'Cabin', { x: 0, y: 0.9, z: -0.3 }, { x: 1.6, y: 0.5, z: 2 }, color, 0.7);

  // Windows
  await createBox(client, carId, 'Windshield', { x: 0, y: 0.9, z: 0.75 }, { x: 1.4, y: 0.4, z: 0.05 }, glass, 0.95);
  await createBox(client, carId, 'RearWindow', { x: 0, y: 0.9, z: -1.25 }, { x: 1.4, y: 0.4, z: 0.05 }, glass, 0.95);
  await createBox(client, carId, 'SideWin_L', { x: -0.82, y: 0.9, z: -0.3 }, { x: 0.05, y: 0.35, z: 1.5 }, glass, 0.95);
  await createBox(client, carId, 'SideWin_R', { x: 0.82, y: 0.9, z: -0.3 }, { x: 0.05, y: 0.35, z: 1.5 }, glass, 0.95);

  // Wheels
  await createBox(client, carId, 'Wheel_FL', { x: -0.85, y: 0.3, z: 1.2 }, { x: 0.2, y: 0.6, z: 0.6 }, black, 0.3);
  await createBox(client, carId, 'Wheel_FR', { x: 0.85, y: 0.3, z: 1.2 }, { x: 0.2, y: 0.6, z: 0.6 }, black, 0.3);
  await createBox(client, carId, 'Wheel_BL', { x: -0.85, y: 0.3, z: -1.2 }, { x: 0.2, y: 0.6, z: 0.6 }, black, 0.3);
  await createBox(client, carId, 'Wheel_BR', { x: 0.85, y: 0.3, z: -1.2 }, { x: 0.2, y: 0.6, z: 0.6 }, black, 0.3);

  // Hubcaps
  await createBox(client, carId, 'Hub_FL', { x: -0.96, y: 0.3, z: 1.2 }, { x: 0.02, y: 0.35, z: 0.35 }, chrome, 0.85, 0.9);
  await createBox(client, carId, 'Hub_FR', { x: 0.96, y: 0.3, z: 1.2 }, { x: 0.02, y: 0.35, z: 0.35 }, chrome, 0.85, 0.9);
  await createBox(client, carId, 'Hub_BL', { x: -0.96, y: 0.3, z: -1.2 }, { x: 0.02, y: 0.35, z: 0.35 }, chrome, 0.85, 0.9);
  await createBox(client, carId, 'Hub_BR', { x: 0.96, y: 0.3, z: -1.2 }, { x: 0.02, y: 0.35, z: 0.35 }, chrome, 0.85, 0.9);

  // Headlights
  await createBox(client, carId, 'Headlight_L', { x: -0.6, y: 0.5, z: 2.02 }, { x: 0.3, y: 0.15, z: 0.05 }, { r: 1, g: 1, b: 0.9 }, 0.9, 0, { r: 1, g: 1, b: 0.8 });
  await createBox(client, carId, 'Headlight_R', { x: 0.6, y: 0.5, z: 2.02 }, { x: 0.3, y: 0.15, z: 0.05 }, { r: 1, g: 1, b: 0.9 }, 0.9, 0, { r: 1, g: 1, b: 0.8 });

  // Taillights
  await createBox(client, carId, 'Taillight_L', { x: -0.7, y: 0.5, z: -2.02 }, { x: 0.25, y: 0.1, z: 0.05 }, { r: 0.8, g: 0.1, b: 0.1 }, 0.7, 0, { r: 0.5, g: 0, b: 0 });
  await createBox(client, carId, 'Taillight_R', { x: 0.7, y: 0.5, z: -2.02 }, { x: 0.25, y: 0.1, z: 0.05 }, { r: 0.8, g: 0.1, b: 0.1 }, 0.7, 0, { r: 0.5, g: 0, b: 0 });

  // Grille
  await createBox(client, carId, 'Grille', { x: 0, y: 0.4, z: 2.01 }, { x: 0.8, y: 0.2, z: 0.02 }, { r: 0.15, g: 0.15, b: 0.15 }, 0.4);

  // Mirrors
  await createBox(client, carId, 'Mirror_L', { x: -0.95, y: 0.85, z: 0.5 }, { x: 0.15, y: 0.1, z: 0.08 }, black, 0.5);
  await createBox(client, carId, 'Mirror_R', { x: 0.95, y: 0.85, z: 0.5 }, { x: 0.15, y: 0.1, z: 0.08 }, black, 0.5);
}

// === SHOP/STORE ===
async function createShop(client: ResoniteLinkClient, position: {x: number, y: number, z: number}, rotationDeg: number, name: string, signColor: {r: number, g: number, b: number}): Promise<void> {
  console.log(`    ${name}`);
  const rotation = eulerToQuaternion(rotationDeg);
  await client.addSlot({ name, position, rotation, isActive: true });
  const shop = await client.findSlotByName(name, 'Root', 1);
  if (!shop?.id) return;
  const shopId = shop.id;

  const brick = { r: 0.6, g: 0.35, b: 0.25 };
  const glass = { r: 0.65, g: 0.8, b: 0.9 };
  const white = { r: 0.95, g: 0.95, b: 0.95 };
  const darkWood = { r: 0.3, g: 0.2, b: 0.12 };

  // Building
  await createBox(client, shopId, 'Building', { x: 0, y: 2, z: 0 }, { x: 8, y: 4, z: 6 }, brick, 0.2);
  await createBox(client, shopId, 'Foundation', { x: 0, y: -0.05, z: 0 }, { x: 8.2, y: 0.1, z: 6.2 }, { r: 0.4, g: 0.4, b: 0.42 }, 0.3);

  // Storefront windows
  await createBox(client, shopId, 'Window_L', { x: -2, y: 1.5, z: 3.02 }, { x: 2.5, y: 2.5, z: 0.05 }, glass, 0.95);
  await createBox(client, shopId, 'Window_R', { x: 2, y: 1.5, z: 3.02 }, { x: 2.5, y: 2.5, z: 0.05 }, glass, 0.95);
  await createBox(client, shopId, 'Window_Frame_L', { x: -2, y: 1.5, z: 3.04 }, { x: 2.6, y: 2.6, z: 0.08 }, darkWood, 0.4);
  await createBox(client, shopId, 'Window_Frame_R', { x: 2, y: 1.5, z: 3.04 }, { x: 2.6, y: 2.6, z: 0.08 }, darkWood, 0.4);

  // Door
  await createBox(client, shopId, 'Door', { x: 0, y: 1.3, z: 3.02 }, { x: 1.2, y: 2.6, z: 0.06 }, glass, 0.9);
  await createBox(client, shopId, 'Door_Frame', { x: 0, y: 1.3, z: 3.04 }, { x: 1.4, y: 2.8, z: 0.08 }, darkWood, 0.4);
  await createBox(client, shopId, 'Door_Handle', { x: 0.5, y: 1.2, z: 3.08 }, { x: 0.08, y: 0.3, z: 0.04 }, { r: 0.75, g: 0.7, b: 0.4 }, 0.8, 0.9);

  // Awning
  await createBox(client, shopId, 'Awning', { x: 0, y: 3.2, z: 4 }, { x: 7.5, y: 0.08, z: 2 }, signColor, 0.25);
  await createBox(client, shopId, 'Awning_Front', { x: 0, y: 3, z: 5 }, { x: 7.5, y: 0.4, z: 0.1 }, signColor, 0.25);

  // Sign
  await createBox(client, shopId, 'Sign_Board', { x: 0, y: 3.8, z: 3.1 }, { x: 4, y: 0.8, z: 0.1 }, white, 0.4);
  await createBox(client, shopId, 'Sign_Frame', { x: 0, y: 3.8, z: 3.08 }, { x: 4.2, y: 0.9, z: 0.06 }, darkWood, 0.4);

  // Roof details
  await createBox(client, shopId, 'Roof_Edge', { x: 0, y: 4.05, z: 0 }, { x: 8.3, y: 0.15, z: 6.3 }, { r: 0.45, g: 0.45, b: 0.48 }, 0.3);
  await createBox(client, shopId, 'Roof_Top', { x: 0, y: 4.2, z: 0 }, { x: 8, y: 0.1, z: 6 }, { r: 0.35, g: 0.35, b: 0.38 }, 0.25);

  // AC unit on roof
  await createBox(client, shopId, 'AC_Unit', { x: 2, y: 4.5, z: -1 }, { x: 1.2, y: 0.6, z: 0.8 }, { r: 0.85, g: 0.85, b: 0.87 }, 0.5);

  // Entrance light
  await createBox(client, shopId, 'Entrance_Light', { x: 0, y: 2.9, z: 3.3 }, { x: 0.4, y: 0.2, z: 0.2 }, { r: 1, g: 0.95, b: 0.85 }, 0.5, 0, { r: 1, g: 0.9, b: 0.7 });
}

// === TRAFFIC LIGHT ===
async function createTrafficLight(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Pole`, { x: position.x, y: 1.8, z: position.z }, { x: 0.12, y: 3.6, z: 0.12 }, { r: 0.25, g: 0.25, b: 0.28 }, 0.5, 0.7);
  await createBox(client, parentId, `${name}_Arm`, { x: position.x + 1.5, y: 3.5, z: position.z }, { x: 3, y: 0.1, z: 0.1 }, { r: 0.25, g: 0.25, b: 0.28 }, 0.5, 0.7);
  await createBox(client, parentId, `${name}_Box`, { x: position.x + 2.5, y: 3, z: position.z }, { x: 0.4, y: 1, z: 0.3 }, { r: 0.2, g: 0.2, b: 0.22 }, 0.4);
  // Lights
  await createBox(client, parentId, `${name}_Red`, { x: position.x + 2.5, y: 3.3, z: position.z + 0.16 }, { x: 0.2, y: 0.2, z: 0.02 }, { r: 0.3, g: 0.05, b: 0.05 }, 0.6);
  await createBox(client, parentId, `${name}_Yellow`, { x: position.x + 2.5, y: 3, z: position.z + 0.16 }, { x: 0.2, y: 0.2, z: 0.02 }, { r: 0.3, g: 0.25, b: 0.05 }, 0.6);
  await createBox(client, parentId, `${name}_Green`, { x: position.x + 2.5, y: 2.7, z: position.z + 0.16 }, { x: 0.2, y: 0.2, z: 0.02 }, { r: 0.05, g: 0.5, b: 0.1 }, 0.6, 0, { r: 0, g: 0.4, b: 0.05 });
}

// === STOP SIGN ===
async function createStopSign(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Pole`, { x: position.x, y: 1.2, z: position.z }, { x: 0.06, y: 2.4, z: 0.06 }, { r: 0.6, g: 0.6, b: 0.62 }, 0.5, 0.8);
  await createBox(client, parentId, `${name}_Sign`, { x: position.x, y: 2.3, z: position.z + 0.04 }, { x: 0.5, y: 0.5, z: 0.03 }, { r: 0.8, g: 0.1, b: 0.1 }, 0.4);
  await createBox(client, parentId, `${name}_Border`, { x: position.x, y: 2.3, z: position.z + 0.05 }, { x: 0.45, y: 0.45, z: 0.02 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.4);
}

// === STREET LIGHT ===
async function createStreetLight(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Pole`, { x: position.x, y: 2, z: position.z }, { x: 0.1, y: 4, z: 0.1 }, { r: 0.2, g: 0.2, b: 0.22 }, 0.5, 0.8);
  await createBox(client, parentId, `${name}_Arm`, { x: position.x + 0.4, y: 3.9, z: position.z }, { x: 0.8, y: 0.06, z: 0.06 }, { r: 0.2, g: 0.2, b: 0.22 }, 0.5, 0.8);
  await createBox(client, parentId, `${name}_Lamp`, { x: position.x + 0.7, y: 3.75, z: position.z }, { x: 0.35, y: 0.25, z: 0.35 }, { r: 1, g: 0.95, b: 0.85 }, 0.4, 0, { r: 1, g: 0.9, b: 0.7 });
}

// === FIRE HYDRANT ===
async function createFireHydrant(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Body`, { x: position.x, y: 0.3, z: position.z }, { x: 0.2, y: 0.6, z: 0.2 }, { r: 0.8, g: 0.15, b: 0.1 }, 0.5);
  await createBox(client, parentId, `${name}_Top`, { x: position.x, y: 0.65, z: position.z }, { x: 0.15, y: 0.1, z: 0.15 }, { r: 0.8, g: 0.15, b: 0.1 }, 0.5);
  await createBox(client, parentId, `${name}_Valve`, { x: position.x + 0.12, y: 0.35, z: position.z }, { x: 0.08, y: 0.08, z: 0.12 }, { r: 0.8, g: 0.15, b: 0.1 }, 0.5);
}

// === TRASH CAN ===
async function createTrashCan(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Body`, { x: position.x, y: 0.4, z: position.z }, { x: 0.4, y: 0.8, z: 0.4 }, { r: 0.2, g: 0.35, b: 0.2 }, 0.3);
  await createBox(client, parentId, `${name}_Lid`, { x: position.x, y: 0.85, z: position.z }, { x: 0.45, y: 0.08, z: 0.45 }, { r: 0.25, g: 0.4, b: 0.25 }, 0.35);
}

// === BUS STOP ===
async function createBusStop(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Pole_L`, { x: position.x - 1, y: 1.4, z: position.z }, { x: 0.08, y: 2.8, z: 0.08 }, { r: 0.25, g: 0.25, b: 0.28 }, 0.5, 0.7);
  await createBox(client, parentId, `${name}_Pole_R`, { x: position.x + 1, y: 1.4, z: position.z }, { x: 0.08, y: 2.8, z: 0.08 }, { r: 0.25, g: 0.25, b: 0.28 }, 0.5, 0.7);
  await createBox(client, parentId, `${name}_Roof`, { x: position.x, y: 2.9, z: position.z }, { x: 2.4, y: 0.08, z: 1.2 }, { r: 0.3, g: 0.5, b: 0.7 }, 0.5);
  await createBox(client, parentId, `${name}_Back`, { x: position.x, y: 1.4, z: position.z - 0.55 }, { x: 2.2, y: 2.6, z: 0.05 }, { r: 0.7, g: 0.8, b: 0.9 }, 0.8);
  await createBox(client, parentId, `${name}_Bench`, { x: position.x, y: 0.45, z: position.z - 0.3 }, { x: 1.8, y: 0.08, z: 0.4 }, { r: 0.45, g: 0.3, b: 0.2 }, 0.4);
  await createBox(client, parentId, `${name}_Sign`, { x: position.x - 1, y: 2.5, z: position.z + 0.2 }, { x: 0.4, y: 0.3, z: 0.05 }, { r: 0.2, g: 0.4, b: 0.7 }, 0.4);
}

// === MAILBOX ===
async function createMailbox(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  await createBox(client, parentId, `${name}_Post`, { x: position.x, y: 0.5, z: position.z }, { x: 0.08, y: 1, z: 0.08 }, { r: 0.3, g: 0.2, b: 0.15 }, 0.35);
  await createBox(client, parentId, `${name}_Box`, { x: position.x, y: 1.05, z: position.z }, { x: 0.25, y: 0.2, z: 0.35 }, { r: 0.15, g: 0.25, b: 0.45 }, 0.4);
}

// === TREE ===
async function createTree(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  const height = 1.5 + Math.random() * 1.5;
  await createBox(client, parentId, `${name}_Trunk`, { x: position.x, y: height/2, z: position.z }, { x: 0.25, y: height, z: 0.25 }, { r: 0.4, g: 0.25, b: 0.15 }, 0.25);
  await createBox(client, parentId, `${name}_L1`, { x: position.x, y: height + 0.5, z: position.z }, { x: 1.4, y: 1, z: 1.4 }, { r: 0.15, g: 0.4, b: 0.12 }, 0.2);
  await createBox(client, parentId, `${name}_L2`, { x: position.x, y: height + 1.2, z: position.z }, { x: 1, y: 0.8, z: 1 }, { r: 0.18, g: 0.45, b: 0.15 }, 0.2);
  await createBox(client, parentId, `${name}_L3`, { x: position.x, y: height + 1.7, z: position.z }, { x: 0.6, y: 0.5, z: 0.6 }, { r: 0.2, g: 0.5, b: 0.18 }, 0.2);
}

// === ROAD with sidewalks ===
async function createRoad(client: ResoniteLinkClient, parentId: string, start: {x: number, z: number}, end: {x: number, z: number}, name: string): Promise<void> {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const cx = (start.x + end.x) / 2;
  const cz = (start.z + end.z) / 2;
  const isHorizontal = Math.abs(dx) > Math.abs(dz);

  // Asphalt
  await createBox(client, parentId, name, { x: cx, y: 0.01, z: cz },
    { x: isHorizontal ? length : 6, y: 0.02, z: isHorizontal ? 6 : length },
    { r: 0.2, g: 0.2, b: 0.22 }, 0.15);

  // Center line
  await createBox(client, parentId, `${name}_CLine`, { x: cx, y: 0.02, z: cz },
    { x: isHorizontal ? length - 2 : 0.12, y: 0.01, z: isHorizontal ? 0.12 : length - 2 },
    { r: 0.9, g: 0.8, b: 0.3 }, 0.25);

  // Edge lines
  const edgeOffset = 2.5;
  if (isHorizontal) {
    await createBox(client, parentId, `${name}_Edge1`, { x: cx, y: 0.02, z: cz - edgeOffset },
      { x: length - 2, y: 0.01, z: 0.1 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
    await createBox(client, parentId, `${name}_Edge2`, { x: cx, y: 0.02, z: cz + edgeOffset },
      { x: length - 2, y: 0.01, z: 0.1 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
  } else {
    await createBox(client, parentId, `${name}_Edge1`, { x: cx - edgeOffset, y: 0.02, z: cz },
      { x: 0.1, y: 0.01, z: length - 2 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
    await createBox(client, parentId, `${name}_Edge2`, { x: cx + edgeOffset, y: 0.02, z: cz },
      { x: 0.1, y: 0.01, z: length - 2 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
  }

  // Sidewalks
  const sidewalkOffset = 3.5;
  if (isHorizontal) {
    await createBox(client, parentId, `${name}_SW1`, { x: cx, y: 0.08, z: cz - sidewalkOffset },
      { x: length, y: 0.16, z: 1.5 }, { r: 0.65, g: 0.65, b: 0.68 }, 0.25);
    await createBox(client, parentId, `${name}_SW2`, { x: cx, y: 0.08, z: cz + sidewalkOffset },
      { x: length, y: 0.16, z: 1.5 }, { r: 0.65, g: 0.65, b: 0.68 }, 0.25);
  } else {
    await createBox(client, parentId, `${name}_SW1`, { x: cx - sidewalkOffset, y: 0.08, z: cz },
      { x: 1.5, y: 0.16, z: length }, { r: 0.65, g: 0.65, b: 0.68 }, 0.25);
    await createBox(client, parentId, `${name}_SW2`, { x: cx + sidewalkOffset, y: 0.08, z: cz },
      { x: 1.5, y: 0.16, z: length }, { r: 0.65, g: 0.65, b: 0.68 }, 0.25);
  }
}

// === CROSSWALK ===
async function createCrosswalk(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, isHorizontal: boolean, name: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if (isHorizontal) {
      await createBox(client, parentId, `${name}_${i}`, { x: position.x - 2.2 + i * 0.9, y: 0.02, z: position.z },
        { x: 0.5, y: 0.01, z: 4 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
    } else {
      await createBox(client, parentId, `${name}_${i}`, { x: position.x, y: 0.02, z: position.z - 2.2 + i * 0.9 },
        { x: 4, y: 0.01, z: 0.5 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
    }
  }
}

// === PARKING LOT ===
async function createParkingLot(client: ResoniteLinkClient, parentId: string, position: {x: number, z: number}, name: string): Promise<void> {
  // Ground
  await createBox(client, parentId, `${name}_Ground`, { x: position.x, y: 0.01, z: position.z },
    { x: 12, y: 0.02, z: 8 }, { r: 0.22, g: 0.22, b: 0.25 }, 0.15);

  // Parking lines
  for (let i = 0; i < 5; i++) {
    await createBox(client, parentId, `${name}_Line${i}`, { x: position.x - 4.5 + i * 2.5, y: 0.02, z: position.z },
      { x: 0.1, y: 0.01, z: 5 }, { r: 0.95, g: 0.95, b: 0.95 }, 0.25);
  }
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('🏘️ Creating Complete Town...\n');

    // === HOUSES (10 total) ===
    // Road_H1 at z=-8, Road_H2 at z=8, Road_H3 at z=28
    // Row A (z=-18) faces +Z toward Road_H1 -> rotation 0
    // Row B (z=18) faces -Z toward Road_H2 -> rotation 180
    // Row C (z=38) faces -Z toward Road_H3 -> rotation 180
    console.log('  Building houses...');
    const houses: HouseStyle[] = [
      { name: 'House_A1', position: { x: -22, y: 0, z: -18 }, rotation: 0, wallColor: { r: 0.95, g: 0.9, b: 0.8 }, roofColor: { r: 0.6, g: 0.2, b: 0.15 }, doorColor: { r: 0.5, g: 0.25, b: 0.1 }, width: 5, depth: 6, height: 3, hasPorch: true, hasChimney: true, hasFence: false },
      { name: 'House_A2', position: { x: -10, y: 0, z: -18 }, rotation: 0, wallColor: { r: 0.9, g: 0.92, b: 0.95 }, roofColor: { r: 0.2, g: 0.3, b: 0.45 }, doorColor: { r: 0.15, g: 0.4, b: 0.2 }, width: 6, depth: 7, height: 3.5, hasPorch: false, hasChimney: true, hasFence: true },
      { name: 'House_A3', position: { x: 10, y: 0, z: -18 }, rotation: 0, wallColor: { r: 0.85, g: 0.9, b: 0.85 }, roofColor: { r: 0.25, g: 0.4, b: 0.25 }, doorColor: { r: 0.6, g: 0.15, b: 0.1 }, width: 5.5, depth: 6.5, height: 3.2, hasPorch: true, hasChimney: false, hasFence: true },
      { name: 'House_A4', position: { x: 22, y: 0, z: -18 }, rotation: 0, wallColor: { r: 0.92, g: 0.88, b: 0.82 }, roofColor: { r: 0.45, g: 0.25, b: 0.2 }, doorColor: { r: 0.2, g: 0.25, b: 0.5 }, width: 5, depth: 6, height: 3, hasPorch: true, hasChimney: true, hasFence: false },
      { name: 'House_B1', position: { x: -22, y: 0, z: 18 }, rotation: 180, wallColor: { r: 0.95, g: 0.95, b: 0.9 }, roofColor: { r: 0.5, g: 0.3, b: 0.2 }, doorColor: { r: 0.2, g: 0.35, b: 0.5 }, width: 5, depth: 6, height: 3, hasPorch: true, hasChimney: true, hasFence: false },
      { name: 'House_B2', position: { x: -10, y: 0, z: 18 }, rotation: 180, wallColor: { r: 0.88, g: 0.92, b: 0.95 }, roofColor: { r: 0.15, g: 0.25, b: 0.4 }, doorColor: { r: 0.7, g: 0.2, b: 0.15 }, width: 6, depth: 7, height: 3.5, hasPorch: true, hasChimney: true, hasFence: false },
      { name: 'House_B3', position: { x: 10, y: 0, z: 18 }, rotation: 180, wallColor: { r: 0.95, g: 0.92, b: 0.85 }, roofColor: { r: 0.35, g: 0.2, b: 0.15 }, doorColor: { r: 0.25, g: 0.3, b: 0.5 }, width: 5, depth: 6, height: 3, hasPorch: false, hasChimney: true, hasFence: true },
      { name: 'House_B4', position: { x: 22, y: 0, z: 18 }, rotation: 180, wallColor: { r: 0.9, g: 0.95, b: 0.9 }, roofColor: { r: 0.2, g: 0.35, b: 0.2 }, doorColor: { r: 0.55, g: 0.35, b: 0.2 }, width: 5.5, depth: 6.5, height: 3.3, hasPorch: true, hasChimney: false, hasFence: false },
      { name: 'House_C1', position: { x: -22, y: 0, z: 38 }, rotation: 180, wallColor: { r: 0.95, g: 0.85, b: 0.8 }, roofColor: { r: 0.55, g: 0.25, b: 0.2 }, doorColor: { r: 0.4, g: 0.55, b: 0.4 }, width: 5.5, depth: 6, height: 3.2, hasPorch: true, hasChimney: false, hasFence: true },
      { name: 'House_C2', position: { x: 22, y: 0, z: 38 }, rotation: 180, wallColor: { r: 0.9, g: 0.85, b: 0.8 }, roofColor: { r: 0.5, g: 0.3, b: 0.2 }, doorColor: { r: 0.15, g: 0.35, b: 0.45 }, width: 5, depth: 5.5, height: 3, hasPorch: false, hasChimney: true, hasFence: true },
    ];

    for (const house of houses) {
      await createHouse(client, house);
    }

    // === SHOPS ===
    // Shops at z=38 face -Z toward Road_H3 -> rotation 180
    console.log('\n  Building shops...');
    await createShop(client, { x: -10, y: 0, z: 38 }, 180, 'Cafe', { r: 0.6, g: 0.3, b: 0.2 });
    await createShop(client, { x: 0, y: 0, z: 38 }, 180, 'Grocery', { r: 0.2, g: 0.5, b: 0.3 });
    await createShop(client, { x: 10, y: 0, z: 38 }, 180, 'Bookstore', { r: 0.3, g: 0.35, b: 0.5 });

    // === INFRASTRUCTURE ===
    console.log('\n  Creating infrastructure...');
    await client.addSlot({ name: 'Town_Infra', position: { x: 0, y: 0, z: 0 }, isActive: true });
    const infra = await client.findSlotByName('Town_Infra', 'Root', 1);
    if (!infra?.id) return;
    const infraId = infra.id;

    // === ROADS ===
    console.log('    Roads...');
    // Main horizontal roads
    await createRoad(client, infraId, { x: -30, z: -8 }, { x: 30, z: -8 }, 'Road_H1');
    await createRoad(client, infraId, { x: -30, z: 8 }, { x: 30, z: 8 }, 'Road_H2');
    await createRoad(client, infraId, { x: -30, z: 28 }, { x: 30, z: 28 }, 'Road_H3');

    // Vertical roads
    await createRoad(client, infraId, { x: -16, z: -12 }, { x: -16, z: 45 }, 'Road_V1');
    await createRoad(client, infraId, { x: 0, z: -12 }, { x: 0, z: 45 }, 'Road_V2');
    await createRoad(client, infraId, { x: 16, z: -12 }, { x: 16, z: 45 }, 'Road_V3');

    // === CROSSWALKS ===
    console.log('    Crosswalks...');
    await createCrosswalk(client, infraId, { x: -16, z: -8 }, false, 'CW1');
    await createCrosswalk(client, infraId, { x: 0, z: -8 }, false, 'CW2');
    await createCrosswalk(client, infraId, { x: 16, z: -8 }, false, 'CW3');
    await createCrosswalk(client, infraId, { x: -16, z: 8 }, false, 'CW4');
    await createCrosswalk(client, infraId, { x: 0, z: 8 }, false, 'CW5');
    await createCrosswalk(client, infraId, { x: 16, z: 8 }, false, 'CW6');

    // === TRAFFIC LIGHTS ===
    console.log('    Traffic lights...');
    await createTrafficLight(client, infraId, { x: -18, z: -10 }, 'TL1');
    await createTrafficLight(client, infraId, { x: 2, z: -10 }, 'TL2');
    await createTrafficLight(client, infraId, { x: -18, z: 6 }, 'TL3');
    await createTrafficLight(client, infraId, { x: 18, z: 6 }, 'TL4');

    // === STOP SIGNS ===
    console.log('    Stop signs...');
    await createStopSign(client, infraId, { x: 14, z: -10 }, 'Stop1');
    await createStopSign(client, infraId, { x: -2, z: 10 }, 'Stop2');
    await createStopSign(client, infraId, { x: 14, z: 26 }, 'Stop3');

    // === STREET LIGHTS ===
    console.log('    Street lights...');
    const streetLightPos = [
      { x: -24, z: -8 }, { x: -8, z: -8 }, { x: 8, z: -8 }, { x: 24, z: -8 },
      { x: -24, z: 8 }, { x: -8, z: 8 }, { x: 8, z: 8 }, { x: 24, z: 8 },
      { x: -24, z: 28 }, { x: -8, z: 28 }, { x: 8, z: 28 }, { x: 24, z: 28 },
      { x: -16, z: -2 }, { x: -16, z: 18 }, { x: 0, z: -2 }, { x: 0, z: 18 },
      { x: 16, z: -2 }, { x: 16, z: 18 },
    ];
    for (let i = 0; i < streetLightPos.length; i++) {
      await createStreetLight(client, infraId, streetLightPos[i], `SL${i}`);
    }

    // === CARS ===
    // Horizontal roads (z=-8, 8, 28): cars face +X (90) or -X (270)
    // Vertical roads (x=-16, 0, 16): cars face +Z (0) or -Z (180)
    console.log('    Cars...');
    const carData = [
      // On Road_H1 (z=-8), facing +X or -X
      { pos: { x: -20, y: 0, z: -6 }, rot: 90, color: { r: 0.8, g: 0.15, b: 0.1 } },
      { pos: { x: -12, y: 0, z: -10 }, rot: 270, color: { r: 0.1, g: 0.3, b: 0.7 } },
      { pos: { x: 5, y: 0, z: -6 }, rot: 90, color: { r: 0.15, g: 0.15, b: 0.15 } },
      { pos: { x: 20, y: 0, z: -10 }, rot: 270, color: { r: 0.95, g: 0.95, b: 0.95 } },
      // On Road_H2 (z=8), facing +X or -X
      { pos: { x: -20, y: 0, z: 6 }, rot: 90, color: { r: 0.2, g: 0.5, b: 0.2 } },
      { pos: { x: -6, y: 0, z: 10 }, rot: 270, color: { r: 0.6, g: 0.4, b: 0.1 } },
      { pos: { x: 12, y: 0, z: 6 }, rot: 90, color: { r: 0.5, g: 0.1, b: 0.4 } },
      // On Road_H3 (z=28), facing +X or -X
      { pos: { x: -8, y: 0, z: 26 }, rot: 90, color: { r: 0.1, g: 0.6, b: 0.6 } },
      { pos: { x: 8, y: 0, z: 30 }, rot: 270, color: { r: 0.7, g: 0.7, b: 0.72 } },
    ];
    for (let i = 0; i < carData.length; i++) {
      await createCar(client, infraId, carData[i].pos, carData[i].rot, carData[i].color, `Car${i}`);
    }

    // === PARKING LOT ===
    console.log('    Parking lot...');
    await createParkingLot(client, infraId, { x: 0, z: 0 }, 'Parking');
    // Cars in parking
    await createCar(client, infraId, { x: -3, y: 0, z: 0 }, 90, { r: 0.3, g: 0.3, b: 0.6 }, 'ParkedCar1');
    await createCar(client, infraId, { x: 2, y: 0, z: 0 }, 90, { r: 0.6, g: 0.2, b: 0.2 }, 'ParkedCar2');

    // === BUS STOPS ===
    console.log('    Bus stops...');
    await createBusStop(client, infraId, { x: -24, z: 4 }, 'BusStop1');
    await createBusStop(client, infraId, { x: 24, z: 12 }, 'BusStop2');

    // === FIRE HYDRANTS ===
    console.log('    Fire hydrants...');
    const hydrantPos = [{ x: -26, z: -5 }, { x: 26, z: -5 }, { x: -26, z: 11 }, { x: 26, z: 25 }];
    for (let i = 0; i < hydrantPos.length; i++) {
      await createFireHydrant(client, infraId, hydrantPos[i], `Hydrant${i}`);
    }

    // === TRASH CANS ===
    console.log('    Trash cans...');
    const trashPos = [{ x: -20, z: 4 }, { x: 20, z: 4 }, { x: -20, z: 12 }, { x: 20, z: 24 }, { x: 0, z: 32 }];
    for (let i = 0; i < trashPos.length; i++) {
      await createTrashCan(client, infraId, trashPos[i], `Trash${i}`);
    }

    // === MAILBOXES ===
    console.log('    Mailboxes...');
    const mailboxPos = [{ x: -18, z: -12 }, { x: -6, z: -12 }, { x: 14, z: -12 }, { x: -18, z: 24 }, { x: 26, z: 24 }];
    for (let i = 0; i < mailboxPos.length; i++) {
      await createMailbox(client, infraId, mailboxPos[i], `Mailbox${i}`);
    }

    // === TREES ===
    console.log('    Trees...');
    const treePos = [
      { x: -26, z: -15 }, { x: -26, z: 0 }, { x: -26, z: 15 }, { x: -26, z: 35 },
      { x: 26, z: -15 }, { x: 26, z: 0 }, { x: 26, z: 15 }, { x: 26, z: 35 },
      { x: -5, z: -2 }, { x: 5, z: -2 }, { x: -5, z: 2 }, { x: 5, z: 2 },
      { x: -28, z: -18 }, { x: 28, z: -18 }, { x: -28, z: 38 }, { x: 28, z: 38 },
    ];
    for (let i = 0; i < treePos.length; i++) {
      await createTree(client, infraId, treePos[i], `Tree${i}`);
    }

    // === CENTRAL PARK ===
    console.log('    Central park...');
    // Grass
    await createBox(client, infraId, 'Park_Grass', { x: 0, y: 0.02, z: 0 }, { x: 10, y: 0.04, z: 6 }, { r: 0.25, g: 0.5, b: 0.2 }, 0.15);
    // Fountain
    await createBox(client, infraId, 'Fountain_Base', { x: 0, y: 0.25, z: 0 }, { x: 2.5, y: 0.5, z: 2.5 }, { r: 0.55, g: 0.55, b: 0.58 }, 0.5);
    await createBox(client, infraId, 'Fountain_Water', { x: 0, y: 0.55, z: 0 }, { x: 2, y: 0.1, z: 2 }, { r: 0.3, g: 0.5, b: 0.7 }, 0.95);
    await createBox(client, infraId, 'Fountain_Center', { x: 0, y: 0.85, z: 0 }, { x: 0.5, y: 0.7, z: 0.5 }, { r: 0.5, g: 0.5, b: 0.52 }, 0.5);
    await createBox(client, infraId, 'Fountain_Spray', { x: 0, y: 1.5, z: 0 }, { x: 0.15, y: 0.8, z: 0.15 }, { r: 0.6, g: 0.8, b: 0.95 }, 0.9, 0, { r: 0.5, g: 0.7, b: 0.9 });
    // Benches
    await createBox(client, infraId, 'Bench1_Seat', { x: -3.5, y: 0.4, z: 0 }, { x: 1.2, y: 0.08, z: 0.45 }, { r: 0.45, g: 0.3, b: 0.18 }, 0.35);
    await createBox(client, infraId, 'Bench1_Back', { x: -3.5, y: 0.72, z: 0.2 }, { x: 1.2, y: 0.5, z: 0.08 }, { r: 0.45, g: 0.3, b: 0.18 }, 0.35);
    await createBox(client, infraId, 'Bench2_Seat', { x: 3.5, y: 0.4, z: 0 }, { x: 1.2, y: 0.08, z: 0.45 }, { r: 0.45, g: 0.3, b: 0.18 }, 0.35);
    await createBox(client, infraId, 'Bench2_Back', { x: 3.5, y: 0.72, z: -0.2 }, { x: 1.2, y: 0.5, z: 0.08 }, { r: 0.45, g: 0.3, b: 0.18 }, 0.35);

    console.log('\n🏘️ COMPLETE TOWN CREATED!');
    console.log('   ✓ 10 Houses (various styles)');
    console.log('   ✓ 3 Shops (Cafe, Grocery, Bookstore)');
    console.log('   ✓ Road network with sidewalks');
    console.log('   ✓ Crosswalks');
    console.log('   ✓ 4 Traffic lights');
    console.log('   ✓ 3 Stop signs');
    console.log('   ✓ 18 Street lights');
    console.log('   ✓ 11 Cars');
    console.log('   ✓ Parking lot');
    console.log('   ✓ 2 Bus stops');
    console.log('   ✓ 4 Fire hydrants');
    console.log('   ✓ 5 Trash cans');
    console.log('   ✓ 5 Mailboxes');
    console.log('   ✓ 16 Trees');
    console.log('   ✓ Central park with fountain');

  } finally {
    client.disconnect();
  }
}

main();

import { ResoniteLinkClient } from '../client.js';

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

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('🏠 Creating House with Fireplace...\n');

    await client.addSlot({ name: 'House', position: { x: 5, y: 0, z: 5 }, isActive: true });
    const house = await client.findSlotByName('House', 'Root', 1);
    if (!house?.id) { console.error('Failed'); return; }
    const houseId = house.id;

    // Colors
    const wood = { r: 0.55, g: 0.35, b: 0.2 };
    const darkWood = { r: 0.35, g: 0.2, b: 0.1 };
    const lightWood = { r: 0.7, g: 0.5, b: 0.3 };
    const white = { r: 0.95, g: 0.93, b: 0.9 };
    const cream = { r: 0.9, g: 0.85, b: 0.75 };
    const brick = { r: 0.6, g: 0.25, b: 0.15 };
    const darkBrick = { r: 0.4, g: 0.15, b: 0.1 };
    const stone = { r: 0.5, g: 0.5, b: 0.48 };
    const glass = { r: 0.7, g: 0.85, b: 0.95 };
    const roof = { r: 0.3, g: 0.15, b: 0.1 };
    const fire = { r: 1, g: 0.4, b: 0.1 };
    const fireGlow = { r: 1, g: 0.6, b: 0.2 };
    const carpet = { r: 0.5, g: 0.1, b: 0.1 };
    const green = { r: 0.2, g: 0.5, b: 0.2 };

    const W = 8;  // Width
    const D = 10; // Depth
    const H = 4;  // Wall height
    const T = 0.2; // Wall thickness

    console.log('  Creating foundation & floor...');
    await createBox(client, houseId, 'Foundation', { x: 0, y: -0.1, z: 0 }, { x: W + 0.4, y: 0.2, z: D + 0.4 }, stone, 0.2);
    await createBox(client, houseId, 'Floor', { x: 0, y: 0.02, z: 0 }, { x: W - 0.1, y: 0.04, z: D - 0.1 }, darkWood, 0.6);

    // Floor planks detail
    for (let i = 0; i < 16; i++) {
      await createBox(client, houseId, `Plank_${i}`, { x: -W/2 + 0.25 + i * 0.5, y: 0.045, z: 0 }, { x: 0.02, y: 0.01, z: D - 0.2 }, darkWood, 0.4);
    }

    console.log('  Creating walls...');
    // Front wall (with door hole)
    await createBox(client, houseId, 'Wall_Front_L', { x: -2.5, y: H/2, z: D/2 }, { x: 2.8, y: H, z: T }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Front_R', { x: 2.5, y: H/2, z: D/2 }, { x: 2.8, y: H, z: T }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Front_Top', { x: 0, y: H - 0.5, z: D/2 }, { x: 2.2, y: 1, z: T }, cream, 0.2);

    // Back wall (with fireplace area)
    await createBox(client, houseId, 'Wall_Back_L', { x: -2.5, y: H/2, z: -D/2 }, { x: 2.8, y: H, z: T }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Back_R', { x: 2.5, y: H/2, z: -D/2 }, { x: 2.8, y: H, z: T }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Back_Top', { x: 0, y: H - 0.5, z: -D/2 }, { x: 2.2, y: 1, z: T }, cream, 0.2);

    // Side walls (with windows)
    await createBox(client, houseId, 'Wall_Left_1', { x: -W/2, y: H/2, z: -3 }, { x: T, y: H, z: 3.8 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Left_2', { x: -W/2, y: H/2, z: 3 }, { x: T, y: H, z: 3.8 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Left_Top', { x: -W/2, y: H - 0.5, z: 0 }, { x: T, y: 1, z: 2.2 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Left_Bot', { x: -W/2, y: 0.5, z: 0 }, { x: T, y: 1, z: 2.2 }, cream, 0.2);

    await createBox(client, houseId, 'Wall_Right_1', { x: W/2, y: H/2, z: -3 }, { x: T, y: H, z: 3.8 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Right_2', { x: W/2, y: H/2, z: 3 }, { x: T, y: H, z: 3.8 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Right_Top', { x: W/2, y: H - 0.5, z: 0 }, { x: T, y: 1, z: 2.2 }, cream, 0.2);
    await createBox(client, houseId, 'Wall_Right_Bot', { x: W/2, y: 0.5, z: 0 }, { x: T, y: 1, z: 2.2 }, cream, 0.2);

    console.log('  Creating windows...');
    // Window frames and glass
    await createBox(client, houseId, 'Window_L_Frame', { x: -W/2 + 0.02, y: 2, z: 0 }, { x: 0.08, y: 1.6, z: 1.8 }, darkWood, 0.4);
    await createBox(client, houseId, 'Window_L_Glass', { x: -W/2 + 0.05, y: 2, z: 0 }, { x: 0.02, y: 1.4, z: 1.6 }, glass, 0.95, 0);
    await createBox(client, houseId, 'Window_L_Div_H', { x: -W/2 + 0.06, y: 2, z: 0 }, { x: 0.02, y: 0.04, z: 1.6 }, darkWood, 0.4);
    await createBox(client, houseId, 'Window_L_Div_V', { x: -W/2 + 0.06, y: 2, z: 0 }, { x: 0.02, y: 1.4, z: 0.04 }, darkWood, 0.4);

    await createBox(client, houseId, 'Window_R_Frame', { x: W/2 - 0.02, y: 2, z: 0 }, { x: 0.08, y: 1.6, z: 1.8 }, darkWood, 0.4);
    await createBox(client, houseId, 'Window_R_Glass', { x: W/2 - 0.05, y: 2, z: 0 }, { x: 0.02, y: 1.4, z: 1.6 }, glass, 0.95, 0);
    await createBox(client, houseId, 'Window_R_Div_H', { x: W/2 - 0.06, y: 2, z: 0 }, { x: 0.02, y: 0.04, z: 1.6 }, darkWood, 0.4);
    await createBox(client, houseId, 'Window_R_Div_V', { x: W/2 - 0.06, y: 2, z: 0 }, { x: 0.02, y: 1.4, z: 0.04 }, darkWood, 0.4);

    console.log('  Creating door...');
    await createBox(client, houseId, 'Door_Frame', { x: 0, y: 1.5, z: D/2 - 0.05 }, { x: 1.4, y: 3, z: 0.15 }, darkWood, 0.4);
    await createBox(client, houseId, 'Door', { x: 0, y: 1.4, z: D/2 - 0.08 }, { x: 1.1, y: 2.6, z: 0.08 }, wood, 0.35);
    await createBox(client, houseId, 'Door_Handle', { x: 0.4, y: 1.3, z: D/2 - 0.03 }, { x: 0.08, y: 0.04, z: 0.06 }, { r: 0.8, g: 0.7, b: 0.3 }, 0.8, 0.9);

    // Door panels
    await createBox(client, houseId, 'Door_Panel1', { x: 0, y: 2.2, z: D/2 - 0.04 }, { x: 0.8, y: 0.8, z: 0.04 }, darkWood, 0.35);
    await createBox(client, houseId, 'Door_Panel2', { x: 0, y: 1.0, z: D/2 - 0.04 }, { x: 0.8, y: 0.8, z: 0.04 }, darkWood, 0.35);

    console.log('  Creating roof...');
    // Simple gabled roof
    await createBox(client, houseId, 'Roof_L', { x: -2.2, y: H + 1.2, z: 0 }, { x: 4.8, y: 0.15, z: D + 0.8 }, roof, 0.3);
    await createBox(client, houseId, 'Roof_R', { x: 2.2, y: H + 1.2, z: 0 }, { x: 4.8, y: 0.15, z: D + 0.8 }, roof, 0.3);
    await createBox(client, houseId, 'Roof_Peak', { x: 0, y: H + 2, z: 0 }, { x: 0.3, y: 0.2, z: D + 0.6 }, darkWood, 0.4);

    // Roof supports (gable ends)
    await createBox(client, houseId, 'Gable_Front', { x: 0, y: H + 1, z: D/2 + 0.1 }, { x: W + 0.2, y: 2, z: 0.1 }, cream, 0.2);
    await createBox(client, houseId, 'Gable_Back', { x: 0, y: H + 1, z: -D/2 - 0.1 }, { x: W + 0.2, y: 2, z: 0.1 }, cream, 0.2);

    console.log('  Creating fireplace...');
    // Fireplace structure
    await createBox(client, houseId, 'FP_Base', { x: 0, y: 0.15, z: -D/2 + 0.5 }, { x: 2.5, y: 0.3, z: 1 }, stone, 0.2);
    await createBox(client, houseId, 'FP_Back', { x: 0, y: 1.5, z: -D/2 + 0.15 }, { x: 2.2, y: 2.8, z: 0.3 }, brick, 0.15);
    await createBox(client, houseId, 'FP_Left', { x: -1, y: 1.5, z: -D/2 + 0.5 }, { x: 0.3, y: 2.8, z: 0.8 }, brick, 0.15);
    await createBox(client, houseId, 'FP_Right', { x: 1, y: 1.5, z: -D/2 + 0.5 }, { x: 0.3, y: 2.8, z: 0.8 }, brick, 0.15);
    await createBox(client, houseId, 'FP_Top', { x: 0, y: 3, z: -D/2 + 0.5 }, { x: 2.5, y: 0.2, z: 1 }, stone, 0.3);
    await createBox(client, houseId, 'FP_Mantle', { x: 0, y: 3.15, z: -D/2 + 0.55 }, { x: 2.8, y: 0.12, z: 0.5 }, darkWood, 0.5);

    // Fireplace interior (black)
    await createBox(client, houseId, 'FP_Interior', { x: 0, y: 1.0, z: -D/2 + 0.4 }, { x: 1.4, y: 1.8, z: 0.6 }, { r: 0.05, g: 0.05, b: 0.05 }, 0.1);

    // Fire logs
    await createBox(client, houseId, 'Log1', { x: -0.2, y: 0.35, z: -D/2 + 0.5 }, { x: 0.15, y: 0.15, z: 0.8 }, darkWood, 0.2);
    await createBox(client, houseId, 'Log2', { x: 0.2, y: 0.35, z: -D/2 + 0.5 }, { x: 0.15, y: 0.15, z: 0.8 }, darkWood, 0.2);
    await createBox(client, houseId, 'Log3', { x: 0, y: 0.5, z: -D/2 + 0.5 }, { x: 0.12, y: 0.12, z: 0.7 }, darkWood, 0.2);

    // Fire (glowing)
    await createBox(client, houseId, 'Fire1', { x: 0, y: 0.6, z: -D/2 + 0.5 }, { x: 0.5, y: 0.6, z: 0.3 }, fire, 0.1, 0, fireGlow);
    await createBox(client, houseId, 'Fire2', { x: -0.15, y: 0.8, z: -D/2 + 0.45 }, { x: 0.25, y: 0.5, z: 0.2 }, { r: 1, g: 0.6, b: 0.1 }, 0.1, 0, { r: 1, g: 0.7, b: 0.2 });
    await createBox(client, houseId, 'Fire3', { x: 0.15, y: 0.75, z: -D/2 + 0.55 }, { x: 0.2, y: 0.45, z: 0.2 }, { r: 1, g: 0.5, b: 0 }, 0.1, 0, { r: 1, g: 0.5, b: 0.1 });

    // Chimney
    await createBox(client, houseId, 'Chimney', { x: 0, y: H + 3, z: -D/2 + 0.3 }, { x: 1.2, y: 2.5, z: 1 }, brick, 0.15);
    await createBox(client, houseId, 'Chimney_Top', { x: 0, y: H + 4.3, z: -D/2 + 0.3 }, { x: 1.4, y: 0.15, z: 1.2 }, stone, 0.2);

    console.log('  Creating furniture...');
    // Carpet in front of fireplace
    await createBox(client, houseId, 'Carpet', { x: 0, y: 0.05, z: -D/2 + 2 }, { x: 3, y: 0.02, z: 2 }, carpet, 0.1);

    // Couch
    await createBox(client, houseId, 'Couch_Base', { x: 0, y: 0.25, z: -D/2 + 3.5 }, { x: 2.5, y: 0.4, z: 1 }, { r: 0.3, g: 0.25, b: 0.2 }, 0.2);
    await createBox(client, houseId, 'Couch_Back', { x: 0, y: 0.65, z: -D/2 + 4 }, { x: 2.5, y: 0.6, z: 0.2 }, { r: 0.3, g: 0.25, b: 0.2 }, 0.2);
    await createBox(client, houseId, 'Couch_Arm_L', { x: -1.15, y: 0.45, z: -D/2 + 3.5 }, { x: 0.2, y: 0.5, z: 1 }, { r: 0.3, g: 0.25, b: 0.2 }, 0.2);
    await createBox(client, houseId, 'Couch_Arm_R', { x: 1.15, y: 0.45, z: -D/2 + 3.5 }, { x: 0.2, y: 0.5, z: 1 }, { r: 0.3, g: 0.25, b: 0.2 }, 0.2);
    // Cushions
    await createBox(client, houseId, 'Cushion_L', { x: -0.55, y: 0.5, z: -D/2 + 3.4 }, { x: 0.8, y: 0.15, z: 0.7 }, { r: 0.6, g: 0.2, b: 0.2 }, 0.15);
    await createBox(client, houseId, 'Cushion_R', { x: 0.55, y: 0.5, z: -D/2 + 3.4 }, { x: 0.8, y: 0.15, z: 0.7 }, { r: 0.6, g: 0.2, b: 0.2 }, 0.15);

    // Coffee table
    await createBox(client, houseId, 'Table_Top', { x: 0, y: 0.45, z: -D/2 + 2.2 }, { x: 1.2, y: 0.06, z: 0.6 }, lightWood, 0.5);
    await createBox(client, houseId, 'Table_Leg1', { x: -0.5, y: 0.22, z: -D/2 + 2.4 }, { x: 0.06, y: 0.4, z: 0.06 }, darkWood, 0.4);
    await createBox(client, houseId, 'Table_Leg2', { x: 0.5, y: 0.22, z: -D/2 + 2.4 }, { x: 0.06, y: 0.4, z: 0.06 }, darkWood, 0.4);
    await createBox(client, houseId, 'Table_Leg3', { x: -0.5, y: 0.22, z: -D/2 + 2 }, { x: 0.06, y: 0.4, z: 0.06 }, darkWood, 0.4);
    await createBox(client, houseId, 'Table_Leg4', { x: 0.5, y: 0.22, z: -D/2 + 2 }, { x: 0.06, y: 0.4, z: 0.06 }, darkWood, 0.4);

    // Armchairs
    await createBox(client, houseId, 'Chair_L_Seat', { x: -2.5, y: 0.35, z: -D/2 + 2.5 }, { x: 0.8, y: 0.3, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_L_Back', { x: -2.5, y: 0.75, z: -D/2 + 2.9 }, { x: 0.8, y: 0.6, z: 0.15 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_L_Arm1', { x: -2.9, y: 0.5, z: -D/2 + 2.5 }, { x: 0.1, y: 0.35, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_L_Arm2', { x: -2.1, y: 0.5, z: -D/2 + 2.5 }, { x: 0.1, y: 0.35, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);

    await createBox(client, houseId, 'Chair_R_Seat', { x: 2.5, y: 0.35, z: -D/2 + 2.5 }, { x: 0.8, y: 0.3, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_R_Back', { x: 2.5, y: 0.75, z: -D/2 + 2.9 }, { x: 0.8, y: 0.6, z: 0.15 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_R_Arm1', { x: 2.1, y: 0.5, z: -D/2 + 2.5 }, { x: 0.1, y: 0.35, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chair_R_Arm2', { x: 2.9, y: 0.5, z: -D/2 + 2.5 }, { x: 0.1, y: 0.35, z: 0.8 }, { r: 0.25, g: 0.35, b: 0.25 }, 0.2);

    // Bookshelf
    await createBox(client, houseId, 'Shelf_Frame', { x: -3.5, y: 1.5, z: -D/2 + 0.4 }, { x: 0.8, y: 2.8, z: 0.4 }, darkWood, 0.4);
    await createBox(client, houseId, 'Shelf1', { x: -3.5, y: 0.5, z: -D/2 + 0.4 }, { x: 0.75, y: 0.04, z: 0.35 }, wood, 0.4);
    await createBox(client, houseId, 'Shelf2', { x: -3.5, y: 1.2, z: -D/2 + 0.4 }, { x: 0.75, y: 0.04, z: 0.35 }, wood, 0.4);
    await createBox(client, houseId, 'Shelf3', { x: -3.5, y: 1.9, z: -D/2 + 0.4 }, { x: 0.75, y: 0.04, z: 0.35 }, wood, 0.4);
    await createBox(client, houseId, 'Shelf4', { x: -3.5, y: 2.6, z: -D/2 + 0.4 }, { x: 0.75, y: 0.04, z: 0.35 }, wood, 0.4);

    // Books
    const bookColors = [{ r: 0.6, g: 0.1, b: 0.1 }, { r: 0.1, g: 0.3, b: 0.5 }, { r: 0.1, g: 0.4, b: 0.2 }, { r: 0.5, g: 0.4, b: 0.1 }, { r: 0.3, g: 0.1, b: 0.3 }];
    for (let shelf = 0; shelf < 4; shelf++) {
      for (let book = 0; book < 5; book++) {
        await createBox(client, houseId, `Book_${shelf}_${book}`,
          { x: -3.7 + book * 0.12, y: 0.35 + shelf * 0.7, z: -D/2 + 0.4 },
          { x: 0.08, y: 0.25 + Math.random() * 0.1, z: 0.2 },
          bookColors[book], 0.3);
      }
    }

    // Dining table
    await createBox(client, houseId, 'DTable_Top', { x: 2, y: 0.8, z: 2 }, { x: 2, y: 0.08, z: 1.2 }, lightWood, 0.5);
    await createBox(client, houseId, 'DTable_Leg1', { x: 1.2, y: 0.4, z: 2.4 }, { x: 0.1, y: 0.8, z: 0.1 }, darkWood, 0.4);
    await createBox(client, houseId, 'DTable_Leg2', { x: 2.8, y: 0.4, z: 2.4 }, { x: 0.1, y: 0.8, z: 0.1 }, darkWood, 0.4);
    await createBox(client, houseId, 'DTable_Leg3', { x: 1.2, y: 0.4, z: 1.6 }, { x: 0.1, y: 0.8, z: 0.1 }, darkWood, 0.4);
    await createBox(client, houseId, 'DTable_Leg4', { x: 2.8, y: 0.4, z: 1.6 }, { x: 0.1, y: 0.8, z: 0.1 }, darkWood, 0.4);

    // Dining chairs
    for (let i = 0; i < 4; i++) {
      const cx = i < 2 ? 1.5 + i * 1 : 1.5 + (i - 2) * 1;
      const cz = i < 2 ? 2.9 : 1.1;
      await createBox(client, houseId, `DChair_${i}_Seat`, { x: cx, y: 0.45, z: cz }, { x: 0.45, y: 0.05, z: 0.45 }, wood, 0.4);
      await createBox(client, houseId, `DChair_${i}_Back`, { x: cx, y: 0.85, z: i < 2 ? cz + 0.2 : cz - 0.2 }, { x: 0.4, y: 0.6, z: 0.05 }, wood, 0.4);
      await createBox(client, houseId, `DChair_${i}_L1`, { x: cx - 0.18, y: 0.22, z: cz - 0.18 }, { x: 0.04, y: 0.45, z: 0.04 }, darkWood, 0.4);
      await createBox(client, houseId, `DChair_${i}_L2`, { x: cx + 0.18, y: 0.22, z: cz - 0.18 }, { x: 0.04, y: 0.45, z: 0.04 }, darkWood, 0.4);
      await createBox(client, houseId, `DChair_${i}_L3`, { x: cx - 0.18, y: 0.22, z: cz + 0.18 }, { x: 0.04, y: 0.45, z: 0.04 }, darkWood, 0.4);
      await createBox(client, houseId, `DChair_${i}_L4`, { x: cx + 0.18, y: 0.22, z: cz + 0.18 }, { x: 0.04, y: 0.45, z: 0.04 }, darkWood, 0.4);
    }

    console.log('  Creating decorations...');
    // Pictures on wall
    await createBox(client, houseId, 'Picture1_Frame', { x: -3, y: 2.2, z: D/2 - 0.12 }, { x: 0.8, y: 0.6, z: 0.05 }, darkWood, 0.4);
    await createBox(client, houseId, 'Picture1', { x: -3, y: 2.2, z: D/2 - 0.1 }, { x: 0.7, y: 0.5, z: 0.02 }, { r: 0.3, g: 0.5, b: 0.7 }, 0.2);

    await createBox(client, houseId, 'Picture2_Frame', { x: 3, y: 2.2, z: D/2 - 0.12 }, { x: 0.6, y: 0.8, z: 0.05 }, darkWood, 0.4);
    await createBox(client, houseId, 'Picture2', { x: 3, y: 2.2, z: D/2 - 0.1 }, { x: 0.5, y: 0.7, z: 0.02 }, { r: 0.6, g: 0.4, b: 0.3 }, 0.2);

    // Clock above fireplace
    await createBox(client, houseId, 'Clock_Body', { x: 0, y: 3.4, z: -D/2 + 0.15 }, { x: 0.4, y: 0.4, z: 0.08 }, darkWood, 0.5);
    await createBox(client, houseId, 'Clock_Face', { x: 0, y: 3.4, z: -D/2 + 0.2 }, { x: 0.32, y: 0.32, z: 0.02 }, white, 0.3);

    // Vase on mantle
    await createBox(client, houseId, 'Vase', { x: 0.8, y: 3.35, z: -D/2 + 0.55 }, { x: 0.12, y: 0.3, z: 0.12 }, { r: 0.2, g: 0.4, b: 0.5 }, 0.7);
    await createBox(client, houseId, 'Flowers', { x: 0.8, y: 3.6, z: -D/2 + 0.55 }, { x: 0.2, y: 0.25, z: 0.2 }, green, 0.2);

    // Candles
    await createBox(client, houseId, 'Candle1', { x: -0.6, y: 3.28, z: -D/2 + 0.55 }, { x: 0.05, y: 0.15, z: 0.05 }, cream, 0.2);
    await createBox(client, houseId, 'Candle1_Flame', { x: -0.6, y: 3.4, z: -D/2 + 0.55 }, { x: 0.02, y: 0.04, z: 0.02 }, fire, 0.1, 0, fireGlow);
    await createBox(client, houseId, 'Candle2', { x: -0.8, y: 3.28, z: -D/2 + 0.55 }, { x: 0.05, y: 0.12, z: 0.05 }, cream, 0.2);
    await createBox(client, houseId, 'Candle2_Flame', { x: -0.8, y: 3.38, z: -D/2 + 0.55 }, { x: 0.02, y: 0.04, z: 0.02 }, fire, 0.1, 0, fireGlow);

    // Ceiling beams
    for (let i = 0; i < 5; i++) {
      await createBox(client, houseId, `Beam_${i}`, { x: 0, y: H - 0.1, z: -D/2 + 1 + i * 2 }, { x: W - 0.4, y: 0.2, z: 0.25 }, darkWood, 0.3);
    }

    // Rug under dining table
    await createBox(client, houseId, 'DiningRug', { x: 2, y: 0.03, z: 2 }, { x: 2.8, y: 0.02, z: 1.8 }, { r: 0.4, g: 0.3, b: 0.2 }, 0.15);

    // Plant in corner
    await createBox(client, houseId, 'Pot', { x: 3.3, y: 0.2, z: -D/2 + 0.5 }, { x: 0.3, y: 0.4, z: 0.3 }, { r: 0.5, g: 0.3, b: 0.2 }, 0.3);
    await createBox(client, houseId, 'Plant', { x: 3.3, y: 0.6, z: -D/2 + 0.5 }, { x: 0.5, y: 0.6, z: 0.5 }, green, 0.2);

    // Lamp
    await createBox(client, houseId, 'Lamp_Base', { x: -2.5, y: 0.05, z: -D/2 + 3.5 }, { x: 0.25, y: 0.1, z: 0.25 }, { r: 0.7, g: 0.6, b: 0.4 }, 0.7, 0.8);
    await createBox(client, houseId, 'Lamp_Pole', { x: -2.5, y: 0.8, z: -D/2 + 3.5 }, { x: 0.04, y: 1.4, z: 0.04 }, { r: 0.7, g: 0.6, b: 0.4 }, 0.7, 0.8);
    await createBox(client, houseId, 'Lamp_Shade', { x: -2.5, y: 1.55, z: -D/2 + 3.5 }, { x: 0.35, y: 0.3, z: 0.35 }, cream, 0.2, 0, { r: 0.4, g: 0.35, b: 0.25 });

    console.log('\n🏠 House with Fireplace created!');
  } finally {
    client.disconnect();
  }
}

main();

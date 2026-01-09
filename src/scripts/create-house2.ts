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
    console.log('🏡 Creating House 2 (Blue Roof Style)...\n');

    await client.addSlot({ name: 'House2', position: { x: -5, y: 0, z: 5 }, isActive: true });
    const house = await client.findSlotByName('House2', 'Root', 1);
    if (!house?.id) { console.error('Failed'); return; }
    const houseId = house.id;

    // Colors - Different palette
    const wood = { r: 0.45, g: 0.3, b: 0.2 };
    const darkWood = { r: 0.3, g: 0.18, b: 0.1 };
    const lightWood = { r: 0.65, g: 0.45, b: 0.3 };
    const white = { r: 0.95, g: 0.95, b: 0.98 };
    const lightBlue = { r: 0.85, g: 0.9, b: 0.95 };
    const stone = { r: 0.55, g: 0.55, b: 0.52 };
    const glass = { r: 0.75, g: 0.88, b: 0.98 };
    const blueRoof = { r: 0.15, g: 0.25, b: 0.45 };
    const darkBlue = { r: 0.1, g: 0.15, b: 0.3 };
    const warmLight = { r: 1, g: 0.9, b: 0.7 };
    const yellow = { r: 0.9, g: 0.8, b: 0.3 };
    const red = { r: 0.7, g: 0.15, b: 0.1 };
    const green = { r: 0.2, g: 0.5, b: 0.2 };

    const W = 7;  // Width (slightly smaller)
    const D = 9;  // Depth
    const H = 3.5;  // Wall height
    const T = 0.18; // Wall thickness

    console.log('  Creating foundation & floor...');
    await createBox(client, houseId, 'Foundation', { x: 0, y: -0.1, z: 0 }, { x: W + 0.5, y: 0.2, z: D + 0.5 }, stone, 0.25);
    await createBox(client, houseId, 'Floor', { x: 0, y: 0.02, z: 0 }, { x: W - 0.1, y: 0.04, z: D - 0.1 }, lightWood, 0.55);

    // Porch
    await createBox(client, houseId, 'Porch', { x: 0, y: 0.08, z: D/2 + 1 }, { x: 3, y: 0.16, z: 2 }, wood, 0.4);
    await createBox(client, houseId, 'Porch_Step1', { x: 0, y: 0.05, z: D/2 + 2.1 }, { x: 2.5, y: 0.1, z: 0.4 }, wood, 0.4);
    await createBox(client, houseId, 'Porch_Step2', { x: 0, y: 0.02, z: D/2 + 2.4 }, { x: 2.5, y: 0.04, z: 0.3 }, wood, 0.4);

    // Porch pillars
    await createBox(client, houseId, 'Pillar_L', { x: -1.2, y: 1.5, z: D/2 + 0.5 }, { x: 0.15, y: 2.8, z: 0.15 }, white, 0.5);
    await createBox(client, houseId, 'Pillar_R', { x: 1.2, y: 1.5, z: D/2 + 0.5 }, { x: 0.15, y: 2.8, z: 0.15 }, white, 0.5);

    // Porch roof
    await createBox(client, houseId, 'Porch_Roof', { x: 0, y: 2.95, z: D/2 + 1 }, { x: 3.5, y: 0.1, z: 2.5 }, blueRoof, 0.35);

    console.log('  Creating walls...');
    // Front wall (with door and windows)
    await createBox(client, houseId, 'Wall_Front_L', { x: -2.3, y: H/2, z: D/2 }, { x: 2.2, y: H, z: T }, lightBlue, 0.25);
    await createBox(client, houseId, 'Wall_Front_R', { x: 2.3, y: H/2, z: D/2 }, { x: 2.2, y: H, z: T }, lightBlue, 0.25);
    await createBox(client, houseId, 'Wall_Front_Top', { x: 0, y: H - 0.4, z: D/2 }, { x: 2.4, y: 0.8, z: T }, lightBlue, 0.25);

    // Back wall
    await createBox(client, houseId, 'Wall_Back', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, lightBlue, 0.25);

    // Side walls with bay windows
    await createBox(client, houseId, 'Wall_Left', { x: -W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, lightBlue, 0.25);
    await createBox(client, houseId, 'Wall_Right', { x: W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, lightBlue, 0.25);

    // Bay window (left side)
    await createBox(client, houseId, 'Bay_Bottom', { x: -W/2 - 0.4, y: 0.8, z: 0 }, { x: 0.8, y: 0.1, z: 2 }, white, 0.4);
    await createBox(client, houseId, 'Bay_Front', { x: -W/2 - 0.8, y: 1.6, z: 0 }, { x: 0.05, y: 1.5, z: 1.8 }, white, 0.4);
    await createBox(client, houseId, 'Bay_Glass', { x: -W/2 - 0.78, y: 1.6, z: 0 }, { x: 0.02, y: 1.3, z: 1.6 }, glass, 0.95);
    await createBox(client, houseId, 'Bay_Top', { x: -W/2 - 0.4, y: 2.4, z: 0 }, { x: 0.8, y: 0.1, z: 2 }, blueRoof, 0.35);

    console.log('  Creating windows...');
    // Front windows (beside door)
    await createBox(client, houseId, 'Window_FL_Frame', { x: -2.3, y: 1.8, z: D/2 + 0.02 }, { x: 1, y: 1.4, z: 0.08 }, white, 0.5);
    await createBox(client, houseId, 'Window_FL_Glass', { x: -2.3, y: 1.8, z: D/2 + 0.05 }, { x: 0.85, y: 1.2, z: 0.02 }, glass, 0.95);
    await createBox(client, houseId, 'Window_FL_Div', { x: -2.3, y: 1.8, z: D/2 + 0.06 }, { x: 0.03, y: 1.2, z: 0.02 }, white, 0.5);

    await createBox(client, houseId, 'Window_FR_Frame', { x: 2.3, y: 1.8, z: D/2 + 0.02 }, { x: 1, y: 1.4, z: 0.08 }, white, 0.5);
    await createBox(client, houseId, 'Window_FR_Glass', { x: 2.3, y: 1.8, z: D/2 + 0.05 }, { x: 0.85, y: 1.2, z: 0.02 }, glass, 0.95);
    await createBox(client, houseId, 'Window_FR_Div', { x: 2.3, y: 1.8, z: D/2 + 0.06 }, { x: 0.03, y: 1.2, z: 0.02 }, white, 0.5);

    // Shutters
    await createBox(client, houseId, 'Shutter_FL_L', { x: -2.85, y: 1.8, z: D/2 + 0.03 }, { x: 0.15, y: 1.3, z: 0.04 }, blueRoof, 0.3);
    await createBox(client, houseId, 'Shutter_FL_R', { x: -1.75, y: 1.8, z: D/2 + 0.03 }, { x: 0.15, y: 1.3, z: 0.04 }, blueRoof, 0.3);
    await createBox(client, houseId, 'Shutter_FR_L', { x: 1.75, y: 1.8, z: D/2 + 0.03 }, { x: 0.15, y: 1.3, z: 0.04 }, blueRoof, 0.3);
    await createBox(client, houseId, 'Shutter_FR_R', { x: 2.85, y: 1.8, z: D/2 + 0.03 }, { x: 0.15, y: 1.3, z: 0.04 }, blueRoof, 0.3);

    console.log('  Creating door...');
    await createBox(client, houseId, 'Door_Frame', { x: 0, y: 1.4, z: D/2 - 0.02 }, { x: 1.3, y: 2.8, z: 0.12 }, white, 0.45);
    await createBox(client, houseId, 'Door', { x: 0, y: 1.35, z: D/2 - 0.05 }, { x: 1.05, y: 2.5, z: 0.06 }, red, 0.4);
    await createBox(client, houseId, 'Door_Window', { x: 0, y: 2.1, z: D/2 - 0.02 }, { x: 0.5, y: 0.8, z: 0.02 }, glass, 0.9);
    await createBox(client, houseId, 'Door_Handle', { x: 0.4, y: 1.2, z: D/2 + 0.02 }, { x: 0.06, y: 0.04, z: 0.05 }, { r: 0.85, g: 0.75, b: 0.35 }, 0.85, 0.95);

    console.log('  Creating roof...');
    // Steeper gabled roof
    await createBox(client, houseId, 'Roof_L', { x: -2, y: H + 1.3, z: 0 }, { x: 4.2, y: 0.12, z: D + 0.6 }, blueRoof, 0.35);
    await createBox(client, houseId, 'Roof_R', { x: 2, y: H + 1.3, z: 0 }, { x: 4.2, y: 0.12, z: D + 0.6 }, blueRoof, 0.35);
    await createBox(client, houseId, 'Roof_Peak', { x: 0, y: H + 2.2, z: 0 }, { x: 0.25, y: 0.15, z: D + 0.5 }, darkBlue, 0.4);

    // Gable trim
    await createBox(client, houseId, 'Gable_Front', { x: 0, y: H + 1.1, z: D/2 + 0.08 }, { x: W + 0.1, y: 2.2, z: 0.08 }, lightBlue, 0.25);
    await createBox(client, houseId, 'Gable_Back', { x: 0, y: H + 1.1, z: -D/2 - 0.08 }, { x: W + 0.1, y: 2.2, z: 0.08 }, lightBlue, 0.25);

    // Dormer window
    await createBox(client, houseId, 'Dormer_Base', { x: 0, y: H + 0.9, z: D/2 + 0.5 }, { x: 1.5, y: 1.2, z: 1 }, lightBlue, 0.25);
    await createBox(client, houseId, 'Dormer_Roof', { x: 0, y: H + 1.55, z: D/2 + 0.5 }, { x: 1.8, y: 0.1, z: 1.3 }, blueRoof, 0.35);
    await createBox(client, houseId, 'Dormer_Window', { x: 0, y: H + 0.9, z: D/2 + 1.02 }, { x: 0.8, y: 0.9, z: 0.03 }, glass, 0.95);
    await createBox(client, houseId, 'Dormer_Frame', { x: 0, y: H + 0.9, z: D/2 + 1.04 }, { x: 0.9, y: 1, z: 0.05 }, white, 0.5);

    // Chimney
    await createBox(client, houseId, 'Chimney', { x: 2.5, y: H + 2.5, z: -1 }, { x: 0.8, y: 2, z: 0.8 }, { r: 0.5, g: 0.3, b: 0.25 }, 0.2);
    await createBox(client, houseId, 'Chimney_Cap', { x: 2.5, y: H + 3.55, z: -1 }, { x: 0.9, y: 0.1, z: 0.9 }, stone, 0.3);

    console.log('  Creating interior...');
    // Wooden beams
    for (let i = 0; i < 4; i++) {
      await createBox(client, houseId, `Beam_${i}`, { x: 0, y: H - 0.08, z: -D/2 + 1.5 + i * 2.2 }, { x: W - 0.3, y: 0.16, z: 0.2 }, darkWood, 0.35);
    }

    // Cozy corner with armchair
    await createBox(client, houseId, 'Chair_Seat', { x: -2.5, y: 0.35, z: -3 }, { x: 0.85, y: 0.35, z: 0.85 }, { r: 0.6, g: 0.5, b: 0.35 }, 0.2);
    await createBox(client, houseId, 'Chair_Back', { x: -2.5, y: 0.8, z: -3.4 }, { x: 0.85, y: 0.65, z: 0.15 }, { r: 0.6, g: 0.5, b: 0.35 }, 0.2);
    await createBox(client, houseId, 'Chair_Arm_L', { x: -2.92, y: 0.55, z: -3 }, { x: 0.12, y: 0.4, z: 0.85 }, { r: 0.6, g: 0.5, b: 0.35 }, 0.2);
    await createBox(client, houseId, 'Chair_Arm_R', { x: -2.08, y: 0.55, z: -3 }, { x: 0.12, y: 0.4, z: 0.85 }, { r: 0.6, g: 0.5, b: 0.35 }, 0.2);

    // Side table with lamp
    await createBox(client, houseId, 'SideTable', { x: -1.4, y: 0.3, z: -3 }, { x: 0.5, y: 0.6, z: 0.5 }, darkWood, 0.45);
    await createBox(client, houseId, 'Lamp_Base2', { x: -1.4, y: 0.65, z: -3 }, { x: 0.15, y: 0.08, z: 0.15 }, { r: 0.75, g: 0.65, b: 0.45 }, 0.75, 0.85);
    await createBox(client, houseId, 'Lamp_Pole2', { x: -1.4, y: 0.9, z: -3 }, { x: 0.04, y: 0.4, z: 0.04 }, { r: 0.75, g: 0.65, b: 0.45 }, 0.75, 0.85);
    await createBox(client, houseId, 'Lamp_Shade2', { x: -1.4, y: 1.2, z: -3 }, { x: 0.3, y: 0.25, z: 0.3 }, yellow, 0.15, 0, warmLight);

    // Kitchen area (back right)
    await createBox(client, houseId, 'Counter', { x: 2.3, y: 0.45, z: -3.5 }, { x: 1.8, y: 0.9, z: 0.7 }, white, 0.5);
    await createBox(client, houseId, 'Counter_Top', { x: 2.3, y: 0.92, z: -3.5 }, { x: 1.85, y: 0.04, z: 0.75 }, stone, 0.7);
    await createBox(client, houseId, 'Sink', { x: 2.5, y: 0.9, z: -3.5 }, { x: 0.5, y: 0.08, z: 0.4 }, { r: 0.8, g: 0.8, b: 0.82 }, 0.9, 0.95);

    // Cabinets above counter
    await createBox(client, houseId, 'Cabinet1', { x: 1.7, y: 2, z: -D/2 + 0.25 }, { x: 0.7, y: 0.9, z: 0.4 }, white, 0.45);
    await createBox(client, houseId, 'Cabinet2', { x: 2.5, y: 2, z: -D/2 + 0.25 }, { x: 0.7, y: 0.9, z: 0.4 }, white, 0.45);

    // Stove
    await createBox(client, houseId, 'Stove', { x: 1.5, y: 0.45, z: -3.5 }, { x: 0.6, y: 0.9, z: 0.65 }, { r: 0.15, g: 0.15, b: 0.15 }, 0.4);
    await createBox(client, houseId, 'Stove_Top', { x: 1.5, y: 0.92, z: -3.5 }, { x: 0.55, y: 0.02, z: 0.6 }, { r: 0.1, g: 0.1, b: 0.1 }, 0.6);

    // Dining set (center)
    await createBox(client, houseId, 'DTable', { x: 0, y: 0.75, z: 0 }, { x: 1.6, y: 0.06, z: 1 }, lightWood, 0.55);
    await createBox(client, houseId, 'DTable_Leg1', { x: -0.6, y: 0.37, z: 0.35 }, { x: 0.08, y: 0.7, z: 0.08 }, darkWood, 0.45);
    await createBox(client, houseId, 'DTable_Leg2', { x: 0.6, y: 0.37, z: 0.35 }, { x: 0.08, y: 0.7, z: 0.08 }, darkWood, 0.45);
    await createBox(client, houseId, 'DTable_Leg3', { x: -0.6, y: 0.37, z: -0.35 }, { x: 0.08, y: 0.7, z: 0.08 }, darkWood, 0.45);
    await createBox(client, houseId, 'DTable_Leg4', { x: 0.6, y: 0.37, z: -0.35 }, { x: 0.08, y: 0.7, z: 0.08 }, darkWood, 0.45);

    // Table centerpiece (vase with flowers)
    await createBox(client, houseId, 'Centerpiece', { x: 0, y: 0.85, z: 0 }, { x: 0.1, y: 0.2, z: 0.1 }, { r: 0.9, g: 0.9, b: 0.95 }, 0.75);
    await createBox(client, houseId, 'Flowers2', { x: 0, y: 1.05, z: 0 }, { x: 0.15, y: 0.2, z: 0.15 }, { r: 0.9, g: 0.4, b: 0.5 }, 0.2);

    // Dining chairs
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const dist = 0.9;
      const cx = Math.sin(angle) * dist;
      const cz = Math.cos(angle) * dist;
      await createBox(client, houseId, `DChair${i}_Seat`, { x: cx, y: 0.45, z: cz }, { x: 0.4, y: 0.04, z: 0.4 }, wood, 0.4);
      const backX = cx + Math.sin(angle) * 0.22;
      const backZ = cz + Math.cos(angle) * 0.22;
      await createBox(client, houseId, `DChair${i}_Back`, { x: backX, y: 0.8, z: backZ }, { x: i % 2 === 0 ? 0.35 : 0.04, y: 0.55, z: i % 2 === 0 ? 0.04 : 0.35 }, wood, 0.4);
    }

    console.log('  Creating decorations...');
    // Welcome mat
    await createBox(client, houseId, 'WelcomeMat', { x: 0, y: 0.01, z: D/2 + 1.5 }, { x: 0.8, y: 0.02, z: 0.5 }, { r: 0.35, g: 0.25, b: 0.15 }, 0.15);

    // Potted plants on porch
    await createBox(client, houseId, 'Pot_L', { x: -1, y: 0.2, z: D/2 + 1.5 }, { x: 0.25, y: 0.35, z: 0.25 }, { r: 0.55, g: 0.35, b: 0.25 }, 0.35);
    await createBox(client, houseId, 'Plant_L', { x: -1, y: 0.5, z: D/2 + 1.5 }, { x: 0.35, y: 0.4, z: 0.35 }, green, 0.2);
    await createBox(client, houseId, 'Pot_R', { x: 1, y: 0.2, z: D/2 + 1.5 }, { x: 0.25, y: 0.35, z: 0.25 }, { r: 0.55, g: 0.35, b: 0.25 }, 0.35);
    await createBox(client, houseId, 'Plant_R', { x: 1, y: 0.5, z: D/2 + 1.5 }, { x: 0.35, y: 0.4, z: 0.35 }, green, 0.2);

    // Mailbox
    await createBox(client, houseId, 'Mailbox_Post', { x: 2.5, y: 0.5, z: D/2 + 2.5 }, { x: 0.08, y: 1, z: 0.08 }, darkWood, 0.35);
    await createBox(client, houseId, 'Mailbox_Box', { x: 2.5, y: 1.05, z: D/2 + 2.5 }, { x: 0.25, y: 0.2, z: 0.35 }, blueRoof, 0.4);

    // Fence (front)
    for (let i = 0; i < 8; i++) {
      const fx = -3 + i * 0.8;
      if (Math.abs(fx) > 1.5) { // Gap for path
        await createBox(client, houseId, `Fence_${i}`, { x: fx, y: 0.4, z: D/2 + 2.8 }, { x: 0.08, y: 0.8, z: 0.08 }, white, 0.45);
      }
    }
    await createBox(client, houseId, 'Fence_Rail', { x: 0, y: 0.65, z: D/2 + 2.8 }, { x: 6, y: 0.06, z: 0.06 }, white, 0.45);

    // Hanging light on porch
    await createBox(client, houseId, 'PorchLight_Chain', { x: 0, y: 2.6, z: D/2 + 0.8 }, { x: 0.02, y: 0.3, z: 0.02 }, { r: 0.2, g: 0.2, b: 0.2 }, 0.5);
    await createBox(client, houseId, 'PorchLight', { x: 0, y: 2.35, z: D/2 + 0.8 }, { x: 0.2, y: 0.25, z: 0.2 }, { r: 0.15, g: 0.15, b: 0.15 }, 0.4);
    await createBox(client, houseId, 'PorchLight_Glow', { x: 0, y: 2.35, z: D/2 + 0.8 }, { x: 0.15, y: 0.18, z: 0.15 }, warmLight, 0.2, 0, warmLight);

    // Picture on interior wall
    await createBox(client, houseId, 'Picture_Frame', { x: -2, y: 2, z: D/2 - 0.15 }, { x: 0.7, y: 0.5, z: 0.04 }, darkWood, 0.45);
    await createBox(client, houseId, 'Picture_Art', { x: -2, y: 2, z: D/2 - 0.12 }, { x: 0.6, y: 0.4, z: 0.02 }, { r: 0.4, g: 0.6, b: 0.8 }, 0.25);

    // Clock
    await createBox(client, houseId, 'Clock', { x: 2, y: 2.3, z: D/2 - 0.12 }, { x: 0.35, y: 0.35, z: 0.06 }, white, 0.4);
    await createBox(client, houseId, 'Clock_Frame', { x: 2, y: 2.3, z: D/2 - 0.14 }, { x: 0.4, y: 0.4, z: 0.04 }, darkWood, 0.45);

    // Rug
    await createBox(client, houseId, 'Rug', { x: 0, y: 0.025, z: 0 }, { x: 2.2, y: 0.02, z: 1.5 }, { r: 0.5, g: 0.35, b: 0.3 }, 0.12);

    console.log('\n🏡 House 2 (Blue Roof) created at (-5, 0, 5)!');
  } finally {
    client.disconnect();
  }
}

main();

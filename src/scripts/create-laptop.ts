import { ResoniteLinkClient } from '../client.js';

async function createPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  smoothness: number = 0.5,
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

  await client.updateComponent({
    id: renderer.id!,
    members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any,
  });

  await client.updateComponent({
    id: renderer.id!,
    members: {
      Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] },
    } as any,
  });

  const rendererData = await client.getComponent(renderer.id!);
  if (rendererData.success) {
    const materials = (rendererData.data.members as any)?.Materials;
    if (materials?.elements?.[0]) {
      await client.updateComponent({
        id: renderer.id!,
        members: {
          Materials: {
            $type: 'list',
            elements: [{ $type: 'reference', id: materials.elements[0].id, targetId: material.id }],
          },
        } as any,
      });
    }
  }

  const members: any = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Smoothness: { $type: 'float', value: smoothness },
    Metallic: { $type: 'float', value: metallic },
  };

  if (emissive) {
    members.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  }

  await client.updateComponent({ id: material.id!, members });
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('💻 Creating Laptop (detailed)...\n');

    await client.addSlot({ name: 'Laptop', position: { x: 0, y: 0.8, z: 2 }, isActive: true });
    const laptop = await client.findSlotByName('Laptop', 'Root', 1);
    if (!laptop?.id) { console.error('Failed'); return; }
    const laptopId = laptop.id;

    await client.addComponent({ containerSlotId: laptopId, componentType: '[FrooxEngine]FrooxEngine.Grabbable' });

    // Colors
    const silver = { r: 0.75, g: 0.75, b: 0.78 };
    const darkSilver = { r: 0.5, g: 0.5, b: 0.53 };
    const black = { r: 0.08, g: 0.08, b: 0.08 };
    const darkGray = { r: 0.15, g: 0.15, b: 0.15 };
    const screenBlue = { r: 0.1, g: 0.2, b: 0.4 };
    const keyColor = { r: 0.12, g: 0.12, b: 0.12 };
    const ledGreen = { r: 0, g: 0.8, b: 0.3 };

    console.log('  Creating base...');
    // === BASE (keyboard side) ===
    await createPart(client, laptopId, 'Base_Bottom', { x: 0, y: 0, z: 0 }, { x: 0.35, y: 0.008, z: 0.24 }, silver, 0.85, 0.9);
    await createPart(client, laptopId, 'Base_Top', { x: 0, y: 0.015, z: 0 }, { x: 0.348, y: 0.006, z: 0.238 }, darkSilver, 0.7, 0.3);

    // Rubber feet
    await createPart(client, laptopId, 'Foot_FL', { x: -0.15, y: -0.003, z: 0.09 }, { x: 0.02, y: 0.004, z: 0.02 }, black, 0.2);
    await createPart(client, laptopId, 'Foot_FR', { x: 0.15, y: -0.003, z: 0.09 }, { x: 0.02, y: 0.004, z: 0.02 }, black, 0.2);
    await createPart(client, laptopId, 'Foot_BL', { x: -0.15, y: -0.003, z: -0.09 }, { x: 0.02, y: 0.004, z: 0.02 }, black, 0.2);
    await createPart(client, laptopId, 'Foot_BR', { x: 0.15, y: -0.003, z: -0.09 }, { x: 0.02, y: 0.004, z: 0.02 }, black, 0.2);

    console.log('  Creating keyboard...');
    // === KEYBOARD ===
    const keyW = 0.014;
    const keyH = 0.014;
    const keyGap = 0.002;
    const keyRows = [
      { keys: 14, startX: -0.155, z: -0.07 },  // Top row (numbers)
      { keys: 14, startX: -0.148, z: -0.052 }, // QWERTY
      { keys: 13, startX: -0.141, z: -0.034 }, // ASDF
      { keys: 12, startX: -0.134, z: -0.016 }, // ZXCV
      { keys: 8, startX: -0.12, z: 0.002 },    // Bottom row
    ];

    let keyCount = 0;
    for (const row of keyRows) {
      for (let i = 0; i < row.keys; i++) {
        keyCount++;
        const x = row.startX + i * (keyW + keyGap);
        await createPart(client, laptopId, `Key_${keyCount}`, { x, y: 0.02, z: row.z }, { x: keyW, y: 0.003, z: keyH }, keyColor, 0.3);
      }
    }

    // Space bar
    await createPart(client, laptopId, 'SpaceBar', { x: 0, y: 0.02, z: 0.002 }, { x: 0.08, y: 0.003, z: keyH }, keyColor, 0.3);

    console.log('  Creating trackpad...');
    // === TRACKPAD ===
    await createPart(client, laptopId, 'Trackpad', { x: 0, y: 0.019, z: 0.055 }, { x: 0.09, y: 0.001, z: 0.06 }, darkSilver, 0.9, 0.1);
    await createPart(client, laptopId, 'Trackpad_Border', { x: 0, y: 0.0185, z: 0.055 }, { x: 0.092, y: 0.0005, z: 0.062 }, silver, 0.8, 0.5);

    console.log('  Creating screen assembly...');
    // === SCREEN (tilted back) ===
    // Hinge
    await createPart(client, laptopId, 'Hinge_L', { x: -0.12, y: 0.012, z: -0.115 }, { x: 0.03, y: 0.008, z: 0.012 }, darkSilver, 0.6, 0.8);
    await createPart(client, laptopId, 'Hinge_R', { x: 0.12, y: 0.012, z: -0.115 }, { x: 0.03, y: 0.008, z: 0.012 }, darkSilver, 0.6, 0.8);

    // Screen back (lid)
    await createPart(client, laptopId, 'Screen_Back', { x: 0, y: 0.13, z: -0.17 }, { x: 0.35, y: 0.22, z: 0.006 }, silver, 0.85, 0.9);

    // Screen bezel (black frame)
    await createPart(client, laptopId, 'Bezel', { x: 0, y: 0.13, z: -0.165 }, { x: 0.34, y: 0.21, z: 0.004 }, black, 0.4);

    // Actual screen (slightly glowing)
    await createPart(client, laptopId, 'Screen', { x: 0, y: 0.13, z: -0.163 }, { x: 0.30, y: 0.18, z: 0.002 }, screenBlue, 0.95, 0, { r: 0.15, g: 0.25, b: 0.5 });

    // Webcam
    await createPart(client, laptopId, 'Webcam', { x: 0, y: 0.228, z: -0.164 }, { x: 0.006, y: 0.006, z: 0.003 }, darkGray, 0.3);
    await createPart(client, laptopId, 'Webcam_Lens', { x: 0, y: 0.228, z: -0.162 }, { x: 0.003, y: 0.003, z: 0.001 }, { r: 0.1, g: 0.1, b: 0.2 }, 0.9);

    // Webcam LED
    await createPart(client, laptopId, 'Webcam_LED', { x: 0.008, y: 0.228, z: -0.162 }, { x: 0.002, y: 0.002, z: 0.001 }, ledGreen, 0.5, 0, ledGreen);

    console.log('  Creating ports...');
    // === PORTS (left side) ===
    await createPart(client, laptopId, 'USB_C_1', { x: -0.176, y: 0.012, z: -0.05 }, { x: 0.002, y: 0.004, z: 0.012 }, darkGray, 0.3);
    await createPart(client, laptopId, 'USB_C_2', { x: -0.176, y: 0.012, z: -0.02 }, { x: 0.002, y: 0.004, z: 0.012 }, darkGray, 0.3);
    await createPart(client, laptopId, 'Headphone', { x: -0.176, y: 0.012, z: 0.02 }, { x: 0.002, y: 0.006, z: 0.006 }, darkGray, 0.3);

    // === PORTS (right side) ===
    await createPart(client, laptopId, 'USB_A', { x: 0.176, y: 0.012, z: -0.03 }, { x: 0.002, y: 0.005, z: 0.015 }, darkGray, 0.3);
    await createPart(client, laptopId, 'HDMI', { x: 0.176, y: 0.012, z: 0.02 }, { x: 0.002, y: 0.004, z: 0.018 }, darkGray, 0.3);
    await createPart(client, laptopId, 'SD_Slot', { x: 0.176, y: 0.012, z: 0.06 }, { x: 0.002, y: 0.003, z: 0.02 }, darkGray, 0.3);

    console.log('  Creating details...');
    // === SPEAKER GRILLS ===
    for (let i = 0; i < 20; i++) {
      const x = -0.1 + i * 0.01;
      await createPart(client, laptopId, `Speaker_L_${i}`, { x, y: 0.019, z: 0.1 }, { x: 0.002, y: 0.001, z: 0.015 }, darkGray, 0.2);
    }
    for (let i = 0; i < 20; i++) {
      const x = -0.1 + i * 0.01;
      await createPart(client, laptopId, `Speaker_R_${i}`, { x, y: 0.019, z: -0.1 }, { x: 0.002, y: 0.001, z: 0.015 }, darkGray, 0.2);
    }

    // Power LED
    await createPart(client, laptopId, 'Power_LED', { x: -0.16, y: 0.019, z: 0.11 }, { x: 0.004, y: 0.001, z: 0.004 }, { r: 1, g: 1, b: 1 }, 0.5, 0, { r: 1, g: 1, b: 1 });

    // Logo on lid
    await createPart(client, laptopId, 'Logo', { x: 0, y: 0.13, z: -0.176 }, { x: 0.03, y: 0.03, z: 0.001 }, { r: 0.9, g: 0.9, b: 0.92 }, 0.95, 0.9);

    // Ventilation slots (back)
    for (let i = 0; i < 15; i++) {
      const x = -0.07 + i * 0.01;
      await createPart(client, laptopId, `Vent_${i}`, { x, y: 0.008, z: -0.118 }, { x: 0.003, y: 0.004, z: 0.002 }, darkGray, 0.2);
    }

    console.log('\n💻 Laptop created!');
  } finally {
    client.disconnect();
  }
}

main();

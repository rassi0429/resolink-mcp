import { ResoniteLinkClient } from '../index';

async function createPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number }
): Promise<void> {
  // 1. Create slot
  await client.addSlot({ parentId, name, position, scale, isActive: true });

  // 2. Find slot
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return;
  const slotId = slot.id;

  // 3. Add components
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.SphereMesh' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.SphereCollider' });

  // 4. Get component IDs
  const slotData = await client.getSlot({ slotId, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return;

  const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.SphereMesh');
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
  if (!mesh || !renderer || !material) return;

  // 5. Set Mesh reference
  await client.updateComponent({
    id: renderer.id!,
    members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any,
  });

  // 6. Add Materials element (empty first)
  await client.updateComponent({
    id: renderer.id!,
    members: {
      Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] },
    } as any,
  });

  // 7. Get Materials element ID and set targetId
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

  // 8. Set color
  await client.updateComponent({
    id: material.id!,
    members: {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.7 },
    } as any,
  });

  console.log(`  ${name} ✓`);
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('💩 Creating Poop...\n');

    // Create parent
    await client.addSlot({ name: 'Poop', position: { x: 2, y: 0, z: 1 }, isActive: true });
    const poop = await client.findSlotByName('Poop', 'Root', 1);
    if (!poop?.id) { console.error('Failed'); return; }
    const poopId = poop.id;

    await client.addComponent({ containerSlotId: poopId, componentType: '[FrooxEngine]FrooxEngine.Grabbable' });

    const brown = { r: 0.45, g: 0.25, b: 0.1 };
    const darkBrown = { r: 0.35, g: 0.18, b: 0.08 };

    // Spiral poop shape - bottom to top, getting smaller
    // Layer 1 (bottom) - largest
    await createPart(client, poopId, 'Layer1_1', { x: 0.12, y: 0.08, z: 0 }, { x: 0.25, y: 0.16, z: 0.25 }, brown);
    await createPart(client, poopId, 'Layer1_2', { x: -0.06, y: 0.08, z: 0.1 }, { x: 0.23, y: 0.16, z: 0.23 }, darkBrown);
    await createPart(client, poopId, 'Layer1_3', { x: -0.1, y: 0.08, z: -0.08 }, { x: 0.24, y: 0.16, z: 0.24 }, brown);
    await createPart(client, poopId, 'Layer1_4', { x: 0.08, y: 0.08, z: -0.1 }, { x: 0.22, y: 0.16, z: 0.22 }, darkBrown);

    // Layer 2 - medium
    await createPart(client, poopId, 'Layer2_1', { x: 0.08, y: 0.22, z: 0.02 }, { x: 0.2, y: 0.14, z: 0.2 }, darkBrown);
    await createPart(client, poopId, 'Layer2_2', { x: -0.04, y: 0.22, z: 0.06 }, { x: 0.19, y: 0.14, z: 0.19 }, brown);
    await createPart(client, poopId, 'Layer2_3', { x: -0.06, y: 0.22, z: -0.05 }, { x: 0.2, y: 0.14, z: 0.2 }, darkBrown);
    await createPart(client, poopId, 'Layer2_4', { x: 0.05, y: 0.22, z: -0.06 }, { x: 0.18, y: 0.14, z: 0.18 }, brown);

    // Layer 3 - smaller
    await createPart(client, poopId, 'Layer3_1', { x: 0.04, y: 0.34, z: 0.02 }, { x: 0.15, y: 0.12, z: 0.15 }, brown);
    await createPart(client, poopId, 'Layer3_2', { x: -0.03, y: 0.34, z: 0.03 }, { x: 0.14, y: 0.12, z: 0.14 }, darkBrown);
    await createPart(client, poopId, 'Layer3_3', { x: -0.03, y: 0.34, z: -0.03 }, { x: 0.15, y: 0.12, z: 0.15 }, brown);

    // Layer 4 - top
    await createPart(client, poopId, 'Layer4_1', { x: 0.02, y: 0.44, z: 0.01 }, { x: 0.11, y: 0.1, z: 0.11 }, darkBrown);
    await createPart(client, poopId, 'Layer4_2', { x: -0.02, y: 0.44, z: -0.01 }, { x: 0.1, y: 0.1, z: 0.1 }, brown);

    // Tip
    await createPart(client, poopId, 'Tip', { x: 0, y: 0.52, z: 0 }, { x: 0.06, y: 0.08, z: 0.06 }, darkBrown);

    console.log('\n💩 Poop created!');
  } finally {
    client.disconnect();
  }
}

main();

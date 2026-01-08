import { ResoniteLinkClient } from '../index';

async function createPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  meshType: string = 'SphereMesh'
): Promise<string | null> {
  // 1. Create slot
  let response = await client.addSlot({
    parentId,
    name,
    position,
    scale,
    isActive: true,
  });
  if (!response.success) {
    console.error(`Failed to create ${name}: ${response.errorInfo}`);
    return null;
  }

  // 2. Find slot
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot || !slot.id) {
    console.error(`Could not find ${name}`);
    return null;
  }
  const slotId = slot.id;

  // 3. Add Mesh
  response = await client.addComponent({
    containerSlotId: slotId,
    componentType: `[FrooxEngine]FrooxEngine.${meshType}`,
  });

  // 4. Add MeshRenderer
  response = await client.addComponent({
    containerSlotId: slotId,
    componentType: '[FrooxEngine]FrooxEngine.MeshRenderer',
  });

  // 5. Add Material
  response = await client.addComponent({
    containerSlotId: slotId,
    componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic',
  });

  // 6. Add Collider
  response = await client.addComponent({
    containerSlotId: slotId,
    componentType: '[FrooxEngine]FrooxEngine.SphereCollider',
  });

  // 7. Get component IDs
  const slotData = await client.getSlot({
    slotId,
    depth: 0,
    includeComponentData: true,
  });

  if (!slotData.success || !slotData.data.components) {
    return slotId;
  }

  const mesh = slotData.data.components.find(c => c.componentType?.includes('Mesh') && !c.componentType?.includes('Renderer'));
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

  if (!mesh || !renderer || !material) {
    return slotId;
  }

  // 8. Set Mesh reference
  await client.updateComponent({
    id: renderer.id!,
    members: {
      Mesh: { $type: 'reference', targetId: mesh.id },
    } as any,
  });

  // 9. Get Materials element ID and set
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

  // 10. Set color
  await client.updateComponent({
    id: material.id!,
    members: {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    } as any,
  });

  console.log(`  Created ${name}`);
  return slotId;
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('Creating Snowman...\n');

    // Create parent slot
    let response = await client.addSlot({
      name: 'Snowman',
      position: { x: 1, y: 0, z: 1 },
      isActive: true,
    });

    const snowman = await client.findSlotByName('Snowman', 'Root', 1);
    if (!snowman?.id) {
      console.error('Failed to create Snowman parent');
      return;
    }
    const snowmanId = snowman.id;
    console.log(`Snowman parent: ${snowmanId}`);

    // Add Grabbable to parent
    await client.addComponent({
      containerSlotId: snowmanId,
      componentType: '[FrooxEngine]FrooxEngine.Grabbable',
    });

    const white = { r: 0.95, g: 0.95, b: 1 };
    const black = { r: 0.1, g: 0.1, b: 0.1 };
    const orange = { r: 1, g: 0.5, b: 0 };
    const brown = { r: 0.4, g: 0.2, b: 0.1 };

    // Body parts (spheres)
    await createPart(client, snowmanId, 'Body_Bottom', { x: 0, y: 0.4, z: 0 }, { x: 0.8, y: 0.8, z: 0.8 }, white);
    await createPart(client, snowmanId, 'Body_Middle', { x: 0, y: 1.0, z: 0 }, { x: 0.6, y: 0.6, z: 0.6 }, white);
    await createPart(client, snowmanId, 'Body_Head', { x: 0, y: 1.5, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }, white);

    // Eyes (small black spheres)
    await createPart(client, snowmanId, 'Eye_Left', { x: -0.08, y: 1.55, z: 0.17 }, { x: 0.05, y: 0.05, z: 0.05 }, black);
    await createPart(client, snowmanId, 'Eye_Right', { x: 0.08, y: 1.55, z: 0.17 }, { x: 0.05, y: 0.05, z: 0.05 }, black);

    // Nose (orange cone - using box as approximation)
    await createPart(client, snowmanId, 'Nose', { x: 0, y: 1.48, z: 0.22 }, { x: 0.05, y: 0.05, z: 0.15 }, orange, 'BoxMesh');

    // Buttons (black spheres on middle body)
    await createPart(client, snowmanId, 'Button_1', { x: 0, y: 1.15, z: 0.28 }, { x: 0.05, y: 0.05, z: 0.05 }, black);
    await createPart(client, snowmanId, 'Button_2', { x: 0, y: 1.0, z: 0.3 }, { x: 0.05, y: 0.05, z: 0.05 }, black);
    await createPart(client, snowmanId, 'Button_3', { x: 0, y: 0.85, z: 0.28 }, { x: 0.05, y: 0.05, z: 0.05 }, black);

    // Arms (brown boxes)
    await createPart(client, snowmanId, 'Arm_Left', { x: -0.4, y: 1.0, z: 0 }, { x: 0.4, y: 0.03, z: 0.03 }, brown, 'BoxMesh');
    await createPart(client, snowmanId, 'Arm_Right', { x: 0.4, y: 1.0, z: 0 }, { x: 0.4, y: 0.03, z: 0.03 }, brown, 'BoxMesh');

    console.log('\n⛄ Snowman created!');
  } finally {
    client.disconnect();
  }
}

main();

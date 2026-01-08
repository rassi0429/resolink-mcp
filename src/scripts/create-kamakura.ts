import { ResoniteLinkClient } from '../client.js';

async function createPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number; a?: number },
  meshType: string = 'SphereMesh',
  meshParams?: Record<string, any>
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
  await client.addComponent({
    containerSlotId: slotId,
    componentType: `[FrooxEngine]FrooxEngine.${meshType}`,
  });

  // 4. Add MeshRenderer
  await client.addComponent({
    containerSlotId: slotId,
    componentType: '[FrooxEngine]FrooxEngine.MeshRenderer',
  });

  // 5. Add Material
  await client.addComponent({
    containerSlotId: slotId,
    componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic',
  });

  // 6. Get component IDs
  const slotData = await client.getSlot({
    slotId,
    depth: 0,
    includeComponentData: true,
  });

  if (!slotData.success || !slotData.data.components) {
    return slotId;
  }

  const mesh = slotData.data.components.find(c => c.componentType?.includes(meshType));
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

  if (!mesh || !renderer || !material) {
    return slotId;
  }

  // 7. Set mesh parameters if provided
  if (meshParams) {
    await client.updateComponent({
      id: mesh.id!,
      members: meshParams as any,
    });
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
      AlbedoColor: { $type: 'colorX', value: { r: color.r, g: color.g, b: color.b, a: color.a ?? 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.1 },
      Metallic: { $type: 'float', value: 0.0 },
    } as any,
  });

  console.log(`  Created ${name}`);
  return slotId;
}

async function addLight(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  intensity: number,
  range: number
): Promise<string | null> {
  // Create slot
  let response = await client.addSlot({
    parentId,
    name,
    position,
    isActive: true,
  });
  if (!response.success) {
    console.error(`Failed to create ${name}`);
    return null;
  }

  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return null;

  // Add Light component
  await client.addComponent({
    containerSlotId: slot.id,
    componentType: '[FrooxEngine]FrooxEngine.Light',
  });

  const slotData = await client.getSlot({
    slotId: slot.id,
    depth: 0,
    includeComponentData: true,
  });

  const lightComp = slotData.data?.components?.find(c => c.componentType?.includes('Light'));
  if (lightComp?.id) {
    await client.updateComponent({
      id: lightComp.id,
      members: {
        Color: { $type: 'colorX', value: { r: color.r, g: color.g, b: color.b, a: 1 } },
        Intensity: { $type: 'float', value: intensity },
        Range: { $type: 'float', value: range },
      } as any,
    });
  }

  console.log(`  Created ${name}`);
  return slot.id;
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('Creating Kamakura...\n');

    const slotName = `Kamakura_${Date.now()}`;

    // Create parent slot at origin
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 0, z: 0 },
      isActive: true,
    });

    const kamakura = await client.findSlotByName(slotName, 'Root', 1);
    if (!kamakura?.id) {
      console.error('Failed to create Kamakura parent');
      return;
    }
    const kamakuraId = kamakura.id;
    console.log(`Kamakura parent: ${kamakuraId}`);

    // Colors
    const snowWhite = { r: 0.95, g: 0.97, b: 1.0 };
    const entranceDark = { r: 0.08, g: 0.08, b: 0.12 };
    const warmOrange = { r: 1.0, g: 0.5, b: 0.2 };

    // Main dome (large sphere)
    await createPart(
      client,
      kamakuraId,
      'Dome',
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      snowWhite,
      'SphereMesh',
      { Radius: { $type: 'float', value: 2.5 } }
    );

    // Entrance (dark ellipsoid to simulate hole)
    await createPart(
      client,
      kamakuraId,
      'Entrance',
      { x: 0, y: 0.7, z: 2.0 },
      { x: 1.0, y: 0.8, z: 0.4 },
      entranceDark,
      'SphereMesh',
      { Radius: { $type: 'float', value: 0.7 } }
    );

    // Inner warm light
    await addLight(
      client,
      kamakuraId,
      'InsideLight',
      { x: 0, y: 1.0, z: 0 },
      warmOrange,
      3.0,
      5.0
    );

    // Snow ground (large flat box)
    await createPart(
      client,
      kamakuraId,
      'SnowGround',
      { x: 0, y: -0.05, z: 0 },
      { x: 1, y: 1, z: 1 },
      snowWhite,
      'BoxMesh',
      { Size: { $type: 'float3', value: { x: 10, y: 0.1, z: 10 } } }
    );

    // Extra entrance passage (darker, recessed)
    await createPart(
      client,
      kamakuraId,
      'EntranceInner',
      { x: 0, y: 0.6, z: 1.5 },
      { x: 0.8, y: 0.7, z: 0.6 },
      { r: 0.05, g: 0.05, b: 0.08 },
      'SphereMesh',
      { Radius: { $type: 'float', value: 0.6 } }
    );

    // Small accent light at entrance (subtle glow)
    await addLight(
      client,
      kamakuraId,
      'EntranceGlow',
      { x: 0, y: 0.5, z: 1.8 },
      warmOrange,
      0.5,
      2.0
    );

    console.log('\nKamakura created successfully!');
    console.log('- Large snow dome (radius 2.5m)');
    console.log('- Dark entrance opening');
    console.log('- Warm orange lights inside');
    console.log('- Snow ground (10m x 10m)');

  } finally {
    client.disconnect();
  }
}

main().catch(console.error);

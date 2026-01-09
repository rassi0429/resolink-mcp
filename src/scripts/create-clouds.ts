import { ResoniteLinkClient } from '../client.js';

async function createCloudPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number }
): Promise<void> {
  await client.addSlot({ parentId, name, position, scale, isActive: true });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return;
  const slotId = slot.id;

  // Use SphereMesh for fluffy cloud look
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.SphereMesh' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

  const slotData = await client.getSlot({ slotId, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return;

  const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.SphereMesh');
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

  // Soft white cloud color with slight glow
  await client.updateComponent({
    id: material.id!,
    members: {
      AlbedoColor: { $type: 'colorX', value: { r: 0.98, g: 0.98, b: 1, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.1 },
      Metallic: { $type: 'float', value: 0 },
      EmissiveColor: { $type: 'colorX', value: { r: 0.15, g: 0.15, b: 0.18, a: 1, profile: 'sRGB' } },
    } as any,
  });
}

async function createCloud(
  client: ResoniteLinkClient,
  position: { x: number; y: number; z: number },
  name: string,
  size: 'small' | 'medium' | 'large'
): Promise<void> {
  await client.addSlot({ name, position, isActive: true });
  const cloud = await client.findSlotByName(name, 'Root', 1);
  if (!cloud?.id) return;
  const cloudId = cloud.id;

  const scale = size === 'large' ? 1.5 : size === 'medium' ? 1 : 0.7;

  // Create fluffy cloud shape with multiple overlapping spheres
  const parts = [
    // Main body
    { x: 0, y: 0, z: 0, sx: 4 * scale, sy: 2 * scale, sz: 3 * scale },
    { x: 2.5 * scale, y: 0.3 * scale, z: 0, sx: 3 * scale, sy: 1.8 * scale, sz: 2.5 * scale },
    { x: -2 * scale, y: 0.2 * scale, z: 0.5 * scale, sx: 3.5 * scale, sy: 1.6 * scale, sz: 2.8 * scale },
    // Top puffs
    { x: 0.5 * scale, y: 1 * scale, z: 0, sx: 2.5 * scale, sy: 1.5 * scale, sz: 2 * scale },
    { x: -1 * scale, y: 0.8 * scale, z: -0.3 * scale, sx: 2 * scale, sy: 1.3 * scale, sz: 1.8 * scale },
    { x: 1.8 * scale, y: 0.6 * scale, z: 0.4 * scale, sx: 2.2 * scale, sy: 1.4 * scale, sz: 2 * scale },
    // Side extensions
    { x: 3.5 * scale, y: -0.2 * scale, z: 0, sx: 2 * scale, sy: 1.2 * scale, sz: 1.8 * scale },
    { x: -3.2 * scale, y: -0.1 * scale, z: 0.3 * scale, sx: 2.2 * scale, sy: 1.3 * scale, sz: 2 * scale },
  ];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    await createCloudPart(client, cloudId, `Puff${i}`,
      { x: p.x, y: p.y, z: p.z },
      { x: p.sx, y: p.sy, z: p.sz }
    );
  }
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('☁️ Creating Clouds...\n');

    // Create clouds at various positions in the sky
    const clouds = [
      // Over the town - high altitude
      { pos: { x: -20, y: 30, z: -10 }, name: 'Cloud1', size: 'large' as const },
      { pos: { x: 15, y: 35, z: 5 }, name: 'Cloud2', size: 'medium' as const },
      { pos: { x: -5, y: 32, z: 25 }, name: 'Cloud3', size: 'large' as const },
      { pos: { x: 25, y: 28, z: -15 }, name: 'Cloud4', size: 'small' as const },
      { pos: { x: -30, y: 33, z: 15 }, name: 'Cloud5', size: 'medium' as const },

      // Mid altitude
      { pos: { x: 0, y: 25, z: -25 }, name: 'Cloud6', size: 'large' as const },
      { pos: { x: 35, y: 27, z: 20 }, name: 'Cloud7', size: 'medium' as const },
      { pos: { x: -25, y: 26, z: 35 }, name: 'Cloud8', size: 'small' as const },

      // Background clouds - further away and larger
      { pos: { x: -50, y: 40, z: -30 }, name: 'Cloud9', size: 'large' as const },
      { pos: { x: 50, y: 38, z: 40 }, name: 'Cloud10', size: 'large' as const },
      { pos: { x: 0, y: 42, z: -50 }, name: 'Cloud11', size: 'medium' as const },
      { pos: { x: -40, y: 36, z: 50 }, name: 'Cloud12', size: 'large' as const },

      // A few wispy smaller clouds
      { pos: { x: 10, y: 22, z: 35 }, name: 'Cloud13', size: 'small' as const },
      { pos: { x: -35, y: 24, z: 0 }, name: 'Cloud14', size: 'small' as const },
      { pos: { x: 40, y: 30, z: -5 }, name: 'Cloud15', size: 'small' as const },
    ];

    for (const cloud of clouds) {
      console.log(`  Creating ${cloud.name} (${cloud.size})...`);
      await createCloud(client, cloud.pos, cloud.name, cloud.size);
    }

    console.log('\n☁️ 15 Clouds created in the sky!');

  } finally {
    client.disconnect();
  }
}

main();

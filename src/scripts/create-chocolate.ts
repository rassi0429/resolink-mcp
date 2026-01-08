import { ResoniteLinkClient } from '../index';

async function createPart(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  smoothness: number = 0.8
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

  await client.updateComponent({
    id: material.id!,
    members: {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: smoothness },
      Metallic: { $type: 'float', value: 0.1 },
    } as any,
  });

  console.log(`  ${name} ✓`);
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('🍫 Creating Chocolate Bar...\n');

    await client.addSlot({ name: 'Chocolate', position: { x: 3, y: 0.5, z: 1 }, isActive: true });
    const choco = await client.findSlotByName('Chocolate', 'Root', 1);
    if (!choco?.id) { console.error('Failed'); return; }
    const chocoId = choco.id;

    await client.addComponent({ containerSlotId: chocoId, componentType: '[FrooxEngine]FrooxEngine.Grabbable' });

    const darkChoco = { r: 0.25, g: 0.12, b: 0.05 };
    const milkChoco = { r: 0.4, g: 0.22, b: 0.1 };

    // Base plate
    await createPart(client, chocoId, 'Base', { x: 0, y: 0, z: 0 }, { x: 0.4, y: 0.03, z: 0.25 }, darkChoco, 0.85);

    // Chocolate squares (4x3 grid)
    const squareSize = 0.08;
    const gap = 0.005;
    const startX = -0.135;
    const startZ = -0.075;

    let count = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        count++;
        const x = startX + col * (squareSize + gap);
        const z = startZ + row * (squareSize + gap);
        const color = (row + col) % 2 === 0 ? darkChoco : milkChoco;
        await createPart(
          client, chocoId,
          `Square_${count}`,
          { x, y: 0.04, z },
          { x: squareSize, y: 0.025, z: squareSize },
          color, 0.9
        );
      }
    }

    console.log('\n🍫 Chocolate Bar created!');
  } finally {
    client.disconnect();
  }
}

main();

import { ResoniteLinkClient } from '../client.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('Cleaning up all objects...\n');

    // List of all objects we created
    const objectsToDelete = [
      // Houses
      'House1', 'House2', 'House3', 'House4', 'House5',
      'House6', 'House7', 'House8', 'House9', 'House10',
      'House', 'BlueHouse',
      // Shops
      'Cafe', 'Grocery', 'Bookstore',
      // Roads
      'MainRoad', 'CrossRoad', 'SideRoad1', 'SideRoad2',
      // Cars
      'Car1', 'Car2', 'Car3', 'Car4', 'Car5',
      'Car6', 'Car7', 'Car8', 'Car9', 'Car10', 'Car11',
      // Infrastructure
      'TrafficLight1', 'TrafficLight2', 'TrafficLight3', 'TrafficLight4',
      'StopSign1', 'StopSign2',
      'BusStop1', 'BusStop2',
      'StreetLight1', 'StreetLight2', 'StreetLight3', 'StreetLight4',
      'StreetLight5', 'StreetLight6', 'StreetLight7', 'StreetLight8',
      'FireHydrant1', 'FireHydrant2', 'FireHydrant3',
      'TrashCan1', 'TrashCan2', 'TrashCan3', 'TrashCan4',
      'Mailbox1', 'Mailbox2', 'Mailbox3', 'Mailbox4',
      // Park
      'CentralPark',
      // Trees
      'Tree1', 'Tree2', 'Tree3', 'Tree4', 'Tree5',
      'Tree6', 'Tree7', 'Tree8', 'Tree9', 'Tree10',
      'Tree11', 'Tree12', 'Tree13', 'Tree14', 'Tree15',
      // Clouds
      'Cloud1', 'Cloud2', 'Cloud3', 'Cloud4', 'Cloud5',
      'Cloud6', 'Cloud7', 'Cloud8', 'Cloud9', 'Cloud10',
      'Cloud11', 'Cloud12', 'Cloud13', 'Cloud14', 'Cloud15',
      // Previous objects
      'Chair', 'Snowman', 'Poop', 'Chocolate', 'Laptop',
      // Old floor if exists
      'Floor', 'Ground',
    ];

    let deleted = 0;
    for (const name of objectsToDelete) {
      try {
        const slot = await client.findSlotByName(name, 'Root', 1);
        if (slot?.id) {
          await client.removeSlot(slot.id);
          console.log(`  Deleted: ${name}`);
          deleted++;
        }
      } catch (e) {
        // Object doesn't exist, skip
      }
    }

    console.log(`\nDeleted ${deleted} objects.`);

    // Create a simple floor
    console.log('\nCreating floor...');

    await client.addSlot({ name: 'Floor', position: { x: 0, y: -0.05, z: 0 }, isActive: true });
    const floor = await client.findSlotByName('Floor', 'Root', 1);
    if (!floor?.id) {
      console.log('Failed to create floor');
      return;
    }

    // Add mesh, renderer, material
    await client.addComponent({ containerSlotId: floor.id, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
    await client.addComponent({ containerSlotId: floor.id, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
    await client.addComponent({ containerSlotId: floor.id, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

    const slotData = await client.getSlot({ slotId: floor.id, depth: 0, includeComponentData: true });
    if (!slotData.success || !slotData.data.components) return;

    const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxMesh');
    const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
    const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

    if (!mesh || !renderer || !material) return;

    // Large flat floor
    await client.updateComponent({
      id: mesh.id!,
      members: {
        Size: { $type: 'float3', value: { x: 100, y: 0.1, z: 100 } },
      } as any,
    });

    // Connect mesh to renderer
    await client.updateComponent({
      id: renderer.id!,
      members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any,
    });

    // Connect material to renderer
    await client.updateComponent({
      id: renderer.id!,
      members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any,
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

    // Gray floor color
    await client.updateComponent({
      id: material.id!,
      members: {
        AlbedoColor: { $type: 'colorX', value: { r: 0.5, g: 0.5, b: 0.5, a: 1, profile: 'sRGB' } },
        Smoothness: { $type: 'float', value: 0.3 },
        Metallic: { $type: 'float', value: 0 },
      } as any,
    });

    console.log('\n✓ Reset complete! Only floor remains (100x100 gray surface)');

  } finally {
    client.disconnect();
  }
}

main();

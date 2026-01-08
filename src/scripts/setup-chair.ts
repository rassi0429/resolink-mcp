import { ResoniteLinkClient } from '../index';

interface Part {
  slotId: string;
  name: string;
  boxMeshId: string;
  meshRendererId: string;
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';

  const parts: Part[] = [
    { slotId: 'Reso_A8E5', name: 'Backrest', boxMeshId: 'Reso_A918', meshRendererId: 'Reso_A919' },
    { slotId: 'Reso_A8E6', name: 'Leg_FL', boxMeshId: 'Reso_A91A', meshRendererId: 'Reso_A91B' },
    { slotId: 'Reso_A8E7', name: 'Leg_FR', boxMeshId: 'Reso_A91C', meshRendererId: 'Reso_A91D' },
    { slotId: 'Reso_A8E8', name: 'Leg_BL', boxMeshId: 'Reso_A91E', meshRendererId: 'Reso_A91F' },
    { slotId: 'Reso_A8E9', name: 'Leg_BR', boxMeshId: 'Reso_A920', meshRendererId: 'Reso_A921' },
  ];

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    for (const part of parts) {
      console.log(`Setting up ${part.name}...`);

      // 1. Set Mesh reference on MeshRenderer
      console.log(`  Setting Mesh reference...`);
      let response = await client.updateComponent({
        id: part.meshRendererId,
        members: {
          Mesh: {
            $type: 'reference',
            targetId: part.boxMeshId,
          },
        } as any,
      });
      if (!response.success) {
        console.error(`  Error setting Mesh: ${response.errorInfo}`);
        continue;
      }

      // 2. Add PBS_Metallic material
      console.log(`  Adding PBS_Metallic...`);
      response = await client.addComponent({
        containerSlotId: part.slotId,
        componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic',
      });
      if (!response.success) {
        console.error(`  Error adding material: ${response.errorInfo}`);
        continue;
      }

      // 3. Get the material ID
      const slotData = await client.getSlot({
        slotId: part.slotId,
        depth: 0,
        includeComponentData: true,
      });

      if (!slotData.success || !slotData.data.components) {
        console.error(`  Error getting slot data`);
        continue;
      }

      const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
      if (!material) {
        console.error(`  Material not found`);
        continue;
      }

      // 4. Set Materials on MeshRenderer
      console.log(`  Setting Materials reference to ${material.id}...`);
      response = await client.updateComponent({
        id: part.meshRendererId,
        members: {
          Materials: {
            $type: 'list',
            elements: [
              {
                $type: 'reference',
                targetId: material.id,
              },
            ],
          },
        } as any,
      });

      if (response.success) {
        console.log(`  ${part.name} setup complete!`);
      } else {
        console.error(`  Error setting Materials: ${response.errorInfo}`);
      }
    }

    console.log('\nAll parts setup complete!');
  } finally {
    client.disconnect();
  }
}

main();

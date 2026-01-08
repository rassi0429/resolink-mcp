import { ResoniteLinkClient } from '../index';

async function fixPart(client: ResoniteLinkClient, slotId: string, name: string) {
  // Get slot components
  const slotData = await client.getSlot({
    slotId,
    depth: 0,
    includeComponentData: true,
  });

  if (!slotData.success || !slotData.data.components) {
    console.error(`  ${name}: Failed to get slot data`);
    return;
  }

  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

  if (!renderer || !material) {
    console.error(`  ${name}: Missing renderer or material`);
    return;
  }

  // Get renderer details
  const rendererData = await client.getComponent(renderer.id!);
  if (!rendererData.success) {
    console.error(`  ${name}: Failed to get renderer data`);
    return;
  }

  const materials = (rendererData.data.members as any)?.Materials;
  if (!materials?.elements?.[0]) {
    console.error(`  ${name}: No Materials element found`);
    return;
  }

  const matRefId = materials.elements[0].id;
  console.log(`  ${name}: Setting Materials[${matRefId}] -> ${material.id}`);

  // Update the existing element's targetId
  const response = await client.updateComponent({
    id: renderer.id!,
    members: {
      Materials: {
        $type: 'list',
        elements: [
          { $type: 'reference', id: matRefId, targetId: material.id },
        ],
      },
    } as any,
  });

  if (response.success) {
    console.log(`  ${name}: Fixed!`);
  } else {
    console.error(`  ${name}: Error - ${response.errorInfo}`);
  }
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';

  const parts = [
    { id: 'Reso_ACFE', name: 'Body_Bottom' },
    { id: 'Reso_AD47', name: 'Body_Middle' },
    { id: 'Reso_AD90', name: 'Body_Head' },
    { id: 'Reso_ADD9', name: 'Eye_Left' },
    { id: 'Reso_AE22', name: 'Eye_Right' },
    { id: 'Reso_AE6B', name: 'Nose' },
    { id: 'Reso_AEB1', name: 'Button_1' },
    { id: 'Reso_AEFA', name: 'Button_2' },
    { id: 'Reso_AF43', name: 'Button_3' },
    { id: 'Reso_AF8C', name: 'Arm_Left' },
    { id: 'Reso_AFD2', name: 'Arm_Right' },
  ];

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('Fixing Snowman materials (step 2)...\n');

    for (const part of parts) {
      await fixPart(client, part.id, part.name);
    }

    console.log('\n⛄ Done!');
  } finally {
    client.disconnect();
  }
}

main();

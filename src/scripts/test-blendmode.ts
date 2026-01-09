import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({
    url: WS_URL,
    debug: true,
    requestTimeout: 10000,  // 10s timeout for faster feedback
  });
  await client.connect();

  // First delete any existing test slot
  const existing = await client.findSlotByName('BlendModeTest', 'Root', 1);
  if (existing?.id) {
    console.log('Deleting existing test slot...');
    await client.removeSlot(existing.id);
  }

  try {
    console.log('Testing BlendMode...\n');

    // Create a test slot with a box
    await client.addSlot({
      name: 'BlendModeTest',
      position: { x: 0, y: 1, z: 0 },
      isActive: true
    });
    const slot = await client.findSlotByName('BlendModeTest', 'Root', 1);
    if (!slot?.id) {
      console.log('Failed to create slot');
      return;
    }
    console.log('Created slot:', slot.id);

    // Add components
    await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
    await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
    await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

    // Get components
    const slotData = await client.getSlot({ slotId: slot.id, depth: 0, includeComponentData: true });
    if (!slotData.success || !slotData.data.components) {
      console.log('Failed to get slot data');
      return;
    }

    const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxMesh');
    const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
    const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

    console.log('Mesh ID:', mesh?.id);
    console.log('Renderer ID:', renderer?.id);
    console.log('Material ID:', material?.id);

    // Get material data to see current BlendMode format
    const materialData = await client.getComponent(material!.id!);
    console.log('\nMaterial data:', JSON.stringify(materialData.data, null, 2));

    // Try different BlendMode formats
    console.log('\n--- Testing BlendMode formats ---\n');

    // Get the BlendMode member ID
    const blendModeId = (materialData.data.members as any)?.BlendMode?.id;
    console.log('BlendMode member ID:', blendModeId);

    // Format 1: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' }
    console.log('\nTrying format 1: { $type: "enum", value: "Alpha", enumType: "BlendMode" }');
    const result1 = await client.updateComponent({
      id: material!.id!,
      members: {
        BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' }
      } as any
    });
    console.log('Result 1:', result1.success, result1.errorInfo);

    // Check if it worked
    const check1 = await client.getComponent(material!.id!);
    const blendMode1 = (check1.data.members as any)?.BlendMode;
    console.log('BlendMode after format 1:', JSON.stringify(blendMode1));

    // Format 2: with id
    console.log('\nTrying format 2: with id included');
    const result2 = await client.updateComponent({
      id: material!.id!,
      members: {
        BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode', id: blendModeId }
      } as any
    });
    console.log('Result 2:', result2.success, result2.errorInfo);

    const check2 = await client.getComponent(material!.id!);
    const blendMode2 = (check2.data.members as any)?.BlendMode;
    console.log('BlendMode after format 2:', JSON.stringify(blendMode2));

    // Format 3: just value with id
    console.log('\nTrying format 3: { value: "Alpha", id: ... }');
    const result3 = await client.updateComponent({
      id: material!.id!,
      members: {
        BlendMode: { value: 'Alpha', id: blendModeId }
      } as any
    });
    console.log('Result 3:', result3.success, result3.errorInfo);

    const check3 = await client.getComponent(material!.id!);
    const blendMode3 = (check3.data.members as any)?.BlendMode;
    console.log('BlendMode after format 3:', JSON.stringify(blendMode3));

    // Also set alpha on color
    console.log('\nSetting AlbedoColor with alpha 0.3...');
    const colorResult = await client.updateComponent({
      id: material!.id!,
      members: {
        AlbedoColor: { $type: 'colorX', value: { r: 0.6, g: 0.75, b: 0.9, a: 0.3, profile: 'sRGB' } }
      } as any
    });
    console.log('Color result:', colorResult.success, colorResult.errorInfo);

    const checkColor = await client.getComponent(material!.id!);
    const albedo = (checkColor.data.members as any)?.AlbedoColor;
    console.log('AlbedoColor after update:', JSON.stringify(albedo));

    console.log('\nTest complete! Check the box in Resonite to see if it\'s transparent.');

  } finally {
    client.disconnect();
  }
}

main().then(() => {
  console.log('\nScript finished');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

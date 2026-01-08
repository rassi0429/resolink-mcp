/**
 * ProtoFlux 1+1 作成スクリプト
 *
 * 2つの ValueInput<int> ノードを足し算して結果を表示するデモ
 *
 * 使い方: npx tsx src/scripts/create-flux-add.ts [ws://localhost:58971]
 */
import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:58971';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating 1+1 ProtoFlux...\n');

    // Create container slot
    const slotName = `Flux_${Date.now()}`; // ユニークな名前
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 2 },
      isActive: true
    });
    const container = await client.findSlotByName(slotName, 'Root', 1);
    if (!container?.id) throw new Error('Failed to create container');
    const containerId = container.id;
    console.log(`  Created container: ${slotName} (${containerId})`);

    // Create child slots
    await client.addSlot({ parentId: containerId, name: 'Input1', position: { x: -0.3, y: 0.1, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'Input2', position: { x: -0.3, y: -0.1, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'Add', position: { x: 0, y: 0, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'Display', position: { x: 0.3, y: 0, z: 0 }, isActive: true });

    // Get slot IDs
    const containerData = await client.getSlot({ slotId: containerId, depth: 1, includeComponentData: false });
    const children = containerData.data?.children || [];

    const input1Slot = children.find(c => c.name?.value === 'Input1');
    const input2Slot = children.find(c => c.name?.value === 'Input2');
    const addSlot = children.find(c => c.name?.value === 'Add');
    const displaySlot = children.find(c => c.name?.value === 'Display');

    if (!input1Slot?.id || !input2Slot?.id || !addSlot?.id || !displaySlot?.id) {
      throw new Error('Failed to find child slots');
    }
    console.log('  Created child slots');

    // Add ProtoFlux components
    await client.addComponent({
      containerSlotId: input1Slot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    await client.addComponent({
      containerSlotId: input2Slot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    await client.addComponent({
      containerSlotId: addSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.ValueAdd<int>',
    });
    await client.addComponent({
      containerSlotId: displaySlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueDisplay<int>',
    });
    console.log('  Added ProtoFlux components');

    // Get component IDs
    const [input1Data, input2Data, addData, displayData] = await Promise.all([
      client.getSlot({ slotId: input1Slot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: input2Slot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: addSlot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: displaySlot.id, depth: 0, includeComponentData: true }),
    ]);

    const input1Comp = input1Data.data?.components?.find(c => c.componentType?.includes('ValueInput'));
    const input2Comp = input2Data.data?.components?.find(c => c.componentType?.includes('ValueInput'));
    const addComp = addData.data?.components?.find(c => c.componentType?.includes('ValueAdd'));
    const displayComp = displayData.data?.components?.find(c => c.componentType?.includes('ValueDisplay'));

    if (!input1Comp?.id || !input2Comp?.id || !addComp?.id || !displayComp?.id) {
      throw new Error('Failed to find components');
    }
    console.log('  Found component IDs');

    // Set values and connect
    await client.updateComponent({
      id: input1Comp.id,
      members: { Value: { $type: 'int', value: 1 } } as any,
    });
    await client.updateComponent({
      id: input2Comp.id,
      members: { Value: { $type: 'int', value: 1 } } as any,
    });
    console.log('  Set input values to 1');

    await client.updateComponent({
      id: addComp.id,
      members: {
        A: { $type: 'reference', targetId: input1Comp.id },
        B: { $type: 'reference', targetId: input2Comp.id },
      } as any,
    });
    console.log('  Connected inputs to Add node');

    await client.updateComponent({
      id: displayComp.id,
      members: {
        Input: { $type: 'reference', targetId: addComp.id },
      } as any,
    });
    console.log('  Connected Add output to Display');

    console.log('\n1+1 ProtoFlux created!');
    console.log(`  Location: ${slotName}`);
    console.log('  Result: 2');

  } finally {
    client.disconnect();
  }
}

main();

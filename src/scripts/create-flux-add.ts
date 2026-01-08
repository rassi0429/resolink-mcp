/**
 * ProtoFlux 1+1 作成スクリプト
 *
 * 注意: このスクリプトは現在動作しません。
 * ResoniteLink モッドがジェネリック型（ValueInput<int> など）を
 * 解決できないため、ProtoFlux コンポーネントの追加に失敗します。
 *
 * 詳細は README.md の「制限事項: ProtoFlux コンポーネント」を参照。
 */
import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating 1+1 ProtoFlux...\n');

    // Create container slot for the Flux
    await client.addSlot({ name: 'OnePlusOne', position: { x: 0, y: 1, z: 0 }, isActive: true });
    const container = await client.findSlotByName('OnePlusOne', 'Root', 1);
    if (!container?.id) throw new Error('Failed to create container');
    const containerId = container.id;

    // Create ValueInput 1 slot
    await client.addSlot({ parentId: containerId, name: 'Input1', position: { x: -0.3, y: 0, z: 0 }, isActive: true });
    const input1Slot = await client.findSlotByName('Input1', containerId, 1);
    if (!input1Slot?.id) throw new Error('Failed to create Input1 slot');

    // Create ValueInput 2 slot
    await client.addSlot({ parentId: containerId, name: 'Input2', position: { x: -0.3, y: -0.2, z: 0 }, isActive: true });
    const input2Slot = await client.findSlotByName('Input2', containerId, 1);
    if (!input2Slot?.id) throw new Error('Failed to create Input2 slot');

    // Create Add slot
    await client.addSlot({ parentId: containerId, name: 'Add', position: { x: 0, y: -0.1, z: 0 }, isActive: true });
    const addSlot = await client.findSlotByName('Add', containerId, 1);
    if (!addSlot?.id) throw new Error('Failed to create Add slot');

    // Create Display slot
    await client.addSlot({ parentId: containerId, name: 'Display', position: { x: 0.3, y: -0.1, z: 0 }, isActive: true });
    const displaySlot = await client.findSlotByName('Display', containerId, 1);
    if (!displaySlot?.id) throw new Error('Failed to create Display slot');

    console.log('  Created slots');

    // Add ValueInput<int> components
    const res1 = await client.addComponent({
      containerSlotId: input1Slot.id,
      componentType: 'FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    console.log('  Input1 result:', res1.success, res1.errorInfo);

    const res2 = await client.addComponent({
      containerSlotId: input2Slot.id,
      componentType: 'FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<int>',
    });
    console.log('  Input2 result:', res2.success, res2.errorInfo);

    // Add ValueAddMulti<int> component
    const res3 = await client.addComponent({
      containerSlotId: addSlot.id,
      componentType: 'FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Operators.ValueAddMulti<int>',
    });
    console.log('  Add result:', res3.success, res3.errorInfo);

    // Add ValueDisplay<int> component
    const res4 = await client.addComponent({
      containerSlotId: displaySlot.id,
      componentType: 'FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueDisplay<int>',
    });
    console.log('  Display result:', res4.success, res4.errorInfo);

    console.log('  Added ValueDisplay component');

    // Get component IDs
    const input1Data = await client.getSlot({ slotId: input1Slot.id, depth: 0, includeComponentData: true });
    const input2Data = await client.getSlot({ slotId: input2Slot.id, depth: 0, includeComponentData: true });
    const addData = await client.getSlot({ slotId: addSlot.id, depth: 0, includeComponentData: true });
    const displayData = await client.getSlot({ slotId: displaySlot.id, depth: 0, includeComponentData: true });

    const input1Comp = input1Data.data?.components?.find(c => c.componentType?.includes('ValueInput'));
    const input2Comp = input2Data.data?.components?.find(c => c.componentType?.includes('ValueInput'));
    const addComp = addData.data?.components?.find(c => c.componentType?.includes('ValueAddMulti'));
    const displayComp = displayData.data?.components?.find(c => c.componentType?.includes('ValueDisplay'));

    if (!input1Comp || !input2Comp || !addComp || !displayComp) {
      throw new Error('Failed to find components');
    }

    console.log('  Found component IDs');

    // Set ValueInput values to 1
    await client.updateComponent({
      id: input1Comp.id!,
      members: { Value: { $type: 'int', value: 1 } } as any,
    });
    await client.updateComponent({
      id: input2Comp.id!,
      members: { Value: { $type: 'int', value: 1 } } as any,
    });

    console.log('  Set input values to 1');

    // Connect inputs to Add node
    // First add empty elements to the Inputs list
    await client.updateComponent({
      id: addComp.id!,
      members: {
        Inputs: {
          $type: 'list',
          elements: [
            { $type: 'reference', targetId: input1Comp.id },
            { $type: 'reference', targetId: input2Comp.id },
          ],
        },
      } as any,
    });

    // Get the element IDs from the list
    const addCompData = await client.getComponent(addComp.id!);
    const inputElements = (addCompData.data?.members as any)?.Inputs?.elements || [];

    if (inputElements.length >= 2) {
      await client.updateComponent({
        id: addComp.id!,
        members: {
          Inputs: {
            $type: 'list',
            elements: [
              { $type: 'reference', id: inputElements[0].id, targetId: input1Comp.id },
              { $type: 'reference', id: inputElements[1].id, targetId: input2Comp.id },
            ],
          },
        } as any,
      });
    }

    console.log('  Connected inputs to Add node');

    // Connect Add output to Display input
    await client.updateComponent({
      id: displayComp.id!,
      members: {
        Input: { $type: 'reference', targetId: addComp.id },
      } as any,
    });

    console.log('  Connected Add output to Display');

    console.log('\n1+1 ProtoFlux created!');
    console.log('  - Two ValueInput<int> nodes with value 1');
    console.log('  - One ValueAddMulti<int> node');
    console.log('  - One ValueDisplay<int> node showing result: 2');

  } finally {
    client.disconnect();
  }
}

main();

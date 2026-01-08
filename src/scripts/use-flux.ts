import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    // ValueAddを探す
    const addSlot = await client.findSlotByName('ValueAdd`1', 'Root', 2);
    if (addSlot?.id) {
      console.log('=== ValueAdd<float> ===');
      const data = await client.getSlot({ slotId: addSlot.id, depth: 0, includeComponentData: true });
      console.log('Slot ID:', addSlot.id);
      for (const comp of data.data?.components || []) {
        if (comp.componentType?.includes('ValueAdd')) {
          console.log('Component:', comp.componentType);
          console.log('ID:', comp.id);
          console.log('Members:', JSON.stringify(comp.members, null, 2));
        }
      }
    }

    // ValueMulを探す
    const mulSlot = await client.findSlotByName('ValueMul`1', 'Root', 2);
    if (mulSlot?.id) {
      console.log('\n=== ValueMul<float> ===');
      const data = await client.getSlot({ slotId: mulSlot.id, depth: 0, includeComponentData: true });
      console.log('Slot ID:', mulSlot.id);
      for (const comp of data.data?.components || []) {
        if (comp.componentType?.includes('ValueMul')) {
          console.log('Component:', comp.componentType);
          console.log('ID:', comp.id);
          console.log('Members:', JSON.stringify(comp.members, null, 2));
        }
      }
    }

    // 入力値を変更してみる
    console.log('\n=== 値を変更してみる ===');

    // ValueAddの入力を探す
    if (addSlot) {
      const root = await client.getSlot({ slotId: 'Root', depth: 3, includeComponentData: true });

      // ValueInput<float>を探す
      function findInputs(slot: any, parentName: string): any[] {
        const results: any[] = [];
        const name = slot.name?.value || '';

        if (slot.components) {
          for (const comp of slot.components) {
            if (comp.componentType === 'FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float>') {
              results.push({
                slotName: name,
                parentName,
                comp
              });
            }
          }
        }

        if (slot.children) {
          for (const child of slot.children) {
            results.push(...findInputs(child, name));
          }
        }

        return results;
      }

      const inputs = findInputs(root.data, '');
      console.log('\nFound ValueInput<float> nodes:');
      for (const input of inputs) {
        if (!input.parentName.startsWith('User')) {
          console.log(`  ${input.slotName} (parent: ${input.parentName})`);
          console.log(`    ID: ${input.comp.id}`);
          console.log(`    Value: ${JSON.stringify(input.comp.members?.Value)}`);
        }
      }
    }

  } finally {
    client.disconnect();
  }
}

main();

import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    const root = await client.getSlot({ slotId: 'Root', depth: 5, includeComponentData: true });

    function findProtoFlux(slot: any, path = '') {
      const name = slot.name?.value || '(unnamed)';
      const currentPath = path + '/' + name;

      if (slot.components) {
        for (const comp of slot.components) {
          if (comp.componentType?.includes('ProtoFlux') || comp.componentType?.includes('Value')) {
            console.log('=== ' + currentPath + ' ===');
            console.log('Type:', comp.componentType);
            console.log('ID:', comp.id);
            if (comp.members) {
              for (const [key, val] of Object.entries(comp.members)) {
                if (key !== 'persistent' && key !== 'UpdateOrder' && key !== 'Enabled') {
                  console.log('  ' + key + ':', JSON.stringify(val).substring(0, 150));
                }
              }
            }
            console.log('');
          }
        }
      }

      if (slot.children) {
        for (const child of slot.children) {
          findProtoFlux(child, currentPath);
        }
      }
    }

    findProtoFlux(root.data);
  } finally {
    client.disconnect();
  }
}

main();

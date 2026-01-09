import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

const SYSTEM_OBJECTS = [
  'Controllers', 'Roles', 'SpawnArea', 'Light', 'Skybox',
  '__TEMP', 'Undo Manager', 'Assets', 'Clipboard Importer'
];

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Deleting town objects...\n');

    // Get Root children
    const root = await client.getSlot({ slotId: 'Root', depth: 1, includeComponentData: false });
    if (!root.success || !root.data.children) {
      console.log('Failed to get root children');
      return;
    }

    const toDelete: string[] = [];

    for (const child of root.data.children) {
      const name = child.name?.value || '';

      // Skip system objects
      if (SYSTEM_OBJECTS.includes(name) || name.startsWith('User ')) {
        console.log(`  [SKIP] ${name} (system object)`);
        continue;
      }

      // Delete town-related objects
      if (name.startsWith('House_') ||
          name.startsWith('Town_') ||
          name === 'Cafe' ||
          name === 'Grocery' ||
          name === 'Bookstore' ||
          name === 'AppleTree' ||
          name === 'ModernHouse') {
        if (child.id) {
          toDelete.push(child.id);
        }
        console.log(`  [DELETE] ${name}`);
      } else {
        console.log(`  [KEEP] ${name}`);
      }
    }

    console.log(`\nDeleting ${toDelete.length} objects...`);

    for (const id of toDelete) {
      if (id) {
        await client.removeSlot(id);
      }
    }

    console.log('\nTown deleted!');

  } finally {
    client.disconnect();
  }
}

main();

import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Deleting Tokyo Tower...');

    const tower = await client.findSlotByName('TokyoTower', 'Root', 1);
    if (tower?.id) {
      await client.removeSlot(tower.id);
      console.log('Tokyo Tower deleted!');
    } else {
      console.log('Tokyo Tower not found');
    }
  } finally {
    client.disconnect();
  }
}

main();

import { ResoniteLinkClient } from '../client.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const r = parseFloat(process.argv[3] || '0');
  const g = parseFloat(process.argv[4] || '1');
  const b = parseFloat(process.argv[5] || '0');

  const materialIds = [
    'Reso_A934',  // Seat
    'Reso_A9AD',  // Backrest
    'Reso_A9CB',  // Leg_FL
    'Reso_A9E9',  // Leg_FR
    'Reso_AA07',  // Leg_BL
    'Reso_AA25',  // Leg_BR
  ];

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    for (const matId of materialIds) {
      console.log(`Setting color on ${matId}...`);

      const response = await client.updateComponent({
        id: matId,
        members: {
          AlbedoColor: {
            $type: 'colorX',
            value: { r, g, b, a: 1, profile: 'sRGB' },
          },
        } as any,
      });

      if (response.success) {
        console.log(`  Done!`);
      } else {
        console.error(`  Error: ${response.errorInfo}`);
      }
    }
    console.log(`\nAll materials set to RGB(${r}, ${g}, ${b})`);
  } finally {
    client.disconnect();
  }
}

main();

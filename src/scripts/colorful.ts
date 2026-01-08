import { ResoniteLinkClient } from '../index';

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';

  const parts = [
    { name: 'Seat', matId: 'Reso_A934', color: { r: 1, g: 0, b: 0 } },       // 赤
    { name: 'Backrest', matId: 'Reso_A9AD', color: { r: 1, g: 0.5, b: 0 } }, // オレンジ
    { name: 'Leg_FL', matId: 'Reso_A9CB', color: { r: 1, g: 1, b: 0 } },     // 黄
    { name: 'Leg_FR', matId: 'Reso_A9E9', color: { r: 0, g: 1, b: 0 } },     // 緑
    { name: 'Leg_BL', matId: 'Reso_AA07', color: { r: 0, g: 0.5, b: 1 } },   // 水色
    { name: 'Leg_BR', matId: 'Reso_AA25', color: { r: 0.5, g: 0, b: 1 } },   // 紫
  ];

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    for (const part of parts) {
      const response = await client.updateComponent({
        id: part.matId,
        members: {
          AlbedoColor: {
            $type: 'colorX',
            value: { ...part.color, a: 1, profile: 'sRGB' },
          },
        } as any,
      });

      if (response.success) {
        console.log(`${part.name}: RGB(${part.color.r}, ${part.color.g}, ${part.color.b})`);
      } else {
        console.error(`${part.name}: Error - ${response.errorInfo}`);
      }
    }
    console.log('\nColorful!');
  } finally {
    client.disconnect();
  }
}

main();

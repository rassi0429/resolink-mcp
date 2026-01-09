import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    // ValueInputを変更する
    // Reso_2DB9B は Add の B入力 (現在値: 2)
    // Reso_2DE19 は Mul の B入力 (現在値: 4)

    console.log('=== 現在の値 ===');

    // 現在の値を取得
    const addBInput = await client.getComponent('Reso_2DB9B');
    const mulBInput = await client.getComponent('Reso_2DE19');

    console.log('Add.B (Reso_2DB9B):', (addBInput.data?.members as any)?.Value?.value);
    console.log('Mul.B (Reso_2DE19):', (mulBInput.data?.members as any)?.Value?.value);

    // Add.B を 3 に変更
    console.log('\n=== Add.B を 3 に変更 ===');
    const result1 = await client.updateComponent({
      id: 'Reso_2DB9B',
      members: {
        Value: { $type: 'float', value: 3 }
      } as any
    });
    console.log('Result:', result1.success, result1.errorInfo);

    // Mul.B を 5 に変更
    console.log('\n=== Mul.B を 5 に変更 ===');
    const result2 = await client.updateComponent({
      id: 'Reso_2DE19',
      members: {
        Value: { $type: 'float', value: 5 }
      } as any
    });
    console.log('Result:', result2.success, result2.errorInfo);

    // 変更後の値を確認
    console.log('\n=== 変更後の値 ===');
    const addBInputAfter = await client.getComponent('Reso_2DB9B');
    const mulBInputAfter = await client.getComponent('Reso_2DE19');

    console.log('Add.B (Reso_2DB9B):', (addBInputAfter.data?.members as any)?.Value?.value);
    console.log('Mul.B (Reso_2DE19):', (mulBInputAfter.data?.members as any)?.Value?.value);

    console.log('\nResoniteで確認してみてください！');
    console.log('計算: (A + 3) × 5 になっているはず');

  } finally {
    client.disconnect();
  }
}

main();

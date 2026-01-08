import { ResoniteLinkClient } from '../index.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';
  const qrContent = process.argv[3] || 'https://example.com';

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log(`=== QRコード板を作成 ===`);
    console.log(`内容: ${qrContent}\n`);

    // 空中にスロットを作成 (Y=15m)
    await client.addSlot({
      name: 'QRCodeBoard',
      position: { x: 0, y: 15, z: 0 },
      scale: { x: 5, y: 5, z: 1 },
      isActive: true
    });

    const board = await client.findSlotByName('QRCodeBoard', 'Root', 1);
    if (!board?.id) throw new Error('Failed to create QRCodeBoard slot');
    const boardId = board.id;
    console.log('スロット作成完了');

    // コンポーネントを追加
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.QuadMesh' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.UnlitMaterial' });
    await client.addComponent({ containerSlotId: boardId, componentType: '[FrooxEngine]FrooxEngine.StringQRCodeTexture' });
    console.log('コンポーネント追加完了');

    // コンポーネント情報を取得
    const slotData = await client.getSlot({ slotId: boardId, depth: 0, includeComponentData: true });
    if (!slotData.success || !slotData.data.components) throw new Error('Failed to get components');

    const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.QuadMesh');
    const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
    const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.UnlitMaterial');
    const qrTexture = slotData.data.components.find(c => c.componentType === 'FrooxEngine.StringQRCodeTexture');

    if (!mesh || !renderer || !material || !qrTexture) throw new Error('Missing components');

    // MeshRendererにMeshを設定
    await client.updateComponent({
      id: renderer.id!,
      members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any
    });

    // MeshRendererにMaterialを設定
    await client.updateComponent({
      id: renderer.id!,
      members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any
    });

    const rendererData = await client.getComponent(renderer.id!);
    if (rendererData.success) {
      const materials = (rendererData.data.members as any)?.Materials;
      if (materials?.elements?.[0]) {
        await client.updateComponent({
          id: renderer.id!,
          members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: materials.elements[0].id, targetId: material.id }] } } as any
        });
      }
    }
    console.log('MeshRenderer設定完了');

    // StringQRCodeTextureにPayloadを設定
    await client.updateComponent({
      id: qrTexture.id!,
      members: {
        Payload: { $type: 'string', value: qrContent },
        Color0: { $type: 'colorX', value: { r: 1, g: 1, b: 1, a: 1, profile: 'sRGB' } },
        Color1: { $type: 'colorX', value: { r: 0, g: 0, b: 0, a: 1, profile: 'sRGB' } }
      } as any
    });
    console.log('QRコードテクスチャ設定完了');

    // UnlitMaterialにQRテクスチャを設定
    await client.updateComponent({
      id: material.id!,
      members: {
        Texture: { $type: 'reference', targetId: qrTexture.id }
      } as any
    });
    console.log('マテリアル設定完了');

    console.log('\n=== QRコード板を作成しました ===');
    console.log('位置: (0, 15, 0) - 空中15mの高さ');
    console.log('サイズ: 5m x 5m');
    console.log(`内容: ${qrContent}`);

  } finally {
    client.disconnect();
  }
}

main();

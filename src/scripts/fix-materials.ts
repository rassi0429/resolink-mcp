import { ResoniteLinkClient } from '../index';

interface PartFix {
  name: string;
  materialRefId: string;  // Materials[0]のID
  materialId: string;      // PBS_MetallicのID
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    // まず各パーツのMeshRendererを確認してMaterials[0]のIDを取得
    const parts = [
      { name: 'Seat', meshRendererId: 'Reso_A8E4', slotId: 'Reso_A80F' },
      { name: 'Backrest', meshRendererId: 'Reso_A919', slotId: 'Reso_A8E5' },
      { name: 'Leg_FL', meshRendererId: 'Reso_A91B', slotId: 'Reso_A8E6' },
      { name: 'Leg_FR', meshRendererId: 'Reso_A91D', slotId: 'Reso_A8E7' },
      { name: 'Leg_BL', meshRendererId: 'Reso_A91F', slotId: 'Reso_A8E8' },
      { name: 'Leg_BR', meshRendererId: 'Reso_A921', slotId: 'Reso_A8E9' },
    ];

    for (const part of parts) {
      console.log(`\nFixing ${part.name}...`);

      // MeshRendererの詳細を取得
      const compData = await client.getComponent(part.meshRendererId);
      if (!compData.success) {
        console.error(`  Failed to get MeshRenderer: ${compData.errorInfo}`);
        continue;
      }

      const members = compData.data.members as any;
      const materials = members?.Materials;

      if (!materials || !materials.elements || materials.elements.length === 0) {
        console.log(`  No Materials elements found, adding new one...`);
        // リストに要素がない場合は追加
        continue;
      }

      const materialRef = materials.elements[0];
      console.log(`  Materials[0] ID: ${materialRef.id}, current target: ${materialRef.targetId}`);

      // PBS_MetallicのIDを取得
      const slotData = await client.getSlot({
        slotId: part.slotId,
        depth: 0,
        includeComponentData: true,
      });

      if (!slotData.success || !slotData.data.components) {
        console.error(`  Failed to get slot data`);
        continue;
      }

      const pbsMaterial = slotData.data.components.find(
        c => c.componentType === 'FrooxEngine.PBS_Metallic'
      );

      if (!pbsMaterial) {
        console.error(`  PBS_Metallic not found`);
        continue;
      }

      console.log(`  PBS_Metallic ID: ${pbsMaterial.id}`);

      // Materials[0]のtargetIdを更新
      // 参照要素を直接更新する - updateComponentでIDを指定
      const response = await client.updateComponent({
        id: part.meshRendererId,
        members: {
          Materials: {
            $type: 'list',
            elements: [
              {
                $type: 'reference',
                id: materialRef.id,  // 既存の要素IDを指定
                targetId: pbsMaterial.id,
              },
            ],
          },
        } as any,
      });

      if (response.success) {
        console.log(`  Fixed!`);
      } else {
        console.error(`  Error: ${response.errorInfo}`);
      }
    }

    console.log('\nDone!');
  } finally {
    client.disconnect();
  }
}

main();

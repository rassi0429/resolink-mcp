/**
 * 虹色に光って回転する箱を作成するスクリプト
 *
 * - BoxMesh + MeshRenderer + PBS_Metallic で箱を作成
 * - Wiggler で回転アニメーション
 * - ProtoFlux (WorldTimeFloat → HSV_ToColorX → ValueFieldDrive) で虹色に発光
 *
 * 使い方: npx tsx src/scripts/create-rainbow-box.ts [ws://localhost:58971]
 */
import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:58971';

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Rainbow Rotating Box...\n');

    // 1. メインスロット作成
    const slotName = `RainbowBox_${Date.now()}`;
    await client.addSlot({
      name: slotName,
      position: { x: 0, y: 1.5, z: 2 },
      isActive: true
    });
    const container = await client.findSlotByName(slotName, 'Root', 1);
    if (!container?.id) throw new Error('Failed to create container');
    const containerId = container.id;
    console.log(`  Created: ${slotName}`);

    // 2. 箱のコンポーネントを追加
    await client.addComponent({
      containerSlotId: containerId,
      componentType: '[FrooxEngine]FrooxEngine.BoxMesh',
    });
    await client.addComponent({
      containerSlotId: containerId,
      componentType: '[FrooxEngine]FrooxEngine.MeshRenderer',
    });
    await client.addComponent({
      containerSlotId: containerId,
      componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic',
    });
    await client.addComponent({
      containerSlotId: containerId,
      componentType: '[FrooxEngine]FrooxEngine.Wiggler',
    });
    console.log('  Added BoxMesh, MeshRenderer, PBS_Metallic, Wiggler');

    // 3. コンポーネントID取得
    const slotData = await client.getSlot({
      slotId: containerId,
      depth: 0,
      includeComponentData: true
    });
    const components = slotData.data?.components || [];

    const boxMesh = components.find(c => c.componentType?.includes('BoxMesh'));
    const meshRenderer = components.find(c => c.componentType?.includes('MeshRenderer'));
    const material = components.find(c => c.componentType?.includes('PBS_Metallic'));
    const wiggler = components.find(c => c.componentType?.includes('Wiggler'));

    if (!boxMesh?.id || !meshRenderer?.id || !material?.id || !wiggler?.id) {
      throw new Error('Failed to find components');
    }
    console.log('  Got component IDs');

    // 4. BoxMesh サイズ設定
    await client.updateComponent({
      id: boxMesh.id,
      members: {
        Size: { $type: 'float3', value: { x: 0.3, y: 0.3, z: 0.3 } },
      } as any
    });
    console.log('  Set box size: 0.3m');

    // 5. MeshRenderer に Mesh と Material を設定
    await client.updateComponent({
      id: meshRenderer.id,
      members: {
        Mesh: { $type: 'reference', targetId: boxMesh.id },
      } as any
    });

    // Materials リストに要素追加
    await client.updateComponent({
      id: meshRenderer.id,
      members: {
        Materials: { $action: 'add', $type: 'reference', targetId: null },
      } as any
    });
    // targetId 設定
    await client.updateComponent({
      id: meshRenderer.id,
      members: {
        Materials: { $action: 'set', $index: 0, $type: 'reference', targetId: material.id },
      } as any
    });
    console.log('  Linked Mesh and Material to MeshRenderer');

    // 6. マテリアル設定（発光させる）
    await client.updateComponent({
      id: material.id,
      members: {
        EmissiveColor: { $type: 'colorX', value: { r: 1, g: 0, b: 0, a: 1 } },
      } as any
    });
    console.log('  Set initial emissive color');

    // 7. Wiggler 設定（回転）
    await client.updateComponent({
      id: wiggler.id,
      members: {
        Speed: { $type: 'float', value: 1.0 },
        Magnitude: { $type: 'floatQ', value: { x: 0.2, y: 0.3, z: 0.1, w: 1 } },
      } as any
    });
    console.log('  Configured Wiggler for rotation');

    // 8. ProtoFlux 用の子スロット作成
    await client.addSlot({ parentId: containerId, name: 'WorldTime', position: { x: -0.3, y: 0, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'HSV', position: { x: 0, y: 0, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'Drive', position: { x: 0.3, y: 0, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'SatInput', position: { x: -0.3, y: -0.1, z: 0 }, isActive: true });
    await client.addSlot({ parentId: containerId, name: 'ValInput', position: { x: -0.3, y: -0.2, z: 0 }, isActive: true });

    // 子スロットID取得
    const containerData = await client.getSlot({ slotId: containerId, depth: 1, includeComponentData: false });
    const children = containerData.data?.children || [];

    const worldTimeSlot = children.find(c => c.name?.value === 'WorldTime');
    const hsvSlot = children.find(c => c.name?.value === 'HSV');
    const driveSlot = children.find(c => c.name?.value === 'Drive');
    const satSlot = children.find(c => c.name?.value === 'SatInput');
    const valSlot = children.find(c => c.name?.value === 'ValInput');

    if (!worldTimeSlot?.id || !hsvSlot?.id || !driveSlot?.id || !satSlot?.id || !valSlot?.id) {
      throw new Error('Failed to find ProtoFlux slots');
    }
    console.log('  Created ProtoFlux slots');

    // 9. ProtoFlux コンポーネント追加
    await client.addComponent({
      containerSlotId: worldTimeSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.FrooxEngine.Time.WorldTimeFloat',
    });
    await client.addComponent({
      containerSlotId: hsvSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.Color.HSV_ToColorX',
    });
    await client.addComponent({
      containerSlotId: driveSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.CoreNodes.ValueFieldDrive<colorX>',
    });
    await client.addComponent({
      containerSlotId: satSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float>',
    });
    await client.addComponent({
      containerSlotId: valSlot.id,
      componentType: '[ProtoFluxBindings]FrooxEngine.ProtoFlux.Runtimes.Execution.Nodes.ValueInput<float>',
    });
    console.log('  Added ProtoFlux components');

    // 10. ProtoFlux コンポーネントID取得
    const [worldTimeData, hsvData, driveData, satData, valData] = await Promise.all([
      client.getSlot({ slotId: worldTimeSlot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: hsvSlot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: driveSlot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: satSlot.id, depth: 0, includeComponentData: true }),
      client.getSlot({ slotId: valSlot.id, depth: 0, includeComponentData: true }),
    ]);

    const worldTimeComp = worldTimeData.data?.components?.find(c => c.componentType?.includes('WorldTimeFloat'));
    const hsvComp = hsvData.data?.components?.find(c => c.componentType?.includes('HSV_ToColorX'));
    const driveComp = driveData.data?.components?.find(c => c.componentType?.includes('ValueFieldDrive'));
    const satComp = satData.data?.components?.find(c => c.componentType?.includes('ValueInput'));
    const valComp = valData.data?.components?.find(c => c.componentType?.includes('ValueInput'));

    if (!worldTimeComp?.id || !hsvComp?.id || !driveComp?.id || !satComp?.id || !valComp?.id) {
      throw new Error('Failed to find ProtoFlux components');
    }
    console.log('  Got ProtoFlux component IDs');

    // 11. S, V の値を設定（彩度・明度を最大に）
    await client.updateComponent({
      id: satComp.id,
      members: { Value: { $type: 'float', value: 1.0 } } as any,
    });
    await client.updateComponent({
      id: valComp.id,
      members: { Value: { $type: 'float', value: 1.0 } } as any,
    });
    console.log('  Set S=1.0, V=1.0');

    // 12. HSV_ToColorX に接続
    await client.updateComponent({
      id: hsvComp.id,
      members: {
        H: { $type: 'reference', targetId: worldTimeComp.id },
        S: { $type: 'reference', targetId: satComp.id },
        V: { $type: 'reference', targetId: valComp.id },
      } as any,
    });
    console.log('  Connected WorldTime→H, SatInput→S, ValInput→V');

    // 13. ValueFieldDrive に接続
    await client.updateComponent({
      id: driveComp.id,
      members: {
        Value: { $type: 'reference', targetId: hsvComp.id },
      } as any,
    });
    console.log('  Connected HSV→ValueFieldDrive');

    // 14. マテリアルの EmissiveColor フィールドをドライブ
    // まず PBS_Metallic の詳細を取得して EmissiveColor フィールドIDを探す
    const materialDetail = await client.getComponent(material.id!);
    console.log('  Material members:', Object.keys(materialDetail.data?.members || {}));

    // Drive の DriveTarget にフィールド参照を設定
    // Proxy コンポーネントが必要
    await client.addComponent({
      containerSlotId: driveSlot.id,
      componentType: 'FrooxEngine.ProtoFlux.CoreNodes.FieldDriveBase<colorX>+Proxy',
    });

    // Proxy ID取得
    const driveSlotData = await client.getSlot({ slotId: driveSlot.id, depth: 0, includeComponentData: true });
    const proxyComp = driveSlotData.data?.components?.find(c => c.componentType?.includes('Proxy'));

    if (proxyComp?.id) {
      // Proxy の LinkedField に PBS_Metallic の EmissiveColor を設定
      await client.updateComponent({
        id: proxyComp.id,
        members: {
          LinkedField: { $type: 'field_reference', targetId: material.id, fieldName: 'EmissiveColor' },
        } as any,
      });

      // Drive の Drive に Proxy を設定
      await client.updateComponent({
        id: driveComp.id,
        members: {
          Drive: { $type: 'reference', targetId: proxyComp.id },
        } as any,
      });
      console.log('  Connected ValueFieldDrive→EmissiveColor via Proxy');
    }

    console.log('\n✨ Rainbow Rotating Box created!');
    console.log(`  Location: ${slotName} at (0, 1.5, 2)`);
    console.log('  - Wiggler: rotating animation');
    console.log('  - ProtoFlux: WorldTime→HSV→EmissiveColor (rainbow cycle)');

  } finally {
    client.disconnect();
  }
}

main();

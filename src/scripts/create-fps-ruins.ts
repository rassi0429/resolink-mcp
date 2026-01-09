import { ResoniteLinkClient } from '../client.js';

// === COLORS ===
const CONCRETE = { r: 0.5, g: 0.5, b: 0.48 };
const CONCRETE_DIRTY = { r: 0.35, g: 0.33, b: 0.3 };
const ASPHALT = { r: 0.2, g: 0.2, b: 0.22 };
const RUST = { r: 0.45, g: 0.25, b: 0.15 };
const OLD_WOOD = { r: 0.35, g: 0.25, b: 0.15 };
const RUBBLE = { r: 0.4, g: 0.38, b: 0.35 };
const SANDBAG = { r: 0.45, g: 0.4, b: 0.3 };
const DARK_METAL = { r: 0.15, g: 0.15, b: 0.18 };

async function createBox(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  scale: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  smoothness: number = 0.2,
  metallic: number = 0
): Promise<string | null> {
  await client.addSlot({ parentId, name, position, scale, isActive: true });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return null;
  const slotId = slot.id;

  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.BoxMesh' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.BoxCollider' });

  const slotData = await client.getSlot({ slotId, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return null;

  const mesh = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxMesh');
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
  if (!mesh || !renderer || !material) return null;

  await client.updateComponent({ id: renderer.id!, members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any });
  await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any });

  const rendererData = await client.getComponent(renderer.id!);
  if (rendererData.success) {
    const materials = (rendererData.data.members as any)?.Materials;
    if (materials?.elements?.[0]) {
      await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: materials.elements[0].id, targetId: material.id }] } } as any });
    }
  }

  await client.updateComponent({
    id: material.id!,
    members: {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: smoothness },
      Metallic: { $type: 'float', value: metallic },
    } as any
  });

  // BoxColliderのCharacterColliderを有効化
  const collider = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxCollider');
  if (collider?.id) {
    await client.updateComponent({
      id: collider.id,
      members: {
        CharacterCollider: { $type: 'bool', value: true }
      } as any
    });
  }

  return slotId;
}

// === 建物A: 廃ビル (北西) ===
async function createBuildingA(client: ResoniteLinkClient, parentId: string): Promise<void> {
  console.log('  建物A: 廃ビルを作成中...');

  const pos = { x: -15, y: 0, z: -15 };
  const W = 10, D = 8, H = 4, T = 0.25;

  await client.addSlot({ parentId, name: 'BuildingA_RuinedOffice', position: pos, isActive: true });
  const building = await client.findSlotByName('BuildingA_RuinedOffice', parentId, 1);
  if (!building?.id) return;
  const bId = building.id;

  // 1F 床
  await createBox(client, bId, 'Floor1F', { x: 0, y: 0.1, z: 0 }, { x: W, y: 0.2, z: D }, CONCRETE_DIRTY, 0.15);

  // 1F 壁 (入口は南面)
  await createBox(client, bId, 'Wall1F_N', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_E', { x: W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_W', { x: -W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, CONCRETE, 0.2);
  // 南壁 (入口用の穴を残す - 左右に分割)
  await createBox(client, bId, 'Wall1F_S_L', { x: -3, y: H/2, z: D/2 }, { x: 4, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_S_R', { x: 3, y: H/2, z: D/2 }, { x: 4, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_S_Top', { x: 0, y: 3.5, z: D/2 }, { x: 2, y: 1, z: T }, CONCRETE, 0.2);

  // 1F 窓枠 (ガラスなし)
  await createBox(client, bId, 'Window1F_E', { x: W/2 + 0.05, y: 2, z: 0 }, { x: 0.1, y: 1.5, z: 2 }, CONCRETE_DIRTY, 0.15);
  await createBox(client, bId, 'Window1F_W', { x: -W/2 - 0.05, y: 2, z: 0 }, { x: 0.1, y: 1.5, z: 2 }, CONCRETE_DIRTY, 0.15);

  // 1F 瓦礫
  await createBox(client, bId, 'Rubble1F_1', { x: -2, y: 0.3, z: -1 }, { x: 1.5, y: 0.6, z: 1.2 }, RUBBLE, 0.1);
  await createBox(client, bId, 'Rubble1F_2', { x: 2, y: 0.25, z: 2 }, { x: 1, y: 0.5, z: 0.8 }, RUBBLE, 0.1);

  // 2F 床 (穴あり - 3分割)
  await createBox(client, bId, 'Floor2F_N', { x: 0, y: H + 0.1, z: -2 }, { x: W - 0.5, y: 0.2, z: 4 }, CONCRETE_DIRTY, 0.15);
  await createBox(client, bId, 'Floor2F_S', { x: 0, y: H + 0.1, z: 3 }, { x: W - 0.5, y: 0.2, z: 2 }, CONCRETE_DIRTY, 0.15);
  // 中央に穴

  // 2F 壁 (一部崩落)
  await createBox(client, bId, 'Wall2F_N', { x: 0, y: H + H/2, z: -D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall2F_E_Lower', { x: W/2, y: H + 1.5, z: 0 }, { x: T, y: 3, z: D }, CONCRETE, 0.2);
  // 西壁は崩落部分あり
  await createBox(client, bId, 'Wall2F_W', { x: -W/2, y: H + H/2, z: -1 }, { x: T, y: H, z: D - 2 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall2F_S', { x: 0, y: H + H/2, z: D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);

  // 内部階段 (北東角)
  for (let i = 0; i < 8; i++) {
    await createBox(client, bId, `Stair_${i}`, { x: 3.5, y: 0.3 + i * 0.5, z: -2.5 + i * 0.4 }, { x: 1.5, y: 0.3, z: 0.6 }, CONCRETE_DIRTY, 0.15);
  }

  // 鉄骨露出
  await createBox(client, bId, 'Beam_1', { x: -4, y: 6, z: 2 }, { x: 0.15, y: 3, z: 0.15 }, RUST, 0.3, 0.5);
  await createBox(client, bId, 'Beam_2', { x: -4, y: 7.5, z: 2 }, { x: 2, y: 0.15, z: 0.15 }, RUST, 0.3, 0.5);

  // 屋上 (一部のみ)
  await createBox(client, bId, 'Roof_Partial', { x: 2, y: H * 2 + 0.1, z: -1 }, { x: 6, y: 0.2, z: 6 }, CONCRETE_DIRTY, 0.15);
}

// === 建物B: 崩壊アパート (北東) ===
async function createBuildingB(client: ResoniteLinkClient, parentId: string): Promise<void> {
  console.log('  建物B: 崩壊アパートを作成中...');

  const pos = { x: 15, y: 0, z: 15 };
  const W = 8, D = 10, H = 3, T = 0.25;

  await client.addSlot({ parentId, name: 'BuildingB_CollapsedApartment', position: pos, isActive: true });
  const building = await client.findSlotByName('BuildingB_CollapsedApartment', parentId, 1);
  if (!building?.id) return;
  const bId = building.id;

  // 1F 床
  await createBox(client, bId, 'Floor1F', { x: 0, y: 0.1, z: 0 }, { x: W, y: 0.2, z: D }, CONCRETE_DIRTY, 0.15);

  // 1F 壁
  await createBox(client, bId, 'Wall1F_N', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_S', { x: 0, y: H/2, z: D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  // 西壁に入口
  await createBox(client, bId, 'Wall1F_W_L', { x: -W/2, y: H/2, z: -3 }, { x: T, y: H, z: 4 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_W_R', { x: -W/2, y: H/2, z: 3 }, { x: T, y: H, z: 4 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall1F_W_Top', { x: -W/2, y: 2.7, z: 0 }, { x: T, y: 0.6, z: 2 }, CONCRETE, 0.2);
  // 東壁 (崩壊)
  await createBox(client, bId, 'Wall1F_E_Partial', { x: W/2, y: 1, z: -3 }, { x: T, y: 2, z: 4 }, CONCRETE, 0.2);

  // 仕切り壁
  await createBox(client, bId, 'Divider', { x: 0, y: H/2, z: 0 }, { x: T, y: H, z: D - 1 }, CONCRETE_DIRTY, 0.2);

  // 2F 床 (半分崩壊 - 西側のみ残存)
  await createBox(client, bId, 'Floor2F', { x: -2, y: H + 0.1, z: 0 }, { x: 4, y: 0.2, z: D - 1 }, CONCRETE_DIRTY, 0.15);

  // 2F 壁 (残存部分のみ)
  await createBox(client, bId, 'Wall2F_N', { x: -2, y: H + H/2, z: -D/2 }, { x: 4, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall2F_W', { x: -W/2, y: H + H/2, z: 0 }, { x: T, y: H, z: D }, CONCRETE, 0.2);

  // 外階段 (西面)
  await client.addSlot({ parentId: bId, name: 'ExternalStairs', position: { x: -5, y: 0, z: 0 }, isActive: true });
  const stairs = await client.findSlotByName('ExternalStairs', bId, 1);
  if (stairs?.id) {
    for (let i = 0; i < 6; i++) {
      await createBox(client, stairs.id, `Step_${i}`, { x: 0, y: 0.3 + i * 0.5, z: -1.5 + i * 0.5 }, { x: 1.2, y: 0.2, z: 0.6 }, RUST, 0.3, 0.4);
    }
    // 手すり
    await createBox(client, stairs.id, 'Rail_L', { x: -0.5, y: 1.8, z: 0 }, { x: 0.05, y: 0.8, z: 3 }, RUST, 0.3, 0.5);
    await createBox(client, stairs.id, 'Rail_R', { x: 0.5, y: 1.8, z: 0 }, { x: 0.05, y: 0.8, z: 3 }, RUST, 0.3, 0.5);
  }

  // 崩壊した瓦礫 (東側)
  await createBox(client, bId, 'Collapse_1', { x: 3, y: 0.5, z: 2 }, { x: 2, y: 1, z: 2 }, RUBBLE, 0.1);
  await createBox(client, bId, 'Collapse_2', { x: 2.5, y: 0.3, z: -2 }, { x: 1.5, y: 0.6, z: 1.5 }, RUBBLE, 0.1);
  await createBox(client, bId, 'Collapse_3', { x: 4, y: 1, z: 0 }, { x: 1, y: 2, z: 3 }, RUBBLE, 0.1);
}

// === 建物C: 倉庫 (南西) ===
async function createBuildingC(client: ResoniteLinkClient, parentId: string): Promise<void> {
  console.log('  建物C: 倉庫を作成中...');

  const pos = { x: -15, y: 0, z: 15 };
  const W = 12, D = 8, H = 5, T = 0.3;

  await client.addSlot({ parentId, name: 'BuildingC_Warehouse', position: pos, isActive: true });
  const building = await client.findSlotByName('BuildingC_Warehouse', parentId, 1);
  if (!building?.id) return;
  const bId = building.id;

  // 床
  await createBox(client, bId, 'Floor', { x: 0, y: 0.1, z: 0 }, { x: W, y: 0.2, z: D }, CONCRETE_DIRTY, 0.15);

  // 壁
  await createBox(client, bId, 'Wall_N', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_S', { x: 0, y: H/2, z: D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_W', { x: -W/2, y: H/2, z: 0 }, { x: T, y: H, z: D }, CONCRETE, 0.2);
  // 東壁 (大きなシャッター入口)
  await createBox(client, bId, 'Wall_E_L', { x: W/2, y: H/2, z: -3 }, { x: T, y: H, z: 2 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_E_R', { x: W/2, y: H/2, z: 3 }, { x: T, y: H, z: 2 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_E_Top', { x: W/2, y: 4.5, z: 0 }, { x: T, y: 1, z: 4 }, CONCRETE, 0.2);

  // シャッター (半開き)
  await createBox(client, bId, 'Shutter', { x: W/2 + 0.05, y: 3, z: 0 }, { x: 0.1, y: 2, z: 3.8 }, RUST, 0.3, 0.4);

  // 北壁に小さなドア
  await createBox(client, bId, 'Door_N', { x: -3, y: 1.2, z: -D/2 - 0.05 }, { x: 1, y: 2.4, z: 0.1 }, OLD_WOOD, 0.2);

  // 内部の棚
  await createBox(client, bId, 'Shelf_1', { x: -4, y: 1, z: -2 }, { x: 2, y: 2, z: 0.5 }, RUST, 0.3, 0.3);
  await createBox(client, bId, 'Shelf_2', { x: -4, y: 1, z: 2 }, { x: 2, y: 2, z: 0.5 }, RUST, 0.3, 0.3);

  // 木箱
  await createBox(client, bId, 'Crate_1', { x: 0, y: 0.4, z: -1 }, { x: 0.8, y: 0.8, z: 0.8 }, OLD_WOOD, 0.2);
  await createBox(client, bId, 'Crate_2', { x: 0.5, y: 0.4, z: 0.5 }, { x: 0.8, y: 0.8, z: 0.8 }, OLD_WOOD, 0.2);
  await createBox(client, bId, 'Crate_3', { x: 0.2, y: 1.2, z: -0.3 }, { x: 0.8, y: 0.8, z: 0.8 }, OLD_WOOD, 0.2);

  // 屋根 (穴あり)
  await createBox(client, bId, 'Roof_W', { x: -3, y: H + 0.1, z: 0 }, { x: 6, y: 0.2, z: D }, CONCRETE_DIRTY, 0.15);
  await createBox(client, bId, 'Roof_E', { x: 4, y: H + 0.1, z: 0 }, { x: 4, y: 0.2, z: D }, CONCRETE_DIRTY, 0.15);
  // 中央に穴 (光が入る)
}

// === 建物D: 廃商店 (南東) ===
async function createBuildingD(client: ResoniteLinkClient, parentId: string): Promise<void> {
  console.log('  建物D: 廃商店を作成中...');

  const pos = { x: 15, y: 0, z: -15 };
  const W = 8, D = 6, H = 4, T = 0.25;

  await client.addSlot({ parentId, name: 'BuildingD_AbandonedShop', position: pos, isActive: true });
  const building = await client.findSlotByName('BuildingD_AbandonedShop', parentId, 1);
  if (!building?.id) return;
  const bId = building.id;

  // 床
  await createBox(client, bId, 'Floor', { x: 0, y: 0.1, z: 0 }, { x: W, y: 0.2, z: D }, OLD_WOOD, 0.2);

  // 壁
  await createBox(client, bId, 'Wall_N', { x: 0, y: H/2, z: -D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_S', { x: 0, y: H/2, z: D/2 }, { x: W, y: H, z: T }, CONCRETE, 0.2);
  // 西壁 (ショーウィンドウ破損)
  await createBox(client, bId, 'Wall_W_Lower', { x: -W/2, y: 0.5, z: 0 }, { x: T, y: 1, z: D }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_W_Upper', { x: -W/2, y: 3.5, z: 0 }, { x: T, y: 1, z: D }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_W_Side_N', { x: -W/2, y: 2, z: -2.5 }, { x: T, y: 2, z: 1 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_W_Side_S', { x: -W/2, y: 2, z: 2.5 }, { x: T, y: 2, z: 1 }, CONCRETE, 0.2);
  // 東壁 (裏口)
  await createBox(client, bId, 'Wall_E_L', { x: W/2, y: H/2, z: -1.5 }, { x: T, y: H, z: 3 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_E_R', { x: W/2, y: H/2, z: 2 }, { x: T, y: H, z: 2 }, CONCRETE, 0.2);
  await createBox(client, bId, 'Wall_E_Top', { x: W/2, y: 3.5, z: 0.5 }, { x: T, y: 1, z: 1 }, CONCRETE, 0.2);

  // カウンター
  await createBox(client, bId, 'Counter', { x: 1, y: 0.5, z: -1.5 }, { x: 3, y: 1, z: 1 }, OLD_WOOD, 0.2);

  // 棚 (倒れかけ)
  await createBox(client, bId, 'Shelf_Fallen', { x: -1.5, y: 0.6, z: 1 }, { x: 0.4, y: 1.2, z: 2 }, OLD_WOOD, 0.2);

  // 看板 (傾いて落ちかけ)
  await client.addSlot({ parentId: bId, name: 'FallingSign', position: { x: -W/2 - 0.5, y: 3.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0.17, w: 0.98 }, isActive: true }); // 約20度傾き
  const sign = await client.findSlotByName('FallingSign', bId, 1);
  if (sign?.id) {
    await createBox(client, sign.id, 'SignBoard', { x: 0, y: 0, z: 0 }, { x: 0.2, y: 1, z: 3 }, RUST, 0.3, 0.3);
  }

  // 屋根
  await createBox(client, bId, 'Roof', { x: 0, y: H + 0.1, z: 0 }, { x: W + 0.5, y: 0.2, z: D + 0.5 }, CONCRETE_DIRTY, 0.15);

  // 割れたガラス片
  await createBox(client, bId, 'Glass_1', { x: -4.5, y: 0.05, z: 0 }, { x: 0.5, y: 0.1, z: 0.3 }, { r: 0.7, g: 0.8, b: 0.85 }, 0.9);
  await createBox(client, bId, 'Glass_2', { x: -4.3, y: 0.05, z: 0.8 }, { x: 0.3, y: 0.1, z: 0.4 }, { r: 0.7, g: 0.8, b: 0.85 }, 0.9);
}

// === カバーオブジェクト ===
async function createCoverObjects(client: ResoniteLinkClient, parentId: string): Promise<void> {
  console.log('  カバーオブジェクトを配置中...');

  // 車1 (横転) at (-8, 0.6, 0)
  await client.addSlot({ parentId, name: 'Car1_Flipped', position: { x: -8, y: 0.6, z: 0 },
    rotation: { x: 0, y: 0, z: 0.7, w: 0.7 }, isActive: true }); // 90度横倒し
  const car1 = await client.findSlotByName('Car1_Flipped', parentId, 1);
  if (car1?.id) {
    await createBox(client, car1.id, 'Body', { x: 0, y: 0, z: 0 }, { x: 1.8, y: 0.5, z: 4 }, RUST, 0.3, 0.3);
    await createBox(client, car1.id, 'Cabin', { x: 0, y: 0.4, z: -0.3 }, { x: 1.6, y: 0.4, z: 2 }, RUST, 0.3, 0.3);
    await createBox(client, car1.id, 'Wheel1', { x: 0.7, y: -0.3, z: 1 }, { x: 0.2, y: 0.5, z: 0.5 }, DARK_METAL, 0.2);
    await createBox(client, car1.id, 'Wheel2', { x: 0.7, y: -0.3, z: -1 }, { x: 0.2, y: 0.5, z: 0.5 }, DARK_METAL, 0.2);
  }

  // 車2 (廃車) at (+5, 0, -8)
  await client.addSlot({ parentId, name: 'Car2_Wrecked', position: { x: 5, y: 0, z: -8 }, isActive: true });
  const car2 = await client.findSlotByName('Car2_Wrecked', parentId, 1);
  if (car2?.id) {
    await createBox(client, car2.id, 'Body', { x: 0, y: 0.5, z: 0 }, { x: 1.8, y: 0.5, z: 4 }, RUST, 0.3, 0.3);
    await createBox(client, car2.id, 'Cabin', { x: 0, y: 0.9, z: -0.3 }, { x: 1.6, y: 0.4, z: 2 }, RUST, 0.3, 0.3);
    for (let i = 0; i < 4; i++) {
      const wx = (i % 2 === 0) ? -0.85 : 0.85;
      const wz = (i < 2) ? 1.2 : -1.2;
      await createBox(client, car2.id, `Wheel_${i}`, { x: wx, y: 0.3, z: wz }, { x: 0.2, y: 0.6, z: 0.6 }, DARK_METAL, 0.2);
    }
  }

  // バリケード1 (土嚢) at (-5, 0, +5)
  await client.addSlot({ parentId, name: 'Barricade1', position: { x: -5, y: 0, z: 5 }, isActive: true });
  const bar1 = await client.findSlotByName('Barricade1', parentId, 1);
  if (bar1?.id) {
    await createBox(client, bar1.id, 'Sandbag1', { x: 0, y: 0.2, z: 0 }, { x: 0.6, y: 0.4, z: 0.3 }, SANDBAG, 0.1);
    await createBox(client, bar1.id, 'Sandbag2', { x: 0.5, y: 0.2, z: 0 }, { x: 0.6, y: 0.4, z: 0.3 }, SANDBAG, 0.1);
    await createBox(client, bar1.id, 'Sandbag3', { x: -0.5, y: 0.2, z: 0 }, { x: 0.6, y: 0.4, z: 0.3 }, SANDBAG, 0.1);
    await createBox(client, bar1.id, 'Sandbag4', { x: 0.25, y: 0.6, z: 0 }, { x: 0.6, y: 0.4, z: 0.3 }, SANDBAG, 0.1);
    await createBox(client, bar1.id, 'Sandbag5', { x: -0.25, y: 0.6, z: 0 }, { x: 0.6, y: 0.4, z: 0.3 }, SANDBAG, 0.1);
    await createBox(client, bar1.id, 'Board', { x: 0, y: 0.5, z: 0.2 }, { x: 1.5, y: 0.8, z: 0.1 }, OLD_WOOD, 0.2);
  }

  // バリケード2 (コンクリートブロック) at (+3, 0, +7)
  await client.addSlot({ parentId, name: 'Barricade2', position: { x: 3, y: 0, z: 7 }, isActive: true });
  const bar2 = await client.findSlotByName('Barricade2', parentId, 1);
  if (bar2?.id) {
    await createBox(client, bar2.id, 'Block1', { x: 0, y: 0.3, z: 0 }, { x: 1, y: 0.6, z: 0.5 }, CONCRETE, 0.2);
    await createBox(client, bar2.id, 'Block2', { x: 1, y: 0.3, z: 0 }, { x: 1, y: 0.6, z: 0.5 }, CONCRETE, 0.2);
    await createBox(client, bar2.id, 'Block3', { x: 0.5, y: 0.9, z: 0 }, { x: 1, y: 0.6, z: 0.5 }, CONCRETE, 0.2);
  }

  // コンテナ at (+8, 0, -5) - 中に入れる
  await client.addSlot({ parentId, name: 'Container', position: { x: 8, y: 0, z: -5 }, isActive: true });
  const container = await client.findSlotByName('Container', parentId, 1);
  if (container?.id) {
    const cId = container.id;
    // 床
    await createBox(client, cId, 'Floor', { x: 0, y: 0.1, z: 0 }, { x: 2.4, y: 0.2, z: 6 }, RUST, 0.3, 0.4);
    // 壁
    await createBox(client, cId, 'Wall_L', { x: -1.2, y: 1.25, z: 0 }, { x: 0.1, y: 2.3, z: 6 }, RUST, 0.3, 0.4);
    await createBox(client, cId, 'Wall_R', { x: 1.2, y: 1.25, z: 0 }, { x: 0.1, y: 2.3, z: 6 }, RUST, 0.3, 0.4);
    await createBox(client, cId, 'Wall_Back', { x: 0, y: 1.25, z: -3 }, { x: 2.4, y: 2.3, z: 0.1 }, RUST, 0.3, 0.4);
    // 天井
    await createBox(client, cId, 'Roof', { x: 0, y: 2.4, z: 0 }, { x: 2.5, y: 0.1, z: 6 }, RUST, 0.3, 0.4);
    // 前面は開いている
  }

  // 瓦礫1 at (+10, 0, +2) - 登れる
  await client.addSlot({ parentId, name: 'RubblePile1', position: { x: 10, y: 0, z: 2 }, isActive: true });
  const rubble1 = await client.findSlotByName('RubblePile1', parentId, 1);
  if (rubble1?.id) {
    await createBox(client, rubble1.id, 'Base', { x: 0, y: 0.4, z: 0 }, { x: 3, y: 0.8, z: 3 }, RUBBLE, 0.1);
    await createBox(client, rubble1.id, 'Mid', { x: 0.3, y: 1, z: 0.2 }, { x: 2, y: 0.6, z: 2 }, RUBBLE, 0.1);
    await createBox(client, rubble1.id, 'Top', { x: 0.5, y: 1.4, z: 0.3 }, { x: 1, y: 0.4, z: 1 }, RUBBLE, 0.1);
  }

  // 瓦礫2 at (-3, 0, -10)
  await client.addSlot({ parentId, name: 'RubblePile2', position: { x: -3, y: 0, z: -10 }, isActive: true });
  const rubble2 = await client.findSlotByName('RubblePile2', parentId, 1);
  if (rubble2?.id) {
    await createBox(client, rubble2.id, 'Chunk1', { x: 0, y: 0.3, z: 0 }, { x: 1.5, y: 0.6, z: 1.5 }, RUBBLE, 0.1);
    await createBox(client, rubble2.id, 'Chunk2', { x: 0.4, y: 0.7, z: 0.2 }, { x: 0.8, y: 0.4, z: 0.8 }, RUBBLE, 0.1);
  }

  // ドラム缶x3 at (-10, 0, +8)
  const drumPositions = [{ x: 0, z: 0 }, { x: 0.7, z: 0.3 }, { x: 0.3, z: 0.7 }];
  for (let i = 0; i < 3; i++) {
    await client.addSlot({ parentId, name: `Drum_${i}`,
      position: { x: -10 + drumPositions[i].x, y: 0.45, z: 8 + drumPositions[i].z }, isActive: true });
    const drum = await client.findSlotByName(`Drum_${i}`, parentId, 1);
    if (drum?.id) {
      await createBox(client, drum.id, 'Body', { x: 0, y: 0, z: 0 }, { x: 0.6, y: 0.9, z: 0.6 }, RUST, 0.3, 0.4);
    }
  }

  // 木箱スタック at (+12, 0, +10)
  await client.addSlot({ parentId, name: 'CrateStack', position: { x: 12, y: 0, z: 10 }, isActive: true });
  const crates = await client.findSlotByName('CrateStack', parentId, 1);
  if (crates?.id) {
    await createBox(client, crates.id, 'Crate1', { x: 0, y: 0.4, z: 0 }, { x: 1, y: 0.8, z: 1 }, OLD_WOOD, 0.2);
    await createBox(client, crates.id, 'Crate2', { x: 0.8, y: 0.4, z: 0 }, { x: 1, y: 0.8, z: 1 }, OLD_WOOD, 0.2);
    await createBox(client, crates.id, 'Crate3', { x: 0.4, y: 1.2, z: 0 }, { x: 1, y: 0.8, z: 1 }, OLD_WOOD, 0.2);
  }
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('=== FPS廃墟市街地ステージ作成開始 ===\n');

    // メインスロット作成
    await client.addSlot({ name: 'FPS_RuinsMap', position: { x: 0, y: 0, z: 0 }, isActive: true });
    const map = await client.findSlotByName('FPS_RuinsMap', 'Root', 1);
    if (!map?.id) throw new Error('Failed to create main slot');
    const mapId = map.id;

    // 1. 地面 (50x50m)
    console.log('地面を作成中...');
    await createBox(client, mapId, 'Ground', { x: 0, y: -0.05, z: 0 }, { x: 50, y: 0.1, z: 50 }, CONCRETE_DIRTY, 0.15);

    // 2. 道路 (十字路)
    console.log('道路を作成中...');
    // 南北道路
    await createBox(client, mapId, 'Road_NS', { x: 0, y: 0.01, z: 0 }, { x: 4, y: 0.02, z: 50 }, ASPHALT, 0.1);
    // 東西道路
    await createBox(client, mapId, 'Road_EW', { x: 0, y: 0.01, z: 0 }, { x: 50, y: 0.02, z: 4 }, ASPHALT, 0.1);
    // ひび割れライン
    await createBox(client, mapId, 'Crack_1', { x: -5, y: 0.015, z: 0 }, { x: 3, y: 0.01, z: 0.1 }, CONCRETE_DIRTY, 0.1);
    await createBox(client, mapId, 'Crack_2', { x: 8, y: 0.015, z: 5 }, { x: 0.1, y: 0.01, z: 4 }, CONCRETE_DIRTY, 0.1);

    // 3. 中央広場と噴水跡
    console.log('中央広場を作成中...');
    await createBox(client, mapId, 'Plaza', { x: 0, y: 0.02, z: 0 }, { x: 12, y: 0.04, z: 12 }, CONCRETE, 0.2);
    // 噴水跡
    await createBox(client, mapId, 'Fountain_Base', { x: 0, y: 0.15, z: 0 }, { x: 3, y: 0.3, z: 3 }, CONCRETE_DIRTY, 0.2);
    await createBox(client, mapId, 'Fountain_Inner', { x: 0, y: 0.25, z: 0 }, { x: 2.5, y: 0.2, z: 2.5 }, { r: 0.25, g: 0.28, b: 0.3 }, 0.3);
    await createBox(client, mapId, 'Fountain_Pillar', { x: 0, y: 0.6, z: 0 }, { x: 0.4, y: 0.8, z: 0.4 }, CONCRETE_DIRTY, 0.2);

    // 4. 建物4棟
    console.log('建物を作成中...');
    await createBuildingA(client, mapId);
    await createBuildingB(client, mapId);
    await createBuildingC(client, mapId);
    await createBuildingD(client, mapId);

    // 5. カバーオブジェクト
    console.log('カバーオブジェクトを作成中...');
    await createCoverObjects(client, mapId);

    console.log('\n=== FPS廃墟市街地ステージ作成完了 ===');
    console.log('  - 地面: 50x50m');
    console.log('  - 道路: 十字路 (4m幅)');
    console.log('  - 中央広場: 12x12m + 噴水跡');
    console.log('  - 建物A: 廃ビル (2階建て)');
    console.log('  - 建物B: 崩壊アパート (外階段付き)');
    console.log('  - 建物C: 倉庫 (シャッター入口)');
    console.log('  - 建物D: 廃商店 (ショーウィンドウ)');
    console.log('  - カバー: 車2台, バリケード2個, コンテナ, 瓦礫, ドラム缶, 木箱');

  } finally {
    client.disconnect();
  }
}

main();

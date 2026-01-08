import { ResoniteLinkClient } from '../index.js';

// === COLORS ===
const CONCRETE = { r: 0.5, g: 0.5, b: 0.48 };
const CONCRETE_DIRTY = { r: 0.35, g: 0.33, b: 0.3 };
const RUST = { r: 0.45, g: 0.25, b: 0.15 };
const OLD_WOOD = { r: 0.35, g: 0.25, b: 0.15 };
const RUBBLE = { r: 0.4, g: 0.38, b: 0.35 };
const DARK_METAL = { r: 0.15, g: 0.15, b: 0.18 };
const GREEN_METAL = { r: 0.2, g: 0.35, b: 0.2 };
const RED = { r: 0.6, g: 0.15, b: 0.1 };
const YELLOW = { r: 0.7, g: 0.6, b: 0.1 };
const GLASS_BROKEN = { r: 0.6, g: 0.65, b: 0.7 };
const SANDBAG = { r: 0.45, g: 0.4, b: 0.3 };
const TARP_BLUE = { r: 0.15, g: 0.25, b: 0.4 };

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

  return slotId;
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('=== 追加オブジェクト配置開始 ===\n');

    // マップを探す
    const map = await client.findSlotByName('FPS_RuinsMap', 'Root', 1);
    if (!map?.id) throw new Error('FPS_RuinsMap not found');
    const mapId = map.id;

    // === 追加の瓦礫 ===
    console.log('瓦礫を追加中...');
    const rubblePositions = [
      { x: -20, y: 0, z: -5, sx: 2, sy: 0.8, sz: 1.5 },
      { x: -18, y: 0, z: 8, sx: 1.5, sy: 0.5, sz: 1.2 },
      { x: 20, y: 0, z: 5, sx: 1.8, sy: 0.7, sz: 1.4 },
      { x: -8, y: 0, z: -18, sx: 1.2, sy: 0.4, sz: 1 },
      { x: 12, y: 0, z: 18, sx: 2.5, sy: 1, sz: 2 },
      { x: -5, y: 0, z: 20, sx: 1.5, sy: 0.6, sz: 1.3 },
      { x: 18, y: 0, z: -8, sx: 1, sy: 0.4, sz: 0.8 },
      { x: -22, y: 0, z: 18, sx: 1.8, sy: 0.6, sz: 1.5 },
    ];
    for (let i = 0; i < rubblePositions.length; i++) {
      const p = rubblePositions[i];
      await createBox(client, mapId, `Rubble_Extra_${i}`, { x: p.x, y: p.sy/2, z: p.z }, { x: p.sx, y: p.sy, z: p.sz }, RUBBLE, 0.1);
    }

    // === 倒れた街灯 ===
    console.log('倒れた街灯を追加中...');
    await client.addSlot({ parentId: mapId, name: 'FallenLamp1', position: { x: -12, y: 0.15, z: 10 },
      rotation: { x: 0, y: 0.38, z: 0.7, w: 0.6 }, isActive: true });
    const lamp1 = await client.findSlotByName('FallenLamp1', mapId, 1);
    if (lamp1?.id) {
      await createBox(client, lamp1.id, 'Pole', { x: 0, y: 1.5, z: 0 }, { x: 0.15, y: 3, z: 0.15 }, DARK_METAL, 0.4, 0.6);
      await createBox(client, lamp1.id, 'Light', { x: 0, y: 3.2, z: 0 }, { x: 0.4, y: 0.2, z: 0.25 }, DARK_METAL, 0.3, 0.5);
    }

    await client.addSlot({ parentId: mapId, name: 'FallenLamp2', position: { x: 15, y: 0.1, z: -3 },
      rotation: { x: 0.5, y: 0.2, z: 0.1, w: 0.83 }, isActive: true });
    const lamp2 = await client.findSlotByName('FallenLamp2', mapId, 1);
    if (lamp2?.id) {
      await createBox(client, lamp2.id, 'Pole', { x: 0, y: 1.5, z: 0 }, { x: 0.15, y: 3, z: 0.15 }, DARK_METAL, 0.4, 0.6);
      await createBox(client, lamp2.id, 'Light', { x: 0, y: 3.2, z: 0 }, { x: 0.4, y: 0.2, z: 0.25 }, DARK_METAL, 0.3, 0.5);
    }

    // 立っている街灯
    const standingLampPos = [
      { x: -22, y: 0, z: 0 },
      { x: 22, y: 0, z: 0 },
      { x: 0, y: 0, z: -22 },
      { x: 0, y: 0, z: 22 },
    ];
    for (let i = 0; i < standingLampPos.length; i++) {
      const p = standingLampPos[i];
      await client.addSlot({ parentId: mapId, name: `StreetLamp_${i}`, position: p, isActive: true });
      const lamp = await client.findSlotByName(`StreetLamp_${i}`, mapId, 1);
      if (lamp?.id) {
        await createBox(client, lamp.id, 'Pole', { x: 0, y: 2, z: 0 }, { x: 0.12, y: 4, z: 0.12 }, DARK_METAL, 0.4, 0.6);
        await createBox(client, lamp.id, 'Arm', { x: 0.4, y: 3.9, z: 0 }, { x: 0.8, y: 0.08, z: 0.08 }, DARK_METAL, 0.4, 0.6);
        await createBox(client, lamp.id, 'Light', { x: 0.7, y: 3.75, z: 0 }, { x: 0.35, y: 0.2, z: 0.25 }, { r: 0.3, g: 0.3, b: 0.28 }, 0.3);
      }
    }

    // === 電柱 ===
    console.log('電柱を追加中...');
    const polePositions = [
      { x: -23, z: -12 },
      { x: 23, z: 12 },
    ];
    for (let i = 0; i < polePositions.length; i++) {
      const p = polePositions[i];
      await client.addSlot({ parentId: mapId, name: `PowerPole_${i}`, position: { x: p.x, y: 0, z: p.z }, isActive: true });
      const pole = await client.findSlotByName(`PowerPole_${i}`, mapId, 1);
      if (pole?.id) {
        await createBox(client, pole.id, 'Main', { x: 0, y: 4, z: 0 }, { x: 0.25, y: 8, z: 0.25 }, OLD_WOOD, 0.2);
        await createBox(client, pole.id, 'CrossArm', { x: 0, y: 7, z: 0 }, { x: 2, y: 0.15, z: 0.15 }, OLD_WOOD, 0.2);
        await createBox(client, pole.id, 'Wire1', { x: -0.8, y: 7.1, z: 0 }, { x: 0.03, y: 0.3, z: 0.03 }, DARK_METAL, 0.3, 0.5);
        await createBox(client, pole.id, 'Wire2', { x: 0.8, y: 7.1, z: 0 }, { x: 0.03, y: 0.3, z: 0.03 }, DARK_METAL, 0.3, 0.5);
      }
    }

    // === ゴミ箱 (倒れたり立ったり) ===
    console.log('ゴミ箱を追加中...');
    // 立っているゴミ箱
    const trashStandPos = [
      { x: -18, z: -2 },
      { x: 18, z: 2 },
      { x: 5, z: 18 },
    ];
    for (let i = 0; i < trashStandPos.length; i++) {
      const p = trashStandPos[i];
      await client.addSlot({ parentId: mapId, name: `TrashCan_${i}`, position: { x: p.x, y: 0, z: p.z }, isActive: true });
      const trash = await client.findSlotByName(`TrashCan_${i}`, mapId, 1);
      if (trash?.id) {
        await createBox(client, trash.id, 'Body', { x: 0, y: 0.4, z: 0 }, { x: 0.5, y: 0.8, z: 0.5 }, GREEN_METAL, 0.3, 0.3);
        await createBox(client, trash.id, 'Lid', { x: 0, y: 0.85, z: 0 }, { x: 0.55, y: 0.1, z: 0.55 }, GREEN_METAL, 0.3, 0.3);
      }
    }
    // 倒れたゴミ箱
    await client.addSlot({ parentId: mapId, name: 'TrashCan_Fallen', position: { x: -6, y: 0.25, z: -15 },
      rotation: { x: 0, y: 0.2, z: 0.7, w: 0.7 }, isActive: true });
    const trashFallen = await client.findSlotByName('TrashCan_Fallen', mapId, 1);
    if (trashFallen?.id) {
      await createBox(client, trashFallen.id, 'Body', { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.8, z: 0.5 }, GREEN_METAL, 0.3, 0.3);
    }

    // === 追加の車 (廃車) ===
    console.log('廃車を追加中...');
    await client.addSlot({ parentId: mapId, name: 'Car3_Burned', position: { x: -18, y: 0, z: -12 }, isActive: true });
    const car3 = await client.findSlotByName('Car3_Burned', mapId, 1);
    if (car3?.id) {
      await createBox(client, car3.id, 'Body', { x: 0, y: 0.45, z: 0 }, { x: 1.7, y: 0.45, z: 3.8 }, { r: 0.15, g: 0.12, b: 0.1 }, 0.2);
      await createBox(client, car3.id, 'Cabin', { x: 0, y: 0.8, z: -0.3 }, { x: 1.5, y: 0.35, z: 1.8 }, { r: 0.1, g: 0.08, b: 0.08 }, 0.2);
    }

    await client.addSlot({ parentId: mapId, name: 'Car4_Wrecked', position: { x: 20, y: 0, z: 20 },
      rotation: { x: 0, y: 0.38, z: 0, w: 0.92 }, isActive: true });
    const car4 = await client.findSlotByName('Car4_Wrecked', mapId, 1);
    if (car4?.id) {
      await createBox(client, car4.id, 'Body', { x: 0, y: 0.5, z: 0 }, { x: 1.8, y: 0.5, z: 4 }, RUST, 0.3, 0.3);
      await createBox(client, car4.id, 'Hood', { x: 0, y: 0.7, z: 1.5 }, { x: 1.6, y: 0.1, z: 1 }, RUST, 0.3, 0.3);
    }

    // === 有刺鉄線バリケード ===
    console.log('有刺鉄線を追加中...');
    const barbedWirePos = [
      { x: -8, z: 12, rot: 0 },
      { x: 8, z: -12, rot: 0.7 },
    ];
    for (let i = 0; i < barbedWirePos.length; i++) {
      const p = barbedWirePos[i];
      await client.addSlot({ parentId: mapId, name: `BarbedWire_${i}`, position: { x: p.x, y: 0, z: p.z },
        rotation: { x: 0, y: Math.sin(p.rot/2), z: 0, w: Math.cos(p.rot/2) }, isActive: true });
      const wire = await client.findSlotByName(`BarbedWire_${i}`, mapId, 1);
      if (wire?.id) {
        await createBox(client, wire.id, 'Post_L', { x: -1, y: 0.5, z: 0 }, { x: 0.08, y: 1, z: 0.08 }, RUST, 0.3, 0.5);
        await createBox(client, wire.id, 'Post_R', { x: 1, y: 0.5, z: 0 }, { x: 0.08, y: 1, z: 0.08 }, RUST, 0.3, 0.5);
        await createBox(client, wire.id, 'Wire1', { x: 0, y: 0.3, z: 0 }, { x: 2, y: 0.03, z: 0.03 }, RUST, 0.3, 0.5);
        await createBox(client, wire.id, 'Wire2', { x: 0, y: 0.6, z: 0 }, { x: 2, y: 0.03, z: 0.03 }, RUST, 0.3, 0.5);
        await createBox(client, wire.id, 'Wire3', { x: 0, y: 0.9, z: 0 }, { x: 2, y: 0.03, z: 0.03 }, RUST, 0.3, 0.5);
      }
    }

    // === 土嚢の壁 ===
    console.log('土嚢の壁を追加中...');
    await client.addSlot({ parentId: mapId, name: 'SandbagWall1', position: { x: 6, y: 0, z: 12 }, isActive: true });
    const sb1 = await client.findSlotByName('SandbagWall1', mapId, 1);
    if (sb1?.id) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const offset = (row % 2) * 0.25;
          await createBox(client, sb1.id, `Bag_${row}_${col}`,
            { x: -0.75 + col * 0.5 + offset, y: 0.15 + row * 0.25, z: 0 },
            { x: 0.45, y: 0.2, z: 0.25 }, SANDBAG, 0.1);
        }
      }
    }

    await client.addSlot({ parentId: mapId, name: 'SandbagWall2', position: { x: -12, y: 0, z: -8 },
      rotation: { x: 0, y: 0.7, z: 0, w: 0.7 }, isActive: true });
    const sb2 = await client.findSlotByName('SandbagWall2', mapId, 1);
    if (sb2?.id) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 5; col++) {
          const offset = (row % 2) * 0.25;
          await createBox(client, sb2.id, `Bag_${row}_${col}`,
            { x: -1 + col * 0.5 + offset, y: 0.15 + row * 0.25, z: 0 },
            { x: 0.45, y: 0.2, z: 0.25 }, SANDBAG, 0.1);
        }
      }
    }

    // === 壊れたフェンス ===
    console.log('壊れたフェンスを追加中...');
    await client.addSlot({ parentId: mapId, name: 'BrokenFence1', position: { x: -20, y: 0, z: 5 }, isActive: true });
    const fence1 = await client.findSlotByName('BrokenFence1', mapId, 1);
    if (fence1?.id) {
      await createBox(client, fence1.id, 'Post1', { x: 0, y: 0.6, z: 0 }, { x: 0.1, y: 1.2, z: 0.1 }, RUST, 0.3, 0.5);
      await createBox(client, fence1.id, 'Post2', { x: 1.5, y: 0.5, z: 0 }, { x: 0.1, y: 1, z: 0.1 }, RUST, 0.3, 0.5);
      await createBox(client, fence1.id, 'Post3', { x: 3, y: 0.6, z: 0 }, { x: 0.1, y: 1.2, z: 0.1 }, RUST, 0.3, 0.5);
      await createBox(client, fence1.id, 'Mesh1', { x: 0.75, y: 0.5, z: 0 }, { x: 1.4, y: 0.8, z: 0.02 }, { r: 0.3, g: 0.3, b: 0.32 }, 0.3, 0.4);
      // 倒れた部分
      await client.addSlot({ parentId: fence1.id, name: 'FallenSection', position: { x: 2.25, y: 0.2, z: 0.5 },
        rotation: { x: 0.5, y: 0, z: 0.2, w: 0.84 }, isActive: true });
      const fallen = await client.findSlotByName('FallenSection', fence1.id, 1);
      if (fallen?.id) {
        await createBox(client, fallen.id, 'Mesh', { x: 0, y: 0, z: 0 }, { x: 1.4, y: 0.8, z: 0.02 }, { r: 0.3, g: 0.3, b: 0.32 }, 0.3, 0.4);
      }
    }

    // === タイヤ ===
    console.log('タイヤを追加中...');
    const tirePositions = [
      { x: -15, y: 0.3, z: 3 },
      { x: -14.5, y: 0.3, z: 3.5 },
      { x: -14.8, y: 0.7, z: 3.2 },
      { x: 10, y: 0.3, z: -18 },
    ];
    for (let i = 0; i < tirePositions.length; i++) {
      const p = tirePositions[i];
      await createBox(client, mapId, `Tire_${i}`, { x: p.x, y: p.y, z: p.z }, { x: 0.6, y: 0.2, z: 0.6 }, DARK_METAL, 0.2);
    }

    // === ブルーシート/タープ ===
    console.log('ブルーシートを追加中...');
    await client.addSlot({ parentId: mapId, name: 'Tarp1', position: { x: -5, y: 1.5, z: -20 },
      rotation: { x: 0.1, y: 0, z: 0.1, w: 0.99 }, isActive: true });
    const tarp1 = await client.findSlotByName('Tarp1', mapId, 1);
    if (tarp1?.id) {
      await createBox(client, tarp1.id, 'Sheet', { x: 0, y: 0, z: 0 }, { x: 3, y: 0.02, z: 2 }, TARP_BLUE, 0.3);
    }

    // === 看板/標識 ===
    console.log('看板を追加中...');
    // 倒れた道路標識
    await client.addSlot({ parentId: mapId, name: 'FallenSign', position: { x: 12, y: 0.1, z: 5 },
      rotation: { x: 0, y: 0.3, z: 0.65, w: 0.7 }, isActive: true });
    const sign = await client.findSlotByName('FallenSign', mapId, 1);
    if (sign?.id) {
      await createBox(client, sign.id, 'Pole', { x: 0, y: 1, z: 0 }, { x: 0.08, y: 2, z: 0.08 }, DARK_METAL, 0.4, 0.6);
      await createBox(client, sign.id, 'Sign', { x: 0, y: 2.1, z: 0 }, { x: 0.6, y: 0.6, z: 0.05 }, YELLOW, 0.3);
    }

    // 警告看板
    await client.addSlot({ parentId: mapId, name: 'WarningSign', position: { x: -2, y: 0, z: 15 }, isActive: true });
    const warn = await client.findSlotByName('WarningSign', mapId, 1);
    if (warn?.id) {
      await createBox(client, warn.id, 'Post', { x: 0, y: 0.6, z: 0 }, { x: 0.06, y: 1.2, z: 0.06 }, DARK_METAL, 0.4, 0.6);
      await createBox(client, warn.id, 'Board', { x: 0, y: 1.3, z: 0 }, { x: 0.5, y: 0.4, z: 0.03 }, RED, 0.3);
    }

    // === パレット ===
    console.log('パレットを追加中...');
    const palletPos = [
      { x: -18, z: 20 },
      { x: 18, z: -20 },
    ];
    for (let i = 0; i < palletPos.length; i++) {
      const p = palletPos[i];
      await client.addSlot({ parentId: mapId, name: `Pallet_${i}`, position: { x: p.x, y: 0, z: p.z }, isActive: true });
      const pallet = await client.findSlotByName(`Pallet_${i}`, mapId, 1);
      if (pallet?.id) {
        await createBox(client, pallet.id, 'Board1', { x: 0, y: 0.05, z: -0.4 }, { x: 1.2, y: 0.1, z: 0.15 }, OLD_WOOD, 0.2);
        await createBox(client, pallet.id, 'Board2', { x: 0, y: 0.05, z: 0 }, { x: 1.2, y: 0.1, z: 0.15 }, OLD_WOOD, 0.2);
        await createBox(client, pallet.id, 'Board3', { x: 0, y: 0.05, z: 0.4 }, { x: 1.2, y: 0.1, z: 0.15 }, OLD_WOOD, 0.2);
        await createBox(client, pallet.id, 'Block1', { x: -0.4, y: 0.15, z: 0 }, { x: 0.15, y: 0.1, z: 0.9 }, OLD_WOOD, 0.2);
        await createBox(client, pallet.id, 'Block2', { x: 0.4, y: 0.15, z: 0 }, { x: 0.15, y: 0.1, z: 0.9 }, OLD_WOOD, 0.2);
      }
    }

    // === 割れたガラス ===
    console.log('割れたガラスを追加中...');
    const glassPositions = [
      { x: 14, z: -12 },
      { x: 13.5, z: -13 },
      { x: -16, z: 16 },
    ];
    for (let i = 0; i < glassPositions.length; i++) {
      const p = glassPositions[i];
      await createBox(client, mapId, `BrokenGlass_${i}`, { x: p.x, y: 0.02, z: p.z },
        { x: 0.3 + Math.random() * 0.3, y: 0.02, z: 0.2 + Math.random() * 0.3 }, GLASS_BROKEN, 0.8);
    }

    // === 追加のコンクリートブロック ===
    console.log('コンクリートブロックを追加中...');
    const blockPositions = [
      { x: -3, y: 0.25, z: 8 },
      { x: 15, y: 0.25, z: 3 },
      { x: -10, y: 0.25, z: -5 },
    ];
    for (let i = 0; i < blockPositions.length; i++) {
      const p = blockPositions[i];
      await createBox(client, mapId, `ConcreteBlock_${i}`, { x: p.x, y: p.y, z: p.z }, { x: 0.8, y: 0.5, z: 0.4 }, CONCRETE, 0.2);
    }

    console.log('\n=== 追加オブジェクト配置完了 ===');
    console.log('  + 瓦礫 x8');
    console.log('  + 街灯 x6 (倒れた x2, 立っている x4)');
    console.log('  + 電柱 x2');
    console.log('  + ゴミ箱 x4');
    console.log('  + 廃車 x2');
    console.log('  + 有刺鉄線 x2');
    console.log('  + 土嚢の壁 x2');
    console.log('  + 壊れたフェンス x1');
    console.log('  + タイヤ x4');
    console.log('  + ブルーシート x1');
    console.log('  + 看板 x2');
    console.log('  + パレット x2');
    console.log('  + 割れたガラス x3');
    console.log('  + コンクリートブロック x3');

  } finally {
    client.disconnect();
  }
}

main();

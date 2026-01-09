import { ResoniteLinkClient } from '../client.js';

// === COLORS ===
const CONCRETE = { r: 0.5, g: 0.5, b: 0.48 };
const CONCRETE_DIRTY = { r: 0.35, g: 0.33, b: 0.3 };
const RUST = { r: 0.45, g: 0.25, b: 0.15 };
const OLD_WOOD = { r: 0.35, g: 0.25, b: 0.15 };
const RUBBLE = { r: 0.4, g: 0.38, b: 0.35 };
const DARK_METAL = { r: 0.15, g: 0.15, b: 0.18 };
const SANDBAG = { r: 0.45, g: 0.4, b: 0.3 };

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
  const collider = slotData.data.components.find(c => c.componentType === 'FrooxEngine.BoxCollider');
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

  // CharacterCollider有効化
  if (collider?.id) {
    await client.updateComponent({
      id: collider.id,
      members: { CharacterCollider: { $type: 'bool', value: true } } as any
    });
  }

  return slotId;
}

async function main() {
  const url = process.argv[2] || 'ws://localhost:29551';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('=== 大量の障害物を追加 ===\n');

    const map = await client.findSlotByName('FPS_RuinsMap', 'Root', 1);
    if (!map?.id) throw new Error('FPS_RuinsMap not found');
    const mapId = map.id;

    let totalCount = 0;

    // === 大きな瓦礫の壁 (射線を遮る) ===
    console.log('瓦礫の壁を追加中...');
    const rubbleWalls = [
      { x: -6, z: -6, w: 4, h: 2, d: 1.5 },
      { x: 6, z: 6, w: 3.5, h: 1.8, d: 1.2 },
      { x: -4, z: 10, w: 3, h: 1.5, d: 2 },
      { x: 8, z: -4, w: 2.5, h: 2, d: 1.8 },
      { x: -10, z: -3, w: 2, h: 1.8, d: 3 },
      { x: 10, z: 10, w: 3, h: 2.2, d: 1.5 },
      { x: -8, z: 15, w: 2.5, h: 1.6, d: 2 },
      { x: 12, z: -10, w: 2, h: 1.5, d: 2.5 },
    ];
    for (let i = 0; i < rubbleWalls.length; i++) {
      const r = rubbleWalls[i];
      await createBox(client, mapId, `RubbleWall_${i}`, { x: r.x, y: r.h/2, z: r.z }, { x: r.w, y: r.h, z: r.d }, RUBBLE, 0.1);
      totalCount++;
    }

    // === コンクリート壁の残骸 ===
    console.log('コンクリート壁の残骸を追加中...');
    const concreteWalls = [
      { x: -12, z: 5, w: 0.3, h: 2.5, d: 4, rot: 0 },
      { x: 5, z: -12, w: 5, h: 2, d: 0.3, rot: 0 },
      { x: -5, z: -5, w: 0.3, h: 1.8, d: 3, rot: 0.5 },
      { x: 8, z: 8, w: 3, h: 2.2, d: 0.3, rot: 0.3 },
      { x: -15, z: -5, w: 0.3, h: 2, d: 3.5, rot: 0 },
      { x: 15, z: 5, w: 0.3, h: 1.5, d: 4, rot: 0 },
      { x: 0, z: -8, w: 3, h: 1.8, d: 0.3, rot: 0 },
      { x: 0, z: 8, w: 4, h: 2, d: 0.3, rot: 0 },
      { x: -8, z: 0, w: 0.3, h: 2.2, d: 3, rot: 0 },
      { x: 12, z: 0, w: 0.3, h: 1.8, d: 3.5, rot: 0 },
    ];
    for (let i = 0; i < concreteWalls.length; i++) {
      const w = concreteWalls[i];
      if (w.rot !== 0) {
        await client.addSlot({ parentId: mapId, name: `ConcreteWall_${i}`,
          position: { x: w.x, y: 0, z: w.z },
          rotation: { x: 0, y: Math.sin(w.rot/2), z: 0, w: Math.cos(w.rot/2) }, isActive: true });
        const slot = await client.findSlotByName(`ConcreteWall_${i}`, mapId, 1);
        if (slot?.id) {
          await createBox(client, slot.id, 'Wall', { x: 0, y: w.h/2, z: 0 }, { x: w.w, y: w.h, z: w.d }, CONCRETE, 0.2);
        }
      } else {
        await createBox(client, mapId, `ConcreteWall_${i}`, { x: w.x, y: w.h/2, z: w.z }, { x: w.w, y: w.h, z: w.d }, CONCRETE, 0.2);
      }
      totalCount++;
    }

    // === 車の残骸 (大きなカバー) ===
    console.log('車の残骸を追加中...');
    const carWrecks = [
      { x: -10, z: 12, rot: 0.8 },
      { x: 10, z: -15, rot: 0.3 },
      { x: -18, z: 0, rot: 1.5 },
      { x: 18, z: 10, rot: 2.2 },
      { x: 5, z: 15, rot: 0.5 },
      { x: -5, z: -15, rot: 1.8 },
    ];
    for (let i = 0; i < carWrecks.length; i++) {
      const c = carWrecks[i];
      await client.addSlot({ parentId: mapId, name: `CarWreck_${i}`,
        position: { x: c.x, y: 0, z: c.z },
        rotation: { x: 0, y: Math.sin(c.rot/2), z: 0, w: Math.cos(c.rot/2) }, isActive: true });
      const car = await client.findSlotByName(`CarWreck_${i}`, mapId, 1);
      if (car?.id) {
        await createBox(client, car.id, 'Body', { x: 0, y: 0.5, z: 0 }, { x: 1.8, y: 0.5, z: 4 }, RUST, 0.3, 0.3);
        await createBox(client, car.id, 'Cabin', { x: 0, y: 0.9, z: -0.3 }, { x: 1.6, y: 0.4, z: 2 }, RUST, 0.3, 0.3);
        totalCount += 2;
      }
    }

    // === 土嚢バリケード (大量) ===
    console.log('土嚢バリケードを追加中...');
    const sandbagPositions = [
      { x: -3, z: 3 }, { x: 3, z: -3 }, { x: -7, z: -10 }, { x: 7, z: 10 },
      { x: -12, z: 8 }, { x: 12, z: -8 }, { x: -5, z: 18 }, { x: 5, z: -18 },
      { x: -18, z: 5 }, { x: 18, z: -5 }, { x: 0, z: 15 }, { x: 0, z: -15 },
      { x: -15, z: 0 }, { x: 15, z: 0 }, { x: -10, z: -15 }, { x: 10, z: 15 },
    ];
    for (let i = 0; i < sandbagPositions.length; i++) {
      const p = sandbagPositions[i];
      const rot = Math.random() * Math.PI;
      await client.addSlot({ parentId: mapId, name: `SandbagCover_${i}`,
        position: { x: p.x, y: 0, z: p.z },
        rotation: { x: 0, y: Math.sin(rot/2), z: 0, w: Math.cos(rot/2) }, isActive: true });
      const sb = await client.findSlotByName(`SandbagCover_${i}`, mapId, 1);
      if (sb?.id) {
        const rows = 2 + Math.floor(Math.random() * 2);
        const cols = 3 + Math.floor(Math.random() * 2);
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const offset = (row % 2) * 0.2;
            await createBox(client, sb.id, `Bag_${row}_${col}`,
              { x: -0.5 + col * 0.4 + offset, y: 0.12 + row * 0.2, z: 0 },
              { x: 0.35, y: 0.18, z: 0.2 }, SANDBAG, 0.1);
            totalCount++;
          }
        }
      }
    }

    // === 木箱スタック ===
    console.log('木箱スタックを追加中...');
    const cratePositions = [
      { x: -8, z: -8 }, { x: 8, z: 8 }, { x: -12, z: 12 }, { x: 12, z: -12 },
      { x: -3, z: -12 }, { x: 3, z: 12 }, { x: -15, z: -8 }, { x: 15, z: 8 },
      { x: -6, z: 6 }, { x: 6, z: -6 },
    ];
    for (let i = 0; i < cratePositions.length; i++) {
      const p = cratePositions[i];
      const rot = Math.random() * Math.PI;
      await client.addSlot({ parentId: mapId, name: `CrateStack_${i}`,
        position: { x: p.x, y: 0, z: p.z },
        rotation: { x: 0, y: Math.sin(rot/2), z: 0, w: Math.cos(rot/2) }, isActive: true });
      const stack = await client.findSlotByName(`CrateStack_${i}`, mapId, 1);
      if (stack?.id) {
        const numCrates = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < numCrates; j++) {
          const size = 0.6 + Math.random() * 0.4;
          await createBox(client, stack.id, `Crate_${j}`,
            { x: (Math.random() - 0.5) * 0.5, y: size/2 + j * 0.5, z: (Math.random() - 0.5) * 0.5 },
            { x: size, y: size, z: size }, OLD_WOOD, 0.2);
          totalCount++;
        }
      }
    }

    // === コンテナ (追加) ===
    console.log('コンテナを追加中...');
    const containerPositions = [
      { x: -18, z: -18, rot: 0.3 },
      { x: 18, z: 18, rot: 1.2 },
      { x: -12, z: 18, rot: 0 },
    ];
    for (let i = 0; i < containerPositions.length; i++) {
      const c = containerPositions[i];
      await client.addSlot({ parentId: mapId, name: `Container_${i}`,
        position: { x: c.x, y: 0, z: c.z },
        rotation: { x: 0, y: Math.sin(c.rot/2), z: 0, w: Math.cos(c.rot/2) }, isActive: true });
      const container = await client.findSlotByName(`Container_${i}`, mapId, 1);
      if (container?.id) {
        await createBox(client, container.id, 'Floor', { x: 0, y: 0.1, z: 0 }, { x: 2.4, y: 0.2, z: 6 }, RUST, 0.3, 0.4);
        await createBox(client, container.id, 'Wall_L', { x: -1.2, y: 1.25, z: 0 }, { x: 0.1, y: 2.3, z: 6 }, RUST, 0.3, 0.4);
        await createBox(client, container.id, 'Wall_R', { x: 1.2, y: 1.25, z: 0 }, { x: 0.1, y: 2.3, z: 6 }, RUST, 0.3, 0.4);
        await createBox(client, container.id, 'Wall_Back', { x: 0, y: 1.25, z: -3 }, { x: 2.4, y: 2.3, z: 0.1 }, RUST, 0.3, 0.4);
        await createBox(client, container.id, 'Roof', { x: 0, y: 2.4, z: 0 }, { x: 2.5, y: 0.1, z: 6 }, RUST, 0.3, 0.4);
        totalCount += 5;
      }
    }

    // === コンクリートブロック (大量) ===
    console.log('コンクリートブロックを追加中...');
    const blockPositions = [
      { x: -4, z: -4 }, { x: 4, z: 4 }, { x: -8, z: 4 }, { x: 8, z: -4 },
      { x: -12, z: -4 }, { x: 12, z: 4 }, { x: -4, z: -12 }, { x: 4, z: 12 },
      { x: -16, z: 12 }, { x: 16, z: -12 }, { x: -6, z: 16 }, { x: 6, z: -16 },
      { x: -14, z: -10 }, { x: 14, z: 10 }, { x: 0, z: 5 }, { x: 0, z: -5 },
      { x: 5, z: 0 }, { x: -5, z: 0 }, { x: -9, z: 9 }, { x: 9, z: -9 },
    ];
    for (let i = 0; i < blockPositions.length; i++) {
      const p = blockPositions[i];
      const h = 0.4 + Math.random() * 0.6;
      const rot = Math.random() * Math.PI;
      await client.addSlot({ parentId: mapId, name: `Block_${i}`,
        position: { x: p.x, y: 0, z: p.z },
        rotation: { x: 0, y: Math.sin(rot/2), z: 0, w: Math.cos(rot/2) }, isActive: true });
      const block = await client.findSlotByName(`Block_${i}`, mapId, 1);
      if (block?.id) {
        await createBox(client, block.id, 'Block', { x: 0, y: h/2, z: 0 },
          { x: 0.8 + Math.random() * 0.4, y: h, z: 0.4 + Math.random() * 0.3 }, CONCRETE, 0.2);
        totalCount++;
      }
    }

    // === ドラム缶 (大量) ===
    console.log('ドラム缶を追加中...');
    const drumPositions = [
      { x: -7, z: 7 }, { x: 7, z: -7 }, { x: -11, z: 11 }, { x: 11, z: -11 },
      { x: -3, z: -7 }, { x: 3, z: 7 }, { x: -17, z: 3 }, { x: 17, z: -3 },
      { x: -14, z: -3 }, { x: 14, z: 3 },
    ];
    for (let i = 0; i < drumPositions.length; i++) {
      const p = drumPositions[i];
      const numDrums = 1 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numDrums; j++) {
        await createBox(client, mapId, `Drum_${i}_${j}`,
          { x: p.x + (Math.random() - 0.5) * 1.5, y: 0.45, z: p.z + (Math.random() - 0.5) * 1.5 },
          { x: 0.6, y: 0.9, z: 0.6 }, RUST, 0.3, 0.4);
        totalCount++;
      }
    }

    // === 大きな瓦礫の山 ===
    console.log('瓦礫の山を追加中...');
    const rubblePilePositions = [
      { x: -5, z: -10, s: 1.5 }, { x: 5, z: 10, s: 1.8 },
      { x: -10, z: 5, s: 1.3 }, { x: 10, z: -5, s: 1.6 },
      { x: -15, z: 15, s: 2 }, { x: 15, z: -15, s: 1.4 },
      { x: 0, z: 12, s: 1.2 }, { x: 0, z: -12, s: 1.5 },
    ];
    for (let i = 0; i < rubblePilePositions.length; i++) {
      const p = rubblePilePositions[i];
      await client.addSlot({ parentId: mapId, name: `RubblePile_${i}`,
        position: { x: p.x, y: 0, z: p.z }, isActive: true });
      const pile = await client.findSlotByName(`RubblePile_${i}`, mapId, 1);
      if (pile?.id) {
        await createBox(client, pile.id, 'Base', { x: 0, y: 0.4 * p.s, z: 0 },
          { x: 2 * p.s, y: 0.8 * p.s, z: 2 * p.s }, RUBBLE, 0.1);
        await createBox(client, pile.id, 'Mid', { x: 0.2, y: 0.9 * p.s, z: 0.2 },
          { x: 1.3 * p.s, y: 0.5 * p.s, z: 1.3 * p.s }, RUBBLE, 0.1);
        await createBox(client, pile.id, 'Top', { x: 0.3, y: 1.2 * p.s, z: 0.3 },
          { x: 0.6 * p.s, y: 0.3 * p.s, z: 0.6 * p.s }, RUBBLE, 0.1);
        totalCount += 3;
      }
    }

    // === 倒れた柱 ===
    console.log('倒れた柱を追加中...');
    const fallenPillars = [
      { x: -8, z: 3, rot: 0.2 },
      { x: 8, z: -3, rot: 1.5 },
      { x: -3, z: 8, rot: 0.8 },
      { x: 3, z: -8, rot: 2.3 },
    ];
    for (let i = 0; i < fallenPillars.length; i++) {
      const p = fallenPillars[i];
      await client.addSlot({ parentId: mapId, name: `FallenPillar_${i}`,
        position: { x: p.x, y: 0.25, z: p.z },
        rotation: { x: 0.5, y: Math.sin(p.rot/2) * 0.7, z: 0.5, w: Math.cos(p.rot/2) }, isActive: true });
      const pillar = await client.findSlotByName(`FallenPillar_${i}`, mapId, 1);
      if (pillar?.id) {
        await createBox(client, pillar.id, 'Pillar', { x: 0, y: 1.5, z: 0 },
          { x: 0.5, y: 3, z: 0.5 }, CONCRETE, 0.2);
        totalCount++;
      }
    }

    console.log(`\n=== 完了: ${totalCount}個のオブジェクトを追加 ===`);
    console.log('射線を遮る障害物を大量に配置しました！');

  } finally {
    client.disconnect();
  }
}

main();

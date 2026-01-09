import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Tokyo Tower colors
const TOWER_ORANGE = { r: 1.0, g: 0.35, b: 0.1 };
const TOWER_WHITE = { r: 1.0, g: 1.0, b: 1.0 };
const DECK_GRAY = { r: 0.3, g: 0.3, b: 0.35 };
const ANTENNA_SILVER = { r: 0.8, g: 0.8, b: 0.85 };

// Tower dimensions (scaled for VR - total height ~33m instead of 333m)
const SCALE = 0.1;
const TOTAL_HEIGHT = 333 * SCALE; // 33.3m
const BASE_WIDTH = 80 * SCALE;    // 8m at base
const MAIN_DECK_HEIGHT = 150 * SCALE;  // 15m
const TOP_DECK_HEIGHT = 250 * SCALE;   // 25m

function eulerToQuaternion(x: number, y: number, z: number): { x: number; y: number; z: number; w: number } {
  const toRad = Math.PI / 180;
  const cx = Math.cos(x * toRad / 2), sx = Math.sin(x * toRad / 2);
  const cy = Math.cos(y * toRad / 2), sy = Math.sin(y * toRad / 2);
  const cz = Math.cos(z * toRad / 2), sz = Math.sin(z * toRad / 2);
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

async function createMeshWithMaterial(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  meshType: string,
  meshParams: Record<string, any>,
  materialParams: Record<string, any>,
  position: { x: number; y: number; z: number },
  rotation?: { x: number; y: number; z: number }
): Promise<string | null> {
  const rot = rotation || { x: 0, y: 0, z: 0 };
  const quat = eulerToQuaternion(rot.x, rot.y, rot.z);
  await client.addSlot({
    parentId,
    name,
    position,
    rotation: quat,
    isActive: true,
  });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return null;
  const slotId = slot.id;

  await client.addComponent({ containerSlotId: slotId, componentType: `[FrooxEngine]FrooxEngine.${meshType}` });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slotId, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

  const slotData = await client.getSlot({ slotId, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return null;

  const mesh = slotData.data.components.find(c => c.componentType === `FrooxEngine.${meshType}`);
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
  if (!mesh || !renderer || !material) return null;

  if (Object.keys(meshParams).length > 0) {
    await client.updateComponent({ id: mesh.id!, members: meshParams as any });
  }

  await client.updateComponent({ id: renderer.id!, members: { Mesh: { $type: 'reference', targetId: mesh.id } } as any });
  await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } } as any });
  const rendererData = await client.getComponent(renderer.id!);
  if (rendererData.success) {
    const materials = (rendererData.data.members as any)?.Materials;
    if (materials?.elements?.[0]) {
      await client.updateComponent({ id: renderer.id!, members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: materials.elements[0].id, targetId: material.id }] } } as any });
    }
  }

  await client.updateComponent({ id: material.id!, members: materialParams as any });
  return slotId;
}

async function createBeam(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  rotation?: { x: number; y: number; z: number }
): Promise<void> {
  await createMeshWithMaterial(
    client,
    parentId,
    name,
    'BoxMesh',
    { Size: { $type: 'float3', value: size } },
    {
      AlbedoColor: { $type: 'colorX', value: { r: color.r, g: color.g, b: color.b, a: 1, profile: 'sRGB' } },
      Metallic: { $type: 'float', value: 0.3 },
      Smoothness: { $type: 'float', value: 0.5 }
    },
    position,
    rotation
  );
}

async function createCylinder(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  height: number,
  radius: number,
  color: { r: number; g: number; b: number }
): Promise<void> {
  await createMeshWithMaterial(
    client,
    parentId,
    name,
    'CylinderMesh',
    {
      Height: { $type: 'float', value: height },
      Radius: { $type: 'float', value: radius }
    },
    {
      AlbedoColor: { $type: 'colorX', value: { r: color.r, g: color.g, b: color.b, a: 1, profile: 'sRGB' } },
      Metallic: { $type: 'float', value: 0.5 },
      Smoothness: { $type: 'float', value: 0.6 }
    },
    position
  );
}

async function createDeck(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await createMeshWithMaterial(
    client,
    parentId,
    name,
    'BoxMesh',
    { Size: { $type: 'float3', value: { x: width, y: height, z: width } } },
    {
      AlbedoColor: { $type: 'colorX', value: { r: DECK_GRAY.r, g: DECK_GRAY.g, b: DECK_GRAY.b, a: 1, profile: 'sRGB' } },
      Metallic: { $type: 'float', value: 0.4 },
      Smoothness: { $type: 'float', value: 0.3 }
    },
    { x: 0, y, z: 0 }
  );
}

async function createTowerLeg(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  baseX: number,
  baseZ: number,
  sections: number
): Promise<void> {
  const beamThickness = 0.15;
  const sectionHeight = MAIN_DECK_HEIGHT / sections;

  for (let i = 0; i < sections; i++) {
    const t = i / sections;
    const nextT = (i + 1) / sections;

    // Interpolate X position (legs taper inward)
    const currentX = baseX * (1 - t * 0.7);
    const nextX = baseX * (1 - nextT * 0.7);
    const currentZ = baseZ * (1 - t * 0.7);
    const nextZ = baseZ * (1 - nextT * 0.7);

    const y = i * sectionHeight;
    const centerX = (currentX + nextX) / 2;
    const centerZ = (currentZ + nextZ) / 2;
    const centerY = y + sectionHeight / 2;

    // Calculate angle for tilted beam
    const dx = nextX - currentX;
    const dz = nextZ - currentZ;
    const dy = sectionHeight;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Alternate colors (orange/white bands)
    const color = i % 2 === 0 ? TOWER_ORANGE : TOWER_WHITE;

    // Vertical beam (slightly tilted)
    const angleX = Math.atan2(dx, dy) * 180 / Math.PI;
    const angleZ = Math.atan2(dz, dy) * 180 / Math.PI;

    await createBeam(
      client,
      parentId,
      `${name}_S${i}`,
      { x: centerX, y: centerY, z: centerZ },
      { x: beamThickness, y: length, z: beamThickness },
      color,
      { x: angleZ, y: 0, z: -angleX }
    );
  }
}

async function createHorizontalBracing(
  client: ResoniteLinkClient,
  parentId: string,
  y: number,
  width: number,
  color: { r: number; g: number; b: number },
  name: string
): Promise<void> {
  const beamThickness = 0.12;
  const halfWidth = width / 2;

  // Four horizontal beams forming a square
  await createBeam(client, parentId, `${name}_N`, { x: 0, y, z: halfWidth }, { x: width, y: beamThickness, z: beamThickness }, color);
  await createBeam(client, parentId, `${name}_S`, { x: 0, y, z: -halfWidth }, { x: width, y: beamThickness, z: beamThickness }, color);
  await createBeam(client, parentId, `${name}_E`, { x: halfWidth, y, z: 0 }, { x: beamThickness, y: beamThickness, z: width }, color);
  await createBeam(client, parentId, `${name}_W`, { x: -halfWidth, y, z: 0 }, { x: beamThickness, y: beamThickness, z: width }, color);
}

async function createUpperSection(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const startY = MAIN_DECK_HEIGHT;
  const endY = TOP_DECK_HEIGHT;
  const sections = 8;
  const sectionHeight = (endY - startY) / sections;
  const beamThickness = 0.1;

  // Width tapers from main deck to top deck
  const startWidth = BASE_WIDTH * 0.3;
  const endWidth = BASE_WIDTH * 0.15;

  for (let i = 0; i < sections; i++) {
    const t = i / sections;
    const y = startY + i * sectionHeight;
    const width = startWidth + (endWidth - startWidth) * t;
    const halfWidth = width / 2;

    const color = i % 2 === 0 ? TOWER_ORANGE : TOWER_WHITE;

    // Four corner beams
    await createBeam(client, parentId, `Up${i}_1`, { x: halfWidth, y: y + sectionHeight/2, z: halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `Up${i}_2`, { x: -halfWidth, y: y + sectionHeight/2, z: halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `Up${i}_3`, { x: halfWidth, y: y + sectionHeight/2, z: -halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `Up${i}_4`, { x: -halfWidth, y: y + sectionHeight/2, z: -halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);

    // Horizontal bracing every other section
    if (i % 2 === 0) {
      await createHorizontalBracing(client, parentId, y, width, color, `UB${i}`);
    }
  }
}

async function createAntenna(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const antennaBase = TOP_DECK_HEIGHT;
  const antennaHeight = TOTAL_HEIGHT - TOP_DECK_HEIGHT;

  // Main antenna pole
  await createCylinder(
    client,
    parentId,
    'Antenna_Main',
    { x: 0, y: antennaBase + antennaHeight / 2, z: 0 },
    antennaHeight,
    0.15,
    ANTENNA_SILVER
  );

  // Antenna tip (red)
  await createCylinder(
    client,
    parentId,
    'Antenna_Tip',
    { x: 0, y: TOTAL_HEIGHT - 0.5, z: 0 },
    1.0,
    0.08,
    TOWER_ORANGE
  );
}

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Creating Tokyo Tower...\n');

    // Create main tower slot
    await client.addSlot({
      name: 'TokyoTower',
      position: { x: 0, y: 0, z: 0 },
      isActive: true
    });
    const tower = await client.findSlotByName('TokyoTower', 'Root', 1);
    if (!tower?.id) {
      console.log('Failed to create tower slot');
      return;
    }
    const towerId = tower.id;
    console.log('Created TokyoTower slot');

    // Create four legs
    console.log('\nCreating tower legs...');
    const legOffset = BASE_WIDTH / 2;
    await createTowerLeg(client, towerId, 'LNE', legOffset, legOffset, 10);
    await createTowerLeg(client, towerId, 'LNW', -legOffset, legOffset, 10);
    await createTowerLeg(client, towerId, 'LSE', legOffset, -legOffset, 10);
    await createTowerLeg(client, towerId, 'LSW', -legOffset, -legOffset, 10);

    // Create horizontal bracing at intervals
    console.log('Creating horizontal bracing...');
    for (let i = 1; i < 10; i += 2) {
      const t = i / 10;
      const y = t * MAIN_DECK_HEIGHT;
      const width = BASE_WIDTH * (1 - t * 0.7);
      const color = i % 4 === 1 ? TOWER_ORANGE : TOWER_WHITE;
      await createHorizontalBracing(client, towerId, y, width, color, `B${i}`);
    }

    // Create main observation deck
    console.log('Creating main observation deck...');
    await createDeck(client, towerId, 'MainDeck', MAIN_DECK_HEIGHT, BASE_WIDTH * 0.35, 0.8);

    // Create upper section
    console.log('Creating upper section...');
    await createUpperSection(client, towerId);

    // Create top observation deck
    console.log('Creating top observation deck...');
    await createDeck(client, towerId, 'TopDeck', TOP_DECK_HEIGHT, BASE_WIDTH * 0.18, 0.5);

    // Create antenna
    console.log('Creating antenna...');
    await createAntenna(client, towerId);

    // Create base/ground
    console.log('Creating base...');
    await createBeam(
      client,
      towerId,
      'Base',
      { x: 0, y: -0.1, z: 0 },
      { x: BASE_WIDTH * 1.2, y: 0.2, z: BASE_WIDTH * 1.2 },
      { r: 0.4, g: 0.4, b: 0.4 }
    );

    console.log('\nTokyo Tower completed!');
    console.log(`Total height: ${TOTAL_HEIGHT}m`);
    console.log(`Base width: ${BASE_WIDTH}m`);

  } finally {
    client.disconnect();
  }
}

main();

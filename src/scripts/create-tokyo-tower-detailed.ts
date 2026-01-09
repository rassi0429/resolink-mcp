import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Tokyo Tower colors
const TOWER_ORANGE = { r: 1.0, g: 0.35, b: 0.1 };
const TOWER_WHITE = { r: 1.0, g: 1.0, b: 1.0 };
const DECK_GRAY = { r: 0.25, g: 0.25, b: 0.28 };
const DECK_FLOOR = { r: 0.35, g: 0.35, b: 0.38 };
const ANTENNA_SILVER = { r: 0.85, g: 0.85, b: 0.9 };
const LIGHT_YELLOW = { r: 1.0, g: 0.95, b: 0.8 };
const GLASS_BLUE = { r: 0.6, g: 0.75, b: 0.9 };

// Tower dimensions (scaled for VR)
const SCALE = 0.1;
const TOTAL_HEIGHT = 333 * SCALE;
const BASE_WIDTH = 88 * SCALE;
const MAIN_DECK_HEIGHT = 150 * SCALE;
const TOP_DECK_HEIGHT = 250 * SCALE;

// Detail level
const LEG_SECTIONS = 15;
const UPPER_SECTIONS = 12;

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
    client, parentId, name, 'BoxMesh',
    { Size: { $type: 'float3', value: size } },
    {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Metallic: { $type: 'float', value: 0.4 },
      Smoothness: { $type: 'float', value: 0.6 }
    },
    position, rotation
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
    client, parentId, name, 'CylinderMesh',
    { Height: { $type: 'float', value: height }, Radius: { $type: 'float', value: radius } },
    {
      AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Metallic: { $type: 'float', value: 0.6 },
      Smoothness: { $type: 'float', value: 0.7 }
    },
    position
  );
}

// Calculate width at given height (tower tapers)
function getWidthAtHeight(y: number): number {
  if (y < MAIN_DECK_HEIGHT) {
    const t = y / MAIN_DECK_HEIGHT;
    return BASE_WIDTH * (1 - t * 0.65);
  } else if (y < TOP_DECK_HEIGHT) {
    const t = (y - MAIN_DECK_HEIGHT) / (TOP_DECK_HEIGHT - MAIN_DECK_HEIGHT);
    const startWidth = BASE_WIDTH * 0.35;
    const endWidth = BASE_WIDTH * 0.15;
    return startWidth + (endWidth - startWidth) * t;
  } else {
    return BASE_WIDTH * 0.15;
  }
}

// Get color for height (alternating bands)
function getColorForHeight(y: number): { r: number; g: number; b: number } {
  const bandHeight = TOTAL_HEIGHT / 14; // 14 bands
  const bandIndex = Math.floor(y / bandHeight);
  return bandIndex % 2 === 0 ? TOWER_ORANGE : TOWER_WHITE;
}

async function createTowerLeg(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  cornerX: number,
  cornerZ: number
): Promise<void> {
  const beamThickness = 0.12;
  const sectionHeight = MAIN_DECK_HEIGHT / LEG_SECTIONS;

  for (let i = 0; i < LEG_SECTIONS; i++) {
    process.stdout.write(`  ${name} section ${i + 1}/${LEG_SECTIONS}\r`);
    const y1 = i * sectionHeight;
    const y2 = (i + 1) * sectionHeight;

    const w1 = getWidthAtHeight(y1) / 2;
    const w2 = getWidthAtHeight(y2) / 2;

    const x1 = cornerX > 0 ? w1 : -w1;
    const z1 = cornerZ > 0 ? w1 : -w1;
    const x2 = cornerX > 0 ? w2 : -w2;
    const z2 = cornerZ > 0 ? w2 : -w2;

    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const centerY = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dz = z2 - z1;
    const dy = sectionHeight;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const color = getColorForHeight(centerY);

    const angleX = Math.atan2(dx, dy) * 180 / Math.PI;
    const angleZ = Math.atan2(dz, dy) * 180 / Math.PI;

    await createBeam(
      client, parentId, `${name}_${i}`,
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
  name: string
): Promise<void> {
  const width = getWidthAtHeight(y);
  const halfWidth = width / 2;
  const beamThickness = 0.08;
  const color = getColorForHeight(y);

  // Four sides of square
  await createBeam(client, parentId, `${name}_N`, { x: 0, y, z: halfWidth }, { x: width, y: beamThickness, z: beamThickness }, color);
  await createBeam(client, parentId, `${name}_S`, { x: 0, y, z: -halfWidth }, { x: width, y: beamThickness, z: beamThickness }, color);
  await createBeam(client, parentId, `${name}_E`, { x: halfWidth, y, z: 0 }, { x: beamThickness, y: beamThickness, z: width }, color);
  await createBeam(client, parentId, `${name}_W`, { x: -halfWidth, y, z: 0 }, { x: beamThickness, y: beamThickness, z: width }, color);
}

async function createDiagonalBracing(
  client: ResoniteLinkClient,
  parentId: string,
  y1: number,
  y2: number,
  face: 'N' | 'S' | 'E' | 'W',
  name: string
): Promise<void> {
  const w1 = getWidthAtHeight(y1) / 2;
  const w2 = getWidthAtHeight(y2) / 2;
  const beamThickness = 0.06;
  const color = getColorForHeight((y1 + y2) / 2);
  const centerY = (y1 + y2) / 2;
  const dy = y2 - y1;

  let x1a: number, z1a: number, x1b: number, z1b: number;
  let x2a: number, z2a: number, x2b: number, z2b: number;

  if (face === 'N') {
    x1a = -w1; z1a = w1; x1b = w1; z1b = w1;
    x2a = -w2; z2a = w2; x2b = w2; z2b = w2;
  } else if (face === 'S') {
    x1a = -w1; z1a = -w1; x1b = w1; z1b = -w1;
    x2a = -w2; z2a = -w2; x2b = w2; z2b = -w2;
  } else if (face === 'E') {
    x1a = w1; z1a = -w1; x1b = w1; z1b = w1;
    x2a = w2; z2a = -w2; x2b = w2; z2b = w2;
  } else {
    x1a = -w1; z1a = -w1; x1b = -w1; z1b = w1;
    x2a = -w2; z2a = -w2; x2b = -w2; z2b = w2;
  }

  // X-brace: diagonal from bottom-left to top-right
  const dx1 = x2b - x1a;
  const dz1 = z2b - z1a;
  const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1 + dy * dy);
  const cx1 = (x1a + x2b) / 2;
  const cz1 = (z1a + z2b) / 2;

  const pitchX1 = Math.atan2(Math.sqrt(dx1 * dx1 + dz1 * dz1), dy) * 180 / Math.PI;
  const yawX1 = Math.atan2(dx1, dz1) * 180 / Math.PI;

  await createBeam(
    client, parentId, `${name}_X1`,
    { x: cx1, y: centerY, z: cz1 },
    { x: beamThickness, y: len1, z: beamThickness },
    color,
    { x: pitchX1, y: yawX1, z: 0 }
  );

  // X-brace: diagonal from bottom-right to top-left
  const dx2 = x2a - x1b;
  const dz2 = z2a - z1b;
  const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2 + dy * dy);
  const cx2 = (x1b + x2a) / 2;
  const cz2 = (z1b + z2a) / 2;

  const pitchX2 = Math.atan2(Math.sqrt(dx2 * dx2 + dz2 * dz2), dy) * 180 / Math.PI;
  const yawX2 = Math.atan2(dx2, dz2) * 180 / Math.PI;

  await createBeam(
    client, parentId, `${name}_X2`,
    { x: cx2, y: centerY, z: cz2 },
    { x: beamThickness, y: len2, z: beamThickness },
    color,
    { x: pitchX2, y: yawX2, z: 0 }
  );
}

async function createObservationDeck(
  client: ResoniteLinkClient,
  parentId: string,
  y: number,
  width: number,
  height: number,
  name: string
): Promise<void> {
  // Main floor
  await createBeam(client, parentId, `${name}_Floor`, { x: 0, y, z: 0 }, { x: width, y: 0.15, z: width }, DECK_FLOOR);

  // Ceiling
  await createBeam(client, parentId, `${name}_Ceil`, { x: 0, y: y + height, z: 0 }, { x: width * 0.95, y: 0.1, z: width * 0.95 }, DECK_GRAY);

  // Walls (glass-like)
  const wallThickness = 0.08;
  const wallHeight = height - 0.25;
  const wallY = y + height / 2;
  const hw = width / 2 - wallThickness / 2;

  // Glass material with Alpha BlendMode for transparency
  const glassMaterial = {
    BlendMode: { $type: 'enum', value: 'Alpha', enumType: 'BlendMode' },
    AlbedoColor: { $type: 'colorX', value: { ...GLASS_BLUE, a: 0.3, profile: 'sRGB' } },
    Metallic: { $type: 'float', value: 0.1 },
    Smoothness: { $type: 'float', value: 0.9 }
  };

  await createMeshWithMaterial(client, parentId, `${name}_WN`, 'BoxMesh',
    { Size: { $type: 'float3', value: { x: width - 0.2, y: wallHeight, z: wallThickness } } },
    glassMaterial,
    { x: 0, y: wallY, z: hw });
  await createMeshWithMaterial(client, parentId, `${name}_WS`, 'BoxMesh',
    { Size: { $type: 'float3', value: { x: width - 0.2, y: wallHeight, z: wallThickness } } },
    glassMaterial,
    { x: 0, y: wallY, z: -hw });
  await createMeshWithMaterial(client, parentId, `${name}_WE`, 'BoxMesh',
    { Size: { $type: 'float3', value: { x: wallThickness, y: wallHeight, z: width - 0.2 } } },
    glassMaterial,
    { x: hw, y: wallY, z: 0 });
  await createMeshWithMaterial(client, parentId, `${name}_WW`, 'BoxMesh',
    { Size: { $type: 'float3', value: { x: wallThickness, y: wallHeight, z: width - 0.2 } } },
    glassMaterial,
    { x: -hw, y: wallY, z: 0 });

  // Corner posts
  const postSize = 0.12;
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    await createBeam(client, parentId, `${name}_P${px}${pz}`,
      { x: px * (hw - postSize), y: wallY, z: pz * (hw - postSize) },
      { x: postSize, y: wallHeight + 0.2, z: postSize }, TOWER_ORANGE);
  }
}

async function createUpperSection(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const beamThickness = 0.08;
  const sectionHeight = (TOP_DECK_HEIGHT - MAIN_DECK_HEIGHT) / UPPER_SECTIONS;

  for (let i = 0; i < UPPER_SECTIONS; i++) {
    process.stdout.write(`  Section ${i + 1}/${UPPER_SECTIONS}\r`);
    const y = MAIN_DECK_HEIGHT + i * sectionHeight;
    const width = getWidthAtHeight(y + sectionHeight / 2);
    const halfWidth = width / 2;
    const color = getColorForHeight(y);

    // Four corner vertical beams
    await createBeam(client, parentId, `U${i}_1`, { x: halfWidth, y: y + sectionHeight/2, z: halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `U${i}_2`, { x: -halfWidth, y: y + sectionHeight/2, z: halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `U${i}_3`, { x: halfWidth, y: y + sectionHeight/2, z: -halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);
    await createBeam(client, parentId, `U${i}_4`, { x: -halfWidth, y: y + sectionHeight/2, z: -halfWidth }, { x: beamThickness, y: sectionHeight, z: beamThickness }, color);

    // Horizontal bracing
    if (i % 2 === 0) {
      await createHorizontalBracing(client, parentId, y, `UH${i}`);
    }

    // X-bracing on all sides
    if (i % 3 === 0 && i < UPPER_SECTIONS - 1) {
      const y1 = y;
      const y2 = y + sectionHeight * 2;
      await createDiagonalBracing(client, parentId, y1, y2, 'N', `UD${i}N`);
      await createDiagonalBracing(client, parentId, y1, y2, 'S', `UD${i}S`);
      await createDiagonalBracing(client, parentId, y1, y2, 'E', `UD${i}E`);
      await createDiagonalBracing(client, parentId, y1, y2, 'W', `UD${i}W`);
    }
  }
}

async function createAntenna(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const antennaBase = TOP_DECK_HEIGHT;
  const antennaHeight = TOTAL_HEIGHT - TOP_DECK_HEIGHT;

  // Main antenna pole (multi-section)
  const sections = 5;
  const sectionH = antennaHeight / sections;
  for (let i = 0; i < sections; i++) {
    const y = antennaBase + i * sectionH + sectionH / 2;
    const radius = 0.12 * (1 - i * 0.15);
    const color = i % 2 === 0 ? TOWER_ORANGE : TOWER_WHITE;
    await createCylinder(client, parentId, `Ant_${i}`, { x: 0, y, z: 0 }, sectionH, radius, color);
  }

  // Antenna tip
  await createCylinder(client, parentId, 'Ant_Tip', { x: 0, y: TOTAL_HEIGHT - 0.3, z: 0 }, 0.6, 0.05, ANTENNA_SILVER);

  // Antenna platforms
  for (let i = 1; i < 4; i++) {
    const y = antennaBase + i * (antennaHeight / 4);
    await createBeam(client, parentId, `AntPlat_${i}`, { x: 0, y, z: 0 }, { x: 0.6, y: 0.05, z: 0.6 }, DECK_GRAY);
  }
}

async function addLight(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  intensity: number,
  range: number
): Promise<void> {
  await client.addSlot({ parentId, name, position, isActive: true });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return;

  await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.Light' });
  const slotData = await client.getSlot({ slotId: slot.id, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return;

  const light = slotData.data.components.find(c => c.componentType === 'FrooxEngine.Light');
  if (!light) return;

  await client.updateComponent({
    id: light.id!,
    members: {
      LightType: { $type: 'enum', value: 'Point', enumType: 'LightType' },
      Intensity: { $type: 'float', value: intensity },
      Color: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
      Range: { $type: 'float', value: range },
    } as any
  });
}

async function main() {
  const client = new ResoniteLinkClient({
    url: WS_URL,
    debug: true,
    logFile: 'tokyo-tower-debug.log'
  });
  await client.connect();

  try {
    console.log('Creating Detailed Tokyo Tower...\n');

    // Create main tower slot
    await client.addSlot({ name: 'TokyoTower', position: { x: 0, y: 0, z: 0 }, isActive: true });
    const tower = await client.findSlotByName('TokyoTower', 'Root', 1);
    if (!tower?.id) {
      console.log('Failed to create tower slot');
      return;
    }
    const towerId = tower.id;
    console.log('Created TokyoTower slot');

    // Create four main legs
    console.log('\nCreating tower legs...');
    console.log('  Creating LegNE...');
    await createTowerLeg(client, towerId, 'LegNE', 1, 1);
    console.log('\n  Creating LegNW...');
    await createTowerLeg(client, towerId, 'LegNW', -1, 1);
    console.log('\n  Creating LegSE...');
    await createTowerLeg(client, towerId, 'LegSE', 1, -1);
    console.log('\n  Creating LegSW...');
    await createTowerLeg(client, towerId, 'LegSW', -1, -1);
    console.log();

    // Create horizontal bracing at regular intervals
    console.log('Creating horizontal bracing...');
    for (let i = 1; i <= LEG_SECTIONS; i++) {
      process.stdout.write(`  Level ${i}/${LEG_SECTIONS}\r`);
      const y = (i / LEG_SECTIONS) * MAIN_DECK_HEIGHT;
      await createHorizontalBracing(client, towerId, y, `HB${i}`);
    }
    console.log();

    // Create diagonal X-bracing on all four faces
    console.log('Creating diagonal bracing...');
    const xBraceInterval = 3;
    let braceCount = 0;
    const totalBraces = Math.ceil((LEG_SECTIONS - 1) / xBraceInterval);
    for (let i = 0; i < LEG_SECTIONS - 1; i += xBraceInterval) {
      braceCount++;
      process.stdout.write(`  Level ${braceCount}/${totalBraces}\r`);
      const y1 = (i / LEG_SECTIONS) * MAIN_DECK_HEIGHT;
      const y2 = ((i + xBraceInterval) / LEG_SECTIONS) * MAIN_DECK_HEIGHT;
      await createDiagonalBracing(client, towerId, y1, Math.min(y2, MAIN_DECK_HEIGHT), 'N', `XN${i}`);
      await createDiagonalBracing(client, towerId, y1, Math.min(y2, MAIN_DECK_HEIGHT), 'S', `XS${i}`);
      await createDiagonalBracing(client, towerId, y1, Math.min(y2, MAIN_DECK_HEIGHT), 'E', `XE${i}`);
      await createDiagonalBracing(client, towerId, y1, Math.min(y2, MAIN_DECK_HEIGHT), 'W', `XW${i}`);
    }
    console.log();

    // Create main observation deck
    console.log('Creating main observation deck...');
    const mainDeckWidth = getWidthAtHeight(MAIN_DECK_HEIGHT) * 1.1;
    await createObservationDeck(client, towerId, MAIN_DECK_HEIGHT - 0.5, mainDeckWidth, 1.2, 'MainDeck');

    // Create upper section
    console.log('Creating upper section...');
    await createUpperSection(client, towerId);
    console.log();

    // Create top observation deck
    console.log('Creating top observation deck...');
    const topDeckWidth = getWidthAtHeight(TOP_DECK_HEIGHT) * 1.2;
    await createObservationDeck(client, towerId, TOP_DECK_HEIGHT - 0.3, topDeckWidth, 0.8, 'TopDeck');

    // Create antenna
    console.log('Creating antenna...');
    await createAntenna(client, towerId);

    // Create base
    console.log('Creating base...');
    await createBeam(client, towerId, 'Base', { x: 0, y: -0.15, z: 0 }, { x: BASE_WIDTH * 1.3, y: 0.3, z: BASE_WIDTH * 1.3 }, { r: 0.35, g: 0.35, b: 0.35 });

    // Add lights
    console.log('Adding lights...');
    const lightPositions = [
      { x: 0, y: MAIN_DECK_HEIGHT + 0.5, z: 0 },
      { x: 0, y: TOP_DECK_HEIGHT + 0.3, z: 0 },
      { x: 0, y: TOTAL_HEIGHT - 1, z: 0 },
    ];
    for (let i = 0; i < lightPositions.length; i++) {
      await addLight(client, towerId, `Light_${i}`, lightPositions[i], LIGHT_YELLOW, 2.0, 15);
    }

    // Add corner lights on main deck
    const deckHW = mainDeckWidth / 2;
    for (const [cx, cz, idx] of [[1, 1, 0], [1, -1, 1], [-1, 1, 2], [-1, -1, 3]] as const) {
      await addLight(client, towerId, `DeckLight_${idx}`, { x: cx * deckHW, y: MAIN_DECK_HEIGHT + 0.3, z: cz * deckHW }, TOWER_ORANGE, 1.0, 8);
    }

    console.log('\nDetailed Tokyo Tower completed!');
    console.log(`Total height: ${TOTAL_HEIGHT.toFixed(1)}m`);
    console.log(`Base width: ${BASE_WIDTH.toFixed(1)}m`);
    console.log(`Leg sections: ${LEG_SECTIONS}`);
    console.log(`Upper sections: ${UPPER_SECTIONS}`);

  } finally {
    client.disconnect();
  }
}

main().then(() => {
  console.log('Script finished, exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

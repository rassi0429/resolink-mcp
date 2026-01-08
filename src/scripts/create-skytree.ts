import { ResoniteLinkClient } from '../index.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Skytree colors
const SKYTREE_WHITE = { r: 0.95, g: 0.95, b: 0.97 };
const SKYTREE_BLUE = { r: 0.7, g: 0.85, b: 0.95 };
const DECK_GRAY = { r: 0.3, g: 0.32, b: 0.35 };
const DECK_GLASS = { r: 0.6, g: 0.75, b: 0.9 };
const ANTENNA_SILVER = { r: 0.85, g: 0.85, b: 0.9 };
const LIGHT_CYAN = { r: 0.5, g: 0.9, b: 1.0 };

// Skytree dimensions (scaled - 634m real -> 63.4m VR)
const SCALE = 0.1;
const TOTAL_HEIGHT = 634 * SCALE;       // 63.4m
const BASE_WIDTH = 68 * SCALE;          // 6.8m triangular base
const TEMBO_DECK_HEIGHT = 350 * SCALE;  // 35m (Tembo Deck)
const TEMBO_GALLERIA_HEIGHT = 450 * SCALE; // 45m (Tembo Galleria)

// Position offset (next to Tokyo Tower)
const OFFSET_X = 25;
const OFFSET_Z = 0;

// Detail
const MAIN_SECTIONS = 20;
const UPPER_SECTIONS = 15;

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
      Metallic: { $type: 'float', value: 0.5 },
      Smoothness: { $type: 'float', value: 0.7 }
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
      Smoothness: { $type: 'float', value: 0.8 }
    },
    position
  );
}

// Skytree has triangular base that morphs to circular
// Returns 3 corner positions at given height
function getTriangleCorners(y: number): { x: number; z: number }[] {
  // Width decreases as we go up
  let width: number;
  if (y < TEMBO_DECK_HEIGHT) {
    const t = y / TEMBO_DECK_HEIGHT;
    width = BASE_WIDTH * (1 - t * 0.6);
  } else if (y < TEMBO_GALLERIA_HEIGHT) {
    const t = (y - TEMBO_DECK_HEIGHT) / (TEMBO_GALLERIA_HEIGHT - TEMBO_DECK_HEIGHT);
    width = BASE_WIDTH * 0.4 * (1 - t * 0.5);
  } else {
    const t = (y - TEMBO_GALLERIA_HEIGHT) / (TOTAL_HEIGHT - TEMBO_GALLERIA_HEIGHT);
    width = BASE_WIDTH * 0.2 * (1 - t * 0.7);
  }

  const radius = width / Math.sqrt(3);

  // Triangle becomes more circular as height increases
  const circularFactor = Math.min(1, y / TEMBO_DECK_HEIGHT);

  // Three corners at 120 degree intervals, rotated 30 degrees
  const corners: { x: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i * 120 + 30) * Math.PI / 180;
    corners.push({
      x: radius * Math.cos(angle),
      z: radius * Math.sin(angle)
    });
  }
  return corners;
}

async function createMainColumn(
  client: ResoniteLinkClient,
  parentId: string,
  cornerIndex: number,
  name: string
): Promise<void> {
  const beamThickness = 0.1;
  const sectionHeight = TEMBO_DECK_HEIGHT / MAIN_SECTIONS;

  for (let i = 0; i < MAIN_SECTIONS; i++) {
    const y1 = i * sectionHeight;
    const y2 = (i + 1) * sectionHeight;

    const corners1 = getTriangleCorners(y1);
    const corners2 = getTriangleCorners(y2);

    const p1 = corners1[cornerIndex];
    const p2 = corners2[cornerIndex];

    const centerX = (p1.x + p2.x) / 2;
    const centerZ = (p1.z + p2.z) / 2;
    const centerY = (y1 + y2) / 2;

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const dy = sectionHeight;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const angleX = Math.atan2(dx, dy) * 180 / Math.PI;
    const angleZ = Math.atan2(dz, dy) * 180 / Math.PI;

    await createBeam(
      client, parentId, `${name}_${i}`,
      { x: centerX, y: centerY, z: centerZ },
      { x: beamThickness, y: length, z: beamThickness },
      SKYTREE_WHITE,
      { x: angleZ, y: 0, z: -angleX }
    );
  }
}

async function createHorizontalRing(
  client: ResoniteLinkClient,
  parentId: string,
  y: number,
  name: string
): Promise<void> {
  const corners = getTriangleCorners(y);
  const beamThickness = 0.06;

  // Connect corners with beams (triangle)
  for (let i = 0; i < 3; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 3];

    const cx = (p1.x + p2.x) / 2;
    const cz = (p1.z + p2.z) / 2;
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz) * 180 / Math.PI;

    await createBeam(
      client, parentId, `${name}_${i}`,
      { x: cx, y, z: cz },
      { x: beamThickness, y: beamThickness, z: length },
      SKYTREE_WHITE,
      { x: 0, y: angle, z: 0 }
    );
  }
}

async function createDiagonalBracing(
  client: ResoniteLinkClient,
  parentId: string,
  y1: number,
  y2: number,
  faceIndex: number,
  name: string
): Promise<void> {
  const corners1 = getTriangleCorners(y1);
  const corners2 = getTriangleCorners(y2);
  const beamThickness = 0.05;

  const i1 = faceIndex;
  const i2 = (faceIndex + 1) % 3;

  // X-brace 1: bottom-left to top-right
  const p1a = corners1[i1];
  const p2b = corners2[i2];
  const cx1 = (p1a.x + p2b.x) / 2;
  const cz1 = (p1a.z + p2b.z) / 2;
  const cy = (y1 + y2) / 2;
  const dx1 = p2b.x - p1a.x;
  const dz1 = p2b.z - p1a.z;
  const dy = y2 - y1;
  const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1 + dy * dy);

  const pitch1 = Math.atan2(Math.sqrt(dx1 * dx1 + dz1 * dz1), dy) * 180 / Math.PI;
  const yaw1 = Math.atan2(dx1, dz1) * 180 / Math.PI;

  await createBeam(
    client, parentId, `${name}_X1`,
    { x: cx1, y: cy, z: cz1 },
    { x: beamThickness, y: len1, z: beamThickness },
    SKYTREE_WHITE,
    { x: pitch1, y: yaw1, z: 0 }
  );

  // X-brace 2: bottom-right to top-left
  const p1b = corners1[i2];
  const p2a = corners2[i1];
  const cx2 = (p1b.x + p2a.x) / 2;
  const cz2 = (p1b.z + p2a.z) / 2;
  const dx2 = p2a.x - p1b.x;
  const dz2 = p2a.z - p1b.z;
  const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2 + dy * dy);

  const pitch2 = Math.atan2(Math.sqrt(dx2 * dx2 + dz2 * dz2), dy) * 180 / Math.PI;
  const yaw2 = Math.atan2(dx2, dz2) * 180 / Math.PI;

  await createBeam(
    client, parentId, `${name}_X2`,
    { x: cx2, y: cy, z: cz2 },
    { x: beamThickness, y: len2, z: beamThickness },
    SKYTREE_WHITE,
    { x: pitch2, y: yaw2, z: 0 }
  );
}

async function createTemboDeck(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const y = TEMBO_DECK_HEIGHT;
  const outerRadius = BASE_WIDTH * 0.28;
  const innerRadius = BASE_WIDTH * 0.22;
  const height = 2.5;

  // Main deck floor (thick disk)
  await createCylinder(client, parentId, 'TemboDeck_Floor', { x: 0, y, z: 0 }, 0.3, outerRadius, DECK_GRAY);

  // Deck ceiling
  await createCylinder(client, parentId, 'TemboDeck_Ceil', { x: 0, y: y + height, z: 0 }, 0.2, outerRadius * 0.95, DECK_GRAY);

  // Vertical support pillars around the edge
  const pillarCount = 12;
  for (let i = 0; i < pillarCount; i++) {
    const angle = (i * 360 / pillarCount) * Math.PI / 180;
    const px = outerRadius * 0.9 * Math.cos(angle);
    const pz = outerRadius * 0.9 * Math.sin(angle);
    await createBeam(
      client, parentId, `TemboDeck_Pillar${i}`,
      { x: px, y: y + height / 2, z: pz },
      { x: 0.12, y: height, z: 0.12 },
      SKYTREE_WHITE
    );
  }

  // Horizontal ring beams (top and bottom)
  const ringThickness = 0.1;
  await createCylinder(client, parentId, 'TemboDeck_RingBot', { x: 0, y: y + 0.2, z: 0 }, ringThickness, outerRadius, SKYTREE_WHITE);
  await createCylinder(client, parentId, 'TemboDeck_RingTop', { x: 0, y: y + height - 0.1, z: 0 }, ringThickness, outerRadius * 0.95, SKYTREE_WHITE);
}

async function createTemboGalleria(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const y = TEMBO_GALLERIA_HEIGHT;
  const radius = BASE_WIDTH * 0.15;
  const height = 1.8;

  // Floor
  await createCylinder(client, parentId, 'Galleria_Floor', { x: 0, y, z: 0 }, 0.2, radius, DECK_GRAY);

  // Ceiling
  await createCylinder(client, parentId, 'Galleria_Ceil', { x: 0, y: y + height, z: 0 }, 0.15, radius * 0.9, DECK_GRAY);

  // Vertical support pillars
  const pillarCount = 8;
  for (let i = 0; i < pillarCount; i++) {
    const angle = (i * 360 / pillarCount) * Math.PI / 180;
    const px = radius * 0.85 * Math.cos(angle);
    const pz = radius * 0.85 * Math.sin(angle);
    await createBeam(
      client, parentId, `Galleria_Pillar${i}`,
      { x: px, y: y + height / 2, z: pz },
      { x: 0.08, y: height, z: 0.08 },
      SKYTREE_WHITE
    );
  }

  // Ring beams
  await createCylinder(client, parentId, 'Galleria_Ring', { x: 0, y: y + height - 0.1, z: 0 }, 0.08, radius * 0.9, SKYTREE_WHITE);
}

async function createUpperSection(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const startY = TEMBO_DECK_HEIGHT;
  const endY = TEMBO_GALLERIA_HEIGHT;
  const sectionHeight = (endY - startY) / UPPER_SECTIONS;
  const beamThickness = 0.07;

  for (let i = 0; i < UPPER_SECTIONS; i++) {
    const y = startY + i * sectionHeight;
    const corners = getTriangleCorners(y + sectionHeight / 2);

    // Vertical beams at corners
    for (let j = 0; j < 3; j++) {
      const p = corners[j];
      await createBeam(
        client, parentId, `Up${i}_V${j}`,
        { x: p.x, y: y + sectionHeight / 2, z: p.z },
        { x: beamThickness, y: sectionHeight, z: beamThickness },
        SKYTREE_WHITE
      );
    }

    // Horizontal rings
    if (i % 2 === 0) {
      await createHorizontalRing(client, parentId, y, `UpH${i}`);
    }

    // Diagonal bracing
    if (i % 3 === 0 && i < UPPER_SECTIONS - 1) {
      for (let j = 0; j < 3; j++) {
        await createDiagonalBracing(client, parentId, y, y + sectionHeight * 2, j, `UpD${i}_${j}`);
      }
    }
  }
}

async function createAntenna(
  client: ResoniteLinkClient,
  parentId: string
): Promise<void> {
  const antennaBase = TEMBO_GALLERIA_HEIGHT + 2;
  const antennaHeight = TOTAL_HEIGHT - antennaBase;
  const sections = 8;
  const sectionH = antennaHeight / sections;

  for (let i = 0; i < sections; i++) {
    const y = antennaBase + i * sectionH + sectionH / 2;
    const radius = 0.15 * (1 - i * 0.1);
    const color = i % 2 === 0 ? SKYTREE_WHITE : SKYTREE_BLUE;
    await createCylinder(client, parentId, `Ant${i}`, { x: 0, y, z: 0 }, sectionH, radius, color);
  }

  // Antenna tip
  await createCylinder(client, parentId, 'AntTip', { x: 0, y: TOTAL_HEIGHT - 0.5, z: 0 }, 1.0, 0.05, ANTENNA_SILVER);

  // Antenna platforms
  for (let i = 1; i < 5; i++) {
    const y = antennaBase + i * (antennaHeight / 5);
    const r = 0.4 * (1 - i * 0.15);
    await createCylinder(client, parentId, `AntPlat${i}`, { x: 0, y, z: 0 }, 0.08, r, DECK_GRAY);
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
      LightType: { $type: 'Enum', value: 2 },
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
    logFile: 'skytree-debug.log'
  });
  await client.connect();

  try {
    console.log('Creating Tokyo Skytree...\n');

    // Create main slot
    await client.addSlot({
      name: 'TokyoSkytree',
      position: { x: OFFSET_X, y: 0, z: OFFSET_Z },
      isActive: true
    });
    const tree = await client.findSlotByName('TokyoSkytree', 'Root', 1);
    if (!tree?.id) {
      console.log('Failed to create Skytree slot');
      return;
    }
    const treeId = tree.id;
    console.log('Created TokyoSkytree slot');

    // Create three main columns
    console.log('\nCreating main columns...');
    await createMainColumn(client, treeId, 0, 'Col0');
    await createMainColumn(client, treeId, 1, 'Col1');
    await createMainColumn(client, treeId, 2, 'Col2');

    // Create horizontal rings
    console.log('Creating horizontal rings...');
    for (let i = 1; i <= MAIN_SECTIONS; i++) {
      const y = (i / MAIN_SECTIONS) * TEMBO_DECK_HEIGHT;
      await createHorizontalRing(client, treeId, y, `HR${i}`);
    }

    // Create diagonal bracing
    console.log('Creating diagonal bracing...');
    const braceInterval = 4;
    for (let i = 0; i < MAIN_SECTIONS - 1; i += braceInterval) {
      const y1 = (i / MAIN_SECTIONS) * TEMBO_DECK_HEIGHT;
      const y2 = ((i + braceInterval) / MAIN_SECTIONS) * TEMBO_DECK_HEIGHT;
      for (let j = 0; j < 3; j++) {
        await createDiagonalBracing(client, treeId, y1, Math.min(y2, TEMBO_DECK_HEIGHT), j, `DB${i}_${j}`);
      }
    }

    // Create Tembo Deck
    console.log('Creating Tembo Deck (350m)...');
    await createTemboDeck(client, treeId);

    // Create upper section
    console.log('Creating upper section...');
    await createUpperSection(client, treeId);

    // Create Tembo Galleria
    console.log('Creating Tembo Galleria (450m)...');
    await createTemboGalleria(client, treeId);

    // Create antenna
    console.log('Creating antenna...');
    await createAntenna(client, treeId);

    // Create base
    console.log('Creating base...');
    await createCylinder(client, treeId, 'Base', { x: 0, y: -0.1, z: 0 }, 0.2, BASE_WIDTH * 0.7, { r: 0.35, g: 0.35, b: 0.38 });

    // Add lights
    console.log('Adding lights...');
    await addLight(client, treeId, 'Light1', { x: 0, y: TEMBO_DECK_HEIGHT + 1, z: 0 }, LIGHT_CYAN, 2.5, 20);
    await addLight(client, treeId, 'Light2', { x: 0, y: TEMBO_GALLERIA_HEIGHT + 1, z: 0 }, LIGHT_CYAN, 2.0, 15);
    await addLight(client, treeId, 'Light3', { x: 0, y: TOTAL_HEIGHT - 3, z: 0 }, SKYTREE_WHITE, 1.5, 10);

    console.log('\nTokyo Skytree completed!');
    console.log(`Total height: ${TOTAL_HEIGHT.toFixed(1)}m`);
    console.log(`Position: (${OFFSET_X}, 0, ${OFFSET_Z})`);

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

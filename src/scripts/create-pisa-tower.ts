import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Pisa Tower colors
const MARBLE_WHITE = { r: 0.95, g: 0.93, b: 0.88 };
const MARBLE_SHADOW = { r: 0.85, g: 0.82, b: 0.75 };
const GRASS_GREEN = { r: 0.3, g: 0.5, b: 0.2 };

// Tower dimensions (scaled for VR)
const SCALE = 0.12;
const TOTAL_HEIGHT = 56 * SCALE;  // 56m real height
const BASE_RADIUS = 7.5 * SCALE;
const TOP_RADIUS = 7 * SCALE;
const TILT_ANGLE = 4;  // Famous 4 degree tilt

// Position next to Tokyo Tower
const OFFSET_X = 20;

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
    name,
    parentId,
    position,
    rotation: quat,
    isActive: true
  });
  const slot = await client.findSlotByName(name, parentId, 1);
  if (!slot?.id) return null;

  // Add mesh
  await client.addComponent({ containerSlotId: slot.id, componentType: `[FrooxEngine]FrooxEngine.${meshType}` });
  await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
  await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });

  const slotData = await client.getSlot({ slotId: slot.id, depth: 0, includeComponentData: true });
  if (!slotData.success || !slotData.data.components) return null;

  const mesh = slotData.data.components.find(c => c.componentType === `FrooxEngine.${meshType}`);
  const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
  const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');

  if (!mesh?.id || !renderer?.id || !material?.id) return null;

  // Set mesh parameters
  await client.updateComponent({ id: mesh.id, members: meshParams });

  // Set material
  await client.updateComponent({ id: material.id, members: materialParams });

  // Link mesh to renderer
  await client.updateComponent({
    id: renderer.id,
    members: { Mesh: { $type: 'reference', targetId: mesh.id } as any }
  });

  // Link material to renderer (2-step)
  await client.updateComponent({
    id: renderer.id,
    members: { Materials: { $type: 'list', elements: [{ $type: 'reference', targetId: material.id }] } as any }
  });
  const rendererData = await client.getComponent(renderer.id);
  const matElement = (rendererData.data.members as any)?.Materials?.elements?.[0];
  if (matElement?.id) {
    await client.updateComponent({
      id: renderer.id,
      members: { Materials: { $type: 'list', elements: [{ $type: 'reference', id: matElement.id, targetId: material.id }] } as any }
    });
  }

  return slot.id;
}

async function main() {
  const client = new ResoniteLinkClient({
    url: WS_URL,
    debug: false,
    requestTimeout: 30000,
  });

  console.log('Creating Leaning Tower of Pisa...\n');
  await client.connect();

  // Delete existing
  const existing = await client.findSlotByName('PisaTower', 'Root', 1);
  if (existing?.id) {
    console.log('Deleting existing Pisa Tower...');
    await client.removeSlot(existing.id);
  }

  try {
    // Create main slot with tilt
    const tiltQuat = eulerToQuaternion(0, 0, TILT_ANGLE);
    await client.addSlot({
      name: 'PisaTower',
      position: { x: OFFSET_X, y: 0, z: 0 },
      rotation: tiltQuat,
      isActive: true
    });
    const tower = await client.findSlotByName('PisaTower', 'Root', 1);
    if (!tower?.id) throw new Error('Failed to create tower slot');
    console.log('Created PisaTower slot with tilt');

    const marbleMat = {
      AlbedoColor: { $type: 'colorX', value: { ...MARBLE_WHITE, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.3 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    const shadowMat = {
      AlbedoColor: { $type: 'colorX', value: { ...MARBLE_SHADOW, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.2 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    // Base platform (ground level)
    console.log('Creating base...');
    await createMeshWithMaterial(
      client, tower.id, 'Base',
      'CylinderMesh',
      {
        Height: { $type: 'float', value: 0.3 },
        Radius: { $type: 'float', value: BASE_RADIUS * 1.3 },
        Sides: { $type: 'int', value: 32 }
      },
      shadowMat,
      { x: 0, y: 0.15, z: 0 }
    );

    // 8 floors of the tower
    const floorHeight = TOTAL_HEIGHT / 8;
    const numColumns = 15;  // Columns per floor

    for (let floor = 0; floor < 8; floor++) {
      const y = floor * floorHeight;
      const floorRadius = BASE_RADIUS - (floor * 0.03);
      const innerRadius = floorRadius * 0.7;

      console.log(`Creating floor ${floor + 1}/8...`);

      // Main cylindrical wall for this floor
      await createMeshWithMaterial(
        client, tower.id, `Floor${floor}_Wall`,
        'CylinderMesh',
        {
          Height: { $type: 'float', value: floorHeight * 0.9 },
          Radius: { $type: 'float', value: innerRadius },
          Sides: { $type: 'int', value: 24 }
        },
        marbleMat,
        { x: 0, y: y + floorHeight * 0.45, z: 0 }
      );

      // Floor platform (gallery)
      await createMeshWithMaterial(
        client, tower.id, `Floor${floor}_Gallery`,
        'CylinderMesh',
        {
          Height: { $type: 'float', value: 0.08 },
          Radius: { $type: 'float', value: floorRadius },
          Sides: { $type: 'int', value: 32 }
        },
        shadowMat,
        { x: 0, y: y + 0.04, z: 0 }
      );

      // Columns around each floor (except ground floor which has walls)
      if (floor > 0 && floor < 7) {
        const columnHeight = floorHeight * 0.8;
        const columnRadius = 0.04;

        for (let col = 0; col < numColumns; col++) {
          const angle = (col / numColumns) * Math.PI * 2;
          const colX = Math.cos(angle) * (floorRadius - 0.08);
          const colZ = Math.sin(angle) * (floorRadius - 0.08);

          await createMeshWithMaterial(
            client, tower.id, `Floor${floor}_Col${col}`,
            'CylinderMesh',
            {
              Height: { $type: 'float', value: columnHeight },
              Radius: { $type: 'float', value: columnRadius },
              Sides: { $type: 'int', value: 8 }
            },
            marbleMat,
            { x: colX, y: y + columnHeight / 2 + 0.1, z: colZ }
          );
        }
      }
    }

    // Bell chamber (top floor) - slightly different design
    console.log('Creating bell chamber...');
    const bellY = 7 * floorHeight;
    await createMeshWithMaterial(
      client, tower.id, 'BellChamber',
      'CylinderMesh',
      {
        Height: { $type: 'float', value: floorHeight * 0.7 },
        Radius: { $type: 'float', value: TOP_RADIUS * 0.5 },
        Sides: { $type: 'int', value: 16 }
      },
      marbleMat,
      { x: 0, y: bellY + floorHeight * 0.8, z: 0 }
    );

    // Dome on top
    await createMeshWithMaterial(
      client, tower.id, 'Dome',
      'SphereMesh',
      {
        Radius: { $type: 'float', value: TOP_RADIUS * 0.35 },
        Segments: { $type: 'int', value: 16 }
      },
      shadowMat,
      { x: 0, y: TOTAL_HEIGHT + 0.2, z: 0 }
    );

    // Grass base around the tower
    console.log('Creating grass base...');
    const grassMat = {
      AlbedoColor: { $type: 'colorX', value: { ...GRASS_GREEN, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.2 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    // Note: grass is not tilted, so we create it at root level
    await client.addSlot({
      name: 'PisaGrass',
      position: { x: OFFSET_X, y: 0, z: 0 },
      isActive: true
    });
    const grass = await client.findSlotByName('PisaGrass', 'Root', 1);
    if (grass?.id) {
      await createMeshWithMaterial(
        client, grass.id, 'GrassCircle',
        'CylinderMesh',
        {
          Height: { $type: 'float', value: 0.05 },
          Radius: { $type: 'float', value: BASE_RADIUS * 2 },
          Sides: { $type: 'int', value: 32 }
        },
        grassMat,
        { x: 0, y: 0.025, z: 0 }
      );
    }

    console.log('\nLeaning Tower of Pisa completed!');

  } finally {
    client.disconnect();
  }
}

main().then(() => {
  console.log('Script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

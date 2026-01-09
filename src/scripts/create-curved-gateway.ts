import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Colors
const METAL_BLUE = { r: 0.4, g: 0.5, b: 0.7 };
const METAL_SILVER = { r: 0.8, g: 0.82, b: 0.85 };
const GLOW_CYAN = { r: 0.2, g: 0.8, b: 1.0 };
const GLOW_PURPLE = { r: 0.6, g: 0.2, b: 1.0 };
const DARK_METAL = { r: 0.15, g: 0.15, b: 0.2 };

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

async function createTorus(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  majorRadius: number,
  minorRadius: number,
  color: { r: number; g: number; b: number },
  rotation?: { x: number; y: number; z: number },
  emissive?: { r: number; g: number; b: number }
): Promise<string | null> {
  const materialParams: Record<string, any> = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Metallic: { $type: 'float', value: 0.8 },
    Smoothness: { $type: 'float', value: 0.9 },
  };
  if (emissive) {
    materialParams.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  }

  return createMeshWithMaterial(
    client, parentId, name, 'TorusMesh',
    {
      MajorRadius: { $type: 'float', value: majorRadius },
      MinorRadius: { $type: 'float', value: minorRadius },
      MajorSegments: { $type: 'int', value: 48 },
      MinorSegments: { $type: 'int', value: 24 },
    },
    materialParams,
    position, rotation
  );
}

async function createSpiralTube(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  startPoint: { x: number; y: number; z: number },
  endPoint: { x: number; y: number; z: number },
  spiralRadius: number,
  tubeRadius: number,
  coilCount: number,
  color: { r: number; g: number; b: number },
  emissive?: { r: number; g: number; b: number }
): Promise<string | null> {
  const materialParams: Record<string, any> = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Metallic: { $type: 'float', value: 0.6 },
    Smoothness: { $type: 'float', value: 0.85 },
  };
  if (emissive) {
    materialParams.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  }

  return createMeshWithMaterial(
    client, parentId, name, 'TubeSpiralMesh',
    {
      StartPoint: { $type: 'float3', value: startPoint },
      EndPoint: { $type: 'float3', value: endPoint },
      StartSpiralRadius: { $type: 'float', value: spiralRadius },
      EndSpiralRadius: { $type: 'float', value: spiralRadius },
      StartTubeRadius: { $type: 'float', value: tubeRadius },
      EndTubeRadius: { $type: 'float', value: tubeRadius },
      CoilCount: { $type: 'float', value: coilCount },
      Steps: { $type: 'int', value: 64 },
      TubePoints: { $type: 'int', value: 12 },
    },
    materialParams,
    position
  );
}

async function createBentTube(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  startPoint: { x: number; y: number; z: number },
  controlPoint: { x: number; y: number; z: number },
  endPoint: { x: number; y: number; z: number },
  radius: number,
  color: { r: number; g: number; b: number },
  emissive?: { r: number; g: number; b: number }
): Promise<string | null> {
  const materialParams: Record<string, any> = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Metallic: { $type: 'float', value: 0.7 },
    Smoothness: { $type: 'float', value: 0.85 },
  };
  if (emissive) {
    materialParams.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  }

  return createMeshWithMaterial(
    client, parentId, name, 'BentTubeMesh',
    {
      StartPoint: { $type: 'float3', value: startPoint },
      DirectTargetPoint: { $type: 'float3', value: controlPoint },
      ActualTargetPoint: { $type: 'float3', value: endPoint },
      Radius: { $type: 'float', value: radius },
      Sides: { $type: 'int', value: 16 },
      Segments: { $type: 'int', value: 32 },
    },
    materialParams,
    position
  );
}

async function createSphere(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  radius: number,
  color: { r: number; g: number; b: number },
  emissive?: { r: number; g: number; b: number }
): Promise<string | null> {
  const materialParams: Record<string, any> = {
    AlbedoColor: { $type: 'colorX', value: { ...color, a: 1, profile: 'sRGB' } },
    Metallic: { $type: 'float', value: 0.5 },
    Smoothness: { $type: 'float', value: 0.9 },
  };
  if (emissive) {
    materialParams.EmissiveColor = { $type: 'colorX', value: { ...emissive, a: 1, profile: 'sRGB' } };
  }

  return createMeshWithMaterial(
    client, parentId, name, 'SphereMesh',
    {
      Radius: { $type: 'float', value: radius },
      Segments: { $type: 'int', value: 32 },
      Rings: { $type: 'int', value: 16 },
    },
    materialParams,
    position
  );
}

async function main() {
  const client = new ResoniteLinkClient({
    url: WS_URL,
    debug: false,
    requestTimeout: 30000,
  });
  await client.connect();

  try {
    console.log('Creating Curved Gateway...\n');

    // Create main structure slot
    await client.addSlot({ name: 'CurvedGateway', position: { x: 0, y: 0, z: 0 }, isActive: true });
    const gateway = await client.findSlotByName('CurvedGateway', 'Root', 1);
    if (!gateway?.id) {
      console.log('Failed to create gateway slot');
      return;
    }
    const gatewayId = gateway.id;
    console.log('Created CurvedGateway slot');

    // Main outer ring (large torus)
    console.log('Creating main ring...');
    await createTorus(client, gatewayId, 'MainRing', { x: 0, y: 5, z: 0 }, 5, 0.3, METAL_BLUE, { x: 0, y: 0, z: 0 });

    // Inner glowing ring
    console.log('Creating inner glow ring...');
    await createTorus(client, gatewayId, 'InnerGlow', { x: 0, y: 5, z: 0 }, 4.5, 0.15, GLOW_CYAN, { x: 0, y: 0, z: 0 }, GLOW_CYAN);

    // Second decorative ring (tilted)
    console.log('Creating decorative rings...');
    await createTorus(client, gatewayId, 'Ring2', { x: 0, y: 5, z: 0 }, 5.5, 0.1, METAL_SILVER, { x: 30, y: 0, z: 0 });
    await createTorus(client, gatewayId, 'Ring3', { x: 0, y: 5, z: 0 }, 5.5, 0.1, METAL_SILVER, { x: -30, y: 0, z: 0 });

    // Spiral decorations around the main ring
    console.log('Creating spiral decorations...');
    await createSpiralTube(
      client, gatewayId, 'Spiral1',
      { x: 0, y: 5, z: 0 },
      { x: -5, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      0.4, 0.08, 5,
      GLOW_PURPLE, GLOW_PURPLE
    );

    await createSpiralTube(
      client, gatewayId, 'Spiral2',
      { x: 0, y: 5, z: 0 },
      { x: 0, y: 0, z: -5 },
      { x: 0, y: 0, z: 5 },
      0.4, 0.08, 5,
      GLOW_PURPLE, GLOW_PURPLE
    );

    // Support arches using bent tubes
    console.log('Creating support arches...');
    // Front arch
    await createBentTube(
      client, gatewayId, 'Arch1',
      { x: 0, y: 0, z: 0 },
      { x: -4, y: 0, z: 3 },
      { x: 0, y: 6, z: 4 },
      { x: 4, y: 0, z: 3 },
      0.15, METAL_SILVER
    );
    // Back arch
    await createBentTube(
      client, gatewayId, 'Arch2',
      { x: 0, y: 0, z: 0 },
      { x: -4, y: 0, z: -3 },
      { x: 0, y: 6, z: -4 },
      { x: 4, y: 0, z: -3 },
      0.15, METAL_SILVER
    );
    // Left arch
    await createBentTube(
      client, gatewayId, 'Arch3',
      { x: 0, y: 0, z: 0 },
      { x: -3, y: 0, z: -4 },
      { x: -4, y: 6, z: 0 },
      { x: -3, y: 0, z: 4 },
      0.15, METAL_SILVER
    );
    // Right arch
    await createBentTube(
      client, gatewayId, 'Arch4',
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: -4 },
      { x: 4, y: 6, z: 0 },
      { x: 3, y: 0, z: 4 },
      0.15, METAL_SILVER
    );

    // Corner spheres (junction points)
    console.log('Creating junction spheres...');
    const cornerPositions = [
      { x: -4, y: 0, z: 3 }, { x: 4, y: 0, z: 3 },
      { x: -4, y: 0, z: -3 }, { x: 4, y: 0, z: -3 },
      { x: -3, y: 0, z: 4 }, { x: 3, y: 0, z: 4 },
      { x: -3, y: 0, z: -4 }, { x: 3, y: 0, z: -4 },
    ];
    for (let i = 0; i < cornerPositions.length; i++) {
      await createSphere(client, gatewayId, `Junction${i}`, cornerPositions[i], 0.25, DARK_METAL, GLOW_CYAN);
    }

    // Central core sphere
    console.log('Creating central core...');
    await createSphere(client, gatewayId, 'Core', { x: 0, y: 5, z: 0 }, 0.5, GLOW_CYAN, GLOW_CYAN);

    // Outer orbiting smaller tori
    console.log('Creating orbiting rings...');
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60) * Math.PI / 180;
      const x = Math.cos(angle) * 6;
      const z = Math.sin(angle) * 6;
      await createTorus(
        client, gatewayId, `OrbitRing${i}`,
        { x, y: 5, z },
        0.5, 0.08,
        METAL_BLUE,
        { x: 90, y: i * 60, z: 0 },
        i % 2 === 0 ? GLOW_CYAN : undefined
      );
    }

    // Base platform (torus lying flat)
    console.log('Creating base platform...');
    await createTorus(client, gatewayId, 'BasePlatform', { x: 0, y: 0.1, z: 0 }, 6, 0.5, DARK_METAL, { x: 90, y: 0, z: 0 });
    await createTorus(client, gatewayId, 'BaseGlow', { x: 0, y: 0.15, z: 0 }, 5.5, 0.1, GLOW_CYAN, { x: 90, y: 0, z: 0 }, GLOW_CYAN);

    console.log('\nCurved Gateway completed!');

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

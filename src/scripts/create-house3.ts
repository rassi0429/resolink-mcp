import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Convert Euler angles (degrees) to quaternion
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
  rotation?: { x: number; y: number; z: number },
  scale?: { x: number; y: number; z: number }
): Promise<string | null> {
  const rot = rotation || { x: 0, y: 0, z: 0 };
  const quat = eulerToQuaternion(rot.x, rot.y, rot.z);
  await client.addSlot({
    parentId,
    name,
    position,
    rotation: quat,
    scale: scale || { x: 1, y: 1, z: 1 },
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

async function addLight(
  client: ResoniteLinkClient,
  parentId: string,
  name: string,
  position: { x: number; y: number; z: number },
  color: { r: number; g: number; b: number },
  intensity: number,
  range: number,
  lightType: number = 2
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
      LightType: { $type: 'Enum', value: lightType },
      Intensity: { $type: 'float', value: intensity },
      Color: { $type: 'colorX', value: { r: color.r, g: color.g, b: color.b, a: 1, profile: 'sRGB' } },
      Range: { $type: 'float', value: range },
    } as any,
  });
}

async function main() {
  const client = new ResoniteLinkClient({ url: WS_URL });
  await client.connect();

  try {
    console.log('Building modern house with interior...\n');

    await client.addSlot({ name: 'ModernHouse', position: { x: 0, y: 0, z: 0 }, isActive: true });
    const house = await client.findSlotByName('ModernHouse', 'Root', 1);
    if (!house?.id) throw new Error('Failed to create house slot');
    const houseId = house.id;

    // Material presets
    const whiteWall = { AlbedoColor: { $type: 'colorX', value: { r: 0.95, g: 0.93, b: 0.9, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 } };
    const darkRoof = { AlbedoColor: { $type: 'colorX', value: { r: 0.15, g: 0.12, b: 0.1, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.6 }, Metallic: { $type: 'float', value: 0.1 } };
    const woodBrown = { AlbedoColor: { $type: 'colorX', value: { r: 0.45, g: 0.28, b: 0.15, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.4 }, Metallic: { $type: 'float', value: 0 } };
    const windowFrame = { AlbedoColor: { $type: 'colorX', value: { r: 0.2, g: 0.18, b: 0.15, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.5 }, Metallic: { $type: 'float', value: 0.3 } };
    const glass = { AlbedoColor: { $type: 'colorX', value: { r: 0.7, g: 0.85, b: 0.95, a: 0.3, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.95 }, Metallic: { $type: 'float', value: 0.8 } };
    const metalGold = { AlbedoColor: { $type: 'colorX', value: { r: 0.83, g: 0.69, b: 0.22, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.8 }, Metallic: { $type: 'float', value: 0.9 } };
    const redDoor = { AlbedoColor: { $type: 'colorX', value: { r: 0.6, g: 0.15, b: 0.1, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.5 }, Metallic: { $type: 'float', value: 0.1 } };
    const floorTile = { AlbedoColor: { $type: 'colorX', value: { r: 0.35, g: 0.32, b: 0.3, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.7 }, Metallic: { $type: 'float', value: 0.05 } };
    const sofaBlue = { AlbedoColor: { $type: 'colorX', value: { r: 0.2, g: 0.35, b: 0.5, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.2 }, Metallic: { $type: 'float', value: 0 } };
    const tvBlack = { AlbedoColor: { $type: 'colorX', value: { r: 0.05, g: 0.05, b: 0.05, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.9 }, Metallic: { $type: 'float', value: 0.3 } };
    const lampWhite = { AlbedoColor: { $type: 'colorX', value: { r: 1, g: 0.98, b: 0.9, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 }, EmissiveColor: { $type: 'colorX', value: { r: 0.5, g: 0.45, b: 0.3, a: 1, profile: 'sRGB' } } };
    const bookColors = [
      { AlbedoColor: { $type: 'colorX', value: { r: 0.6, g: 0.2, b: 0.15, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 } },
      { AlbedoColor: { $type: 'colorX', value: { r: 0.15, g: 0.3, b: 0.5, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 } },
      { AlbedoColor: { $type: 'colorX', value: { r: 0.2, g: 0.45, b: 0.2, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 } },
    ];
    const bedWhite = { AlbedoColor: { $type: 'colorX', value: { r: 0.95, g: 0.95, b: 0.98, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.2 }, Metallic: { $type: 'float', value: 0 } };
    const pillowPink = { AlbedoColor: { $type: 'colorX', value: { r: 0.9, g: 0.75, b: 0.8, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.15 }, Metallic: { $type: 'float', value: 0 } };

    // === FOUNDATION ===
    console.log('  Creating foundation...');
    await createMeshWithMaterial(client, houseId, 'Foundation', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 8, y: 0.3, z: 6 } }, Bevel: { $type: 'float', value: 0.05 } },
      floorTile, { x: 0, y: 0.15, z: 0 });

    // === WALLS ===
    console.log('  Creating walls...');
    await createMeshWithMaterial(client, houseId, 'WallFrontLeft', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 2.5, y: 3, z: 0.25 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: -2.25, y: 1.8, z: -3 });
    await createMeshWithMaterial(client, houseId, 'WallFrontRight', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 2.5, y: 3, z: 0.25 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: 2.25, y: 1.8, z: -3 });
    await createMeshWithMaterial(client, houseId, 'WallFrontTop', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 3, y: 0.8, z: 0.25 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: 0, y: 2.9, z: -3 });
    await createMeshWithMaterial(client, houseId, 'WallBack', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 8, y: 3, z: 0.25 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: 0, y: 1.8, z: 3 });
    await createMeshWithMaterial(client, houseId, 'WallLeft', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.25, y: 3, z: 6 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: -4, y: 1.8, z: 0 });
    await createMeshWithMaterial(client, houseId, 'WallRight', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.25, y: 3, z: 6 } }, Bevel: { $type: 'float', value: 0.02 } },
      whiteWall, { x: 4, y: 1.8, z: 0 });

    // === DOOR ===
    console.log('  Creating door...');
    await createMeshWithMaterial(client, houseId, 'Door', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1.2, y: 2.3, z: 0.1 } }, Bevel: { $type: 'float', value: 0.03 } },
      redDoor, { x: 0, y: 1.45, z: -3.1 });
    await createMeshWithMaterial(client, houseId, 'DoorHandle', 'TorusMesh',
      { MajorRadius: { $type: 'float', value: 0.08 }, MinorRadius: { $type: 'float', value: 0.015 }, MajorSegments: { $type: 'int', value: 24 }, MinorSegments: { $type: 'int', value: 12 } },
      metalGold, { x: 0.4, y: 1.3, z: -3.2 }, { x: 90, y: 0, z: 0 });

    // === WINDOWS ===
    console.log('  Creating windows...');
    await createMeshWithMaterial(client, houseId, 'WindowFrameLeft', 'FrameMesh',
      { ContentSize: { $type: 'float2', value: { x: 1.2, y: 1.0 } }, Thickness: { $type: 'float', value: 0.08 } },
      windowFrame, { x: -4.15, y: 2, z: 0 }, { x: 0, y: 90, z: 0 });
    await createMeshWithMaterial(client, houseId, 'WindowGlassLeft', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 1.1, y: 0.9, z: 0.02 } } },
      glass, { x: -4.15, y: 2, z: 0 }, { x: 0, y: 90, z: 0 });
    await createMeshWithMaterial(client, houseId, 'WindowFrameRight', 'FrameMesh',
      { ContentSize: { $type: 'float2', value: { x: 1.2, y: 1.0 } }, Thickness: { $type: 'float', value: 0.08 } },
      windowFrame, { x: 4.15, y: 2, z: 0 }, { x: 0, y: 90, z: 0 });
    await createMeshWithMaterial(client, houseId, 'WindowGlassRight', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 1.1, y: 0.9, z: 0.02 } } },
      glass, { x: 4.15, y: 2, z: 0 }, { x: 0, y: 90, z: 0 });

    // === ROOF ===
    console.log('  Creating roof...');
    await createMeshWithMaterial(client, houseId, 'RoofLeft', 'RampMesh',
      { Length: { $type: 'float', value: 7 }, Height: { $type: 'float', value: 1.8 }, Width: { $type: 'float', value: 4.5 } },
      darkRoof, { x: -2.25, y: 3.3, z: 0 }, { x: 0, y: 90, z: 0 });
    await createMeshWithMaterial(client, houseId, 'RoofRight', 'RampMesh',
      { Length: { $type: 'float', value: 7 }, Height: { $type: 'float', value: 1.8 }, Width: { $type: 'float', value: 4.5 } },
      darkRoof, { x: 2.25, y: 3.3, z: 0 }, { x: 0, y: -90, z: 0 });

    // === PORCH ===
    console.log('  Creating porch...');
    await createMeshWithMaterial(client, houseId, 'PillarLeft', 'CapsuleMesh',
      { Radius: { $type: 'float', value: 0.12 }, Height: { $type: 'float', value: 2.8 }, Segments: { $type: 'int', value: 16 }, Rings: { $type: 'int', value: 8 } },
      whiteWall, { x: -1.5, y: 1.7, z: -3.5 });
    await createMeshWithMaterial(client, houseId, 'PillarRight', 'CapsuleMesh',
      { Radius: { $type: 'float', value: 0.12 }, Height: { $type: 'float', value: 2.8 }, Segments: { $type: 'int', value: 16 }, Rings: { $type: 'int', value: 8 } },
      whiteWall, { x: 1.5, y: 1.7, z: -3.5 });
    await createMeshWithMaterial(client, houseId, 'PorchRoof', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 4, y: 0.15, z: 1.5 } }, Bevel: { $type: 'float', value: 0.03 } },
      darkRoof, { x: 0, y: 3.2, z: -3.5 });
    await createMeshWithMaterial(client, houseId, 'Doorstep', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 2, y: 0.15, z: 0.8 } }, Bevel: { $type: 'float', value: 0.03 } },
      floorTile, { x: 0, y: 0.38, z: -3.5 });

    // === CHIMNEY ===
    await createMeshWithMaterial(client, houseId, 'Chimney', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.6, y: 1.5, z: 0.6 } }, Bevel: { $type: 'float', value: 0.05 } },
      { AlbedoColor: { $type: 'colorX', value: { r: 0.55, g: 0.27, b: 0.2, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.3 }, Metallic: { $type: 'float', value: 0 } },
      { x: 3, y: 4.8, z: 1.5 });

    // === INTERIOR FLOOR ===
    console.log('  Creating interior floor...');
    await createMeshWithMaterial(client, houseId, 'InteriorFloor', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 7.5, y: 0.05, z: 5.5 } } },
      woodBrown, { x: 0, y: 0.35, z: 0 });

    // ============================================
    // INTERIOR FURNITURE
    // ============================================
    console.log('  Creating interior furniture...');

    // === SOFA (Living Room - Left side) ===
    console.log('    - Sofa...');
    await createMeshWithMaterial(client, houseId, 'SofaBase', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 2, y: 0.4, z: 0.9 } }, Bevel: { $type: 'float', value: 0.05 } },
      sofaBlue, { x: -2.5, y: 0.6, z: 0 });
    await createMeshWithMaterial(client, houseId, 'SofaBack', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 2, y: 0.6, z: 0.15 } }, Bevel: { $type: 'float', value: 0.03 } },
      sofaBlue, { x: -2.5, y: 1.1, z: 0.4 });
    await createMeshWithMaterial(client, houseId, 'SofaArmL', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.15, y: 0.5, z: 0.9 } }, Bevel: { $type: 'float', value: 0.03 } },
      sofaBlue, { x: -3.4, y: 0.85, z: 0 });
    await createMeshWithMaterial(client, houseId, 'SofaArmR', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.15, y: 0.5, z: 0.9 } }, Bevel: { $type: 'float', value: 0.03 } },
      sofaBlue, { x: -1.6, y: 0.85, z: 0 });

    // === COFFEE TABLE ===
    console.log('    - Coffee table...');
    await createMeshWithMaterial(client, houseId, 'CoffeeTableTop', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1, y: 0.08, z: 0.6 } }, Bevel: { $type: 'float', value: 0.02 } },
      woodBrown, { x: -2.5, y: 0.55, z: -1.2 });
    await createMeshWithMaterial(client, houseId, 'CoffeeTableLeg1', 'CylinderMesh',
      { Height: { $type: 'float', value: 0.4 }, Radius: { $type: 'float', value: 0.04 } },
      woodBrown, { x: -2.9, y: 0.35, z: -1.4 });
    await createMeshWithMaterial(client, houseId, 'CoffeeTableLeg2', 'CylinderMesh',
      { Height: { $type: 'float', value: 0.4 }, Radius: { $type: 'float', value: 0.04 } },
      woodBrown, { x: -2.1, y: 0.35, z: -1.4 });
    await createMeshWithMaterial(client, houseId, 'CoffeeTableLeg3', 'CylinderMesh',
      { Height: { $type: 'float', value: 0.4 }, Radius: { $type: 'float', value: 0.04 } },
      woodBrown, { x: -2.9, y: 0.35, z: -1.0 });
    await createMeshWithMaterial(client, houseId, 'CoffeeTableLeg4', 'CylinderMesh',
      { Height: { $type: 'float', value: 0.4 }, Radius: { $type: 'float', value: 0.04 } },
      woodBrown, { x: -2.1, y: 0.35, z: -1.0 });

    // === TV on wall ===
    console.log('    - TV...');
    await createMeshWithMaterial(client, houseId, 'TVScreen', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 1.5, y: 0.9, z: 0.05 } } },
      tvBlack, { x: -2.5, y: 1.8, z: -2.8 });
    await createMeshWithMaterial(client, houseId, 'TVFrame', 'FrameMesh',
      { ContentSize: { $type: 'float2', value: { x: 1.5, y: 0.9 } }, Thickness: { $type: 'float', value: 0.05 } },
      tvBlack, { x: -2.5, y: 1.8, z: -2.75 });

    // === FLOOR LAMP ===
    console.log('    - Floor lamp...');
    await createMeshWithMaterial(client, houseId, 'LampPole', 'CylinderMesh',
      { Height: { $type: 'float', value: 1.5 }, Radius: { $type: 'float', value: 0.03 } },
      metalGold, { x: -0.8, y: 1.1, z: 0.2 });
    await createMeshWithMaterial(client, houseId, 'LampBase', 'CylinderMesh',
      { Height: { $type: 'float', value: 0.05 }, Radius: { $type: 'float', value: 0.2 } },
      metalGold, { x: -0.8, y: 0.4, z: 0.2 });
    await createMeshWithMaterial(client, houseId, 'LampShade', 'ConeMesh',
      { Height: { $type: 'float', value: 0.35 }, RadiusBase: { $type: 'float', value: 0.25 }, RadiusTop: { $type: 'float', value: 0.15 } },
      lampWhite, { x: -0.8, y: 2.0, z: 0.2 });

    // === BED (Right side) ===
    console.log('    - Bed...');
    await createMeshWithMaterial(client, houseId, 'BedFrame', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1.8, y: 0.35, z: 2.2 } }, Bevel: { $type: 'float', value: 0.03 } },
      woodBrown, { x: 2.5, y: 0.5, z: 1.5 });
    await createMeshWithMaterial(client, houseId, 'Mattress', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1.6, y: 0.25, z: 2 } }, Bevel: { $type: 'float', value: 0.05 } },
      bedWhite, { x: 2.5, y: 0.8, z: 1.5 });
    await createMeshWithMaterial(client, houseId, 'Pillow1', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.5, y: 0.15, z: 0.35 } }, Bevel: { $type: 'float', value: 0.05 } },
      pillowPink, { x: 2.2, y: 1.0, z: 2.3 });
    await createMeshWithMaterial(client, houseId, 'Pillow2', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 0.5, y: 0.15, z: 0.35 } }, Bevel: { $type: 'float', value: 0.05 } },
      bedWhite, { x: 2.8, y: 1.0, z: 2.3 });
    await createMeshWithMaterial(client, houseId, 'Headboard', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1.8, y: 0.8, z: 0.1 } }, Bevel: { $type: 'float', value: 0.02 } },
      woodBrown, { x: 2.5, y: 1.1, z: 2.6 });

    // === BOOKSHELF ===
    console.log('    - Bookshelf...');
    await createMeshWithMaterial(client, houseId, 'ShelfFrame', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 0.8, y: 1.5, z: 0.3 } } },
      woodBrown, { x: 2.5, y: 1.1, z: -1.5 });
    // Shelf boards
    for (let i = 0; i < 4; i++) {
      await createMeshWithMaterial(client, houseId, `ShelfBoard${i}`, 'BoxMesh',
        { Size: { $type: 'float3', value: { x: 0.75, y: 0.03, z: 0.28 } } },
        woodBrown, { x: 2.5, y: 0.5 + i * 0.4, z: -1.5 });
    }
    // Books
    for (let i = 0; i < 5; i++) {
      const color = bookColors[i % bookColors.length];
      await createMeshWithMaterial(client, houseId, `Book${i}`, 'BoxMesh',
        { Size: { $type: 'float3', value: { x: 0.08, y: 0.25, z: 0.18 } } },
        color, { x: 2.3 + i * 0.1, y: 0.75, z: -1.5 });
    }

    // === DINING TABLE ===
    console.log('    - Dining table...');
    await createMeshWithMaterial(client, houseId, 'DiningTableTop', 'BevelBoxMesh',
      { Size: { $type: 'float3', value: { x: 1.4, y: 0.08, z: 0.9 } }, Bevel: { $type: 'float', value: 0.02 } },
      woodBrown, { x: 0.5, y: 1.0, z: 1.5 });
    // Table legs
    const tableLegPositions = [
      { x: 0.0, z: 1.1 }, { x: 1.0, z: 1.1 },
      { x: 0.0, z: 1.9 }, { x: 1.0, z: 1.9 },
    ];
    for (let i = 0; i < tableLegPositions.length; i++) {
      await createMeshWithMaterial(client, houseId, `DiningLeg${i}`, 'CylinderMesh',
        { Height: { $type: 'float', value: 0.8 }, Radius: { $type: 'float', value: 0.04 } },
        woodBrown, { x: tableLegPositions[i].x, y: 0.6, z: tableLegPositions[i].z });
    }

    // === CHAIRS ===
    console.log('    - Chairs...');
    const chairPositions = [
      { x: -0.1, z: 1.5, ry: 90 },
      { x: 1.1, z: 1.5, ry: -90 },
    ];
    for (let i = 0; i < chairPositions.length; i++) {
      const cp = chairPositions[i];
      await createMeshWithMaterial(client, houseId, `ChairSeat${i}`, 'BevelBoxMesh',
        { Size: { $type: 'float3', value: { x: 0.45, y: 0.05, z: 0.45 } }, Bevel: { $type: 'float', value: 0.02 } },
        woodBrown, { x: cp.x, y: 0.65, z: cp.z }, { x: 0, y: cp.ry, z: 0 });
      await createMeshWithMaterial(client, houseId, `ChairBack${i}`, 'BevelBoxMesh',
        { Size: { $type: 'float3', value: { x: 0.45, y: 0.5, z: 0.05 } }, Bevel: { $type: 'float', value: 0.02 } },
        woodBrown, { x: cp.x + (cp.ry > 0 ? -0.2 : 0.2), y: 0.95, z: cp.z }, { x: 0, y: cp.ry, z: 0 });
    }

    // === PICTURE FRAME on wall ===
    console.log('    - Picture frame...');
    await createMeshWithMaterial(client, houseId, 'PictureFrame', 'FrameMesh',
      { ContentSize: { $type: 'float2', value: { x: 0.6, y: 0.8 } }, Thickness: { $type: 'float', value: 0.05 } },
      metalGold, { x: 2.5, y: 2, z: 2.85 }, { x: 0, y: 180, z: 0 });
    await createMeshWithMaterial(client, houseId, 'PictureCanvas', 'BoxMesh',
      { Size: { $type: 'float3', value: { x: 0.55, y: 0.75, z: 0.02 } } },
      { AlbedoColor: { $type: 'colorX', value: { r: 0.3, g: 0.5, b: 0.7, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.1 }, Metallic: { $type: 'float', value: 0 } },
      { x: 2.5, y: 2, z: 2.88 });

    // === RUG using QuadMesh ===
    console.log('    - Rug...');
    await createMeshWithMaterial(client, houseId, 'Rug', 'QuadMesh',
      { Size: { $type: 'float2', value: { x: 2.5, y: 1.8 } }, DualSided: { $type: 'bool', value: false } },
      { AlbedoColor: { $type: 'colorX', value: { r: 0.5, g: 0.2, b: 0.2, a: 1, profile: 'sRGB' } }, Smoothness: { $type: 'float', value: 0.1 }, Metallic: { $type: 'float', value: 0 } },
      { x: -2.5, y: 0.38, z: -0.5 }, { x: -90, y: 0, z: 0 });

    // === LIGHTS ===
    console.log('  Adding lights...');
    await addLight(client, houseId, 'PorchLight', { x: 0, y: 2.8, z: -3.8 }, { r: 1, g: 0.9, b: 0.7 }, 2, 5, 2);
    await addLight(client, houseId, 'LivingRoomLight', { x: -2, y: 2.8, z: -0.5 }, { r: 1, g: 0.95, b: 0.85 }, 1.5, 5, 2);
    await addLight(client, houseId, 'BedroomLight', { x: 2.5, y: 2.8, z: 1.5 }, { r: 1, g: 0.9, b: 0.8 }, 1.2, 4, 2);
    await addLight(client, houseId, 'DiningLight', { x: 0.5, y: 2.8, z: 1.5 }, { r: 1, g: 0.95, b: 0.9 }, 1, 4, 2);
    await addLight(client, houseId, 'FloorLampLight', { x: -0.8, y: 2.1, z: 0.2 }, { r: 1, g: 0.9, b: 0.7 }, 0.8, 3, 2);

    console.log('\n House created with:');
    console.log('  Exterior: BevelBoxMesh walls, RampMesh roof, CapsuleMesh pillars');
    console.log('  Windows: FrameMesh frames with glass');
    console.log('  Door: TorusMesh handle');
    console.log('  Interior:');
    console.log('    - Sofa, Coffee table, Floor lamp');
    console.log('    - TV with FrameMesh bezel');
    console.log('    - Bed with pillows');
    console.log('    - Bookshelf with books');
    console.log('    - Dining table with chairs');
    console.log('    - Picture frame, Rug');
    console.log('    - Multiple Light components');

  } finally {
    client.disconnect();
  }
}

main();

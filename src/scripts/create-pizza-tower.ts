import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Pizza Tower colors
const CRUST_COLOR = { r: 0.85, g: 0.6, b: 0.3 };     // Dough/Crust
const CHEESE_COLOR = { r: 1.0, g: 0.9, b: 0.6 };     // Melted Cheese
const SAUCE_COLOR = { r: 0.8, g: 0.2, b: 0.1 };      // Tomato Sauce
const PEPPERONI_COLOR = { r: 0.7, g: 0.15, b: 0.1 }; // Pepperoni
const OLIVE_COLOR = { r: 0.2, g: 0.2, b: 0.2 };      // Black Olive
const PEPPER_COLOR = { r: 0.2, g: 0.6, b: 0.2 };     // Green Pepper

// Tower dimensions (scaled for VR)
const SCALE = 0.12;
const TOTAL_HEIGHT = 56 * SCALE;
const BASE_RADIUS = 7.5 * SCALE;
const TOP_RADIUS = 7 * SCALE;
const TILT_ANGLE = 4;

// Position
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
  rotation?: { x: number; y: number; z: number },
  scale?: { x: number; y: number; z: number }
): Promise<string | null> {
  const rot = rotation || { x: 0, y: 0, z: 0 };
  const quat = eulerToQuaternion(rot.x, rot.y, rot.z);
  await client.addSlot({
    name,
    parentId,
    position,
    rotation: quat,
    scale: scale || { x: 1, y: 1, z: 1 },
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

  console.log('Creating Pizza Tower (The Leaning Tower of Pizza)...\n');
  await client.connect();

  // Delete existing PisaTower (replacing it)
  const existing = await client.findSlotByName('PisaTower', 'Root', 1);
  if (existing?.id) {
    console.log('Deleting existing Pisa Tower to replace with Pizza Tower...');
    await client.removeSlot(existing.id);
  }
  const existingPizza = await client.findSlotByName('PizzaTower', 'Root', 1);
  if (existingPizza?.id) {
    await client.removeSlot(existingPizza.id);
  }

  try {
    // Create main slot with tilt
    const tiltQuat = eulerToQuaternion(0, 0, TILT_ANGLE);
    await client.addSlot({
      name: 'PizzaTower',
      position: { x: OFFSET_X, y: 0, z: 0 },
      rotation: tiltQuat,
      isActive: true
    });
    const tower = await client.findSlotByName('PizzaTower', 'Root', 1);
    if (!tower?.id) throw new Error('Failed to create tower slot');

    const crustMat = {
      AlbedoColor: { $type: 'colorX', value: { ...CRUST_COLOR, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.1 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    const cheeseMat = {
      AlbedoColor: { $type: 'colorX', value: { ...CHEESE_COLOR, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.4 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    const sauceMat = {
      AlbedoColor: { $type: 'colorX', value: { ...SAUCE_COLOR, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.6 },
      Metallic: { $type: 'float', value: 0.0 }
    };
    
    const pepperoniMat = {
      AlbedoColor: { $type: 'colorX', value: { ...PEPPERONI_COLOR, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.3 },
      Metallic: { $type: 'float', value: 0.0 }
    };

    const pepperMat = {
      AlbedoColor: { $type: 'colorX', value: { ...PEPPER_COLOR, a: 1, profile: 'sRGB' } },
      Smoothness: { $type: 'float', value: 0.4 }
    };

    // Base platform (Thick Crust)
    console.log('Creating Deep Dish Base...');
    await createMeshWithMaterial(
      client, tower.id, 'BaseCrust',
      'CylinderMesh',
      {
        Height: { $type: 'float', value: 0.3 },
        Radius: { $type: 'float', value: BASE_RADIUS * 1.3 },
        Sides: { $type: 'int', value: 32 }
      },
      crustMat,
      { x: 0, y: 0.15, z: 0 }
    );
    
    // Sauce layer on base
    await createMeshWithMaterial(
        client, tower.id, 'BaseSauce',
        'CylinderMesh',
        {
          Height: { $type: 'float', value: 0.05 },
          Radius: { $type: 'float', value: BASE_RADIUS * 1.25 },
          Sides: { $type: 'int', value: 32 }
        },
        sauceMat,
        { x: 0, y: 0.3, z: 0 }
      );

    // 8 floors
    const floorHeight = TOTAL_HEIGHT / 8;
    const numColumns = 15;

    for (let floor = 0; floor < 8; floor++) {
      const y = floor * floorHeight;
      const floorRadius = BASE_RADIUS - (floor * 0.03);
      const innerRadius = floorRadius * 0.7;

      console.log(`Baking floor ${floor + 1}/8...`);

      // Main cylindrical wall (Cheese Wall)
      await createMeshWithMaterial(
        client, tower.id, `Floor${floor}_Cheese`,
        'CylinderMesh',
        {
          Height: { $type: 'float', value: floorHeight * 0.9 },
          Radius: { $type: 'float', value: innerRadius },
          Sides: { $type: 'int', value: 24 }
        },
        cheeseMat,
        { x: 0, y: y + floorHeight * 0.45, z: 0 }
      );

      // Floor platform (Crust Rim)
      await createMeshWithMaterial(
        client, tower.id, `Floor${floor}_Crust`,
        'CylinderMesh',
        {
          Height: { $type: 'float', value: 0.15 },
          Radius: { $type: 'float', value: floorRadius },
          Sides: { $type: 'int', value: 32 }
        },
        crustMat,
        { x: 0, y: y + 0.04, z: 0 }
      );

      // Columns -> Dripping Cheese or Dough pillars
      if (floor > 0 && floor < 7) {
        const columnHeight = floorHeight * 0.8;
        const columnRadius = 0.06; // Thicker for doughy look

        for (let col = 0; col < numColumns; col++) {
          const angle = (col / numColumns) * Math.PI * 2;
          const colX = Math.cos(angle) * (floorRadius - 0.1);
          const colZ = Math.sin(angle) * (floorRadius - 0.1);

          await createMeshWithMaterial(
            client, tower.id, `Floor${floor}_Col${col}`,
            'CylinderMesh',
            {
              Height: { $type: 'float', value: columnHeight },
              Radius: { $type: 'float', value: columnRadius },
              Sides: { $type: 'int', value: 8 }
            },
            crustMat,
            { x: colX, y: y + columnHeight / 2 + 0.1, z: colZ }
          );
        }
        
        // Add Toppings (Pepperoni and Peppers) attached to the cheese wall
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = innerRadius + 0.05;
            const pX = Math.cos(angle) * r;
            const pZ = Math.sin(angle) * r;
            const pY = y + floorHeight * 0.2 + Math.random() * floorHeight * 0.6;
            
            // Pepperoni
            await createMeshWithMaterial(
                client, tower.id, `Floor${floor}_Pep${i}`,
                'CylinderMesh',
                {
                    Height: { $type: 'float', value: 0.05 },
                    Radius: { $type: 'float', value: 0.15 },
                    Sides: { $type: 'int', value: 16 }
                },
                pepperoniMat,
                { x: pX, y: pY, z: pZ },
                { x: 90, y: angle * 180 / Math.PI, z: 0 } // Stick to wall
            );
        }
        
        // Add some green peppers on the gallery floor
         for (let i = 0; i < 5; i++) {
             const angle = Math.random() * Math.PI * 2;
             const r = innerRadius + 0.15 + Math.random() * (floorRadius - innerRadius - 0.2);
             const pX = Math.cos(angle) * r;
             const pZ = Math.sin(angle) * r;
             
             await createMeshWithMaterial(
                client, tower.id, `Floor${floor}_Grn${i}`,
                'BoxMesh',
                {
                    Size: { $type: 'float3', value: { x: 0.1, y: 0.05, z: 0.02 } }
                },
                pepperMat,
                { x: pX, y: y + 0.12, z: pZ },
                { x: 0, y: Math.random() * 360, z: 0 }
             );
         }
      }
    }

    // Bell chamber (Top Crust)
    console.log('Creating top crust...');
    const bellY = 7 * floorHeight;
    await createMeshWithMaterial(
      client, tower.id, 'BellChamber',
      'CylinderMesh',
      {
        Height: { $type: 'float', value: floorHeight * 0.7 },
        Radius: { $type: 'float', value: TOP_RADIUS * 0.5 },
        Sides: { $type: 'int', value: 16 }
      },
      crustMat,
      { x: 0, y: bellY + floorHeight * 0.8, z: 0 }
    );

    // Dome -> Giant Meatball or just crust dome
    await createMeshWithMaterial(
      client, tower.id, 'Dome',
      'SphereMesh',
      {
        Radius: { $type: 'float', value: TOP_RADIUS * 0.35 },
        Segments: { $type: 'int', value: 16 }
      },
      sauceMat, // Red top
      { x: 0, y: TOTAL_HEIGHT + 0.2, z: 0 }
    );
    
    // Flag pole (Toothpick)
    await createMeshWithMaterial(
        client, tower.id, 'Toothpick',
        'CylinderMesh',
        {
            Height: { $type: 'float', value: 1.5 },
            Radius: { $type: 'float', value: 0.05 },
            Sides: { $type: 'int', value: 8 }
        },
        { AlbedoColor: { $type: 'colorX', value: { r: 0.9, g: 0.8, b: 0.7, a: 1 } }, Smoothness: { $type: 'float', value: 0.5 } },
        { x: 0, y: TOTAL_HEIGHT + 0.8, z: 0 }
    );
    
    // Flag (Italian flag colors on a slice?)
    // Let's make a flag that looks like a basil leaf
    await createMeshWithMaterial(
        client, tower.id, 'BasilFlag',
        'BoxMesh',
        {
             Size: { $type: 'float3', value: { x: 0.8, y: 0.5, z: 0.05 } }
        },
        pepperMat,
        { x: 0.4, y: TOTAL_HEIGHT + 1.2, z: 0 }
    );


    console.log('\nPizza Tower completed! Buon appetito!');

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

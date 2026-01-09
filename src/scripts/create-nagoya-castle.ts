import { ResoniteLinkClient } from '../client.js';

const WS_URL = process.argv[2] || 'ws://localhost:29551';

// Nagoya Castle Colors
const STONE_GRAY = { r: 0.4, g: 0.4, b: 0.45 };
const WALL_WHITE = { r: 0.95, g: 0.95, b: 0.95 };
const ROOF_GREEN = { r: 0.2, g: 0.45, b: 0.35 }; // Copper rust green
const ROOF_RIDGE = { r: 0.15, g: 0.35, b: 0.25 };
const GOLD = { r: 0.9, g: 0.7, b: 0.1 };
const WOOD_DARK = { r: 0.3, g: 0.2, b: 0.1 };

// Position
const POSITION = { x: -20, y: 0, z: 0 }; // Left of origin (Pizza Tower is at +20)
const SCALE = 1.0; 

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

async function createMesh(
    client: ResoniteLinkClient,
    parentId: string,
    name: string,
    meshType: string,
    meshParams: Record<string, any>,
    materialColor: { r: number, g: number, b: number },
    position: { x: number, y: number, z: number },
    scale: { x: number, y: number, z: number } = { x: 1, y: 1, z: 1 },
    rotation: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 },
    metallic: number = 0,
    smoothness: number = 0.2
): Promise<string | null> {
    const quat = eulerToQuaternion(rotation.x, rotation.y, rotation.z);
    
    await client.addSlot({
        name,
        parentId,
        position,
        rotation: quat,
        scale,
        isActive: true
    });
    
    const slot = await client.findSlotByName(name, parentId, 1);
    if (!slot?.id) return null;
    
    await client.addComponent({ containerSlotId: slot.id, componentType: `[FrooxEngine]FrooxEngine.${meshType}` });
    await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.MeshRenderer' });
    await client.addComponent({ containerSlotId: slot.id, componentType: '[FrooxEngine]FrooxEngine.PBS_Metallic' });
    
    const slotData = await client.getSlot({ slotId: slot.id, depth: 0, includeComponentData: true });
    if (!slotData.success || !slotData.data.components) return null;
    
    const mesh = slotData.data.components.find(c => c.componentType === `FrooxEngine.${meshType}`);
    const renderer = slotData.data.components.find(c => c.componentType === 'FrooxEngine.MeshRenderer');
    const material = slotData.data.components.find(c => c.componentType === 'FrooxEngine.PBS_Metallic');
    
    if (!mesh?.id || !renderer?.id || !material?.id) return null;
    
    // Set Mesh Params
    await client.updateComponent({ id: mesh.id, members: meshParams });
    
    // Set Material Params
    const matParams = {
        AlbedoColor: { $type: 'colorX', value: { ...materialColor, a: 1, profile: 'sRGB' } },
        Smoothness: { $type: 'float', value: smoothness },
        Metallic: { $type: 'float', value: metallic }
    };
    await client.updateComponent({ id: material.id, members: matParams });
    
    // Link
     await client.updateComponent({
        id: renderer.id,
        members: { Mesh: { $type: 'reference', targetId: mesh.id } as any }
      });
    
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

// Helper to create a roof layer (Pyramid-ish using ConeMesh)
async function createRoof(
    client: ResoniteLinkClient,
    parentId: string,
    name: string,
    width: number,
    depth: number,
    height: number,
    yPos: number
) {
    const radius = Math.max(width, depth) * 0.75; // Approx fit
    
    // Main Roof (Green)
    await createMesh(
        client, parentId, name,
        'ConeMesh',
        {
            Height: { $type: 'float', value: height },
            RadiusBase: { $type: 'float', value: radius }, // Bottom
            RadiusTop: { $type: 'float', value: radius * 0.1 }, // Top (not pointy, slight flat for next floor)
            Sides: { $type: 'int', value: 4 }
        },
        ROOF_GREEN,
        { x: 0, y: yPos + height/2, z: 0 },
        { x: width/radius/1.414, y: 1, z: depth/radius/1.414 }, // Scale to match rect
        { x: 0, y: 45, z: 0 }
    );
}

// Helper to create a castle floor (White box)
async function createFloor(
    client: ResoniteLinkClient,
    parentId: string,
    name: string,
    width: number,
    depth: number,
    height: number,
    yPos: number
) {
    await createMesh(
        client, parentId, name,
        'BoxMesh',
        {
            Size: { $type: 'float3', value: { x: width, y: height, z: depth } }
        },
        WALL_WHITE,
        { x: 0, y: yPos + height/2, z: 0 }
    );
}


async function main() {
    const client = new ResoniteLinkClient({ url: WS_URL });
    console.log('Creating Nagoya Castle...');
    await client.connect();
    
    // Cleanup
    const existing = await client.findSlotByName('NagoyaCastle', 'Root', 1);
    if (existing?.id) {
        await client.removeSlot(existing.id);
    }
    
    try {
        await client.addSlot({
            name: 'NagoyaCastle',
            position: POSITION,
            isActive: true
        });
        const castle = await client.findSlotByName('NagoyaCastle', 'Root', 1);
        if (!castle?.id) return;
        
        // --- Stone Base (Ishigaki) ---
        // Large trapezoid base. Approximated with a Box for now, maybe slightly tapered if possible?
        // Let's just use a BoxMesh with Stone Gray.
        const baseWidth = 12;
        const baseDepth = 10;
        const baseHeight = 3;
        
        await createMesh(
            client, castle.id, 'StoneBase',
            'BoxMesh',
            { Size: { $type: 'float3', value: { x: baseWidth, y: baseHeight, z: baseDepth } } },
            STONE_GRAY,
            { x: 0, y: baseHeight/2, z: 0 }
        );
        
        let currentY = baseHeight;
        
        // --- Main Keep Layers ---
        // 5 Layers, getting smaller
        
        const layerConfig = [
            { w: 9, d: 8, h: 2.5 },
            { w: 7.5, d: 6.5, h: 2.2 },
            { w: 6, d: 5, h: 2.0 },
            { w: 4.5, d: 3.5, h: 1.8 },
            { w: 3, d: 2.5, h: 1.5 } // Top floor
        ];
        
        for (let i = 0; i < layerConfig.length; i++) {
            const layer = layerConfig[i];
            
            // Wall
            await createFloor(client, castle.id, `Floor_${i+1}`, layer.w, layer.d, layer.h, currentY);
            
            // Roof (Skirt around the floor)
            // The roof sits slightly lower than the top of the wall usually, or starts from top.
            // Let's put roof base at currentY + layer.h * 0.5 roughly
            
            const roofOverhang = 1.0;
            const roofHeight = 1.2;
            
            // Roof geometry: 4-sided pyramid section
            // We use the createRoof helper which makes a pyramid.
            // To make it look like a "skirt", we might need to position it carefully.
            // Actually, castle roofs are complex. Simplified: A pyramid on top of each box.
            
            // Create a roof "cap" for this layer (except for top layer which has a special roof)
            // But Japanese castles have roofs between layers.
            
            await createRoof(
                client, castle.id, `Roof_${i+1}`,
                layer.w + roofOverhang,
                layer.d + roofOverhang,
                roofHeight,
                currentY + layer.h - 0.2 // Base Y position
            );

            currentY += layer.h;
        }
        
        // --- Top Roof (Irimoya style simplified) ---
        // Just a final pyramid cap
        const topW = 3.5;
        const topD = 3.0;
        await createMesh(
            client, castle.id, 'TopRoof',
            'ConeMesh',
            {
                Height: { $type: 'float', value: 1.5 },
                RadiusBase: { $type: 'float', value: 2.5 }, 
                Sides: { $type: 'int', value: 4 }
            },
            ROOF_GREEN,
            { x: 0, y: currentY, z: 0 },
            { x: 1, y: 1, z: 0.8 }, // Slight rectangular stretch
            { x: 0, y: 45, z: 0 }
        );
        
        currentY += 1.0;
        
        // --- Golden Shachihoko (Tiger-Fish) ---
        // Two golden decorations on top
        const shachiScale = { x: 0.3, y: 0.6, z: 0.15 };
        const shachiOffset = 0.8;
        
        // Left
        await createMesh(
            client, castle.id, 'Shachi_L',
            'BoxMesh',
            { Size: { $type: 'float3', value: { x: 1, y: 1, z: 1 } } }, // Unit box scaled
            GOLD,
            { x: -shachiOffset, y: currentY + 0.3, z: 0 },
            shachiScale,
            { x: 0, y: 0, z: -20 },
            0.8, 0.8 // Shiny gold
        );
        
        // Right
        await createMesh(
            client, castle.id, 'Shachi_R',
            'BoxMesh',
            { Size: { $type: 'float3', value: { x: 1, y: 1, z: 1 } } }, 
            GOLD,
            { x: shachiOffset, y: currentY + 0.3, z: 0 },
            shachiScale,
            { x: 0, y: 0, z: 20 },
             0.8, 0.8
        );
        
        console.log('Nagoya Castle constructed!');
        
    } finally {
        client.disconnect();
    }
}

main().then(() => {
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});

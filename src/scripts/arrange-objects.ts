import { ResoniteLinkClient } from '../client.js';

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    console.log('🎨 Arranging objects around the house...\n');

    // House is at (5, 0, 5), size 8x10
    // Living room area: around (5, 0, 2) - front of house near fireplace
    // Dining area: around (7, 0, 7)
    // Outside front: around (5, 0, 11)
    // Garden: around (10, 0, 5)

    const objects = [
      { name: 'Chair', newPos: { x: 8, y: 0, z: 7 } },           // Near dining table
      { name: 'Laptop', newPos: { x: 5, y: 0.5, z: 2.8 } },      // On coffee table in living room
      { name: 'Chocolate', newPos: { x: 5.3, y: 0.5, z: 2.5 } }, // On coffee table
      { name: 'Snowman', newPos: { x: 5, y: 0, z: 12 } },        // Front yard
      { name: 'Poop', newPos: { x: 11, y: 0, z: 8 } },           // Garden corner
    ];

    for (const obj of objects) {
      // Find the object
      const slot = await client.findSlotByName(obj.name, 'Root', 1);
      if (!slot?.id) {
        console.log(`  ${obj.name}: Not found, skipping`);
        continue;
      }

      // Update position
      const response = await client.updateSlot({
        id: slot.id,
        position: obj.newPos,
      });

      if (response.success) {
        console.log(`  ${obj.name}: Moved to (${obj.newPos.x}, ${obj.newPos.y}, ${obj.newPos.z})`);
      } else {
        console.log(`  ${obj.name}: Failed - ${response.errorInfo}`);
      }
    }

    console.log('\n✨ Objects arranged!');
  } finally {
    client.disconnect();
  }
}

main();

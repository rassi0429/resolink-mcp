import { ResoniteLinkClient, ROOT_SLOT_ID } from './index';

async function main() {
  // Create client instance
  const client = new ResoniteLinkClient({
    url: 'ws://localhost:9080', // Default ResoniteLink port
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  try {
    // Connect to ResoniteLink
    console.log('Connecting to ResoniteLink...');
    await client.connect();
    console.log('Connected!');

    // Get root slot with depth 1
    console.log('\nFetching root slot...');
    const rootResponse = await client.getRootSlot(1, false);

    if (rootResponse.success) {
      console.log('Root slot:', rootResponse.data.name?.value);
      console.log('Children count:', rootResponse.data.children?.length ?? 0);

      if (rootResponse.data.children) {
        console.log('\nChildren:');
        for (const child of rootResponse.data.children) {
          console.log(`  - ${child.name?.value ?? '(unnamed)'} [${child.id}]`);
        }
      }
    } else {
      console.error('Failed to get root slot:', rootResponse.errorInfo);
    }

    // Example: Create a new slot
    console.log('\nCreating a new slot...');
    const addResponse = await client.addSlot({
      parentId: ROOT_SLOT_ID,
      name: 'TestSlot_FromNodeJS',
      position: { x: 0, y: 1, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      isActive: true,
    });

    if (addResponse.success) {
      console.log('Slot created successfully!');
    } else {
      console.error('Failed to create slot:', addResponse.errorInfo);
    }

    // Example: Find slot by name
    console.log('\nSearching for slot by name...');
    const foundSlot = await client.findSlotByName('TestSlot_FromNodeJS');
    if (foundSlot) {
      console.log('Found slot:', foundSlot.id);

      // Update the slot
      console.log('\nUpdating slot...');
      const updateResponse = await client.updateSlot({
        id: foundSlot.id!,
        position: { x: 1, y: 2, z: 3 },
      });

      if (updateResponse.success) {
        console.log('Slot updated!');
      }

      // Remove the slot
      console.log('\nRemoving slot...');
      const removeResponse = await client.removeSlot(foundSlot.id!);
      if (removeResponse.success) {
        console.log('Slot removed!');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
    console.log('\nDisconnected.');
  }
}

main();

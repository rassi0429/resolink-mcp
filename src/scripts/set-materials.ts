import { ResoniteLinkClient } from '../index';

async function main() {
  const args = process.argv.slice(2);
  const url = args[0] || 'ws://localhost:31541';
  const meshRendererId = args[1];
  const materialId = args[2];

  if (!meshRendererId || !materialId) {
    console.error('Usage: set-materials <url> <meshRendererId> <materialId>');
    process.exit(1);
  }

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    const response = await client.updateComponent({
      id: meshRendererId,
      members: {
        Materials: {
          $type: 'list',
          elements: [
            {
              $type: 'reference',
              targetId: materialId,
            },
          ],
        },
      } as any,
    });

    if (response.success) {
      console.log('Materials set successfully');
    } else {
      console.error('Error:', response.errorInfo);
    }
  } finally {
    client.disconnect();
  }
}

main();

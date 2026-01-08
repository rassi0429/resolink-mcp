import { ResoniteLinkClient } from '../index';

async function main() {
  const url = process.argv[2] || 'ws://localhost:31541';
  const componentId = process.argv[3];

  if (!componentId) {
    console.error('Usage: inspect-component <url> <componentId>');
    process.exit(1);
  }

  const client = new ResoniteLinkClient({ url });
  await client.connect();

  try {
    const response = await client.getComponent(componentId);
    console.log(JSON.stringify(response, null, 2));
  } finally {
    client.disconnect();
  }
}

main();

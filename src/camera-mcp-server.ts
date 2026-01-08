import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { CameraClient } from './camera-client.js';

const DEFAULT_WS_URL = process.env.CAMERA_WS_URL || 'wss://wsecho.kokoa.dev/mcp/cam';

const client = new CameraClient({ url: DEFAULT_WS_URL });

const server = new McpServer({
  name: 'resonite-camera-server',
  version: '1.0.0',
});

server.registerTool(
  'get_camera',
  {
    title: 'Get Camera Status',
    description: 'Check if the camera is available in Resonite',
    inputSchema: {},
  },
  async () => {
    try {
      const result = await client.getCamera();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }] };
    }
  }
);

server.registerTool(
  'set_camera',
  {
    title: 'Set Camera Position',
    description: 'Set the camera position and rotation in Resonite',
    inputSchema: {
      x: z.number().describe('X position'),
      y: z.number().describe('Y position'),
      z: z.number().describe('Z position'),
      xrot: z.number().describe('X rotation in degrees'),
      yrot: z.number().describe('Y rotation in degrees'),
      zrot: z.number().describe('Z rotation in degrees'),
    },
  },
  async ({ x, y, z, xrot, yrot, zrot }) => {
    try {
      const result = await client.setCamera(x, y, z, xrot, yrot, zrot);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }] };
    }
  }
);

server.registerTool(
  'take_photo',
  {
    title: 'Take Photo',
    description: 'Take a photo in Resonite and return the uploaded image URL. This may take several seconds.',
    inputSchema: {},
  },
  async () => {
    try {
      const result = await client.takePhoto();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Resonite Camera MCP Server started');
}

main().catch(console.error);

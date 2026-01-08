import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { ResoniteLinkClient } from './client.js';
import { DecompileSearch } from './decompile-search.js';


const DEFAULT_WS_URL = process.env.RESONITE_WS_URL || 'ws://localhost:29551';

const decompileSearch = new DecompileSearch('C:\\Users\\neo\\GitHub\\reso-decompile\\sources');

let client: ResoniteLinkClient | null = null;
let isConnected = false;

async function getClient(): Promise<ResoniteLinkClient> {
  if (!client || !isConnected) {
    client = new ResoniteLinkClient({ url: DEFAULT_WS_URL });
    await client.connect();
    isConnected = true;
  }
  return client;
}

const server = new McpServer({
  name: 'resonitelink-server',
  version: '1.0.0',
});

// === Connection Tools ===
server.registerTool(
  'connect',
  {
    title: 'Connect to Resonite',
    description: 'Connect to Resonite via ResoniteLink WebSocket',
    inputSchema: {
      url: z.string().optional().describe('WebSocket URL (default: ws://localhost:29551)'),
    },
  },
  async ({ url }) => {
    const wsUrl = url || DEFAULT_WS_URL;
    client = new ResoniteLinkClient({ url: wsUrl });
    await client.connect();
    isConnected = true;
    return { content: [{ type: 'text', text: `Connected to ${wsUrl}` }] };
  }
);

server.registerTool(
  'disconnect',
  {
    title: 'Disconnect from Resonite',
    description: 'Disconnect from Resonite',
    inputSchema: {},
  },
  async () => {
    if (client) {
      client.disconnect();
      isConnected = false;
    }
    return { content: [{ type: 'text', text: 'Disconnected' }] };
  }
);

// === Slot Tools ===
server.registerTool(
  'get_slot',
  {
    title: 'Get Slot',
    description: 'Get information about a slot by ID',
    inputSchema: {
      slotId: z.string().describe('Slot ID (e.g., "Root" or specific ID)'),
      depth: z.number().optional().describe('Depth of children to retrieve (default: 0)'),
      includeComponentData: z.boolean().optional().describe('Include component data (default: false)'),
    },
  },
  async ({ slotId, depth, includeComponentData }) => {
    const c = await getClient();
    const result = await c.getSlot({
      slotId,
      depth: depth ?? 0,
      includeComponentData: includeComponentData ?? false,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'find_slot',
  {
    title: 'Find Slot by Name',
    description: 'Find a slot by name within a parent slot',
    inputSchema: {
      name: z.string().describe('Name of the slot to find'),
      parentId: z.string().optional().describe('Parent slot ID to search in (default: "Root")'),
      maxDepth: z.number().optional().describe('Maximum depth to search (default: 10)'),
    },
  },
  async ({ name, parentId, maxDepth }) => {
    const c = await getClient();
    const result = await c.findSlotByName(name, parentId || 'Root', maxDepth || 10);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'add_slot',
  {
    title: 'Add Slot',
    description: 'Add a new slot to the world',
    inputSchema: {
      name: z.string().describe('Name of the new slot'),
      parentId: z.string().optional().describe('Parent slot ID (default: "Root")'),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      }).optional().describe('Position {x, y, z}'),
      isActive: z.boolean().optional().describe('Whether the slot is active (default: true)'),
    },
  },
  async ({ name, parentId, position, isActive }) => {
    const c = await getClient();
    const result = await c.addSlot({
      name,
      parentId,
      position,
      isActive: isActive ?? true,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'remove_slot',
  {
    title: 'Remove Slot',
    description: 'Remove a slot from the world. WARNING: Do not remove system slots like Controllers, Roles, SpawnArea, Light, Skybox, Assets, etc.',
    inputSchema: {
      slotId: z.string().describe('ID of the slot to remove'),
    },
  },
  async ({ slotId }) => {
    const c = await getClient();
    const result = await c.removeSlot(slotId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'update_slot',
  {
    title: 'Update Slot',
    description: 'Update slot properties (position, rotation, scale, name, active)',
    inputSchema: {
      slotId: z.string().describe('ID of the slot to update'),
      name: z.string().optional().describe('New name'),
      position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
      rotation: z.object({ x: z.number(), y: z.number(), z: z.number(), w: z.number() }).optional(),
      scale: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
      isActive: z.boolean().optional(),
    },
  },
  async ({ slotId, name, position, rotation, scale, isActive }) => {
    const c = await getClient();
    const result = await c.updateSlot({ id: slotId, name, position, rotation, scale, isActive });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// === Component Tools ===
server.registerTool(
  'add_component',
  {
    title: 'Add Component',
    description: 'Add a component to a slot. Component type format: [FrooxEngine]FrooxEngine.ComponentName',
    inputSchema: {
      slotId: z.string().describe('Slot ID to add component to'),
      componentType: z.string().describe('Component type (e.g., "[FrooxEngine]FrooxEngine.BoxMesh")'),
    },
  },
  async ({ slotId, componentType }) => {
    const c = await getClient();
    const result = await c.addComponent({ containerSlotId: slotId, componentType });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'get_component',
  {
    title: 'Get Component',
    description: 'Get component details by ID',
    inputSchema: {
      componentId: z.string().describe('Component ID'),
    },
  },
  async ({ componentId }) => {
    const c = await getClient();
    const result = await c.getComponent(componentId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'update_component',
  {
    title: 'Update Component',
    description: 'Update component member values',
    inputSchema: {
      componentId: z.string().describe('Component ID'),
      members: z.record(z.string(), z.any()).describe('Members to update (e.g., {"Size": {"$type": "float3", "value": {"x": 1, "y": 2, "z": 3}}})'),
    },
  },
  async ({ componentId, members }) => {
    const c = await getClient();
    const result = await c.updateComponent({ id: componentId, members: members as any });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'remove_component',
  {
    title: 'Remove Component',
    description: 'Remove a component by ID',
    inputSchema: {
      componentId: z.string().describe('Component ID'),
    },
  },
  async ({ componentId }) => {
    const c = await getClient();
    const result = await c.removeComponent(componentId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// === Decompile Search Tools ===

server.registerTool(
  'search_components',
  {
    title: 'Search Components',
    description: 'Search for Resonite components by name in decompiled source',
    inputSchema: {
      query: z.string().describe('Search query (component name)'),
      maxResults: z.number().optional().describe('Max results (default: 20)'),
    },
  },
  async ({ query, maxResults }) => {
    const results = await decompileSearch.searchComponents(query, { maxResults: maxResults ?? 20 });
    const formatted = results.map(r => decompileSearch.formatComponentInfo(r)).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No results found' }] };
  }
);

server.registerTool(
  'get_component_info',
  {
    title: 'Get Component Info',
    description: 'Get detailed info about a specific Resonite component',
    inputSchema: {
      name: z.string().describe('Component name (e.g., "PBS_Metallic", "BoxMesh")'),
    },
  },
  async ({ name }) => {
    const info = await decompileSearch.getComponent(name);
    if (!info) {
      return { content: [{ type: 'text', text: `Component "${name}" not found` }] };
    }
    return { content: [{ type: 'text', text: decompileSearch.formatComponentInfo(info) }] };
  }
);

server.registerTool(
  'list_categories',
  {
    title: 'List Component Categories',
    description: 'List all available component categories',
    inputSchema: {},
  },
  async () => {
    const categories = await decompileSearch.listCategories();
    return { content: [{ type: 'text', text: categories.join('\n') }] };
  }
);

server.registerTool(
  'search_by_category',
  {
    title: 'Search by Category',
    description: 'Search components by category',
    inputSchema: {
      category: z.string().describe('Category to search (e.g., "Assets/Procedural Meshes")'),
      maxResults: z.number().optional().describe('Max results (default: 50)'),
    },
  },
  async ({ category, maxResults }) => {
    const results = await decompileSearch.searchByCategory(category, { maxResults: maxResults ?? 50 });
    const formatted = results.map(r => decompileSearch.formatComponentInfo(r)).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No results found' }] };
  }
);

server.registerTool(
  'search_by_member',
  {
    title: 'Search by Member',
    description: 'Search components that have a specific member name',
    inputSchema: {
      memberName: z.string().describe('Member name to search for'),
      maxResults: z.number().optional().describe('Max results (default: 20)'),
    },
  },
  async ({ memberName, maxResults }) => {
    const results = await decompileSearch.searchByMember(memberName, { maxResults: maxResults ?? 20 });
    const formatted = results.map(r => decompileSearch.formatComponentInfo(r)).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No results found' }] };
  }
);

server.registerTool(
  'get_component_source',
  {
    title: 'Get Component Source',
    description: 'Get the full source code of a component',
    inputSchema: {
      name: z.string().describe('Component name'),
    },
  },
  async ({ name }) => {
    const source = await decompileSearch.getComponentSource(name);
    if (!source) {
      return { content: [{ type: 'text', text: `Component "${name}" not found` }] };
    }
    return { content: [{ type: 'text', text: source }] };
  }
);

server.registerTool(
  'grep_source',
  {
    title: 'Grep Source Code',
    description: 'Search all source files for a text pattern',
    inputSchema: {
      query: z.string().describe('Text to search for'),
      maxResults: z.number().optional().describe('Max results (default: 30)'),
    },
  },
  async ({ query, maxResults }) => {
    const results = await decompileSearch.searchAllSources(query, { maxResults: maxResults ?? 30 });
    const formatted = results.map(r => `${r.file}:\n${r.matches.map(m => `  ${m}`).join('\n')}`).join('\n\n');
    return { content: [{ type: 'text', text: formatted || 'No results found' }] };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ResoniteLink MCP Server started');
}

main().catch(console.error);

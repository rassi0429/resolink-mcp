#!/usr/bin/env node

import { ResoniteLinkClient, ROOT_SLOT_ID, Slot, Component, Member } from './index.js';


const DEFAULT_URL = 'ws://localhost:9080';

interface CliOptions {
  url: string;
  command: string;
  args: Record<string, string>;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = {
    url: process.env.RESONITELINK_URL || DEFAULT_URL,
    command: '',
    args: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--url' || arg === '-u') {
      options.url = args[++i];
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      options.args[key] = args[++i] || 'true';
    } else if (!options.command) {
      options.command = arg;
    }
    i++;
  }

  return options;
}

function formatSlot(slot: Slot, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];

  lines.push(`${prefix}Slot: ${slot.name?.value ?? '(unnamed)'}`);
  lines.push(`${prefix}  ID: ${slot.id}`);

  if (slot.position?.value) {
    const p = slot.position.value;
    lines.push(`${prefix}  Position: (${p.x}, ${p.y}, ${p.z})`);
  }

  if (slot.rotation?.value) {
    const r = slot.rotation.value;
    lines.push(`${prefix}  Rotation: (${r.x}, ${r.y}, ${r.z}, ${r.w})`);
  }

  if (slot.scale?.value) {
    const s = slot.scale.value;
    lines.push(`${prefix}  Scale: (${s.x}, ${s.y}, ${s.z})`);
  }

  if (slot.isActive !== undefined) {
    lines.push(`${prefix}  Active: ${slot.isActive.value}`);
  }

  if (slot.components && slot.components.length > 0) {
    lines.push(`${prefix}  Components: ${slot.components.length}`);
    for (const comp of slot.components) {
      lines.push(`${prefix}    - ${comp.componentType ?? '?'} [${comp.id}]`);
    }
  }

  if (slot.children && slot.children.length > 0) {
    lines.push(`${prefix}  Children: ${slot.children.length}`);
    for (const child of slot.children) {
      if (child.isReferenceOnly) {
        lines.push(`${prefix}    - [ref] ${child.name?.value ?? child.id}`);
      } else {
        lines.push(formatSlot(child, indent + 2));
      }
    }
  }

  return lines.join('\n');
}

function formatComponent(comp: Component): string {
  const lines: string[] = [];

  lines.push(`Component: ${comp.componentType}`);
  lines.push(`  ID: ${comp.id}`);

  if (comp.members) {
    lines.push(`  Members:`);
    for (const [name, member] of Object.entries(comp.members)) {
      if ('value' in member) {
        lines.push(`    ${name}: ${JSON.stringify(member.value)}`);
      } else if ('targetId' in member) {
        lines.push(`    ${name}: -> ${member.targetId ?? 'null'}`);
      }
    }
  }

  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv);

  if (!options.command || options.command === 'help') {
    printHelp();
    process.exit(0);
  }

  const client = new ResoniteLinkClient({ url: options.url });

  try {
    await client.connect();

    switch (options.command) {
      case 'get-root':
      case 'root': {
        const depth = parseInt(options.args.depth ?? '1', 10);
        const includeComponents = options.args.components === 'true';
        const response = await client.getRootSlot(depth, includeComponents);

        if (response.success) {
          console.log(formatSlot(response.data));
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'get-slot':
      case 'get': {
        const slotId = options.args.id || options.args.slotId;
        if (!slotId) {
          console.error('Error: --id is required');
          process.exit(1);
        }

        const depth = parseInt(options.args.depth ?? '0', 10);
        const includeComponents = options.args.components === 'true';

        const response = await client.getSlot({
          slotId,
          depth,
          includeComponentData: includeComponents,
        });

        if (response.success) {
          console.log(formatSlot(response.data));
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'add-slot':
      case 'add': {
        const parentId = options.args.parent || options.args.parentId || ROOT_SLOT_ID;
        const name = options.args.name || 'NewSlot';

        const addOptions: Parameters<typeof client.addSlot>[0] = {
          parentId,
          name,
        };

        if (options.args.position) {
          const [x, y, z] = options.args.position.split(',').map(Number);
          addOptions.position = { x, y, z };
        }

        if (options.args.scale) {
          const [x, y, z] = options.args.scale.split(',').map(Number);
          addOptions.scale = { x, y, z };
        }

        if (options.args.active !== undefined) {
          addOptions.isActive = options.args.active === 'true';
        }

        const response = await client.addSlot(addOptions);

        if (response.success) {
          console.log('Slot created successfully');
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'update-slot':
      case 'update': {
        const id = options.args.id;
        if (!id) {
          console.error('Error: --id is required');
          process.exit(1);
        }

        const updateOptions: Parameters<typeof client.updateSlot>[0] = { id };

        if (options.args.name) {
          updateOptions.name = options.args.name;
        }

        if (options.args.position) {
          const [x, y, z] = options.args.position.split(',').map(Number);
          updateOptions.position = { x, y, z };
        }

        if (options.args.scale) {
          const [x, y, z] = options.args.scale.split(',').map(Number);
          updateOptions.scale = { x, y, z };
        }

        if (options.args.active !== undefined) {
          updateOptions.isActive = options.args.active === 'true';
        }

        const response = await client.updateSlot(updateOptions);

        if (response.success) {
          console.log('Slot updated successfully');
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'remove-slot':
      case 'remove': {
        const slotId = options.args.id || options.args.slotId;
        if (!slotId) {
          console.error('Error: --id is required');
          process.exit(1);
        }

        const response = await client.removeSlot(slotId);

        if (response.success) {
          console.log('Slot removed successfully');
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'get-component': {
        const componentId = options.args.id || options.args.componentId;
        if (!componentId) {
          console.error('Error: --id is required');
          process.exit(1);
        }

        const response = await client.getComponent(componentId);

        if (response.success) {
          console.log(formatComponent(response.data));
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'add-component': {
        const containerSlotId = options.args.slot || options.args.containerSlotId;
        let componentType = options.args.type || options.args.componentType;

        if (!containerSlotId || !componentType) {
          console.error('Error: --slot and --type are required');
          process.exit(1);
        }

        // Auto-add assembly name if not present
        if (!componentType.startsWith('[')) {
          if (componentType.startsWith('FrooxEngine.')) {
            componentType = `[FrooxEngine]${componentType}`;
          } else {
            componentType = `[FrooxEngine]FrooxEngine.${componentType}`;
          }
        }

        const response = await client.addComponent({
          containerSlotId,
          componentType,
        });

        if (response.success) {
          console.log('Component added successfully');
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'remove-component': {
        const componentId = options.args.id || options.args.componentId;
        if (!componentId) {
          console.error('Error: --id is required');
          process.exit(1);
        }

        const response = await client.removeComponent(componentId);

        if (response.success) {
          console.log('Component removed successfully');
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'set-ref': {
        // Set a reference field on a component
        // Usage: set-ref --id <componentId> --field <fieldName> --target <targetId>
        const componentId = options.args.id;
        const fieldName = options.args.field;
        const targetId = options.args.target;

        if (!componentId || !fieldName) {
          console.error('Error: --id and --field are required');
          process.exit(1);
        }

        const members: Record<string, unknown> = {
          [fieldName]: {
            $type: 'reference',
            targetId: targetId || null,
          },
        };

        const response = await client.updateComponent({
          id: componentId,
          members: members as Record<string, Member>,
        });

        if (response.success) {
          console.log(`Reference ${fieldName} set to ${targetId || 'null'}`);
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'set-field': {
        // Set a value field on a component
        // Usage: set-field --id <componentId> --field <fieldName> --type <type> --value <value>
        const componentId = options.args.id;
        const fieldName = options.args.field;
        const fieldType = options.args.type || 'string';
        let fieldValue: unknown = options.args.value;

        if (!componentId || !fieldName) {
          console.error('Error: --id and --field are required');
          process.exit(1);
        }

        // Parse value based on type
        switch (fieldType) {
          case 'bool':
            fieldValue = fieldValue === 'true';
            break;
          case 'int':
          case 'float':
          case 'double':
            fieldValue = parseFloat(fieldValue as string);
            break;
          case 'float3':
            const [x, y, z] = (fieldValue as string).split(',').map(Number);
            fieldValue = { x, y, z };
            break;
          case 'color':
            const [r, g, b, a] = (fieldValue as string).split(',').map(Number);
            fieldValue = { r, g, b, a: a ?? 1 };
            break;
        }

        const members: Record<string, unknown> = {
          [fieldName]: {
            $type: fieldType,
            value: fieldValue,
          },
        };

        const response = await client.updateComponent({
          id: componentId,
          members: members as Record<string, Member>,
        });

        if (response.success) {
          console.log(`Field ${fieldName} set to ${JSON.stringify(fieldValue)}`);
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      case 'find': {
        const name = options.args.name;
        if (!name) {
          console.error('Error: --name is required');
          process.exit(1);
        }

        const startId = options.args.start || ROOT_SLOT_ID;
        const depth = parseInt(options.args.depth ?? '-1', 10);

        const slot = await client.findSlotByName(name, startId, depth);

        if (slot) {
          console.log(formatSlot(slot));
        } else {
          console.log(`Slot with name "${name}" not found`);
          process.exit(1);
        }
        break;
      }

      case 'tree': {
        const slotId = options.args.id || ROOT_SLOT_ID;
        const depth = parseInt(options.args.depth ?? '2', 10);

        const response = await client.getSlot({
          slotId,
          depth,
          includeComponentData: false,
        });

        if (response.success) {
          printTree(response.data, 0);
        } else {
          console.error('Error:', response.errorInfo);
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${options.command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Connection error:', (error as Error).message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

function printTree(slot: Slot, indent: number): void {
  const prefix = '  '.repeat(indent);
  const name = slot.name?.value ?? '(unnamed)';
  const id = slot.id ? ` [${slot.id}]` : '';

  if (slot.isReferenceOnly) {
    console.log(`${prefix}├─ (ref) ${name}${id}`);
  } else {
    console.log(`${prefix}├─ ${name}${id}`);

    if (slot.children) {
      for (const child of slot.children) {
        printTree(child, indent + 1);
      }
    }
  }
}

function printHelp(): void {
  console.log(`
ResoniteLink CLI - Control Resonite from the command line

Usage: resonitelink <command> [options]

=== Slot Commands ===
  root, get-root     Get the root slot
    --depth <n>        Hierarchy depth (default: 1)
    --components       Include component data

  get, get-slot      Get a specific slot
    --id <slotId>      Slot ID (required)
    --depth <n>        Hierarchy depth (default: 0)
    --components       Include component data

  add, add-slot      Create a new slot
    --parent <id>      Parent slot ID (default: Root)
    --name <name>      Slot name (default: NewSlot)
    --position <x,y,z> Position (e.g., 0,1,0)
    --scale <x,y,z>    Scale (e.g., 1,1,1)
    --active <bool>    Is active (default: true)

  update, update-slot Update an existing slot
    --id <slotId>      Slot ID (required)
    --name <name>      New name
    --position <x,y,z> New position
    --scale <x,y,z>    New scale
    --active <bool>    Set active state

  remove, remove-slot Remove a slot
    --id <slotId>      Slot ID (required)

  find               Find a slot by name
    --name <name>      Slot name to find (required)
    --start <id>       Start slot ID (default: Root)
    --depth <n>        Search depth (default: -1, unlimited)

  tree               Show slot hierarchy tree
    --id <slotId>      Start slot ID (default: Root)
    --depth <n>        Tree depth (default: 2)

=== Component Commands ===
  get-component      Get component data
    --id <compId>      Component ID (required)

  add-component      Add a component to a slot
    --slot <slotId>    Container slot ID (required)
    --type <type>      Component type (required)

  remove-component   Remove a component
    --id <compId>      Component ID (required)

=== Decompile Search Commands ===
  search, search-component  Search for components by name
    --query, --name <q>     Search query (required)
    --max <n>               Max results (default: 20)

  info, component-info      Get detailed component info
    --name <name>           Component name (required)

  category, search-category Search components by category
    --category <cat>        Category name (required)
    --max <n>               Max results (default: 50)

  categories, list-categories List all component categories

  member, search-member     Search components by member name
    --member, --name <m>    Member name to search (required)
    --max <n>               Max results (default: 30)

  grep, search-all          Search all source files
    --query, --q <query>    Search query (required)
    --max <n>               Max results (default: 30)

  source                    Get full source code of a component
    --name <name>           Component name (required)

  help               Show this help message

Global Options:
  --url, -u <url>    WebSocket URL (default: ws://localhost:9080)
                     Can also be set via RESONITELINK_URL env var

Examples:
  resonitelink root --depth 2
  resonitelink get --id S-12345 --components
  resonitelink add --parent Root --name "My Slot" --position 0,1,0
  resonitelink find --name "Player"
  resonitelink tree --depth 3

  # Decompile search examples:
  resonitelink search --query Mesh
  resonitelink info --name BoxMesh
  resonitelink category --category "Assets/Materials"
  resonitelink categories
  resonitelink member --member Smoothness
  resonitelink grep --query "AlbedoColor"
  resonitelink source --name PBS_Metallic
`);
}

main();

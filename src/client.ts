import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  Response,
  SlotDataResponse,
  ComponentDataResponse,
  GetSlotMessage,
  AddSlotMessage,
  UpdateSlotMessage,
  RemoveSlotMessage,
  GetComponentMessage,
  AddComponentMessage,
  UpdateComponentMessage,
  RemoveComponentMessage,
  Slot,
  Component,
  GetSlotOptions,
  AddSlotOptions,
  UpdateSlotOptions,
  AddComponentOptions,
  UpdateComponentOptions,
  ROOT_SLOT_ID,
} from './types';

export interface ResoniteLinkClientOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

type PendingRequest = {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

export class ResoniteLinkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnected = false;
  private reconnecting = false;

  constructor(options: ResoniteLinkClientOptions) {
    this.url = options.url;
    this.autoReconnect = options.autoReconnect ?? false;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnecting = false;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.rejectAllPending(new Error('Connection closed'));

        if (this.autoReconnect && !this.reconnecting) {
          this.reconnecting = true;
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      });

      this.ws.on('error', (error) => {
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const response = JSON.parse(data.toString()) as Response;
      const pending = this.pendingRequests.get(response.sourceMessageId);

      if (pending) {
        this.pendingRequests.delete(response.sourceMessageId);
        pending.resolve(response);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private async sendMessage<T extends Response>(message: Message): Promise<T> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.messageId, {
        resolve: resolve as (response: Response) => void,
        reject,
      });

      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          this.pendingRequests.delete(message.messageId);
          reject(error);
        }
      });
    });
  }

  // ============================================
  // Slot API
  // ============================================

  async getSlot(options: GetSlotOptions): Promise<SlotDataResponse> {
    const message: GetSlotMessage = {
      $type: 'getSlot',
      messageId: uuidv4(),
      slotId: options.slotId,
      depth: options.depth ?? 0,
      includeComponentData: options.includeComponentData ?? false,
    };

    return this.sendMessage<SlotDataResponse>(message);
  }

  async getRootSlot(depth = 0, includeComponentData = false): Promise<SlotDataResponse> {
    return this.getSlot({
      slotId: ROOT_SLOT_ID,
      depth,
      includeComponentData,
    });
  }

  async addSlot(options: AddSlotOptions): Promise<Response> {
    const slotData: Slot = {};

    if (options.parentId) {
      slotData.parent = { targetId: options.parentId };
    }
    if (options.name !== undefined) {
      slotData.name = { value: options.name };
    }
    if (options.position) {
      slotData.position = { value: options.position };
    }
    if (options.rotation) {
      slotData.rotation = { value: options.rotation };
    }
    if (options.scale) {
      slotData.scale = { value: options.scale };
    }
    if (options.isActive !== undefined) {
      slotData.isActive = { value: options.isActive };
    }
    if (options.isPersistent !== undefined) {
      slotData.isPersistent = { value: options.isPersistent };
    }
    if (options.tag !== undefined) {
      slotData.tag = { value: options.tag };
    }

    const message: AddSlotMessage = {
      $type: 'addSlot',
      messageId: uuidv4(),
      data: slotData,
    };

    return this.sendMessage<Response>(message);
  }

  async updateSlot(options: UpdateSlotOptions): Promise<Response> {
    const slotData: Slot = {
      id: options.id,
    };

    if (options.name !== undefined) {
      slotData.name = { value: options.name };
    }
    if (options.position) {
      slotData.position = { value: options.position };
    }
    if (options.rotation) {
      slotData.rotation = { value: options.rotation };
    }
    if (options.scale) {
      slotData.scale = { value: options.scale };
    }
    if (options.isActive !== undefined) {
      slotData.isActive = { value: options.isActive };
    }
    if (options.isPersistent !== undefined) {
      slotData.isPersistent = { value: options.isPersistent };
    }
    if (options.tag !== undefined) {
      slotData.tag = { value: options.tag };
    }

    const message: UpdateSlotMessage = {
      $type: 'updateSlot',
      messageId: uuidv4(),
      data: slotData,
    };

    return this.sendMessage<Response>(message);
  }

  async removeSlot(slotId: string): Promise<Response> {
    const message: RemoveSlotMessage = {
      $type: 'removeSlot',
      messageId: uuidv4(),
      slotId,
    };

    return this.sendMessage<Response>(message);
  }

  // ============================================
  // Component API
  // ============================================

  async getComponent(componentId: string): Promise<ComponentDataResponse> {
    const message: GetComponentMessage = {
      $type: 'getComponent',
      messageId: uuidv4(),
      componentId,
    };

    return this.sendMessage<ComponentDataResponse>(message);
  }

  async addComponent(options: AddComponentOptions): Promise<Response> {
    const componentData: Component = {
      componentType: options.componentType,
      members: options.members,
    };

    const message: AddComponentMessage = {
      $type: 'addComponent',
      messageId: uuidv4(),
      containerSlotId: options.containerSlotId,
      data: componentData,
    };

    return this.sendMessage<Response>(message);
  }

  async updateComponent(options: UpdateComponentOptions): Promise<Response> {
    const componentData: Component = {
      id: options.id,
      members: options.members,
    };

    const message: UpdateComponentMessage = {
      $type: 'updateComponent',
      messageId: uuidv4(),
      data: componentData,
    };

    return this.sendMessage<Response>(message);
  }

  async removeComponent(componentId: string): Promise<Response> {
    const message: RemoveComponentMessage = {
      $type: 'removeComponent',
      messageId: uuidv4(),
      componentId,
    };

    return this.sendMessage<Response>(message);
  }

  // ============================================
  // Utility Methods
  // ============================================

  async findSlotByName(
    name: string,
    startSlotId = ROOT_SLOT_ID,
    depth = -1
  ): Promise<Slot | null> {
    const response = await this.getSlot({
      slotId: startSlotId,
      depth,
      includeComponentData: false,
    });

    if (!response.success) {
      return null;
    }

    return this.findSlotByNameRecursive(response.data, name);
  }

  private findSlotByNameRecursive(slot: Slot, name: string): Slot | null {
    if (slot.name?.value === name) {
      return slot;
    }

    if (slot.children) {
      for (const child of slot.children) {
        const found = this.findSlotByNameRecursive(child, name);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  async getSlotHierarchy(slotId: string, depth = 1): Promise<Slot | null> {
    const response = await this.getSlot({
      slotId,
      depth,
      includeComponentData: true,
    });

    return response.success ? response.data : null;
  }
}

export default ResoniteLinkClient;

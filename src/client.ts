import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import {
  Message,
  Response,
  SlotDataResponse,
  ComponentDataResponse,
  AssetDataResponse,
  GetSlotMessage,
  AddSlotMessage,
  UpdateSlotMessage,
  RemoveSlotMessage,
  GetComponentMessage,
  AddComponentMessage,
  UpdateComponentMessage,
  RemoveComponentMessage,
  ImportTexture2DFileMessage,
  ImportTexture2DRawDataMessage,
  Slot,
  Component,
  GetSlotOptions,
  AddSlotOptions,
  UpdateSlotOptions,
  AddComponentOptions,
  UpdateComponentOptions,
  ImportTexture2DFileOptions,
  ImportTexture2DRawDataOptions,
  ROOT_SLOT_ID,
} from './types.js';

export interface ResoniteLinkClientOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  debug?: boolean;
  logFile?: string;
  requestTimeout?: number;
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
  private debug: boolean;
  private logFile: string | null;
  private logStream: fs.WriteStream | null = null;
  private requestTimeout: number;

  constructor(options: ResoniteLinkClientOptions) {
    this.url = options.url;
    this.autoReconnect = options.autoReconnect ?? false;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
    this.debug = options.debug ?? false;
    this.logFile = options.logFile ?? null;
    this.requestTimeout = options.requestTimeout ?? 30000; // Default 30s timeout

    if (this.logFile) {
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      this.log('=== Session started ===');
    }
  }

  private log(message: string, data?: any): void {
    if (!this.debug && !this.logStream) return;

    const timestamp = new Date().toISOString();
    const logLine = data
      ? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] ${message}`;

    if (this.debug) {
      console.log(logLine);
    }

    if (this.logStream) {
      this.logStream.write(logLine + '\n');
    }
  }

  private logError(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const errorDetail = error instanceof Error ? error.message : JSON.stringify(error);
    const logLine = `[${timestamp}] ERROR: ${message} - ${errorDetail}`;

    console.error(logLine);

    if (this.logStream) {
      this.logStream.write(logLine + '\n');
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    this.log(`Connecting to ${this.url}`);
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnecting = false;
        this.log('Connected successfully');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.log('Connection closed');
        this.isConnected = false;
        this.rejectAllPending(new Error('Connection closed'));

        if (this.autoReconnect && !this.reconnecting) {
          this.reconnecting = true;
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      });

      this.ws.on('error', (error) => {
        this.logError('WebSocket error', error);
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  disconnect(): void {
    this.log('Disconnecting');
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.logStream) {
      this.log('=== Session ended ===');
      this.logStream.end();
      this.logStream = null;
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const response = JSON.parse(data.toString()) as Response;
      const pending = this.pendingRequests.get(response.sourceMessageId);

      // Log response
      this.log('RECV', { success: response.success, messageId: response.sourceMessageId, error: response.errorInfo });

      if (!response.success && response.errorInfo) {
        this.logError(`Response error for ${response.sourceMessageId}`, response.errorInfo);
      }

      if (pending) {
        this.pendingRequests.delete(response.sourceMessageId);
        pending.resolve(response);
      }
    } catch (error) {
      this.logError('Failed to parse message', error);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private async sendMessage<T extends Response>(message: Message, binaryPayload?: Buffer): Promise<T> {
    if (!this.ws || !this.isConnected) {
      this.logError('Send failed - not connected', message.$type);
      throw new Error('Not connected');
    }

    // Log the message being sent (truncate large data)
    const logMessage: any = { $type: message.$type, messageId: message.messageId };
    if ('slotId' in message) logMessage.slotId = (message as any).slotId;
    if ('componentType' in message) logMessage.componentType = (message as any).componentType;
    if ('containerSlotId' in message) logMessage.containerSlotId = (message as any).containerSlotId;
    if ('id' in message) logMessage.id = (message as any).id;
    if ('filePath' in message) logMessage.filePath = (message as any).filePath;
    if (binaryPayload) logMessage.binaryPayloadSize = binaryPayload.length;
    this.log('SEND', logMessage);

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(message.messageId)) {
          this.pendingRequests.delete(message.messageId);
          const error = new Error(`Request timeout after ${this.requestTimeout}ms: ${message.$type} (${message.messageId})`);
          this.logError('Request timeout', { messageId: message.messageId, type: message.$type });
          reject(error);
        }
      }, this.requestTimeout);

      this.pendingRequests.set(message.messageId, {
        resolve: (response: Response) => {
          clearTimeout(timeoutId);
          resolve(response as T);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      // Send JSON message
      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.logError('Send error', error);
          this.pendingRequests.delete(message.messageId);
          reject(error);
          return;
        }

        // Send binary payload if present (immediately after JSON message)
        if (binaryPayload) {
          this.ws!.send(binaryPayload, (binaryError) => {
            if (binaryError) {
              clearTimeout(timeoutId);
              this.logError('Binary payload send error', binaryError);
              this.pendingRequests.delete(message.messageId);
              reject(binaryError);
            }
          });
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
  // Asset Import API
  // ============================================

  /**
   * Import a texture from a file on the local file system (Resonite host).
   * The file must be in a format supported by Resonite (PNG, JPG, etc.).
   * @returns AssetDataResponse with the assetURL that can be assigned to static asset providers
   */
  async importTexture2DFile(options: ImportTexture2DFileOptions): Promise<AssetDataResponse> {
    const message: ImportTexture2DFileMessage = {
      $type: 'importTexture2DFile',
      messageId: uuidv4(),
      filePath: options.filePath,
    };

    return this.sendMessage<AssetDataResponse>(message);
  }

  /**
   * Import a texture from raw pixel data.
   * The raw data should be in RGBA format (4 bytes per pixel).
   * @returns AssetDataResponse with the assetURL that can be assigned to static asset providers
   */
  async importTexture2DRawData(options: ImportTexture2DRawDataOptions): Promise<AssetDataResponse> {
    const message: ImportTexture2DRawDataMessage = {
      $type: 'importTexture2DRawData',
      messageId: uuidv4(),
      width: options.width,
      height: options.height,
      colorProfile: options.colorProfile ?? 'sRGB',
    };

    return this.sendMessage<AssetDataResponse>(message, options.rawData);
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

import WebSocket from 'ws';

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
  xrot: number;
  yrot: number;
  zrot: number;
}

export interface CameraClientOptions {
  url?: string;
  timeout?: number;
}

export class CameraClient {
  private url: string;
  private timeout: number;
  private ws: WebSocket | null = null;

  constructor(options: CameraClientOptions = {}) {
    this.url = options.url || 'wss://wsecho.kokoa.dev/mcp/cam';
    this.timeout = options.timeout || 10000;
  }

  private async sendCommand(command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let responded = false;

      const timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          ws.close();
          reject(new Error('Timeout waiting for response'));
        }
      }, this.timeout);

      ws.on('open', () => {
        ws.send(command);
      });

      ws.on('message', (data) => {
        const message = data.toString();
        // Skip echo
        if (message === command) {
          return;
        }
        // Parse response
        try {
          const response = JSON.parse(message);
          responded = true;
          clearTimeout(timer);
          ws.close();
          resolve(response);
        } catch {
          // Not JSON, skip
        }
      });

      ws.on('error', (err) => {
        if (!responded) {
          responded = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /**
   * Get current camera availability status
   */
  async getCamera(): Promise<{ cameraAvailable: boolean }> {
    return this.sendCommand('getCamera()');
  }

  /**
   * Set camera position and rotation
   * @param x X position
   * @param y Y position
   * @param z Z position
   * @param xrot X rotation (degrees)
   * @param yrot Y rotation (degrees)
   * @param zrot Z rotation (degrees)
   */
  async setCamera(
    x: number,
    y: number,
    z: number,
    xrot: number,
    yrot: number,
    zrot: number
  ): Promise<{ success: boolean }> {
    return this.sendCommand(`setCamera(${x}, ${y}, ${z}, ${xrot}, ${yrot}, ${zrot})`);
  }

  /**
   * Set camera from position object
   */
  async setCameraPosition(pos: CameraPosition): Promise<{ success: boolean }> {
    return this.setCamera(pos.x, pos.y, pos.z, pos.xrot, pos.yrot, pos.zrot);
  }

  /**
   * Take a photo and return the URL
   * Note: This may take several seconds
   */
  async takePhoto(): Promise<{ uploadedImageUrl: string }> {
    // Use longer timeout for photo
    const originalTimeout = this.timeout;
    this.timeout = Math.max(this.timeout, 30000);

    try {
      const response = await this.sendCommand('takePhoto()');
      // Clean up URL format if needed
      if (response.uploadedImageUrl && response.uploadedImageUrl.startsWith('URL:')) {
        response.uploadedImageUrl = response.uploadedImageUrl.substring(4);
      }
      return response;
    } finally {
      this.timeout = originalTimeout;
    }
  }
}

export default CameraClient;

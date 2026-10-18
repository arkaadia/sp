import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AssetMetadata } from '../types/sprites';

const ASSETS_DIR = path.join(process.cwd(), 'data/assets');
const METADATA_FILE = path.join(ASSETS_DIR, 'metadata.json');

export class AssetLibrary {
  static async init() {
    try {
      await fs.access(ASSETS_DIR);
    } catch {
      await fs.mkdir(ASSETS_DIR, { recursive: true });
    }
    try {
      await fs.access(METADATA_FILE);
    } catch {
      await fs.writeFile(METADATA_FILE, JSON.stringify([]));
    }
  }

  static async getAssets(): Promise<AssetMetadata[]> {
    await this.init();
    try {
      const data = await fs.readFile(METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to read assets metadata:', err);
      return [];
    }
  }

  static async saveAsset(metadata: Omit<AssetMetadata, 'id' | 'creationTimestamp' | 'assetLocation'>, imageBuffer: Buffer): Promise<AssetMetadata> {
    await this.init();
    const id = uuidv4();
    const filename = `${id}.png`;
    const assetLocation = `/api/assets/images/${filename}`;
    const physicalPath = path.join(ASSETS_DIR, filename);
    const creationTimestamp = new Date().toISOString();

    const fullMetadata: AssetMetadata = {
      ...metadata,
      id,
      creationTimestamp,
      assetLocation,
    };

    await fs.writeFile(physicalPath, imageBuffer);

    const assets = await this.getAssets();
    assets.push(fullMetadata);
    await fs.writeFile(METADATA_FILE, JSON.stringify(assets, null, 2));

    return fullMetadata;
  }
}

import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { AssetLibrary } from './src/utils/AssetLibrary';

describe('Asset Library', () => {
  it('should save and get assets', async () => {
    // Clear out data if testing locally or assume clean env
    const mockImageBuffer = Buffer.from('mock image data');
    const assetMetadata = {
      name: 'Test Character',
      prompt: 'A test prompt',
      provider: 'TestProvider',
      model: 'test-model',
      generationSettings: {},
      imageDimensions: { width: 100, height: 100 },
    };

    const savedAsset = await AssetLibrary.saveAsset(assetMetadata, mockImageBuffer);
    assert.ok(savedAsset.id);
    assert.strictEqual(savedAsset.name, 'Test Character');

    const assets = await AssetLibrary.getAssets();
    assert.ok(assets.length > 0);
    const found = assets.find(a => a.id === savedAsset.id);
    assert.ok(found);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getProvider, getProviders } from './src/utils/providers';

describe('Provider Abstraction', () => {
  it('should list OpenAI as a provider', () => {
    const providers = getProviders();
    assert.ok(providers.length > 0);
    const openai = providers.find(p => p.id === 'openai');
    assert.ok(openai);
  });

  it('should retrieve a provider by ID', () => {
    const provider = getProvider('openai');
    assert.ok(provider);
    assert.strictEqual(provider?.name, 'OpenAI (DALL-E)');
  });

  it('should have verifyConnection defined', () => {
    const provider = getProvider('openai');
    assert.strictEqual(typeof provider?.verifyConnection, 'function');
  });

  it('should have generateImage defined', () => {
    const provider = getProvider('openai');
    assert.strictEqual(typeof provider?.generateImage, 'function');
  });
});

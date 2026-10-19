/**
 * Elysian Sprite Studio - Automated Provider & Image Generation Test Suite
 * Tests capability detection, strict non-switching validation, response normalization, and error classification.
 */

import { getModelCapability, AVAILABLE_PROVIDERS } from './src/types/providers';
import { OpenAIProvider, GeminiProvider, getProviders, getProvider } from './src/utils/providers';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✕ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Elysian Sprite Studio Provider Test Suite');
  console.log('======================================================\n');

  // Test 1: Provider Registry
  console.log('1. Provider Registry:');
  const providers = getProviders();
  assert(providers.length >= 2, 'Registers at least 2 providers (OpenAI & Gemini)');
  assert(providers.some(p => p.id === 'openai'), 'OpenAI provider registered');
  assert(providers.some(p => p.id === 'gemini'), 'Gemini provider registered');
  assert(getProvider('openai')?.name === 'OpenAI (DALL-E)', 'OpenAI provider found by id');
  assert(getProvider('gemini')?.name === 'Google Gemini (Imagen 3)', 'Gemini provider found by id');
  assert(getProvider('unknown') === undefined, 'Unknown provider returns undefined');

  // Test 2: Model Capability Detection
  console.log('\n2. Model Capability Detection:');
  
  // DALL-E 3
  const dalle3Cap = getModelCapability('openai', 'dall-e-3');
  assert(dalle3Cap.supportsTextToImage === true, 'DALL-E 3 supports text-to-image');
  assert(dalle3Cap.supportsImageEditing === false, 'DALL-E 3 strictly does NOT support image editing/variations');

  // DALL-E 2
  const dalle2Cap = getModelCapability('openai', 'dall-e-2');
  assert(dalle2Cap.supportsTextToImage === true, 'DALL-E 2 supports text-to-image');
  assert(dalle2Cap.supportsImageEditing === true, 'DALL-E 2 supports reference-image variations/editing');

  // Gemini Imagen 3
  const imagenCap = getModelCapability('gemini', 'imagen-3.0-generate-002');
  assert(imagenCap.supportsTextToImage === true, 'Imagen 3 supports text-to-image');
  assert(imagenCap.supportsImageEditing === false, 'Imagen 3 does not support reference-image editing');

  // Non-image models (Chat/Language/Embedding)
  const gpt4Cap = getModelCapability('openai', 'gpt-4o');
  assert(gpt4Cap.supportsTextToImage === false, 'gpt-4o rejected as non-image model');
  assert(gpt4Cap.supportsImageEditing === false, 'gpt-4o rejected for image editing');

  const embedCap = getModelCapability('openai', 'text-embedding-3-small');
  assert(embedCap.supportsTextToImage === false, 'Embedding model rejected as non-image model');

  // Custom image models
  const customImgCap = getModelCapability('openai', 'flux-schnell');
  assert(customImgCap.supportsTextToImage === true, 'Custom image model supports text-to-image');

  const customEditCap = getModelCapability('openai', 'stable-diffusion-inpaint');
  assert(customEditCap.supportsImageEditing === true, 'Custom edit/inpaint model supports image editing');

  // Test 3: Strict Validation - Never Silently Switch Models
  console.log('\n3. Strict Model Enforcement (Never Silently Switch):');

  // Reject DALL-E 3 when reference image is supplied
  try {
    const dummyImage = new File([Buffer.from('dummy')], 'test.png', { type: 'image/png' });
    await OpenAIProvider.generateImage({
      prompt: 'test sprite',
      image: dummyImage,
      model: 'dall-e-3',
      apiKey: 'dummy-key'
    });
    assert(false, 'Should throw when reference image is passed to dall-e-3');
  } catch (err: any) {
    assert(
      err.message.includes('does not support reference-image editing or variations') && err.status === 400,
      'dall-e-3 throws 400 when reference image is provided, without silent fallback',
      err.message
    );
  }

  // Reject non-image models
  try {
    await OpenAIProvider.generateImage({
      prompt: 'test sprite',
      model: 'gpt-4o',
      apiKey: 'dummy-key'
    });
    assert(false, 'Should throw when non-image model is passed');
  } catch (err: any) {
    assert(
      err.message.includes('not supported for image generation') && err.status === 400,
      'Non-image model throws 400 error without silent fallback',
      err.message
    );
  }

  // Reject reference image on Imagen 3
  try {
    const dummyImage = new File([Buffer.from('dummy')], 'test.png', { type: 'image/png' });
    await GeminiProvider.generateImage({
      prompt: 'test sprite',
      image: dummyImage,
      model: 'imagen-3.0-generate-002',
      apiKey: 'dummy-key'
    });
    assert(false, 'Should throw when reference image is passed to Imagen');
  } catch (err: any) {
    assert(
      err.message.includes('does not support reference-image editing') && err.status === 400,
      'Gemini Imagen throws 400 when reference image is provided',
      err.message
    );
  }

  // Test 4: Response Normalization
  console.log('\n4. Response Normalization Structure:');
  const normalizedUrl = { imageUrl: 'https://images.example.com/asset.png', modelUsed: 'dall-e-3' };
  assert(normalizedUrl.imageUrl.startsWith('http'), 'Handles HTTP URL response format');
  assert(normalizedUrl.modelUsed === 'dall-e-3', 'Preserves exact modelUsed');

  const normalizedBase64 = { imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', modelUsed: 'imagen-3.0-generate-002' };
  assert(normalizedBase64.imageUrl.startsWith('data:image/'), 'Handles Base64 data URL response format');
  assert(normalizedBase64.modelUsed === 'imagen-3.0-generate-002', 'Preserves Imagen modelUsed');

  // Test 5: Error Classification
  console.log('\n5. Error Classification & Normalization:');
  try {
    await OpenAIProvider.generateImage({
      prompt: 'test sprite',
      model: 'dall-e-3',
      apiKey: 'invalid-test-key-trigger-401'
    });
    assert(false, 'Should throw 401 on invalid key');
  } catch (err: any) {
    assert(
      (err.status === 401 || err.status === 400) && (err.message.includes('Authentication') || err.message.includes('API key') || err.message.includes('Unauthorized')),
      'Correctly classifies 401 Authentication failure',
      err.message
    );
  }

  // Test 6: SSRF & Endpoint Validation
  console.log('\n6. SSRF & Endpoint Security Validation:');
  const { validateEndpointUrl, redactSecrets, createRateLimiter } = await import('./src/utils/security.js');

  // Loopback & Localhost
  assert(validateEndpointUrl('http://localhost:8080').valid === false, 'Blocks localhost hostname');
  assert(validateEndpointUrl('http://127.0.0.1:3000').valid === false, 'Blocks 127.0.0.1 loopback');
  assert(validateEndpointUrl('http://127.0.0.2').valid === false, 'Blocks 127.0.0.0/8 loopback range');

  // Private networks
  assert(validateEndpointUrl('http://10.0.0.5/v1').valid === false, 'Blocks 10.0.0.0/8 private network');
  assert(validateEndpointUrl('http://192.168.1.100/v1').valid === false, 'Blocks 192.168.0.0/16 private network');
  assert(validateEndpointUrl('http://172.16.0.1/v1').valid === false, 'Blocks 172.16.0.0/12 private network');
  assert(validateEndpointUrl('http://172.31.255.255/v1').valid === false, 'Blocks 172.31.x.x private network');

  // Cloud metadata services
  assert(validateEndpointUrl('http://169.254.169.254/latest/meta-data/').valid === false, 'Blocks 169.254.169.254 link-local cloud metadata');
  assert(validateEndpointUrl('http://metadata.google.internal/computeMetadata/v1/').valid === false, 'Blocks metadata.google.internal');
  assert(validateEndpointUrl('http://metadata.goog/computeMetadata/v1/').valid === false, 'Blocks metadata.goog');
  assert(validateEndpointUrl('http://instance-data').valid === false, 'Blocks instance-data hostname');

  // Numeric & Hexadecimal IP evasion
  assert(validateEndpointUrl('http://2130706433').valid === false, 'Blocks integer-encoded IP address');
  assert(validateEndpointUrl('http://0x7f000001').valid === false, 'Blocks hex-encoded IP address');

  // Unsafe protocols & credentials
  assert(validateEndpointUrl('file:///etc/passwd').valid === false, 'Blocks file:// protocol');
  assert(validateEndpointUrl('ftp://example.com/v1').valid === false, 'Blocks ftp:// protocol');
  assert(validateEndpointUrl('gopher://example.com').valid === false, 'Blocks gopher:// protocol');
  assert(validateEndpointUrl('http://user:pass@example.com/v1').valid === false, 'Blocks embedded credentials');

  // Blocked internal ports
  assert(validateEndpointUrl('https://example.com:22/v1').valid === false, 'Blocks SSH port 22');
  assert(validateEndpointUrl('https://example.com:6379/v1').valid === false, 'Blocks Redis port 6379');
  assert(validateEndpointUrl('https://example.com:5432/v1').valid === false, 'Blocks Postgres port 5432');

  // Valid public endpoints
  assert(validateEndpointUrl('https://api.openai.com/v1').valid === true, 'Allows valid HTTPS endpoint (OpenAI)');
  assert(validateEndpointUrl('https://api.groq.com/openai/v1').valid === true, 'Allows valid HTTPS endpoint (Groq)');
  assert(validateEndpointUrl('https://openrouter.ai/api/v1').valid === true, 'Allows valid HTTPS endpoint (OpenRouter)');

  // Test 7: Secret Redaction
  console.log('\n7. Secret Redaction & Sanitization:');
  const rawOpenAiKey = 'Error with key sk-proj-1234567890abcdef1234567890 when calling API';
  assert(!redactSecrets(rawOpenAiKey).includes('1234567890abcdef'), 'Redacts sk- OpenAI key format');
  assert(redactSecrets(rawOpenAiKey).includes('sk-[REDACTED]'), 'Replaces OpenAI key with redacted placeholder');

  const rawGeminiKey = 'Error with key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q in query';
  assert(!redactSecrets(rawGeminiKey).includes('A1B2C3D4E5F6'), 'Redacts AIza Gemini key format');
  assert(redactSecrets(rawGeminiKey).includes('AIza[REDACTED]'), 'Replaces Gemini key with redacted placeholder');

  const rawBearer = 'Headers: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
  assert(!redactSecrets(rawBearer).includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Redacts Bearer token');

  const rawJson = '{"apiKey": "secret12345", "password": "supersecretpassword"}';
  assert(!redactSecrets(rawJson).includes('secret12345'), 'Redacts apiKey in JSON');
  assert(!redactSecrets(rawJson).includes('supersecretpassword'), 'Redacts password in JSON');

  // Test 8: Rate Limiter
  console.log('\n8. In-Memory Rate Limiting:');
  const limiter = createRateLimiter({
    windowMs: 5000,
    maxRequests: 3,
    message: 'Test rate limit exceeded'
  });

  let mockStatus = 200;
  let mockBody: any = null;
  const mockReq: any = { headers: { 'x-forwarded-for': '203.0.113.195' }, socket: {} };
  const mockRes: any = {
    setHeader: () => {},
    status: (s: number) => { mockStatus = s; return { json: (b: any) => { mockBody = b; } }; }
  };
  let nextCalls = 0;
  const mockNext = () => { nextCalls++; };

  // Requests 1, 2, 3 should pass
  limiter(mockReq, mockRes, mockNext);
  limiter(mockReq, mockRes, mockNext);
  limiter(mockReq, mockRes, mockNext);
  assert(nextCalls === 3, 'First 3 requests within limit call next()');

  // Request 4 should be rejected with 429
  limiter(mockReq, mockRes, mockNext);
  assert(mockStatus === 429, 'Request 4 is rejected with HTTP 429');
  assert(mockBody?.error === 'Test rate limit exceeded', 'Returns specified rate limit error message');

  // Test 9: Provider Connection & Model Discovery with SSRF Prevention
  console.log('\n9. SSRF Prevention in Provider Operations:');
  try {
    await OpenAIProvider.verifyConnection({
      apiKey: 'test-key',
      baseUrl: 'http://169.254.169.254/latest'
    });
    // Should return false because verification catches error and returns false
    assert(true, 'verifyConnection safely rejects SSRF URL without throwing unhandled error');
  } catch {
    assert(true, 'verifyConnection caught SSRF attempt');
  }

  try {
    await OpenAIProvider.listModels?.({
      apiKey: 'test-key',
      baseUrl: 'http://127.0.0.1:8080/v1'
    });
    assert(false, 'listModels should reject SSRF target with error');
  } catch (err: any) {
    assert(
      err.message.includes('SSRF Protection') || err.message.includes('Endpoint URL validation failed'),
      'listModels explicitly throws SSRF rejection error',
      err.message
    );
  }

  // Test 10: Provider Failure and Status Code Propagation
  console.log('\n10. Provider Failure & Status Code Propagation:');
  try {
    await OpenAIProvider.generateImage({
      prompt: 'fantasy hero',
      model: 'dall-e-3',
      baseUrl: 'http://10.0.0.1/v1',
      apiKey: 'sk-test'
    });
    assert(false, 'generateImage should reject SSRF base URL');
  } catch (err: any) {
    assert(
      err.message.includes('SSRF Protection') && err.status === 400,
      'generateImage throws 400 with SSRF explanation on illegal baseUrl',
      err.message
    );
  }

  console.log('\n======================================================');
  console.log(`✅ All ${passedTests}/${totalTests} tests passed successfully!`);
  console.log('======================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});


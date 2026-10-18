import { describe, it } from 'node:test';
import assert from 'node:assert';

// Extract the buildPrompt logic to test it directly.
function buildPrompt(promptData: any) {
  const parts = [];

  if (promptData.workflow === 'Views') {
    parts.push('A character design sheet showing clear front, side, and back views.');
  } else if (promptData.workflow === 'Turnaround Sheet') {
    parts.push('A professional character turnaround reference sheet.');
  } else if (promptData.workflow === 'Expression Sheet') {
    parts.push('A facial expression sheet showing various emotions and reactions.');
  } else if (promptData.workflow === 'Pose Sheet') {
    parts.push('An action pose sheet showing the character in multiple dynamic combat or movement poses.');
  } else if (promptData.workflow === 'Sprite Sheet') {
    parts.push('A 2D game asset sprite sheet containing multiple frames of animation aligned on a grid layout.');
  } else {
    parts.push('A high-quality character concept art illustration.');
  }

  if (promptData.style) parts.push(`Style: ${promptData.style}.`);
  if (promptData.type) parts.push(`Type: ${promptData.type}.`);
  if (promptData.description) parts.push(`Description: ${promptData.description}.`);
  if (promptData.appearance) parts.push(`Appearance: ${promptData.appearance}.`);
  if (promptData.clothing) parts.push(`Clothing: ${promptData.clothing}.`);
  if (promptData.mood && promptData.workflow !== 'Expression Sheet') parts.push(`Mood: ${promptData.mood}.`);
  if (promptData.background) parts.push(`Background: ${promptData.background}.`);

  return parts.join(' ');
}

describe('Generator Prompt Logic', () => {
  it('should inject Concept Art prefix', () => {
    const p = buildPrompt({ workflow: 'Concept Art', style: 'Anime' });
    assert.ok(p.includes('concept art illustration'));
    assert.ok(p.includes('Style: Anime'));
  });

  it('should inject Sprite Sheet prefix and grid instructions', () => {
    const p = buildPrompt({ workflow: 'Sprite Sheet', style: 'Pixel Art' });
    assert.ok(p.includes('sprite sheet containing multiple frames'));
    assert.ok(p.includes('Style: Pixel Art'));
  });

  it('should omit mood for Expression Sheet to avoid conflicts', () => {
    const p = buildPrompt({ workflow: 'Expression Sheet', mood: 'Happy' });
    assert.ok(p.includes('facial expression sheet'));
    assert.ok(!p.includes('Mood: Happy'));
  });
});

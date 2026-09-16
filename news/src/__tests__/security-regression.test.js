import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

describe('client security regression', () => {
  it('references standalone local assets that exist beside the HTML file', () => {
    const assetReferences = [...indexHtml.matchAll(/(?:href|src)="(\.\/assets\/[^"?]+)"/g)]
      .map(match => match[1]);

    expect(assetReferences).toEqual(expect.arrayContaining([
      './assets/app.css',
      './assets/app.js',
    ]));
    for (const assetReference of assetReferences) {
      expect(fs.existsSync(path.resolve(projectRoot, assetReference))).toBe(true);
    }
  });

  it('has no third-party runtime scripts or inline event handlers', () => {
    expect(indexHtml).not.toMatch(/cdn\.tailwindcss\.com/);
    expect(indexHtml).not.toMatch(/\son(?:click|change|input)=/i);
    expect(indexHtml).not.toMatch(/<script(?![^>]+src=)[^>]*>/i);
  });

  it('restricts scripts and AI provider connections through CSP', () => {
    expect(indexHtml).toContain("script-src 'self'");
    expect(indexHtml).toContain('https://api.groq.com');
    expect(indexHtml).not.toContain('https://generativelanguage.googleapis.com');
    expect(indexHtml).toContain("object-src 'none'");
  });
});

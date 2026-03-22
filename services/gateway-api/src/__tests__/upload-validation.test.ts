import { describe, expect, it } from '@jest/globals';
import {
  estimateBase64DecodedBytes,
  isLikelyBase64,
} from '../lib/upload-validation.js';

describe('upload validation helpers', () => {
  it('estimates decoded size from base64 length', () => {
    const raw = Buffer.from('hello world', 'utf8');
    const encoded = raw.toString('base64');
    expect(estimateBase64DecodedBytes(encoded)).toBe(raw.length);
  });

  it('accepts valid base64 and rejects invalid payloads', () => {
    expect(isLikelyBase64(Buffer.from('abc').toString('base64'))).toBe(true);
    expect(isLikelyBase64('not-base64***')).toBe(false);
    expect(isLikelyBase64('abcd=')).toBe(false);
  });
});

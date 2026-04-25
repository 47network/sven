import { describe, expect, it } from '@jest/globals';
import * as toolkit from '../index.js';

describe('security-toolkit barrel exports', () => {
  it('exports all top-level namespaces', () => {
    expect(toolkit).toHaveProperty('sast');
    expect(toolkit).toHaveProperty('dependencyAudit');
    expect(toolkit).toHaveProperty('secretScanner');
    expect(toolkit).toHaveProperty('infraScanner');
    expect(toolkit).toHaveProperty('pentest');
    expect(toolkit).toHaveProperty('report');
  });
});

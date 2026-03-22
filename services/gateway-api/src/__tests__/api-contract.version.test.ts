import { API_CONTRACT_HEADER, API_CONTRACT_SURFACES, API_CONTRACT_VERSION } from '../contracts/api-contract';

describe('api contract version metadata', () => {
  it('uses a stable versioned contract identifier', () => {
    expect(API_CONTRACT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
  });

  it('defines expected compatibility surfaces', () => {
    expect(Array.isArray(API_CONTRACT_SURFACES)).toBe(true);
    expect(API_CONTRACT_SURFACES.length).toBeGreaterThanOrEqual(5);
    expect(API_CONTRACT_SURFACES).toEqual(
      expect.arrayContaining(['auth', 'chat', 'approvals', 'admin', 'stats']),
    );
  });

  it('exposes a deterministic response header name', () => {
    expect(API_CONTRACT_HEADER).toBe('x-sven-contract-version');
  });
});

import { describe, expect, it } from '@jest/globals';
import { applyQuantumFade, applyTemporalDecay } from '../services/MemoryStore';

describe('Quantum fade decay', () => {
  it('returns near-1.0 for freshly created memories', () => {
    const score = applyQuantumFade(1.0, 0, 0.05, 0.3, 0.5, 0, 0, 0.2);
    // At t=0: e^(0) * (1 + 0.3*sin(0)) = 1 * 1 = 1
    expect(score).toBeCloseTo(1.0, 4);
  });

  it('decays over time with oscillation', () => {
    const day0 = applyQuantumFade(1.0, 0, 0.05, 0.3, 0.5, 0, 0, 0.2);
    const day10 = applyQuantumFade(1.0, 10, 0.05, 0.3, 0.5, 0, 0, 0.2);
    const day30 = applyQuantumFade(1.0, 30, 0.05, 0.3, 0.5, 0, 0, 0.2);

    expect(day0).toBeGreaterThan(day10);
    expect(day10).toBeGreaterThan(day30);
    expect(day30).toBeGreaterThan(0);
  });

  it('importance-weighted persistence slows decay for referenced memories', () => {
    const noRefs = applyQuantumFade(1.0, 30, 0.05, 0.3, 0.5, 0, 0, 0.2);
    const fiveRefs = applyQuantumFade(1.0, 30, 0.05, 0.3, 0.5, 0, 5, 0.2);
    const twentyRefs = applyQuantumFade(1.0, 30, 0.05, 0.3, 0.5, 0, 20, 0.2);

    // More references → lower effective gamma → higher strength
    expect(fiveRefs).toBeGreaterThan(noRefs);
    expect(twentyRefs).toBeGreaterThan(fiveRefs);
  });

  it('gamma_effective formula is correct', () => {
    // γ_effective = γ_base * (1 / (1 + ref_count * resonance_factor))
    // With γ_base=0.05, ref_count=5, resonance_factor=0.2:
    // γ_eff = 0.05 * (1/(1+5*0.2)) = 0.05 * (1/2) = 0.025
    // At day30: e^(-0.025*30) * (1 + 0.3*sin(0.5*30+0))
    const expected = Math.exp(-0.025 * 30) * (1 + 0.3 * Math.sin(0.5 * 30));
    const actual = applyQuantumFade(1.0, 30, 0.05, 0.3, 0.5, 0, 5, 0.2);
    expect(actual).toBeCloseTo(expected, 6);
  });

  it('clamps output to [0, 1]', () => {
    // Large amplitude could push above 1.0 — verify clamping
    const clamped = applyQuantumFade(1.0, 0.1, 0.01, 0.9, 5.0, 0, 0, 0.2);
    expect(clamped).toBeLessThanOrEqual(1.0);
    expect(clamped).toBeGreaterThanOrEqual(0);
  });

  it('phase offset shifts oscillation timing', () => {
    const noPhase = applyQuantumFade(1.0, 10, 0.05, 0.3, 0.5, 0, 0, 0.2);
    const withPhase = applyQuantumFade(1.0, 10, 0.05, 0.3, 0.5, Math.PI, 0, 0.2);

    // Different phase offset → different strength at same time
    expect(noPhase).not.toBeCloseTo(withPhase, 2);
  });

  it('score multiplication preserves zero', () => {
    const result = applyQuantumFade(0, 10, 0.05, 0.3, 0.5, 0, 0, 0.2);
    expect(result).toBe(0);
  });

  it('integrates with applyTemporalDecay via quantum_fade curve', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

    const result = applyTemporalDecay(1.0, tenDaysAgo, 0.98, 'quantum_fade', 7, {
      gamma: 0.05,
      amplitude: 0.3,
      omega: 0.5,
      phase_offset: 0,
      resonance_boost_count: 3,
      resonance_factor: 0.2,
    });

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it('quantum_fade without quantumParams falls back to exponential', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

    const qfResult = applyTemporalDecay(1.0, tenDaysAgo, 0.98, 'quantum_fade');
    const expResult = applyTemporalDecay(1.0, tenDaysAgo, 0.98, 'exponential');

    // Without quantum params, quantum_fade falls through to exponential
    expect(qfResult).toBeCloseTo(expResult, 6);
  });
});

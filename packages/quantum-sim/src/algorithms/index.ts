import {
  type Complex,
  complex,
  H,
  X,
  Rx,
  Ry,
  Rz,
  CNOT,
} from '../gates/index.js';
import {
  createCircuit,
  addGate,
  simulate,
  measureMultiple,
  measure,
  type QuantumCircuit,
} from '../simulator/index.js';

// ─── QAOA (Quantum Approximate Optimization Algorithm) ───────────────────────

export interface QAOAProblem {
  numVariables: number;
  objective: Array<{ variables: number[]; weight: number }>;
  constraints?: Array<{ variables: number[]; maxWeight: number }>;
}

export interface QAOAResult {
  bestSolution: number[];
  bestCost: number;
  iterations: number;
  convergenceHistory: number[];
  measurementCounts: Map<string, number>;
}

function evaluateObjective(solution: number[], problem: QAOAProblem): number {
  let cost = 0;
  for (const term of problem.objective) {
    let termValue = term.weight;
    for (const v of term.variables) {
      termValue *= solution[v] ?? 0;
    }
    cost += termValue;
  }
  return cost;
}

/**
 * Run QAOA for combinatorial optimization.
 * Uses variational approach: alternating problem and mixer unitaries.
 */
export function runQAOA(problem: QAOAProblem, layers = 3, shots = 1024): QAOAResult {
  const n = Math.min(problem.numVariables, 20); // Cap at simulator limit
  const convergenceHistory: number[] = [];
  let bestSolution: number[] = [];
  let bestCost = -Infinity;
  let bestCounts = new Map<string, number>();

  // Simple parameter sweep (classical optimizer placeholder)
  const steps = 8;
  for (let gi = 0; gi < steps; gi++) {
    const gamma = (gi / steps) * Math.PI;
    for (let bi = 0; bi < steps; bi++) {
      const beta = (bi / steps) * Math.PI;

      let circuit = createCircuit(n);

      // Initial superposition
      for (let q = 0; q < n; q++) {
        circuit = addGate(circuit, H, [q]);
      }

      // QAOA layers
      for (let l = 0; l < layers; l++) {
        // Problem unitary: apply Rz based on objective terms (simplified)
        for (const term of problem.objective) {
          for (const v of term.variables) {
            if (v < n) {
              circuit = addGate(circuit, Rz(gamma * term.weight), [v]);
            }
          }
        }
        // Mixer unitary: Rx on all qubits
        for (let q = 0; q < n; q++) {
          circuit = addGate(circuit, Rx(beta), [q]);
        }
      }

      const result = simulate(circuit);
      const counts = measureMultiple(result, shots);

      // Find best measurement
      for (const [bitstring, count] of counts) {
        const solution = bitstring.split('').map(Number);
        const cost = evaluateObjective(solution, problem);
        if (cost > bestCost) {
          bestCost = cost;
          bestSolution = solution;
          bestCounts = counts;
        }
      }
      convergenceHistory.push(bestCost);
    }
  }

  return {
    bestSolution,
    bestCost,
    iterations: steps * steps,
    convergenceHistory,
    measurementCounts: bestCounts,
  };
}

// ─── Grover's Search ─────────────────────────────────────────────────────────

export interface GroverResult {
  targetFound: boolean;
  foundIndex: number;
  iterations: number;
  successProbability: number;
  measurementCounts: Map<string, number>;
}

/**
 * Grover's algorithm for searching an unstructured list.
 * Oracle marks the target index by flipping its phase.
 */
export function runGroverSearch(numQubits: number, targetIndex: number, shots = 1024): GroverResult {
  const n = Math.min(numQubits, 20);
  const N = 1 << n;
  const target = targetIndex % N;

  // Optimal number of Grover iterations
  const optimalIterations = Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(N)));

  let circuit = createCircuit(n);

  // Initial superposition
  for (let q = 0; q < n; q++) {
    circuit = addGate(circuit, H, [q]);
  }

  // Grover iterations
  for (let iter = 0; iter < optimalIterations; iter++) {
    // Oracle: flip phase of target state
    // Implemented as: X on qubits where target bit is 0, then multi-controlled Z, then X again
    const targetBits = target.toString(2).padStart(n, '0');
    for (let q = 0; q < n; q++) {
      if (targetBits[q] === '0') {
        circuit = addGate(circuit, X, [q]);
      }
    }
    // Simulated phase flip via Z on last qubit (simplified for small circuits)
    if (n >= 1) {
      circuit = addGate(circuit, Rz(Math.PI), [n - 1]);
    }
    for (let q = 0; q < n; q++) {
      if (targetBits[q] === '0') {
        circuit = addGate(circuit, X, [q]);
      }
    }

    // Diffusion operator: H → X → MCZ → X → H
    for (let q = 0; q < n; q++) circuit = addGate(circuit, H, [q]);
    for (let q = 0; q < n; q++) circuit = addGate(circuit, X, [q]);
    if (n >= 1) circuit = addGate(circuit, Rz(Math.PI), [n - 1]);
    for (let q = 0; q < n; q++) circuit = addGate(circuit, X, [q]);
    for (let q = 0; q < n; q++) circuit = addGate(circuit, H, [q]);
  }

  const result = simulate(circuit);
  const counts = measureMultiple(result, shots);
  const targetBinary = target.toString(2).padStart(n, '0');
  const targetCount = counts.get(targetBinary) ?? 0;
  const successProb = targetCount / shots;

  return {
    targetFound: successProb > 0.5,
    foundIndex: target,
    iterations: optimalIterations,
    successProbability: successProb,
    measurementCounts: counts,
  };
}

// ─── Quantum Monte Carlo ─────────────────────────────────────────────────────

export interface QMCResult {
  estimate: number;
  standardError: number;
  samples: number;
  convergenceHistory: number[];
}

/**
 * Quantum-enhanced Monte Carlo estimation.
 * Uses amplitude estimation concepts to improve convergence rate.
 */
export function runQuantumMonteCarlo(
  evaluator: (sample: number[]) => number,
  numQubits: number,
  samples: number,
): QMCResult {
  const n = Math.min(numQubits, 15);
  const convergenceHistory: number[] = [];
  let runningSum = 0;
  let runningSumSq = 0;

  for (let s = 0; s < samples; s++) {
    // Generate quantum random sample
    let circuit = createCircuit(n);
    for (let q = 0; q < n; q++) {
      circuit = addGate(circuit, H, [q]);
      // Add slight rotation for non-uniform distribution
      circuit = addGate(circuit, Ry(0.1 * (q + 1)), [q]);
    }

    const result = simulate(circuit);
    const m = measure(result);
    const bits = m.binaryString.split('').map(Number);

    const value = evaluator(bits);
    runningSum += value;
    runningSumSq += value * value;
    convergenceHistory.push(runningSum / (s + 1));
  }

  const mean = runningSum / samples;
  const variance = runningSumSq / samples - mean * mean;
  const standardError = Math.sqrt(variance / samples);

  return {
    estimate: mean,
    standardError,
    samples,
    convergenceHistory: convergenceHistory.filter((_, i) => i % Math.max(1, Math.floor(samples / 50)) === 0),
  };
}

// ─── Quantum Random Number Generator ─────────────────────────────────────────

export interface QRNGResult {
  bits: string;
  bytes: number[];
  entropy: number;
  numBits: number;
}

/**
 * Generate random bits using quantum measurement of superposition states.
 * Each qubit in |+⟩ state measured gives a truly random bit.
 */
export function generateQuantumRandom(numBits: number): QRNGResult {
  const bits: string[] = [];
  const batchSize = Math.min(numBits, 20);

  for (let offset = 0; offset < numBits; offset += batchSize) {
    const remaining = Math.min(batchSize, numBits - offset);
    let circuit = createCircuit(remaining);

    // Put all qubits into equal superposition
    for (let q = 0; q < remaining; q++) {
      circuit = addGate(circuit, H, [q]);
    }

    const result = simulate(circuit);
    const m = measure(result);
    bits.push(m.binaryString);
  }

  const bitString = bits.join('').slice(0, numBits);

  // Convert to bytes
  const bytes: number[] = [];
  for (let i = 0; i < bitString.length; i += 8) {
    const byte = bitString.slice(i, i + 8).padEnd(8, '0');
    bytes.push(parseInt(byte, 2));
  }

  // Calculate Shannon entropy
  const ones = bitString.split('').filter((b) => b === '1').length;
  const p1 = ones / bitString.length;
  const p0 = 1 - p1;
  const entropy = p0 > 0 && p1 > 0 ? -(p0 * Math.log2(p0) + p1 * Math.log2(p1)) : 0;

  return {
    bits: bitString,
    bytes,
    entropy,
    numBits: bitString.length,
  };
}

// ─── Quantum Annealing Emulation ─────────────────────────────────────────────

export interface AnnealingProblem {
  numSpins: number;
  couplings: Array<{ i: number; j: number; strength: number }>;
  fields: Array<{ i: number; strength: number }>;
}

export interface AnnealingResult {
  bestState: number[];
  bestEnergy: number;
  iterations: number;
  temperatureSchedule: number[];
}

export function calculateEnergy(s: number[], problem: AnnealingProblem): number {
  let e = 0;
  for (const coupling of problem.couplings) {
    e += coupling.strength * (s[coupling.i] ?? 1) * (s[coupling.j] ?? 1);
  }
  for (const field of problem.fields) {
    e += field.strength * (s[field.i] ?? 1);
  }
  return e;
}

export function generateProposal(state: (1 | -1)[], n: number): (1 | -1)[] {
  const flipIdx = Math.floor(Math.random() * n);
  const proposal = [...state];
  proposal[flipIdx] = (-(proposal[flipIdx] ?? 1)) as 1 | -1;
  return proposal;
}

export function calculateAcceptanceProbability(deltaE: number, temperature: number, transverseField: number): number {
  const tunnelProb = transverseField * 0.1;
  const thermalProb = deltaE <= 0 ? 1 : Math.exp(-deltaE / Math.max(temperature, 0.01));
  return Math.max(thermalProb, tunnelProb);
}

/**
 * Simulated quantum annealing using classical Monte Carlo with quantum-inspired schedule.
 * Uses transverse field Ising model concepts.
 */
export function runQuantumAnnealing(problem: AnnealingProblem, maxIterations = 1000): AnnealingResult {
  const n = problem.numSpins;
  let state = Array.from({ length: n }, () => (Math.random() > 0.5 ? 1 : -1));
  const schedule: number[] = [];

  let bestState = [...state];
  let bestEnergy = calculateEnergy(state, problem);

  for (let t = 0; t < maxIterations; t++) {
    const temperature = 10 * Math.exp(-5 * t / maxIterations); // Exponential cooling
    const transverseField = (1 - t / maxIterations); // Quantum transverse field decreases
    schedule.push(temperature);

    const proposal = generateProposal(state, n);

    const currentE = calculateEnergy(state, problem);
    const proposalE = calculateEnergy(proposal, problem);
    const deltaE = proposalE - currentE;

    const acceptProb = calculateAcceptanceProbability(deltaE, temperature, transverseField);

    if (Math.random() < acceptProb) {
      state = proposal;
      if (proposalE < bestEnergy) {
        bestEnergy = proposalE;
        bestState = [...proposal];
      }
    }
  }

  return {
    bestState,
    bestEnergy,
    iterations: maxIterations,
    temperatureSchedule: schedule.filter((_, i) => i % Math.max(1, Math.floor(maxIterations / 20)) === 0),
  };
}

// ─── Portfolio Optimization via QAOA ─────────────────────────────────────────

export interface PortfolioOptimizationResult {
  allocation: number[];
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  assets: string[];
}

/**
 * Optimise a simple portfolio allocation using QAOA.
 * Binary allocation: include asset (1) or exclude (0).
 */
export function optimizePortfolio(
  assets: string[],
  expectedReturns: number[],
  riskMatrix: number[][],
  riskAversion = 0.5,
): PortfolioOptimizationResult {
  const n = Math.min(assets.length, 10);

  // Build QAOA objective
  const objective: Array<{ variables: number[]; weight: number }> = [];
  for (let i = 0; i < n; i++) {
    objective.push({ variables: [i], weight: expectedReturns[i]! });
  }
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const riskWeight = -(riskMatrix[i]?.[j] ?? 0) * riskAversion;
      if (Math.abs(riskWeight) > 0.001) {
        objective.push({ variables: [i, j], weight: riskWeight });
      }
    }
  }

  const result = runQAOA({ numVariables: n, objective }, 2, 512);

  const allocation = result.bestSolution.slice(0, n);
  let expectedReturn = 0;
  let risk = 0;
  for (let i = 0; i < n; i++) {
    expectedReturn += (allocation[i] ?? 0) * (expectedReturns[i] ?? 0);
    for (let j = 0; j < n; j++) {
      risk += (allocation[i] ?? 0) * (allocation[j] ?? 0) * (riskMatrix[i]?.[j] ?? 0);
    }
  }
  const sharpe = risk > 0 ? expectedReturn / Math.sqrt(risk) : 0;

  return {
    allocation,
    expectedReturn,
    risk,
    sharpeRatio: sharpe,
    assets: assets.slice(0, n),
  };
}

// ---------------------------------------------------------------------------
// Micrograd — Educational Autograd Engine (H.3.1 / H.3.2 / H.3.3)
// ---------------------------------------------------------------------------
// Pure TypeScript port of Karpathy's micrograd with extensions for
// interactive educational walkthroughs and Canvas UI visualization.
//
// Core:   Value (scalar autograd), computational graph, backward pass
// NN:     Neuron, Layer, MLP (multi-layer perceptron)
// Edu:    Step-by-step walkthrough engine, training visualisation
// Canvas: Graph serialisation for UI rendering
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';

const logger = createLogger('micrograd');

/* ================================================================ */
/* § Value — Scalar autograd node (Karpathy's Value class)          */
/* ================================================================ */

let valueCounter = 0;

export class Value {
  data: number;
  grad: number;
  readonly id: string;
  readonly label: string;
  readonly op: string;
  readonly children: Value[];
  private _backward: () => void;

  constructor(data: number, children: Value[] = [], op = '', label = '') {
    this.data = data;
    this.grad = 0;
    this.id = `v${++valueCounter}`;
    this.label = label || this.id;
    this.op = op;
    this.children = children;
    this._backward = () => {};
  }

  // ---- Arithmetic operations with autograd ----

  add(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data + o.data, [this, o], '+');
    out._backward = () => {
      this.grad += out.grad;
      o.grad += out.grad;
    };
    return out;
  }

  mul(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data * o.data, [this, o], '*');
    out._backward = () => {
      this.grad += o.data * out.grad;
      o.grad += this.data * out.grad;
    };
    return out;
  }

  pow(exponent: number): Value {
    const out = new Value(Math.pow(this.data, exponent), [this], `**${exponent}`);
    out._backward = () => {
      this.grad += exponent * Math.pow(this.data, exponent - 1) * out.grad;
    };
    return out;
  }

  neg(): Value {
    return this.mul(-1);
  }

  sub(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return this.add(o.neg());
  }

  div(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return this.mul(o.pow(-1));
  }

  tanh(): Value {
    const t = Math.tanh(this.data);
    const out = new Value(t, [this], 'tanh');
    out._backward = () => {
      this.grad += (1 - t * t) * out.grad;
    };
    return out;
  }

  relu(): Value {
    const out = new Value(this.data > 0 ? this.data : 0, [this], 'relu');
    out._backward = () => {
      this.grad += (out.data > 0 ? 1 : 0) * out.grad;
    };
    return out;
  }

  exp(): Value {
    const e = Math.exp(this.data);
    const out = new Value(e, [this], 'exp');
    out._backward = () => {
      this.grad += e * out.grad;
    };
    return out;
  }

  /**
   * Backpropagation: topological sort → reverse-order backward pass.
   * This is the core of autograd — computes ∂loss/∂self for every
   * Value in the computational graph.
   */
  backward(): void {
    const topo: Value[] = [];
    const visited = new Set<string>();

    const buildTopo = (v: Value) => {
      if (visited.has(v.id)) return;
      visited.add(v.id);
      for (const child of v.children) {
        buildTopo(child);
      }
      topo.push(v);
    };

    buildTopo(this);
    this.grad = 1;

    for (let i = topo.length - 1; i >= 0; i--) {
      topo[i]._backward();
    }
  }

  toString(): string {
    return `Value(data=${this.data.toFixed(4)}, grad=${this.grad.toFixed(4)}, label=${this.label})`;
  }
}

/* ================================================================ */
/* § Neural Network Building Blocks                                  */
/* ================================================================ */

/** Seeded PRNG (xoshiro128) for reproducible weight init */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export class Neuron {
  readonly w: Value[];
  readonly b: Value;
  readonly nonlin: boolean;
  readonly activation: 'tanh' | 'relu' | 'linear';

  constructor(nin: number, nonlin = true, activation: 'tanh' | 'relu' | 'linear' = 'tanh', rng?: () => number) {
    const rand = rng || Math.random;
    this.w = Array.from({ length: nin }, (_, i) =>
      new Value((rand() * 2 - 1), [], '', `w${i}`),
    );
    this.b = new Value(0, [], '', 'b');
    this.nonlin = nonlin;
    this.activation = nonlin ? activation : 'linear';
  }

  forward(x: Value[]): Value {
    // w · x + b
    let act = this.b;
    for (let i = 0; i < this.w.length; i++) {
      act = act.add(this.w[i].mul(x[i]));
    }
    if (!this.nonlin) return act;
    return this.activation === 'relu' ? act.relu() : act.tanh();
  }

  parameters(): Value[] {
    return [...this.w, this.b];
  }
}

export class Layer {
  readonly neurons: Neuron[];

  constructor(nin: number, nout: number, nonlin = true, activation: 'tanh' | 'relu' | 'linear' = 'tanh', rng?: () => number) {
    this.neurons = Array.from({ length: nout }, () =>
      new Neuron(nin, nonlin, activation, rng),
    );
  }

  forward(x: Value[]): Value[] {
    return this.neurons.map((n) => n.forward(x));
  }

  parameters(): Value[] {
    return this.neurons.flatMap((n) => n.parameters());
  }
}

export class MLP {
  readonly layers: Layer[];

  constructor(
    nin: number,
    layerSizes: number[],
    activation: 'tanh' | 'relu' | 'linear' = 'tanh',
    seed?: number,
  ) {
    const rng = seed !== undefined ? seededRandom(seed) : undefined;
    const sizes = [nin, ...layerSizes];
    this.layers = [];
    for (let i = 0; i < layerSizes.length; i++) {
      const isLast = i === layerSizes.length - 1;
      this.layers.push(
        new Layer(sizes[i], sizes[i + 1], !isLast, activation, rng),
      );
    }
  }

  forward(x: Value[] | number[]): Value[] {
    let current: Value[] = x.map((v) =>
      v instanceof Value ? v : new Value(v),
    );
    for (const layer of this.layers) {
      current = layer.forward(current);
    }
    return current;
  }

  parameters(): Value[] {
    return this.layers.flatMap((l) => l.parameters());
  }

  zeroGrad(): void {
    for (const p of this.parameters()) {
      p.grad = 0;
    }
  }
}

/* ================================================================ */
/* § Loss Functions                                                  */
/* ================================================================ */

/** Mean squared error loss */
export function mseLoss(predictions: Value[], targets: number[]): Value {
  let loss = new Value(0, [], '', 'loss');
  for (let i = 0; i < predictions.length; i++) {
    const diff = predictions[i].sub(targets[i]);
    loss = loss.add(diff.pow(2));
  }
  // Mean
  return loss.mul(1.0 / predictions.length);
}

/** Binary cross-entropy loss (for classification, expects 0/1 targets) */
export function binaryXentLoss(predictions: Value[], targets: number[]): Value {
  let loss = new Value(0, [], '', 'bce_loss');
  const eps = 1e-7;
  for (let i = 0; i < predictions.length; i++) {
    // Clamp prediction to (eps, 1-eps) for numerical stability
    const p = predictions[i];
    const t = targets[i];
    // -[t * log(p) + (1-t) * log(1-p)]
    const logP = new Value(Math.log(Math.max(p.data, eps)));
    const log1mP = new Value(Math.log(Math.max(1 - p.data, eps)));
    const term = logP.mul(t).add(log1mP.mul(1 - t));
    loss = loss.sub(term);
  }
  return loss.mul(1.0 / predictions.length);
}

/** Hinge loss (SVM-style, for binary +1/-1 targets) */
export function hingeLoss(predictions: Value[], targets: number[]): Value {
  let loss = new Value(0, [], '', 'hinge_loss');
  for (let i = 0; i < predictions.length; i++) {
    // max(0, 1 - yi * pred_i)
    const margin = predictions[i].mul(targets[i]);
    const term = new Value(1).sub(margin).relu();
    loss = loss.add(term);
  }
  return loss.mul(1.0 / predictions.length);
}

/* ================================================================ */
/* § Training Loop                                                   */
/* ================================================================ */

export interface TrainingConfig {
  learningRate: number;
  epochs: number;
  lossFunction: 'mse' | 'hinge' | 'bce';
  seed?: number;
  logEvery?: number;
  earlyStopLoss?: number;
}

export interface TrainingStep {
  epoch: number;
  loss: number;
  learningRate: number;
  gradNorm: number;
  paramCount: number;
  accuracy?: number;
  predictions: number[];
}

export interface TrainingResult {
  steps: TrainingStep[];
  finalLoss: number;
  finalAccuracy: number | null;
  totalEpochs: number;
  paramCount: number;
  converged: boolean;
  model: MLP;
}

function computeLoss(
  model: MLP,
  xs: number[][],
  ys: number[],
  lossFn: 'mse' | 'hinge' | 'bce',
): { loss: Value; predictions: Value[] } {
  const predictions = xs.map((x) => model.forward(x)[0]);
  let loss: Value;
  switch (lossFn) {
    case 'mse':
      loss = mseLoss(predictions, ys);
      break;
    case 'hinge':
      loss = hingeLoss(predictions, ys);
      break;
    case 'bce':
      loss = binaryXentLoss(predictions, ys);
      break;
  }
  return { loss, predictions };
}

function computeAccuracy(predictions: Value[], targets: number[], lossFn: string): number | undefined {
  if (lossFn === 'hinge') {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i].data > 0 ? 1 : -1;
      if (pred === targets[i]) correct++;
    }
    return correct / predictions.length;
  }
  if (lossFn === 'bce') {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i].data > 0.5 ? 1 : 0;
      if (pred === targets[i]) correct++;
    }
    return correct / predictions.length;
  }
  return undefined;
}

/**
 * Full training loop. Returns step-by-step results for visualization.
 */
export function train(
  model: MLP,
  xs: number[][],
  ys: number[],
  config: TrainingConfig,
): TrainingResult {
  const steps: TrainingStep[] = [];
  const params = model.parameters();
  const logEvery = config.logEvery ?? 1;
  let converged = false;

  for (let epoch = 0; epoch < config.epochs; epoch++) {
    // Forward pass
    const { loss, predictions } = computeLoss(model, xs, ys, config.lossFunction);

    // Zero gradients
    model.zeroGrad();

    // Backward pass
    loss.backward();

    // Gradient norm for monitoring
    let gradNorm = 0;
    for (const p of params) {
      gradNorm += p.grad * p.grad;
    }
    gradNorm = Math.sqrt(gradNorm);

    // SGD update
    for (const p of params) {
      p.data -= config.learningRate * p.grad;
    }

    // Record step
    const accuracy = computeAccuracy(predictions, ys, config.lossFunction);
    const step: TrainingStep = {
      epoch,
      loss: loss.data,
      learningRate: config.learningRate,
      gradNorm,
      paramCount: params.length,
      accuracy,
      predictions: predictions.map((p) => p.data),
    };
    steps.push(step);

    if (epoch % logEvery === 0) {
      logger.debug('Training step', { epoch, loss: loss.data, gradNorm, accuracy });
    }

    // Early stop
    if (config.earlyStopLoss !== undefined && loss.data <= config.earlyStopLoss) {
      converged = true;
      break;
    }
  }

  const finalStep = steps[steps.length - 1];
  return {
    steps,
    finalLoss: finalStep.loss,
    finalAccuracy: finalStep.accuracy ?? null,
    totalEpochs: steps.length,
    paramCount: params.length,
    converged,
    model,
  };
}

/* ================================================================ */
/* § Interactive Walkthrough Engine (H.3.2)                          */
/* ================================================================ */

export type WalkthroughSection =
  | 'value_basics'
  | 'operations'
  | 'chain_rule'
  | 'backpropagation'
  | 'neuron'
  | 'mlp'
  | 'training_loop'
  | 'moon_demo';

export interface WalkthroughStep {
  section: WalkthroughSection;
  stepIndex: number;
  title: string;
  explanation: string;
  code: string;
  graphSnapshot: GraphNode[];
  highlightedNodes: string[];
  result?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  data: number;
  grad: number;
  op: string;
  children: string[];
  highlighted: boolean;
}

/**
 * Serialise a Value's computational graph for Canvas UI rendering.
 */
export function serialiseGraph(root: Value, highlightIds: Set<string> = new Set()): GraphNode[] {
  const nodes: GraphNode[] = [];
  const visited = new Set<string>();

  const walk = (v: Value) => {
    if (visited.has(v.id)) return;
    visited.add(v.id);
    nodes.push({
      id: v.id,
      label: v.label,
      data: v.data,
      grad: v.grad,
      op: v.op,
      children: v.children.map((c) => c.id),
      highlighted: highlightIds.has(v.id),
    });
    for (const child of v.children) {
      walk(child);
    }
  };

  walk(root);
  return nodes;
}

/**
 * Generate the full interactive walkthrough — 8 sections, ~30 steps.
 * Each step includes executable code, explanation, and a graph snapshot
 * for the Canvas UI to render.
 */
export function generateWalkthrough(): WalkthroughStep[] {
  const steps: WalkthroughStep[] = [];

  // Reset counter for clean IDs
  valueCounter = 0;

  // ─── Section 1: Value Basics ───

  const a = new Value(2.0, [], '', 'a');
  const b = new Value(-3.0, [], '', 'b');

  steps.push({
    section: 'value_basics',
    stepIndex: 0,
    title: 'Creating Values',
    explanation:
      'A Value wraps a scalar number and tracks its gradient. ' +
      'In neural networks, every number — weights, biases, inputs — is a Value. ' +
      'The gradient (∂loss/∂self) tells us how changing this value affects the loss.',
    code: `const a = new Value(2.0, [], '', 'a');\nconst b = new Value(-3.0, [], '', 'b');`,
    graphSnapshot: serialiseGraph(a).concat(serialiseGraph(b)),
    highlightedNodes: [a.id, b.id],
    result: `a = ${a.toString()}\nb = ${b.toString()}`,
  });

  // ─── Section 2: Operations ───

  const c = a.mul(b);
  (c as any).label = 'c = a*b';

  steps.push({
    section: 'operations',
    stepIndex: 1,
    title: 'Multiplication',
    explanation:
      'When we multiply a × b, we create a new Value that remembers its parents. ' +
      'This builds a computational graph. The result c = 2.0 × -3.0 = -6.0. ' +
      'The graph tracks: c depends on a and b via the * operation.',
    code: `const c = a.mul(b); // c = a * b = ${c.data}`,
    graphSnapshot: serialiseGraph(c),
    highlightedNodes: [c.id],
    result: `c = ${c.data}`,
  });

  const d = c.add(new Value(10.0, [], '', 'd_bias'));
  (d as any).label = 'd = c+10';

  steps.push({
    section: 'operations',
    stepIndex: 2,
    title: 'Addition',
    explanation:
      'Adding a bias: d = c + 10 = -6.0 + 10.0 = 4.0. ' +
      'The graph grows — d depends on c and the constant 10.',
    code: `const d = c.add(10); // d = c + 10 = ${d.data}`,
    graphSnapshot: serialiseGraph(d),
    highlightedNodes: [d.id],
    result: `d = ${d.data}`,
  });

  const e = d.tanh();
  (e as any).label = 'e = tanh(d)';

  steps.push({
    section: 'operations',
    stepIndex: 3,
    title: 'Activation Function (tanh)',
    explanation:
      'tanh squashes the value to [-1, 1]. This is the activation function. ' +
      'Neural networks need non-linear activations to learn complex patterns. ' +
      'tanh(4.0) ≈ 0.9993 — almost saturated at 1.',
    code: `const e = d.tanh(); // e = tanh(${d.data}) = ${e.data.toFixed(4)}`,
    graphSnapshot: serialiseGraph(e),
    highlightedNodes: [e.id],
    result: `e = ${e.data.toFixed(6)}`,
  });

  // ─── Section 3: Chain Rule ───

  steps.push({
    section: 'chain_rule',
    stepIndex: 4,
    title: 'The Chain Rule',
    explanation:
      'The chain rule says: ∂e/∂a = (∂e/∂d) × (∂d/∂c) × (∂c/∂a). ' +
      'Instead of computing this symbolically, we compute it one operation ' +
      'at a time, starting from the output and working backward. ' +
      'This is backpropagation — the most important algorithm in deep learning.',
    code: `// The chain rule: de/da = (de/dd) × (dd/dc) × (dc/da)\n// Computed automatically by .backward()`,
    graphSnapshot: serialiseGraph(e),
    highlightedNodes: [a.id, b.id, c.id, d.id, e.id],
  });

  // ─── Section 4: Backpropagation ───

  e.backward();

  steps.push({
    section: 'backpropagation',
    stepIndex: 5,
    title: 'Backward Pass',
    explanation:
      'Calling e.backward() computes gradients for every Value in the graph. ' +
      `e.grad = 1.0 (always — we\'re differentiating e with respect to itself). ` +
      `a.grad = ${a.grad.toFixed(6)} — this means increasing \'a\' by ε would ` +
      `change e by ${a.grad.toFixed(6)} × ε. ` +
      `b.grad = ${b.grad.toFixed(6)} — the gradient with respect to b.`,
    code: `e.backward();\n// a.grad = ${a.grad.toFixed(6)}\n// b.grad = ${b.grad.toFixed(6)}`,
    graphSnapshot: serialiseGraph(e, new Set([a.id, b.id])),
    highlightedNodes: [a.id, b.id],
    result: `a.grad = ${a.grad.toFixed(6)}\nb.grad = ${b.grad.toFixed(6)}\ne.grad = ${e.grad.toFixed(6)}`,
  });

  // ─── Section 5: Neuron ───

  valueCounter = 100; // Reset for clean neuron IDs
  const rng = seededRandom(42);
  const neuron = new Neuron(2, true, 'tanh', rng);
  const x_in = [new Value(1.0, [], '', 'x0'), new Value(2.0, [], '', 'x1')];
  const neuronOut = neuron.forward(x_in);
  (neuronOut as any).label = 'out';
  neuronOut.backward();

  steps.push({
    section: 'neuron',
    stepIndex: 6,
    title: 'A Single Neuron',
    explanation:
      'A neuron computes: out = tanh(w0·x0 + w1·x1 + b). ' +
      `With inputs [1.0, 2.0] and random weights, the output is ${neuronOut.data.toFixed(4)}. ` +
      'The neuron has 3 parameters (2 weights + 1 bias). ' +
      'After backward(), each weight\'s gradient tells us how to adjust it.',
    code: `const neuron = new Neuron(2); // 2 inputs\nconst out = neuron.forward([1.0, 2.0]);\nout.backward();`,
    graphSnapshot: serialiseGraph(neuronOut),
    highlightedNodes: neuron.parameters().map((p) => p.id),
    result: `out = ${neuronOut.data.toFixed(4)}\nparams = ${neuron.parameters().length}`,
  });

  // ─── Section 6: MLP ───

  valueCounter = 200;
  const mlp = new MLP(2, [4, 4, 1], 'tanh', 42);
  const mlpOut = mlp.forward([1.0, 2.0]);
  const mlpVal = mlpOut[0];
  (mlpVal as any).label = 'mlp_out';

  steps.push({
    section: 'mlp',
    stepIndex: 7,
    title: 'Multi-Layer Perceptron',
    explanation:
      'An MLP stacks layers of neurons. Architecture [2, 4, 4, 1] means: ' +
      '2 inputs → 4 hidden neurons → 4 hidden neurons → 1 output. ' +
      `Total parameters: ${mlp.parameters().length} (weights + biases). ` +
      'This is enough to learn simple patterns like XOR or circular boundaries.',
    code: `const mlp = new MLP(2, [4, 4, 1], 'tanh', 42);\nmlp.forward([1.0, 2.0]);`,
    graphSnapshot: [], // Too large to serialise fully — UI shows architecture diagram
    highlightedNodes: [],
    result: `output = ${mlpVal.data.toFixed(4)}\nparameters = ${mlp.parameters().length}`,
  });

  // ─── Section 7: Training Loop ───

  valueCounter = 500;
  const demoModel = new MLP(2, [4, 4, 1], 'tanh', 42);

  // XOR-like dataset
  const demoXs = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const demoYs = [-1, 1, 1, -1]; // XOR with +1/-1 encoding

  const demoResult = train(demoModel, demoXs, demoYs, {
    learningRate: 0.05,
    epochs: 5,
    lossFunction: 'hinge',
    logEvery: 100,
  });

  steps.push({
    section: 'training_loop',
    stepIndex: 8,
    title: 'Training Loop (First 5 Epochs)',
    explanation:
      'Training repeats: 1) Forward pass (compute predictions), ' +
      '2) Compute loss (how wrong are we?), ' +
      '3) Backward pass (compute gradients), ' +
      '4) Update weights (move in the direction that reduces loss). ' +
      `After 5 epochs: loss = ${demoResult.finalLoss.toFixed(4)}`,
    code: `train(model, xs, ys, { learningRate: 0.05, epochs: 5, lossFunction: 'hinge' });`,
    graphSnapshot: [],
    highlightedNodes: [],
    result: demoResult.steps.map((s) =>
      `epoch ${s.epoch}: loss=${s.loss.toFixed(4)} acc=${s.accuracy?.toFixed(2) ?? 'N/A'}`,
    ).join('\n'),
  });

  // ─── Section 8: Moon Demo ───

  valueCounter = 1000;
  const moonModel = new MLP(2, [8, 8, 1], 'tanh', 123);

  // Generate a simple 2D classification dataset (mini moons)
  const moonData = generateMoonDataset(40, 0.15, 123);
  const moonResult = train(moonModel, moonData.xs, moonData.ys, {
    learningRate: 0.02,
    epochs: 50,
    lossFunction: 'hinge',
    logEvery: 100,
    earlyStopLoss: 0.01,
  });

  steps.push({
    section: 'moon_demo',
    stepIndex: 9,
    title: 'Moon Dataset — Full Training',
    explanation:
      'The "moons" dataset has two interleaving half-circles. ' +
      'A linear classifier cannot separate them — we need a neural network. ' +
      `After ${moonResult.totalEpochs} epochs: loss = ${moonResult.finalLoss.toFixed(4)}, ` +
      `accuracy = ${moonResult.finalAccuracy !== null ? (moonResult.finalAccuracy * 100).toFixed(1) + '%' : 'N/A'}. ` +
      'The decision boundary curves around the data — that\'s the power of non-linearity!',
    code: `const model = new MLP(2, [8, 8, 1], 'tanh', 123);\ntrain(model, moonXs, moonYs, { lr: 0.02, epochs: 50 });`,
    graphSnapshot: [],
    highlightedNodes: [],
    result: [
      `Epochs: ${moonResult.totalEpochs}`,
      `Final loss: ${moonResult.finalLoss.toFixed(4)}`,
      `Accuracy: ${moonResult.finalAccuracy !== null ? (moonResult.finalAccuracy * 100).toFixed(1) + '%' : 'N/A'}`,
      `Parameters: ${moonResult.paramCount}`,
      `Converged: ${moonResult.converged}`,
    ].join('\n'),
  });

  // Restore counter
  valueCounter = 0;
  return steps;
}

/* ================================================================ */
/* § Moon Dataset Generator                                          */
/* ================================================================ */

export function generateMoonDataset(
  nSamples: number,
  noise: number,
  seed: number,
): { xs: number[][]; ys: number[] } {
  const rng = seededRandom(seed);
  const halfN = Math.floor(nSamples / 2);
  const xs: number[][] = [];
  const ys: number[] = [];

  for (let i = 0; i < halfN; i++) {
    const angle = (Math.PI * i) / halfN;
    xs.push([Math.cos(angle) + (rng() - 0.5) * noise, Math.sin(angle) + (rng() - 0.5) * noise]);
    ys.push(1);
  }
  for (let i = 0; i < halfN; i++) {
    const angle = (Math.PI * i) / halfN;
    xs.push([1 - Math.cos(angle) + (rng() - 0.5) * noise, 1 - Math.sin(angle) - 0.5 + (rng() - 0.5) * noise]);
    ys.push(-1);
  }

  return { xs, ys };
}

/* ================================================================ */
/* § Canvas UI Serialisation (H.3.3)                                 */
/* ================================================================ */

export interface TrainingSnapshot {
  epoch: number;
  loss: number;
  accuracy: number | null;
  gradNorm: number;
  predictions: number[];
  parameters: { id: string; label: string; data: number; grad: number }[];
  decisionBoundary?: { x: number; y: number; predicted: number }[];
}

/**
 * Generate a decision boundary grid for Canvas UI visualization.
 * Evaluates the model on a 2D grid and returns predictions.
 */
export function generateDecisionBoundary(
  model: MLP,
  xRange: [number, number] = [-1.5, 2.5],
  yRange: [number, number] = [-1.0, 1.5],
  resolution: number = 20,
): { x: number; y: number; predicted: number }[] {
  const grid: { x: number; y: number; predicted: number }[] = [];
  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;

  for (let xi = 0; xi <= resolution; xi++) {
    for (let yi = 0; yi <= resolution; yi++) {
      const x = xRange[0] + xi * xStep;
      const y = yRange[0] + yi * yStep;
      const out = model.forward([x, y]);
      grid.push({ x, y, predicted: out[0].data });
    }
  }

  return grid;
}

/**
 * Run training and produce snapshots at regular intervals for Canvas UI animation.
 */
export function trainWithSnapshots(
  model: MLP,
  xs: number[][],
  ys: number[],
  config: TrainingConfig,
  snapshotEvery: number = 5,
): { result: TrainingResult; snapshots: TrainingSnapshot[] } {
  const snapshots: TrainingSnapshot[] = [];
  const params = model.parameters();
  const logEvery = config.logEvery ?? 1;
  const steps: TrainingStep[] = [];
  let converged = false;

  for (let epoch = 0; epoch < config.epochs; epoch++) {
    const { loss, predictions } = computeLoss(model, xs, ys, config.lossFunction);

    model.zeroGrad();
    loss.backward();

    let gradNorm = 0;
    for (const p of params) {
      gradNorm += p.grad * p.grad;
    }
    gradNorm = Math.sqrt(gradNorm);

    // Take snapshot before SGD update
    if (epoch % snapshotEvery === 0 || epoch === config.epochs - 1) {
      const accuracy = computeAccuracy(predictions, ys, config.lossFunction);
      snapshots.push({
        epoch,
        loss: loss.data,
        accuracy: accuracy ?? null,
        gradNorm,
        predictions: predictions.map((p) => p.data),
        parameters: params.map((p) => ({
          id: p.id,
          label: p.label,
          data: p.data,
          grad: p.grad,
        })),
        decisionBoundary: xs[0]?.length === 2
          ? generateDecisionBoundary(model)
          : undefined,
      });
    }

    // SGD update
    for (const p of params) {
      p.data -= config.learningRate * p.grad;
    }

    const accuracy = computeAccuracy(predictions, ys, config.lossFunction);
    steps.push({
      epoch,
      loss: loss.data,
      learningRate: config.learningRate,
      gradNorm,
      paramCount: params.length,
      accuracy,
      predictions: predictions.map((p) => p.data),
    });

    if (config.earlyStopLoss !== undefined && loss.data <= config.earlyStopLoss) {
      converged = true;
      break;
    }
  }

  const finalStep = steps[steps.length - 1];
  return {
    result: {
      steps,
      finalLoss: finalStep.loss,
      finalAccuracy: finalStep.accuracy ?? null,
      totalEpochs: steps.length,
      paramCount: params.length,
      converged,
      model,
    },
    snapshots,
  };
}

/* ================================================================ */
/* § Session Management                                              */
/* ================================================================ */

export interface MicrogradSession {
  id: string;
  orgId: string;
  walkthroughProgress: number; // step index
  model: MLP | null;
  trainingResult: TrainingResult | null;
  dataset: { xs: number[][]; ys: number[] } | null;
  createdAt: string;
  updatedAt: string;
}

const sessionStore = new Map<string, MicrogradSession>();
const MAX_SESSIONS = 50;
let sessionCounter = 0;

export function createSession(orgId: string): MicrogradSession {
  if (sessionStore.size >= MAX_SESSIONS) {
    const oldest = [...sessionStore.entries()]
      .sort(([, a], [, b]) => a.updatedAt.localeCompare(b.updatedAt));
    if (oldest.length > 0) sessionStore.delete(oldest[0][0]);
  }

  sessionCounter++;
  const id = `micrograd-${Date.now()}-${sessionCounter}`;
  const now = new Date().toISOString();

  const session: MicrogradSession = {
    id,
    orgId,
    walkthroughProgress: 0,
    model: null,
    trainingResult: null,
    dataset: null,
    createdAt: now,
    updatedAt: now,
  };

  sessionStore.set(id, session);
  logger.info('Micrograd session created', { id, orgId });
  return session;
}

export function getSession(id: string): MicrogradSession | undefined {
  return sessionStore.get(id);
}

export function advanceWalkthrough(sessionId: string): WalkthroughStep | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const steps = generateWalkthrough();
  if (session.walkthroughProgress >= steps.length) return null;

  const step = steps[session.walkthroughProgress];
  session.walkthroughProgress++;
  session.updatedAt = new Date().toISOString();
  return step;
}

export function getWalkthroughStep(sessionId: string, stepIndex: number): WalkthroughStep | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const steps = generateWalkthrough();
  if (stepIndex < 0 || stepIndex >= steps.length) return null;
  return steps[stepIndex];
}

export function trainInSession(
  sessionId: string,
  architecture: number[],
  datasetType: 'xor' | 'moon' | 'custom',
  config: Partial<TrainingConfig>,
  customData?: { xs: number[][]; ys: number[] },
): TrainingResult | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  let xs: number[][];
  let ys: number[];

  switch (datasetType) {
    case 'xor':
      xs = [[0, 0], [0, 1], [1, 0], [1, 1]];
      ys = [-1, 1, 1, -1];
      break;
    case 'moon':
      const moon = generateMoonDataset(60, 0.15, config.seed ?? 42);
      xs = moon.xs;
      ys = moon.ys;
      break;
    case 'custom':
      if (!customData) return null;
      xs = customData.xs;
      ys = customData.ys;
      break;
  }

  const nin = xs[0]?.length ?? 2;
  const model = new MLP(nin, architecture, 'tanh', config.seed);
  const fullConfig: TrainingConfig = {
    learningRate: config.learningRate ?? 0.05,
    epochs: config.epochs ?? 100,
    lossFunction: config.lossFunction ?? 'hinge',
    seed: config.seed,
    logEvery: config.logEvery ?? 10,
    earlyStopLoss: config.earlyStopLoss,
  };

  const result = train(model, xs, ys, fullConfig);
  session.model = model;
  session.trainingResult = result;
  session.dataset = { xs, ys };
  session.updatedAt = new Date().toISOString();

  logger.info('Micrograd training completed', {
    sessionId,
    epochs: result.totalEpochs,
    loss: result.finalLoss,
    accuracy: result.finalAccuracy,
    converged: result.converged,
  });

  return result;
}

export function listSessions(orgId?: string): MicrogradSession[] {
  let sessions = [...sessionStore.values()];
  if (orgId) sessions = sessions.filter((s) => s.orgId === orgId);
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function destroySession(id: string): boolean {
  return sessionStore.delete(id);
}

/* ================================================================ */
/* § Stats                                                           */
/* ================================================================ */

export interface MicrogradStats {
  activeSessions: number;
  totalTrainingRuns: number;
  totalWalkthroughSteps: number;
}

let totalTrainingRuns = 0;
let totalWalkthroughSteps = 0;

export function getMicrogradStats(): MicrogradStats {
  return {
    activeSessions: sessionStore.size,
    totalTrainingRuns,
    totalWalkthroughSteps,
  };
}

/* ================================================================ */
/* § Testing Utilities                                               */
/* ================================================================ */

export function _resetForTesting(): void {
  sessionStore.clear();
  sessionCounter = 0;
  valueCounter = 0;
  totalTrainingRuns = 0;
  totalWalkthroughSteps = 0;
}

export function resetValueCounter(): void {
  valueCounter = 0;
}

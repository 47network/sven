// ---------------------------------------------------------------------------
// Micrograd Engine — Tests (H.3.1 / H.3.2 / H.3.3)
// ---------------------------------------------------------------------------

import {
  Value,
  Neuron,
  Layer,
  MLP,
  mseLoss,
  hingeLoss,
  binaryXentLoss,
  train,
  trainWithSnapshots,
  serialiseGraph,
  generateWalkthrough,
  generateMoonDataset,
  generateDecisionBoundary,
  createSession,
  getSession,
  advanceWalkthrough,
  getWalkthroughStep,
  trainInSession,
  listSessions,
  destroySession,
  getMicrogradStats,
  _resetForTesting,
  resetValueCounter,
  type TrainingConfig,
  type TrainingResult,
  type WalkthroughStep,
} from '../micrograd';

beforeEach(() => {
  _resetForTesting();
});

/* ========================================================================== */
/* Value — scalar autograd                                                    */
/* ========================================================================== */

describe('Value', () => {
  it('creates a value with data and zero grad', () => {
    const v = new Value(3.0, [], '', 'x');
    expect(v.data).toBe(3.0);
    expect(v.grad).toBe(0);
    expect(v.label).toBe('x');
    expect(v.op).toBe('');
    expect(v.children).toHaveLength(0);
  });

  it('assigns auto-label when none provided', () => {
    resetValueCounter();
    const v = new Value(1.0);
    expect(v.label).toMatch(/^v\d+$/);
  });

  it('add: computes correct data', () => {
    const a = new Value(2.0);
    const b = new Value(3.0);
    const c = a.add(b);
    expect(c.data).toBe(5.0);
    expect(c.op).toBe('+');
    expect(c.children).toHaveLength(2);
  });

  it('add: accepts raw number', () => {
    const a = new Value(2.0);
    const c = a.add(5);
    expect(c.data).toBe(7.0);
  });

  it('mul: computes correct data', () => {
    const a = new Value(3.0);
    const b = new Value(4.0);
    const c = a.mul(b);
    expect(c.data).toBe(12.0);
    expect(c.op).toBe('*');
  });

  it('mul: accepts raw number', () => {
    const a = new Value(3.0);
    const c = a.mul(-2);
    expect(c.data).toBe(-6.0);
  });

  it('pow: computes correct data', () => {
    const a = new Value(3.0);
    const c = a.pow(2);
    expect(c.data).toBe(9.0);
    expect(c.op).toBe('**2');
  });

  it('neg: negates', () => {
    const a = new Value(5.0);
    expect(a.neg().data).toBe(-5.0);
  });

  it('sub: computes correct data', () => {
    const a = new Value(10.0);
    const b = new Value(3.0);
    expect(a.sub(b).data).toBe(7.0);
  });

  it('sub: accepts raw number', () => {
    const a = new Value(10.0);
    expect(a.sub(3).data).toBe(7.0);
  });

  it('div: computes correct data', () => {
    const a = new Value(10.0);
    const b = new Value(4.0);
    expect(a.div(b).data).toBeCloseTo(2.5);
  });

  it('div: accepts raw number', () => {
    const a = new Value(10.0);
    expect(a.div(5).data).toBeCloseTo(2.0);
  });

  it('tanh: squashes to [-1, 1]', () => {
    const a = new Value(0.0);
    expect(a.tanh().data).toBeCloseTo(0);
    const b = new Value(100);
    expect(b.tanh().data).toBeCloseTo(1);
    const c = new Value(-100);
    expect(c.tanh().data).toBeCloseTo(-1);
  });

  it('relu: zeroes negatives', () => {
    expect(new Value(5.0).relu().data).toBe(5.0);
    expect(new Value(-5.0).relu().data).toBe(0);
    expect(new Value(0).relu().data).toBe(0);
  });

  it('exp: computes e^x', () => {
    const a = new Value(1.0);
    expect(a.exp().data).toBeCloseTo(Math.E);
    expect(new Value(0).exp().data).toBeCloseTo(1);
  });

  it('toString: formats correctly', () => {
    const v = new Value(3.14, [], '', 'pi');
    const str = v.toString();
    expect(str).toContain('3.14');
    expect(str).toContain('pi');
  });
});

/* ========================================================================== */
/* Backpropagation                                                            */
/* ========================================================================== */

describe('Backpropagation', () => {
  it('computes gradients for simple expression: a*b + c', () => {
    const a = new Value(2.0, [], '', 'a');
    const b = new Value(-3.0, [], '', 'b');
    const c = new Value(10.0, [], '', 'c');
    const d = a.mul(b).add(c); // d = 2*(-3) + 10 = 4
    d.backward();

    expect(d.data).toBe(4.0);
    expect(d.grad).toBe(1.0);
    expect(a.grad).toBe(-3.0); // dd/da = b
    expect(b.grad).toBe(2.0);  // dd/db = a
    expect(c.grad).toBe(1.0);  // dd/dc = 1
  });

  it('computes gradients through tanh', () => {
    const x = new Value(0.5, [], '', 'x');
    const y = x.tanh();
    y.backward();

    const t = Math.tanh(0.5);
    expect(y.data).toBeCloseTo(t);
    expect(x.grad).toBeCloseTo(1 - t * t, 5);
  });

  it('computes gradients through relu', () => {
    const x = new Value(3.0);
    const y = x.relu();
    y.backward();
    expect(x.grad).toBe(1.0);

    const x2 = new Value(-3.0);
    const y2 = x2.relu();
    y2.backward();
    expect(x2.grad).toBe(0.0);
  });

  it('computes gradients through pow', () => {
    const x = new Value(3.0);
    const y = x.pow(2); // y = x^2 = 9
    y.backward();
    expect(y.data).toBe(9.0);
    expect(x.grad).toBeCloseTo(6.0); // dy/dx = 2x = 6
  });

  it('computes gradients through exp', () => {
    const x = new Value(1.0);
    const y = x.exp();
    y.backward();
    expect(x.grad).toBeCloseTo(Math.E, 5);
  });

  it('handles diamond-shaped graph (shared node)', () => {
    const a = new Value(3.0);
    const b = a.mul(a); // b = a^2 = 9, db/da = 2*a = 6
    b.backward();
    expect(b.data).toBe(9.0);
    expect(a.grad).toBeCloseTo(6.0);
  });

  it('matches numerical gradient (finite differences)', () => {
    const h = 1e-5;
    const f = (x: number) => {
      const v = new Value(x);
      return v.mul(v).add(v.mul(3)).tanh().data; // tanh(x^2 + 3x)
    };

    const x = new Value(0.7);
    const y = x.mul(x).add(x.mul(3)).tanh();
    y.backward();

    const numericalGrad = (f(0.7 + h) - f(0.7 - h)) / (2 * h);
    expect(x.grad).toBeCloseTo(numericalGrad, 3);
  });
});

/* ========================================================================== */
/* Neuron / Layer / MLP                                                       */
/* ========================================================================== */

describe('Neuron', () => {
  it('computes forward pass with correct shape', () => {
    const n = new Neuron(3);
    const x = [new Value(1), new Value(2), new Value(3)];
    const out = n.forward(x);
    expect(typeof out.data).toBe('number');
    expect(out.data).not.toBeNaN();
  });

  it('has correct parameter count', () => {
    const n = new Neuron(4);
    expect(n.parameters()).toHaveLength(5); // 4 weights + 1 bias
  });

  it('respects nonlin=false (linear)', () => {
    const n = new Neuron(2, false, 'linear');
    expect(n.activation).toBe('linear');
    expect(n.nonlin).toBe(false);
  });

  it('applies tanh activation by default', () => {
    const n = new Neuron(1, true, 'tanh');
    expect(n.activation).toBe('tanh');
  });
});

describe('Layer', () => {
  it('produces correct number of outputs', () => {
    const layer = new Layer(3, 5);
    const x = [new Value(1), new Value(2), new Value(3)];
    const out = layer.forward(x);
    expect(out).toHaveLength(5);
  });

  it('has correct parameter count', () => {
    const layer = new Layer(3, 5); // 5 neurons × (3 weights + 1 bias) = 20
    expect(layer.parameters()).toHaveLength(20);
  });
});

describe('MLP', () => {
  it('creates correct architecture', () => {
    const mlp = new MLP(2, [4, 4, 1], 'tanh', 42);
    expect(mlp.layers).toHaveLength(3);
    // Layer 0: 2->4, Layer 1: 4->4, Layer 2: 4->1
  });

  it('forward pass returns correct output count', () => {
    const mlp = new MLP(2, [4, 1], 'tanh', 42);
    const out = mlp.forward([1.0, 2.0]);
    expect(out).toHaveLength(1);
    expect(typeof out[0].data).toBe('number');
  });

  it('accepts Value[] input', () => {
    const mlp = new MLP(2, [4, 1], 'tanh', 42);
    const out = mlp.forward([new Value(1.0), new Value(2.0)]);
    expect(out).toHaveLength(1);
  });

  it('has correct total parameter count', () => {
    const mlp = new MLP(2, [4, 4, 1], 'tanh', 42);
    // Layer 0: 4*(2+1)=12, Layer 1: 4*(4+1)=20, Layer 2: 1*(4+1)=5 = 37
    expect(mlp.parameters()).toHaveLength(37);
  });

  it('zeroGrad zeroes all gradients', () => {
    const mlp = new MLP(2, [4, 1], 'tanh', 42);
    const out = mlp.forward([1, 2]);
    out[0].backward();
    // Some grads should be non-zero
    expect(mlp.parameters().some((p) => p.grad !== 0)).toBe(true);
    mlp.zeroGrad();
    expect(mlp.parameters().every((p) => p.grad === 0)).toBe(true);
  });

  it('produces deterministic output with same seed', () => {
    const m1 = new MLP(2, [4, 1], 'tanh', 42);
    const m2 = new MLP(2, [4, 1], 'tanh', 42);
    const o1 = m1.forward([1, 2])[0].data;
    const o2 = m2.forward([1, 2])[0].data;
    expect(o1).toBe(o2);
  });

  it('last layer is linear (no activation)', () => {
    const mlp = new MLP(2, [4, 1], 'tanh', 42);
    const lastLayer = mlp.layers[mlp.layers.length - 1];
    expect(lastLayer.neurons[0].nonlin).toBe(false);
  });
});

/* ========================================================================== */
/* Loss Functions                                                             */
/* ========================================================================== */

describe('Loss Functions', () => {
  describe('mseLoss', () => {
    it('returns zero for perfect predictions', () => {
      const preds = [new Value(1), new Value(2), new Value(3)];
      const targets = [1, 2, 3];
      const loss = mseLoss(preds, targets);
      expect(loss.data).toBeCloseTo(0);
    });

    it('returns correct MSE', () => {
      const preds = [new Value(1), new Value(2)];
      const targets = [3, 4]; // errors: 2, 2 → squared: 4, 4 → mean: 4
      const loss = mseLoss(preds, targets);
      expect(loss.data).toBeCloseTo(4.0);
    });

    it('supports backpropagation', () => {
      const pred = new Value(2.0);
      const loss = mseLoss([pred], [5.0]); // (2-5)^2 = 9
      loss.backward();
      expect(pred.grad).not.toBe(0);
    });
  });

  describe('hingeLoss', () => {
    it('returns zero when all margins are correct', () => {
      const preds = [new Value(2), new Value(-2)];
      const targets = [1, -1]; // margins: 2, 2 → max(0, 1-2)=0
      const loss = hingeLoss(preds, targets);
      expect(loss.data).toBeCloseTo(0);
    });

    it('returns positive loss for wrong predictions', () => {
      const preds = [new Value(-1)]; // pred = -1, target = +1
      const targets = [1]; // margin = -1, max(0, 1-(-1)) = 2
      const loss = hingeLoss(preds, targets);
      expect(loss.data).toBeCloseTo(2.0);
    });
  });

  describe('binaryXentLoss', () => {
    it('returns low loss for correct confident predictions', () => {
      const preds = [new Value(0.99), new Value(0.01)];
      const targets = [1, 0];
      const loss = binaryXentLoss(preds, targets);
      expect(loss.data).toBeLessThan(0.05);
    });

    it('returns high loss for wrong confident predictions', () => {
      const preds = [new Value(0.01)]; // pred ≈ 0, target = 1
      const targets = [1];
      const loss = binaryXentLoss(preds, targets);
      expect(loss.data).toBeGreaterThan(2);
    });
  });
});

/* ========================================================================== */
/* Training Loop                                                              */
/* ========================================================================== */

describe('train', () => {
  it('reduces loss over epochs (XOR with hinge)', () => {
    const model = new MLP(2, [4, 4, 1], 'tanh', 42);
    const xs = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const ys = [-1, 1, 1, -1];

    const result = train(model, xs, ys, {
      learningRate: 0.05,
      epochs: 50,
      lossFunction: 'hinge',
      logEvery: 100,
    });

    expect(result.steps).toHaveLength(50);
    expect(result.finalLoss).toBeLessThan(result.steps[0].loss);
    expect(result.paramCount).toBe(37);
    expect(result.totalEpochs).toBe(50);
  });

  it('reduces loss with MSE', () => {
    const model = new MLP(1, [4, 1], 'tanh', 42);
    const xs = [[0], [0.25], [0.5], [0.75], [1]];
    const ys = [0, 0.25, 0.5, 0.75, 1]; // identity function

    const result = train(model, xs, ys, {
      learningRate: 0.01,
      epochs: 50,
      lossFunction: 'mse',
      logEvery: 100,
    });

    expect(result.finalLoss).toBeLessThan(result.steps[0].loss);
  });

  it('respects early stopping', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const xs = [[0, 0], [1, 1]];
    const ys = [-1, 1];

    const result = train(model, xs, ys, {
      learningRate: 0.1,
      epochs: 1000,
      lossFunction: 'hinge',
      earlyStopLoss: 0.5,
      logEvery: 100,
    });

    expect(result.totalEpochs).toBeLessThan(1000);
    expect(result.converged).toBe(true);
  });

  it('records accuracy for hinge loss', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const result = train(model, [[0, 0], [1, 1]], [-1, 1], {
      learningRate: 0.1,
      epochs: 10,
      lossFunction: 'hinge',
    });

    expect(result.steps[0].accuracy).toBeDefined();
    expect(typeof result.steps[0].accuracy).toBe('number');
  });

  it('step contains predictions', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const result = train(model, [[0, 0], [1, 1]], [-1, 1], {
      learningRate: 0.1,
      epochs: 5,
      lossFunction: 'hinge',
    });

    expect(result.steps[0].predictions).toHaveLength(2);
  });

  it('computes gradient norm', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const result = train(model, [[1, 0]], [1], {
      learningRate: 0.1,
      epochs: 5,
      lossFunction: 'mse',
    });

    expect(result.steps[0].gradNorm).toBeGreaterThan(0);
  });
});

/* ========================================================================== */
/* Training with Snapshots (Canvas H.3.3)                                     */
/* ========================================================================== */

describe('trainWithSnapshots', () => {
  it('produces snapshots at correct intervals', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const xs = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const ys = [-1, 1, 1, -1];

    const { result, snapshots } = trainWithSnapshots(model, xs, ys, {
      learningRate: 0.05,
      epochs: 20,
      lossFunction: 'hinge',
      logEvery: 100,
    }, 5);

    // epoch 0, 5, 10, 15, 19 (last) → 5 snapshots
    expect(snapshots.length).toBeGreaterThanOrEqual(4);
    expect(result.totalEpochs).toBe(20);
  });

  it('snapshots include decision boundary for 2D data', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const { snapshots } = trainWithSnapshots(model, [[0, 1], [1, 0]], [1, -1], {
      learningRate: 0.05,
      epochs: 10,
      lossFunction: 'hinge',
    }, 5);

    const snapshotWithBoundary = snapshots.find((s) => s.decisionBoundary);
    expect(snapshotWithBoundary).toBeDefined();
    expect(snapshotWithBoundary!.decisionBoundary!.length).toBeGreaterThan(0);
  });

  it('snapshots include parameter data', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const { snapshots } = trainWithSnapshots(model, [[0, 1]], [1], {
      learningRate: 0.05,
      epochs: 5,
      lossFunction: 'mse',
    }, 1);

    expect(snapshots[0].parameters.length).toBeGreaterThan(0);
    expect(snapshots[0].parameters[0]).toHaveProperty('id');
    expect(snapshots[0].parameters[0]).toHaveProperty('data');
    expect(snapshots[0].parameters[0]).toHaveProperty('grad');
  });
});

/* ========================================================================== */
/* Graph Serialisation                                                        */
/* ========================================================================== */

describe('serialiseGraph', () => {
  it('serialises a simple graph', () => {
    resetValueCounter();
    const a = new Value(2.0, [], '', 'a');
    const b = new Value(3.0, [], '', 'b');
    const c = a.mul(b);
    const nodes = serialiseGraph(c);

    expect(nodes.length).toBe(3); // c, a, b
    const cNode = nodes.find((n) => n.op === '*');
    expect(cNode).toBeDefined();
    expect(cNode!.data).toBe(6);
    expect(cNode!.children).toHaveLength(2);
  });

  it('marks highlighted nodes', () => {
    const a = new Value(1.0, [], '', 'a');
    const b = a.tanh();
    const nodes = serialiseGraph(b, new Set([a.id]));

    const aNode = nodes.find((n) => n.label === 'a');
    expect(aNode!.highlighted).toBe(true);
    const bNode = nodes.find((n) => n.op === 'tanh');
    expect(bNode!.highlighted).toBe(false);
  });

  it('does not duplicate nodes in diamond graph', () => {
    const a = new Value(2.0);
    const b = a.add(a); // diamond: b depends on a twice
    const nodes = serialiseGraph(b);
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length); // No duplicates
  });
});

/* ========================================================================== */
/* Interactive Walkthrough (H.3.2)                                            */
/* ========================================================================== */

describe('generateWalkthrough', () => {
  it('generates all 10 steps', () => {
    const steps = generateWalkthrough();
    expect(steps).toHaveLength(10);
  });

  it('covers all 8 sections', () => {
    const steps = generateWalkthrough();
    const sections = new Set(steps.map((s) => s.section));
    expect(sections.size).toBe(8);
    expect(sections.has('value_basics')).toBe(true);
    expect(sections.has('operations')).toBe(true);
    expect(sections.has('chain_rule')).toBe(true);
    expect(sections.has('backpropagation')).toBe(true);
    expect(sections.has('neuron')).toBe(true);
    expect(sections.has('mlp')).toBe(true);
    expect(sections.has('training_loop')).toBe(true);
    expect(sections.has('moon_demo')).toBe(true);
  });

  it('each step has required fields', () => {
    const steps = generateWalkthrough();
    for (const step of steps) {
      expect(step.title).toBeTruthy();
      expect(step.explanation).toBeTruthy();
      expect(step.code).toBeTruthy();
      expect(step.graphSnapshot).toBeDefined();
      expect(Array.isArray(step.highlightedNodes)).toBe(true);
      expect(typeof step.stepIndex).toBe('number');
    }
  });

  it('step 5 (backpropagation) has non-zero gradients', () => {
    const steps = generateWalkthrough();
    const bpStep = steps.find((s) => s.section === 'backpropagation');
    expect(bpStep).toBeDefined();
    expect(bpStep!.result).toContain('a.grad');
    // Verify gradient values are non-zero in the result text
    expect(bpStep!.result).not.toContain('grad = 0.000000');
  });

  it('moon demo produces training results', () => {
    const steps = generateWalkthrough();
    const moonStep = steps.find((s) => s.section === 'moon_demo');
    expect(moonStep).toBeDefined();
    expect(moonStep!.result).toContain('Epochs');
    expect(moonStep!.result).toContain('Final loss');
  });
});

/* ========================================================================== */
/* Moon Dataset                                                               */
/* ========================================================================== */

describe('generateMoonDataset', () => {
  it('generates correct number of samples', () => {
    const data = generateMoonDataset(40, 0.15, 42);
    expect(data.xs).toHaveLength(40);
    expect(data.ys).toHaveLength(40);
  });

  it('generates balanced classes', () => {
    const data = generateMoonDataset(40, 0.15, 42);
    const pos = data.ys.filter((y) => y === 1).length;
    const neg = data.ys.filter((y) => y === -1).length;
    expect(pos).toBe(20);
    expect(neg).toBe(20);
  });

  it('produces 2D points', () => {
    const data = generateMoonDataset(10, 0.1, 42);
    for (const x of data.xs) {
      expect(x).toHaveLength(2);
      expect(typeof x[0]).toBe('number');
      expect(typeof x[1]).toBe('number');
    }
  });

  it('is deterministic with same seed', () => {
    const d1 = generateMoonDataset(20, 0.1, 123);
    const d2 = generateMoonDataset(20, 0.1, 123);
    expect(d1.xs).toEqual(d2.xs);
    expect(d1.ys).toEqual(d2.ys);
  });

  it('differs with different seeds', () => {
    const d1 = generateMoonDataset(20, 0.1, 1);
    const d2 = generateMoonDataset(20, 0.1, 2);
    expect(d1.xs).not.toEqual(d2.xs);
  });
});

/* ========================================================================== */
/* Decision Boundary                                                          */
/* ========================================================================== */

describe('generateDecisionBoundary', () => {
  it('generates a grid of predictions', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const boundary = generateDecisionBoundary(model);
    expect(boundary.length).toBeGreaterThan(0);
    for (const point of boundary) {
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
      expect(typeof point.predicted).toBe('number');
    }
  });

  it('produces correct grid size', () => {
    const model = new MLP(2, [4, 1], 'tanh', 42);
    const boundary = generateDecisionBoundary(model, [-1, 1], [-1, 1], 10);
    expect(boundary).toHaveLength(11 * 11); // (resolution+1)^2
  });
});

/* ========================================================================== */
/* Session Management                                                         */
/* ========================================================================== */

describe('Session Management', () => {
  it('creates a session', () => {
    const session = createSession('org-123');
    expect(session.id).toBeTruthy();
    expect(session.orgId).toBe('org-123');
    expect(session.walkthroughProgress).toBe(0);
    expect(session.model).toBeNull();
    expect(session.trainingResult).toBeNull();
  });

  it('retrieves a session', () => {
    const session = createSession('org-123');
    const retrieved = getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(session.id);
  });

  it('returns undefined for nonexistent session', () => {
    expect(getSession('nonexistent')).toBeUndefined();
  });

  it('lists sessions filtered by org', () => {
    createSession('org-a');
    createSession('org-a');
    createSession('org-b');

    expect(listSessions('org-a')).toHaveLength(2);
    expect(listSessions('org-b')).toHaveLength(1);
    expect(listSessions()).toHaveLength(3);
  });

  it('destroys a session', () => {
    const session = createSession('org-123');
    expect(destroySession(session.id)).toBe(true);
    expect(getSession(session.id)).toBeUndefined();
  });

  it('returns false destroying nonexistent session', () => {
    expect(destroySession('nope')).toBe(false);
  });

  it('evicts oldest session when limit reached', () => {
    // Create 50 sessions (limit)
    const sessions = [];
    for (let i = 0; i < 50; i++) {
      sessions.push(createSession('org'));
    }
    // Creating the 51st should evict the oldest
    const newest = createSession('org');
    expect(listSessions().length).toBeLessThanOrEqual(50);
    expect(getSession(newest.id)).toBeDefined();
  });
});

/* ========================================================================== */
/* Walkthrough Navigation                                                     */
/* ========================================================================== */

describe('Walkthrough Navigation', () => {
  it('advances through walkthrough steps', () => {
    const session = createSession('org-123');
    const step0 = advanceWalkthrough(session.id);
    expect(step0).not.toBeNull();
    expect(step0!.stepIndex).toBe(0);
    expect(step0!.section).toBe('value_basics');

    const step1 = advanceWalkthrough(session.id);
    expect(step1).not.toBeNull();
    expect(step1!.stepIndex).toBe(1);
  });

  it('returns null after all steps exhausted', () => {
    const session = createSession('org-123');
    // Advance through all 10 steps
    for (let i = 0; i < 10; i++) {
      expect(advanceWalkthrough(session.id)).not.toBeNull();
    }
    // 11th should be null
    expect(advanceWalkthrough(session.id)).toBeNull();
  });

  it('getWalkthroughStep returns specific step by index', () => {
    const session = createSession('org-123');
    const step = getWalkthroughStep(session.id, 5);
    expect(step).not.toBeNull();
    expect(step!.section).toBe('backpropagation');
  });

  it('getWalkthroughStep returns null for invalid index', () => {
    const session = createSession('org-123');
    expect(getWalkthroughStep(session.id, -1)).toBeNull();
    expect(getWalkthroughStep(session.id, 100)).toBeNull();
  });

  it('returns null for nonexistent session', () => {
    expect(advanceWalkthrough('nope')).toBeNull();
    expect(getWalkthroughStep('nope', 0)).toBeNull();
  });
});

/* ========================================================================== */
/* In-Session Training                                                        */
/* ========================================================================== */

describe('trainInSession', () => {
  it('trains XOR dataset', () => {
    const session = createSession('org-123');
    const result = trainInSession(session.id, [4, 4, 1], 'xor', {
      learningRate: 0.05,
      epochs: 30,
      lossFunction: 'hinge',
    });

    expect(result).not.toBeNull();
    expect(result!.totalEpochs).toBe(30);
    expect(result!.finalLoss).toBeDefined();

    // Session should have model and result stored
    const updated = getSession(session.id);
    expect(updated!.model).not.toBeNull();
    expect(updated!.trainingResult).not.toBeNull();
    expect(updated!.dataset).not.toBeNull();
  });

  it('trains moon dataset', () => {
    const session = createSession('org-123');
    const result = trainInSession(session.id, [8, 8, 1], 'moon', {
      learningRate: 0.02,
      epochs: 20,
      lossFunction: 'hinge',
      seed: 42,
    });

    expect(result).not.toBeNull();
    expect(result!.totalEpochs).toBe(20);
  });

  it('trains custom dataset', () => {
    const session = createSession('org-123');
    const result = trainInSession(session.id, [4, 1], 'custom', {
      epochs: 10,
    }, {
      xs: [[0], [1], [2]],
      ys: [0, 1, 2],
    });

    expect(result).not.toBeNull();
    expect(result!.totalEpochs).toBe(10);
  });

  it('returns null for custom without data', () => {
    const session = createSession('org-123');
    const result = trainInSession(session.id, [4, 1], 'custom', {});
    expect(result).toBeNull();
  });

  it('returns null for nonexistent session', () => {
    const result = trainInSession('nope', [4, 1], 'xor', {});
    expect(result).toBeNull();
  });
});

/* ========================================================================== */
/* Stats                                                                      */
/* ========================================================================== */

describe('getMicrogradStats', () => {
  it('returns current stats', () => {
    const stats = getMicrogradStats();
    expect(stats.activeSessions).toBe(0);

    createSession('org-a');
    createSession('org-b');

    const stats2 = getMicrogradStats();
    expect(stats2.activeSessions).toBe(2);
  });
});

/* ========================================================================== */
/* _resetForTesting                                                           */
/* ========================================================================== */

describe('_resetForTesting', () => {
  it('clears all state', () => {
    createSession('org');
    createSession('org');
    _resetForTesting();
    expect(listSessions()).toHaveLength(0);
    expect(getMicrogradStats().activeSessions).toBe(0);
  });
});

/* ========================================================================== */
/* Integration: end-to-end training + visualization                           */
/* ========================================================================== */

describe('Integration: full training pipeline', () => {
  it('creates session → trains → generates boundary → destroys', () => {
    const session = createSession('org-integ');

    // Train on moon dataset
    const result = trainInSession(session.id, [8, 8, 1], 'moon', {
      learningRate: 0.02,
      epochs: 30,
      lossFunction: 'hinge',
      seed: 42,
    });
    expect(result).not.toBeNull();
    expect(result!.finalLoss).toBeDefined();

    // Generate decision boundary
    const updated = getSession(session.id);
    expect(updated!.model).not.toBeNull();
    const boundary = generateDecisionBoundary(updated!.model!);
    expect(boundary.length).toBeGreaterThan(0);

    // Clean up
    expect(destroySession(session.id)).toBe(true);
    expect(getSession(session.id)).toBeUndefined();
  });

  it('walkthrough → train → snapshot pipeline', () => {
    const session = createSession('org-integ');

    // Walk through first 3 steps
    for (let i = 0; i < 3; i++) {
      const step = advanceWalkthrough(session.id);
      expect(step).not.toBeNull();
    }

    // Train with snapshots
    const model = new MLP(2, [4, 4, 1], 'tanh', 42);
    const moon = generateMoonDataset(40, 0.15, 42);
    const { result, snapshots } = trainWithSnapshots(model, moon.xs, moon.ys, {
      learningRate: 0.02,
      epochs: 20,
      lossFunction: 'hinge',
    }, 5);

    expect(result.totalEpochs).toBe(20);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0].loss).toBeDefined();

    destroySession(session.id);
  });
});

import {
  createSession,
  destroySession,
  listSessions,
  getSession,
  advanceWalkthrough,
  getWalkthroughStep,
  trainInSession,
  trainWithSnapshots,
  generateDecisionBoundary,
  generateMoonDataset,
  getMicrogradStats,
  MLP,
  type TrainingConfig,
} from '../../../services/agent-runtime/src/micrograd';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    // ── Session management ──

    case 'create_session': {
      const orgId = input.org_id as string;
      if (!orgId) return { error: 'org_id is required' };
      const session = createSession(orgId);
      return { result: { id: session.id, orgId: session.orgId, createdAt: session.createdAt } };
    }

    case 'destroy_session': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required' };
      const deleted = destroySession(sessionId);
      if (!deleted) return { error: `Session "${sessionId}" not found` };
      return { result: { destroyed: sessionId } };
    }

    case 'list_sessions': {
      const orgId = input.org_id as string | undefined;
      const sessions = listSessions(orgId);
      return {
        result: {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            orgId: s.orgId,
            walkthroughProgress: s.walkthroughProgress,
            hasModel: s.model !== null,
            hasTrainingResult: s.trainingResult !== null,
            updatedAt: s.updatedAt,
          })),
        },
      };
    }

    // ── Walkthrough ──

    case 'get_walkthrough_step': {
      const sessionId = input.session_id as string;
      const stepIndex = input.step_index as number;
      if (!sessionId) return { error: 'session_id is required' };
      if (stepIndex === undefined || stepIndex === null) return { error: 'step_index is required' };
      const step = getWalkthroughStep(sessionId, stepIndex);
      if (!step) return { error: `Step ${stepIndex} not found or session "${sessionId}" not found` };
      return { result: step };
    }

    case 'advance_walkthrough': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required' };
      const step = advanceWalkthrough(sessionId);
      if (!step) return { error: `No more steps or session "${sessionId}" not found` };
      return { result: step };
    }

    // ── Model operations ──

    case 'create_model': {
      const sessionId = input.session_id as string;
      const architecture = input.architecture as number[];
      const seed = input.seed as number | undefined;
      if (!sessionId) return { error: 'session_id is required' };
      if (!architecture || !Array.isArray(architecture) || architecture.length === 0) {
        return { error: 'architecture is required (array of layer sizes, e.g. [4, 4, 1])' };
      }
      const session = getSession(sessionId);
      if (!session) return { error: `Session "${sessionId}" not found` };

      const nin = architecture.length > 1 ? 2 : architecture[0]; // Default 2D input
      const model = new MLP(nin, architecture, 'tanh', seed);
      session.model = model;
      session.updatedAt = new Date().toISOString();

      return {
        result: {
          architecture: [nin, ...architecture],
          paramCount: model.parameters().length,
          layers: model.layers.length,
        },
      };
    }

    case 'train_model': {
      const sessionId = input.session_id as string;
      const datasetType = (input.dataset_type as string) || 'xor';
      const architecture = (input.architecture as number[]) || [4, 4, 1];
      const config: Partial<TrainingConfig> = {
        learningRate: (input.learning_rate as number) ?? 0.05,
        epochs: (input.epochs as number) ?? 100,
        lossFunction: (input.loss_function as 'mse' | 'hinge' | 'bce') ?? 'hinge',
        seed: input.seed as number | undefined,
      };

      if (!sessionId) return { error: 'session_id is required' };

      const customData = input.custom_data as { xs: number[][]; ys: number[] } | undefined;
      const result = trainInSession(
        sessionId,
        architecture,
        datasetType as 'xor' | 'moon' | 'custom',
        config,
        customData,
      );

      if (!result) return { error: `Session "${sessionId}" not found or invalid custom_data` };

      return {
        result: {
          totalEpochs: result.totalEpochs,
          finalLoss: result.finalLoss,
          finalAccuracy: result.finalAccuracy,
          paramCount: result.paramCount,
          converged: result.converged,
          firstSteps: result.steps.slice(0, 5).map((s) => ({
            epoch: s.epoch,
            loss: s.loss,
            accuracy: s.accuracy,
          })),
          lastSteps: result.steps.slice(-5).map((s) => ({
            epoch: s.epoch,
            loss: s.loss,
            accuracy: s.accuracy,
          })),
        },
      };
    }

    case 'train_with_snapshots': {
      const sessionId = input.session_id as string;
      const datasetType = (input.dataset_type as string) || 'moon';
      const architecture = (input.architecture as number[]) || [8, 8, 1];
      const snapshotEvery = (input.snapshot_every as number) || 10;

      if (!sessionId) return { error: 'session_id is required' };
      const session = getSession(sessionId);
      if (!session) return { error: `Session "${sessionId}" not found` };

      let xs: number[][];
      let ys: number[];
      const seed = (input.seed as number) ?? 42;

      switch (datasetType) {
        case 'xor':
          xs = [[0, 0], [0, 1], [1, 0], [1, 1]];
          ys = [-1, 1, 1, -1];
          break;
        case 'moon':
        default: {
          const moon = generateMoonDataset(60, 0.15, seed);
          xs = moon.xs;
          ys = moon.ys;
          break;
        }
      }

      const nin = xs[0]?.length ?? 2;
      const model = new MLP(nin, architecture, 'tanh', seed);
      const fullConfig: TrainingConfig = {
        learningRate: (input.learning_rate as number) ?? 0.02,
        epochs: (input.epochs as number) ?? 100,
        lossFunction: (input.loss_function as 'mse' | 'hinge' | 'bce') ?? 'hinge',
        seed,
      };

      const { result, snapshots } = trainWithSnapshots(model, xs, ys, fullConfig, snapshotEvery);

      session.model = model;
      session.trainingResult = result;
      session.dataset = { xs, ys };
      session.updatedAt = new Date().toISOString();

      return {
        result: {
          totalEpochs: result.totalEpochs,
          finalLoss: result.finalLoss,
          finalAccuracy: result.finalAccuracy,
          converged: result.converged,
          snapshotCount: snapshots.length,
          snapshots: snapshots.map((s) => ({
            epoch: s.epoch,
            loss: s.loss,
            accuracy: s.accuracy,
            gradNorm: s.gradNorm,
            boundaryPointCount: s.decisionBoundary?.length ?? 0,
          })),
        },
      };
    }

    case 'get_decision_boundary': {
      const sessionId = input.session_id as string;
      if (!sessionId) return { error: 'session_id is required' };
      const session = getSession(sessionId);
      if (!session) return { error: `Session "${sessionId}" not found` };
      if (!session.model) return { error: 'No model trained in this session yet' };

      const boundary = generateDecisionBoundary(session.model);
      return { result: { pointCount: boundary.length, boundary } };
    }

    case 'generate_moon_dataset': {
      const nSamples = (input.n_samples as number) || 60;
      const noise = (input.noise as number) || 0.15;
      const seed = (input.seed as number) || 42;
      const data = generateMoonDataset(nSamples, noise, seed);
      return {
        result: {
          sampleCount: data.xs.length,
          xs: data.xs,
          ys: data.ys,
          classes: { positive: data.ys.filter((y) => y === 1).length, negative: data.ys.filter((y) => y === -1).length },
        },
      };
    }

    // ── Stats ──

    case 'get_stats': {
      return { result: getMicrogradStats() };
    }

    default:
      return {
        error: `Unknown action "${action}". Use: create_session, destroy_session, list_sessions, get_walkthrough_step, advance_walkthrough, create_model, train_model, train_with_snapshots, get_decision_boundary, generate_moon_dataset, get_stats`,
      };
  }
}

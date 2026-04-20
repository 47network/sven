export const classifyTask = (task: any, options?: any) => ({});
export const scoreModel = (model: any, request: any, context?: any) => ({});
export const routeRequest = (request: any, fleet: any, context?: any): any => ({
  modelId: 'dummy',
  modelName: 'dummy',
  score: 1,
  reason: 'stub',
  fallbackChain: []
});
export const calculateVramBudget = (fleet: any, options?: any) => 0;
export const suggestEviction = (fleet: any, budget: number, options?: any) => ({ length: 0 });
export const splitContext = (context: any, maxTokens: number) => [];
export interface InferenceRequest {
  id: string;
  task: any;
  qualityPriority: any;
  prompt: string;
  maxTokens?: number;
  preferredModel?: string;
  preferLocal?: boolean;
  latencyBudgetMs?: number;
}
export interface RoutingDecision {
  modelId: string;
  modelName: string;
  score: number;
  reason: string;
  fallbackChain: string[];
}

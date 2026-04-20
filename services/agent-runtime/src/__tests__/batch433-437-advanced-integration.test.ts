import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const VERTICALS = [
  {
    name: 'event_sourcer',
    migration: '20260620700000_agent_event_sourcer.sql',
    typeFile: 'agent-event-sourcer.ts',
    skillDir: 'event-sourcer',
    prefix: 'evsrc',
    bk: 'event_sourcer',
    eks: ['evsrc.stream_created','evsrc.event_appended','evsrc.snapshot_created','evsrc.projection_rebuilt'],
    cases: ['evsrc_create_stream','evsrc_append_event','evsrc_read_stream','evsrc_create_snapshot','evsrc_create_projection','evsrc_rebuild_projection'],
    handlers: ['handleEvsrcCreateStream','handleEvsrcAppendEvent','handleEvsrcReadStream','handleEvsrcCreateSnapshot','handleEvsrcCreateProjection','handleEvsrcRebuildProjection'],
    interfaces: ['EventSourcerConfig','EventStream','EventProjection'],
    types: ['EventStoreBackend','StreamStatus','ProjectionStatus'],
  },
  {
    name: 'state_machine_runner',
    migration: '20260620710000_agent_state_machine_runner.sql',
    typeFile: 'agent-state-machine-runner.ts',
    skillDir: 'state-machine-runner',
    prefix: 'stmr',
    bk: 'state_machine_runner',
    eks: ['stmr.machine_created','stmr.transition_fired','stmr.machine_completed','stmr.machine_terminated'],
    cases: ['stmr_create_machine','stmr_send_event','stmr_get_state','stmr_get_history','stmr_terminate','stmr_visualize'],
    handlers: ['handleStmrCreateMachine','handleStmrSendEvent','handleStmrGetState','handleStmrGetHistory','handleStmrTerminate','handleStmrVisualize'],
    interfaces: ['StateMachineRunnerConfig','StateMachine','StateTransition'],
    types: ['MachineStatus'],
  },
  {
    name: 'request_router',
    migration: '20260620720000_agent_request_router.sql',
    typeFile: 'agent-request-router.ts',
    skillDir: 'request-router',
    prefix: 'rqrt',
    bk: 'request_router',
    eks: ['rqrt.rule_created','rqrt.weights_updated','rqrt.health_checked','rqrt.rule_toggled'],
    cases: ['rqrt_create_rule','rqrt_update_weights','rqrt_health_check','rqrt_get_metrics','rqrt_toggle_rule','rqrt_test_route'],
    handlers: ['handleRqrtCreateRule','handleRqrtUpdateWeights','handleRqrtHealthCheck','handleRqrtGetMetrics','handleRqrtToggleRule','handleRqrtTestRoute'],
    interfaces: ['RequestRouterConfig','RouteRule','RouteMetrics'],
    types: ['RoutingStrategy'],
  },
  {
    name: 'load_balancer_agent',
    migration: '20260620730000_agent_load_balancer_agent.sql',
    typeFile: 'agent-load-balancer-agent.ts',
    skillDir: 'load-balancer-agent',
    prefix: 'lbag',
    bk: 'load_balancer_agent',
    eks: ['lbag.backend_added','lbag.backend_removed','lbag.rebalance_completed','lbag.health_checked'],
    cases: ['lbag_add_backend','lbag_remove_backend','lbag_health_check','lbag_get_status','lbag_rebalance','lbag_configure'],
    handlers: ['handleLbagAddBackend','handleLbagRemoveBackend','handleLbagHealthCheck','handleLbagGetStatus','handleLbagRebalance','handleLbagConfigure'],
    interfaces: ['LoadBalancerAgentConfig','LBBackend','LBHealthCheck'],
    types: ['LBAlgorithm','BackendStatus','HealthCheckResult'],
  },
  {
    name: 'circuit_breaker_agent',
    migration: '20260620740000_agent_circuit_breaker_agent.sql',
    typeFile: 'agent-circuit-breaker-agent.ts',
    skillDir: 'circuit-breaker-agent',
    prefix: 'cbag',
    bk: 'circuit_breaker_agent',
    eks: ['cbag.breaker_created','cbag.circuit_tripped','cbag.circuit_reset','cbag.half_open_entered'],
    cases: ['cbag_create_breaker','cbag_get_state','cbag_force_open','cbag_force_close','cbag_get_events','cbag_configure'],
    handlers: ['handleCbagCreateBreaker','handleCbagGetState','handleCbagForceOpen','handleCbagForceClose','handleCbagGetEvents','handleCbagConfigure'],
    interfaces: ['CircuitBreakerAgentConfig','CircuitBreaker','CircuitEvent'],
    types: ['CircuitState','CircuitEventType'],
  },
];

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

const typesTs   = readFile('services/sven-eidolon/src/types.ts');
const eventBus  = readFile('services/sven-eidolon/src/event-bus.ts');
const taskExec  = readFile('services/sven-marketplace/src/task-executor.ts');
const barrel    = readFile('packages/shared/src/index.ts');

describe.each(VERTICALS)('Batch 433-437 · $name', (v) => {

  describe('migration', () => {
    const sql = readFile(`services/gateway-api/migrations/${v.migration}`);
    it('file exists', () => expect(sql.length).toBeGreaterThan(0));
    it('creates config table', () => expect(sql).toContain(`agent_${v.name}_configs`));
    it('has agent_id column', () => expect(sql).toContain('agent_id'));
    it('has created_at', () => expect(sql).toContain('created_at'));
    it('has index', () => expect(sql).toContain('CREATE INDEX'));
  });

  describe('types', () => {
    const src = readFile(`packages/shared/src/${v.typeFile}`);
    it('file exists', () => expect(src.length).toBeGreaterThan(0));
    v.interfaces.forEach((iface) => {
      it(`exports ${iface}`, () => expect(src).toContain(`export interface ${iface}`));
    });
    v.types.forEach((t) => {
      it(`exports ${t}`, () => expect(src).toContain(`export type ${t}`));
    });
  });

  it('barrel exports type file', () => {
    expect(barrel).toContain(`from './${v.typeFile.replace('.ts', '')}'`);
  });

  describe('SKILL.md', () => {
    const md = readFile(`skills/autonomous-economy/${v.skillDir}/SKILL.md`);
    it('exists', () => expect(md.length).toBeGreaterThan(0));
    it('has name', () => expect(md).toContain(`name: ${v.skillDir}`));
    it('has actions', () => expect(md).toContain('## Actions'));
    it('has pricing', () => expect(md).toContain('pricing:'));
  });

  it('BK contains value', () => expect(typesTs).toContain(`'${v.bk}'`));

  describe('EK', () => {
    v.eks.forEach((ek) => {
      it(`has ${ek}`, () => expect(typesTs).toContain(`'${ek}'`));
    });
  });

  it('districtFor has case', () => expect(typesTs).toContain(`case '${v.bk}':`));

  describe('SUBJECT_MAP', () => {
    v.eks.forEach((ek) => {
      it(`maps sven.${ek}`, () => expect(eventBus).toContain(`'sven.${ek}': '${ek}'`));
    });
  });

  describe('task-executor cases', () => {
    v.cases.forEach((c) => {
      it(`routes ${c}`, () => expect(taskExec).toContain(`case '${c}'`));
    });
  });

  describe('task-executor handlers', () => {
    v.handlers.forEach((h) => {
      it(`has ${h}`, () => expect(taskExec).toContain(h));
    });
  });
});

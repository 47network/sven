import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 343-347: Developer Tooling', () => {

  const migrations = [
    { file: '20260619800000_agent_api_documenter.sql', tables: ['agent_api_documenter_configs', 'agent_api_specs', 'agent_doc_pages'] },
    { file: '20260619810000_agent_sdk_generator.sql', tables: ['agent_sdk_generator_configs', 'agent_sdk_builds', 'agent_sdk_methods'] },
    { file: '20260619820000_agent_contract_tester.sql', tables: ['agent_contract_tester_configs', 'agent_contracts', 'agent_contract_results'] },
    { file: '20260619830000_agent_mock_server.sql', tables: ['agent_mock_server_configs', 'agent_mock_endpoints', 'agent_mock_requests'] },
    { file: '20260619840000_agent_test_harness.sql', tables: ['agent_test_harness_configs', 'agent_test_suites', 'agent_test_cases'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true); });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => { expect(fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8')).toContain(t); });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-api-documenter.ts', exports: ['DocFormat', 'DocPageType', 'PublishStatus'] },
    { file: 'agent-sdk-generator.ts', exports: ['SdkLanguage', 'BuildStatus', 'VersioningStrategy'] },
    { file: 'agent-contract-tester.ts', exports: ['ContractFramework', 'ContractStatus', 'CompatibilityLevel'] },
    { file: 'agent-mock-server.ts', exports: ['MockMethod', 'RecordMode', 'MatchStrategy'] },
    { file: 'agent-test-harness.ts', exports: ['SuiteType', 'TestStatus', 'HarnessMode'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true); });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => { expect(fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8')).toContain(exp); });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-api-documenter', 'agent-sdk-generator', 'agent-contract-tester', 'agent-mock-server', 'agent-test-harness']) {
      it(`exports ${b}`, () => { expect(idx).toContain(b); });
    }
  });

  const skills = [
    { dir: 'api-documenter', price: '14.99', archetype: 'engineer' },
    { dir: 'sdk-generator', price: '19.99', archetype: 'engineer' },
    { dir: 'contract-tester', price: '16.99', archetype: 'engineer' },
    { dir: 'mock-server', price: '12.99', archetype: 'engineer' },
    { dir: 'test-harness', price: '17.99', archetype: 'engineer' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const tc = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['api_documenter', 'sdk_generator', 'contract_tester', 'mock_server', 'test_harness']) {
      it(`has BK '${bk}'`, () => { expect(tc).toContain(`'${bk}'`); });
    }
    for (const ek of ['apdc.spec_generated', 'sdkg.sdk_generated', 'ctst.contract_created', 'mksv.mock_created', 'tshr.suite_completed']) {
      it(`has EK '${ek}'`, () => { expect(tc).toContain(`'${ek}'`); });
    }
    for (const bk of ['api_documenter', 'sdk_generator', 'contract_tester', 'mock_server', 'test_harness']) {
      it(`has districtFor case '${bk}'`, () => { expect(tc).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.apdc.spec_generated', 'sven.apdc.docs_published', 'sven.apdc.spec_validated', 'sven.apdc.version_diffed',
      'sven.sdkg.sdk_generated', 'sven.sdkg.package_built', 'sven.sdkg.tests_passed', 'sven.sdkg.package_published',
      'sven.ctst.contract_created', 'sven.ctst.contract_verified', 'sven.ctst.breaking_detected', 'sven.ctst.compatibility_checked',
      'sven.mksv.mock_created', 'sven.mksv.endpoint_added', 'sven.mksv.recording_started', 'sven.mksv.request_captured',
      'sven.tshr.suite_completed', 'sven.tshr.tests_passed', 'sven.tshr.flaky_detected', 'sven.tshr.report_generated',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(bus).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'apdc_generate_spec', 'apdc_generate_pages', 'apdc_validate_spec', 'apdc_publish_docs', 'apdc_diff_versions', 'apdc_add_examples',
      'sdkg_generate_sdk', 'sdkg_build_package', 'sdkg_run_tests', 'sdkg_publish_package', 'sdkg_update_sdk', 'sdkg_list_methods',
      'ctst_create_contract', 'ctst_verify_contract', 'ctst_detect_breaking', 'ctst_compatibility_check', 'ctst_generate_stubs', 'ctst_contract_report',
      'mksv_create_mock', 'mksv_add_endpoint', 'mksv_record_mode', 'mksv_replay_mode', 'mksv_request_log', 'mksv_simulate_latency',
      'tshr_run_suite', 'tshr_run_all', 'tshr_retry_failed', 'tshr_detect_flaky', 'tshr_generate_report', 'tshr_schedule_run',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(exec).toContain(`case '${c}'`); });
    }
    for (const h of ['handleApdcGenerateSpec', 'handleSdkgGenerateSdk', 'handleCtstCreateContract', 'handleMksvCreateMock', 'handleTshrRunSuite']) {
      it(`has handler ${h}`, () => { expect(exec).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_api_documenter.sql', 'agent_sdk_generator.sql', 'agent_contract_tester.sql', 'agent_mock_server.sql', 'agent_test_harness.sql',
      'agent-api-documenter.ts', 'agent-sdk-generator.ts', 'agent-contract-tester.ts', 'agent-mock-server.ts', 'agent-test-harness.ts',
      'api-documenter/SKILL.md', 'sdk-generator/SKILL.md', 'contract-tester/SKILL.md', 'mock-server/SKILL.md', 'test-harness/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});

# Resumable Stream Gate

Generated: 2026-03-21T02:10:07.603Z
Status: fail

## Checks
- [ ] stream_resume_reconnect_and_authz_runtime_pass: failed: ts-jest[ts-jest-transformer] (WARN) Define `ts-jest` config under `globals` is deprecated. Please do
transform: {
    <transform_regex>: ['ts-jest', { /* ts-jest config goes here in Jest */ }],
},
See more at https://kulshekhar.github.io/ts-jest/docs/getting-started/presets#advanced
FAIL src/__tests__/stream-resume.e2e.test.js
  ● Test suite failed to run

    Jest encountered an unexpected token

    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.

    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.

    By default "node_modules" folder is ignored by transformers.

    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.

    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation

    Details:

    /media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/services/gateway-api/src/routes/streams.ts:2
    import { EventEmitter } from 'node:events';
    ^^^^^^

    SyntaxError: Cannot use import statement outside a module

      at Runtime.createScriptFromCode (../../node_modules/jest-runtime/build/index.js:1505:14)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        4.23 s
Ran all test suites within paths "src/__tests__/stream-resume.e2e.test.js".
(node:229780) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
- [ ] stream_retention_expiry_policy_pass: failed: FAIL src/__tests__/streams.retention.test.ts
  ● Test suite failed to run

    ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/services/gateway-api/src/__tests__/streams.retention.test.ts'

      at runTestInternal (../../node_modules/jest-runner/build/runTest.js:170:27)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        0.3 s
Ran all test suites within paths "src/__tests__/streams.retention.test.ts".
- [ ] stream_owner_scope_contract_pass: failed: FAIL src/__tests__/streams.owner-scope-contract.test.ts
  ● Test suite failed to run

    ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/services/gateway-api/src/__tests__/streams.owner-scope-contract.test.ts'

      at runTestInternal (../../node_modules/jest-runner/build/runTest.js:170:27)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        0.3 s
Ran all test suites within paths "src/__tests__/streams.owner-scope-contract.test.ts".

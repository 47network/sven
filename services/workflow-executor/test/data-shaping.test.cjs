const test = require('node:test');
const assert = require('node:assert/strict');
const { applyDataShapingPipeline } = require('../dist/data-shaping.js');

test('data shaping pipeline: where -> sort -> pick -> head', () => {
  const input = [
    { id: 1, name: 'A', score: 8, active: true },
    { id: 2, name: 'B', score: 4, active: false },
    { id: 3, name: 'C', score: 7, active: true },
  ];

  const out = applyDataShapingPipeline(input, [
    { op: 'where', field: 'active', equals: true },
    { op: 'sort', field: 'score', direction: 'desc' },
    { op: 'pick', fields: ['id', 'name'] },
    { op: 'head', count: 1 },
  ]);

  assert.deepEqual(out, [{ id: 1, name: 'A' }]);
});

test('data shaping pipeline: map -> reduce(sum)', () => {
  const input = [{ score: 2 }, { score: 5 }, { score: 3 }];
  const out = applyDataShapingPipeline(input, [
    { op: 'map', template: { points: '$.score' } },
    { op: 'reduce', method: 'sum', field: 'points' },
  ]);
  assert.equal(out, 10);
});

test('data shaping pipeline: map rejects prototype-sensitive template keys', () => {
  const input = [{ id: 1 }];
  const template = JSON.parse('{"__proto__":"$.id"}');
  assert.throws(
    () =>
      applyDataShapingPipeline(input, [
        { op: 'map', template },
      ]),
    /reserved key/i,
  );
});

test('data shaping pipeline: map rejects non-safe template keys', () => {
  const input = [{ id: 1 }];
  assert.throws(
    () =>
      applyDataShapingPipeline(input, [
        { op: 'map', template: { 'a b': '$.id' } },
      ]),
    /key is invalid/i,
  );
});

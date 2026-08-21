import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateDecision } from '../../src/core/updates.js';

test('nothing waiting means nothing to do', () => {
  assert.equal(updateDecision({ waiting: false, activeSession: false }), 'none');
  assert.equal(updateDecision({ waiting: false, activeSession: true }), 'none');
  assert.equal(updateDecision({}), 'none');
  assert.equal(updateDecision(), 'none', 'called with nothing at all');
});

test('a waiting update is applied immediately when no workout is running', () => {
  // The regression this guards. Previously the ONLY path that applied an update
  // was a pill the user had to notice and tap. If they missed it, the worker sat
  // in `waiting` forever: no `updatefound` fires on later launches, because it
  // already installed. The app then served an old build indefinitely with no
  // visible sign anything was wrong.
  assert.equal(updateDecision({ waiting: true, activeSession: false }), 'apply');
});

test('a waiting update never interrupts a workout', () => {
  // Reloading mid-session discards the set being entered.
  assert.equal(updateDecision({ waiting: true, activeSession: true }), 'prompt');
});

test('the decision is total — every input combination is handled', () => {
  const seen = new Set();
  for (const waiting of [true, false]) {
    for (const activeSession of [true, false]) {
      const d = updateDecision({ waiting, activeSession });
      assert.ok(['apply', 'prompt', 'none'].includes(d), `unexpected: ${d}`);
      seen.add(d);
    }
  }
  assert.deepEqual([...seen].sort(), ['apply', 'none', 'prompt']);
});

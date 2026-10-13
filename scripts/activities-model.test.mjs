import test from 'node:test';
import assert from 'node:assert/strict';
import { projectActivities, validateDrawing } from '../src/lib/activities-model.ts';

const event = (id, kind, entityId, authorId, payload = {}, sequence = 1) => ({
  id, kind, entityId, authorId, payload, sequence, coupleId: 'couple', createdAt: sequence, status: 'sent',
});
test('reconstructs parents after paginated children, without duplicate retries', () => {
  const vote = event('vote', 'wish.vote', 'wish', 'evy', { interested: true }, 2);
  const items = projectActivities([vote, vote, event('wish', 'wish.create', 'wish', 'jota', { text: 'Ver o mar' })]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].interested, ['evy']);
});
test('changing one vote preserves the other person’s choice', () => {
  const items = projectActivities([
    event('wish', 'wish.create', 'wish', 'jota', { text: 'Ver o mar' }),
    event('a', 'wish.vote', 'wish', 'jota', { interested: true }, 2),
    event('b', 'wish.vote', 'wish', 'evy', { interested: true }, 3),
    event('c', 'wish.vote', 'wish', 'jota', { interested: false }, 4),
  ]);
  assert.deepEqual(items[0].interested, ['evy']);
});
test('only the drawing author can reveal; guessing never reveals the secret', () => {
  const root = event('round', 'game.start', 'round', 'jota', { drawing: [[{ x: 0, y: 1 }]] });
  const guesses = [root, event('guess', 'game.guess', 'round', 'evy', { text: 'Girassol' }, 2)];
  assert.equal(projectActivities(guesses)[0].answer, null);
  assert.equal(projectActivities([...guesses, event('spoof', 'game.reveal', 'round', 'evy', { text: 'secret' }, 3)])[0].answer, null);
  assert.equal(projectActivities([...guesses, event('reveal', 'game.reveal', 'round', 'jota', { text: 'Girassol' }, 4)])[0].answer, 'Girassol');
});
test('offline descendants apply after server events and keep pending/error states', () => {
  const item = projectActivities([
    event('wish', 'wish.create', 'wish', 'jota', { text: 'Ver o mar' }),
    event('date', 'wish.date', 'wish', 'evy', { date: 10 }, 2),
    { ...event('offline', 'wish.date', 'wish', 'jota', { date: null }, 0), status: 'pending' },
    { ...event('failure', 'wish.done', 'wish', 'jota', {}, 0), status: 'failed' },
  ])[0];
  assert.equal(item.date, null);
  assert.equal(item.pending, true);
  assert.equal(item.failed, true);
  assert.equal(item.doneAt, 0);
});
test('drawing validation rejects malformed, nonfinite, oversized and out-of-bounds data', () => {
  assert.equal(validateDrawing([[{ x: 0, y: 1 }]]), true);
  for (const input of [null, [], [[]], [[{ x: NaN, y: 0 }]], [[{ x: -1, y: 0 }]], Array(81).fill([{ x: 0, y: 0 }]), [Array(6001).fill({ x: 0, y: 0 })]]) {
    assert.equal(validateDrawing(input), false);
  }
});

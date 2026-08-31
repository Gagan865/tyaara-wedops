// Verify the promise-resolution contract of ConfirmProvider without a DOM:
// replicate the exact settle/confirm logic and assert it resolves correctly.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeConfirm(){
  let resolver = null, state = null;
  const confirm = (opts={}) => { state = {...opts}; return new Promise(r => { resolver = r; }); };
  const settle = (v) => { resolver?.(v); resolver = null; state = null; };
  return { confirm, settle, peek: () => state };
}

test('confirm resolves true when confirmed', async () => {
  const c = makeConfirm();
  const p = c.confirm({ title: 'Remove?' });
  assert.equal(c.peek().title, 'Remove?');
  c.settle(true);
  assert.equal(await p, true);
});

test('confirm resolves false when cancelled/dismissed', async () => {
  const c = makeConfirm();
  const p = c.confirm({ title: 'Remove?' });
  c.settle(false);
  assert.equal(await p, false);
});

test('guard pattern: `if (!await confirm(...)) return` aborts on cancel', async () => {
  const c = makeConfirm();
  let deleted = false;
  const action = async () => { if (!await c.confirm({})) return; deleted = true; };
  const run = action();
  c.settle(false);
  await run;
  assert.equal(deleted, false, 'must NOT delete when user cancels');
});

test('guard pattern proceeds on confirm', async () => {
  const c = makeConfirm();
  let deleted = false;
  const action = async () => { if (!await c.confirm({})) return; deleted = true; };
  const run = action();
  c.settle(true);
  await run;
  assert.equal(deleted, true, 'must delete when user confirms');
});

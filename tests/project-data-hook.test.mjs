// Simulate the useProjectData state machine (no React runtime needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function runLoad({ pmResult, pmError, loader, aborted=false }) {
  let state = { ctx:null, data:null, loading:true, error:null, noProject:false };
  const set = (s)=>{ state = typeof s==='function'? s(state) : s; };
  try {
    if (pmError) throw pmError;
    const pm = pmResult;
    if (!pm) { if(!aborted) set({ctx:null,data:null,loading:false,error:null,noProject:true}); return state; }
    const ctx = { projectId: pm.project_id, orgId: pm.projects?.org_id ?? null, project: pm.projects ?? null };
    const data = loader ? await loader(ctx) : null;
    if(!aborted) set({ctx,data,loading:false,error:null,noProject:false});
  } catch(e){ if(!aborted) set(s=>({...s,loading:false,error:e,noProject:false})); }
  return state;
}

test('no project -> noProject true, loading false (not stuck)', async () => {
  const s = await runLoad({ pmResult: null });
  assert.equal(s.loading, false, 'must not stay loading');
  assert.equal(s.noProject, true);
});

test('query error -> error set, loading false', async () => {
  const s = await runLoad({ pmError: new Error('boom') });
  assert.equal(s.loading, false);
  assert.equal(s.error.message, 'boom');
});

test('loader throws -> error surfaced, loading false', async () => {
  const s = await runLoad({ pmResult:{project_id:'p1',projects:{org_id:'o1'}}, loader: async()=>{ throw new Error('load fail'); }});
  assert.equal(s.loading, false);
  assert.equal(s.error.message, 'load fail');
});

test('happy path -> ctx + data populated', async () => {
  const s = await runLoad({ pmResult:{project_id:'p1',projects:{org_id:'o1'}}, loader: async(ctx)=>({v:[1,2], got:ctx.projectId}) });
  assert.equal(s.loading, false);
  assert.equal(s.error, null);
  assert.equal(s.ctx.projectId,'p1');
  assert.equal(s.ctx.orgId,'o1');
  assert.deepEqual(s.data.v,[1,2]);
});

test('null projects relation does not throw', async () => {
  const s = await runLoad({ pmResult:{project_id:'p1',projects:null}, loader: async()=>({}) });
  assert.equal(s.error, null);
  assert.equal(s.ctx.orgId, null, 'orgId null rather than TypeError');
});

test('aborted fetch does not write state', async () => {
  const s = await runLoad({ pmResult:{project_id:'p1',projects:{org_id:'o1'}}, loader: async()=>({}), aborted:true });
  assert.equal(s.loading, true, 'unmounted: state untouched');
});

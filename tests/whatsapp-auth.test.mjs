import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';

function constantTimeEqual(a,b){
  const A=Buffer.from(String(a)), B=Buffer.from(String(b));
  if(A.length!==B.length) return false;
  return timingSafeEqual(A,B);
}
// mirrors the auth decision in app/api/whatsapp/reply/route.js
function authorize({secret, header, user, membership}){
  const isWebhook = Boolean(secret && header && constantTimeEqual(header, secret));
  if(isWebhook) return {allowed:true, via:'webhook'};
  if(!user) return {allowed:false, status:401};
  if(!membership) return {allowed:false, status:403};
  return {allowed:true, via:'session'};
}

test('anonymous caller with no secret is rejected (the original vuln)', () => {
  const r = authorize({secret:'s3cret', header:null, user:null, membership:null});
  assert.equal(r.allowed,false); assert.equal(r.status,401);
});
test('wrong secret is rejected', () => {
  const r = authorize({secret:'s3cret', header:'guess', user:null, membership:null});
  assert.equal(r.allowed,false);
});
test('correct secret is accepted', () => {
  const r = authorize({secret:'s3cret', header:'s3cret', user:null, membership:null});
  assert.equal(r.allowed,true); assert.equal(r.via,'webhook');
});
test('signed-in NON-member is forbidden (cross-tenant blocked)', () => {
  const r = authorize({secret:'s3cret', header:null, user:{id:'u1'}, membership:null});
  assert.equal(r.allowed,false); assert.equal(r.status,403);
});
test('signed-in member of the message project is allowed', () => {
  const r = authorize({secret:'s3cret', header:null, user:{id:'u1'}, membership:{project_id:'p1'}});
  assert.equal(r.allowed,true); assert.equal(r.via,'session');
});
test('unset server secret cannot be bypassed with empty header', () => {
  const r = authorize({secret:undefined, header:'', user:null, membership:null});
  assert.equal(r.allowed,false,'must not treat missing config as open');
});
test('length mismatch does not throw', () => {
  assert.doesNotThrow(()=>constantTimeEqual('short','muchlongersecret'));
  assert.equal(constantTimeEqual('short','muchlongersecret'), false);
});

// tenant-scoping fix in /api/whatsapp/send
function buildSendArgs(body, pm){
  const {orgId:_o, projectId:_p, ...safe} = body||{};
  return {...safe, orgId: pm.projects.org_id, projectId: pm.project_id};
}
test('caller cannot override orgId/projectId', () => {
  const out = buildSendArgs({to:'+91',body:'x',orgId:'ATTACKER',projectId:'ATTACKER'},
                            {project_id:'p1',projects:{org_id:'o1'}});
  assert.equal(out.orgId,'o1'); assert.equal(out.projectId,'p1');
});

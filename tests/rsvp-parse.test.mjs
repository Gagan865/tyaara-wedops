import { test } from 'node:test';
import assert from 'node:assert/strict';

// OLD (buggy) ordering from the original route
function oldParse(reply){
  const r=(reply||'').trim().toLowerCase();
  if(r.startsWith('yes')||r.startsWith('y')||r==='1') return 'Coming';
  else if(r.startsWith('no')||r==='2') return 'Not coming';
  else if(r.startsWith('maybe')||r==='3') return 'Maybe';
  return null;
}
// NEW ordering
function newParse(reply){
  const r=(reply||'').trim().toLowerCase();
  if(r.startsWith('yes')||r==='y'||r==='1') return 'Coming';
  else if(r.startsWith('no')||r==='n'||r==='2') return 'Not coming';
  else if(r.startsWith('maybe')||r==='3') return 'Maybe';
  return null;
}

test('bare "n" was previously unhandled; now maps to Not coming', () => {
  assert.equal(oldParse('n'), null);          // guest reply silently ignored
  assert.equal(newParse('n'), 'Not coming');  // now recorded
});
test('yes variants', () => {
  ['yes','YES','Yes please','y','1'].forEach(v=>assert.equal(newParse(v),'Coming',v));
});
test('no variants', () => {
  ['no','NO','nope','n','2'].forEach(v=>assert.equal(newParse(v),'Not coming',v));
});
test('maybe variants', () => {
  ['maybe','MAYBE','3'].forEach(v=>assert.equal(newParse(v),'Maybe',v));
});
test('unparseable replies leave RSVP untouched', () => {
  ['','   ','what?','call me'].forEach(v=>assert.equal(newParse(v),null,JSON.stringify(v)));
});

// Run with Node 18 or later: node --test model.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const model = html.match(/<script id="model">([\s\S]*?)<\/script>/)[1];
const {runDay,compare,selectPolicy} = vm.runInNewContext(model + '\n;({runDay,compare,selectPolicy})');
const base = {requests:16,walkins:8,noShow:15,seed:42};
const empty = () => Array(16).fill(0);

test('empty demand leaves all capacity idle', () => {
  for (const r of compare({...base,requests:0,walkins:0})) {
    assert.equal(r.idle,16); assert.equal(r.advance,null); assert.equal(r.walkin,null); assert.equal(r.p90,null);
  }
});
test('holds limit advance bookings even under excess demand', () => {
  const r = runDay({attendance:Array(30).fill(true),arrivals:empty()},4);
  assert.equal(r.bookings,12); assert.equal(r.attended,12);
});
test('a no-show releases the slot to a waiting walk-in', () => {
  const arrivals = empty(); arrivals[0] = 1;
  const r = runDay({attendance:[false],arrivals},0);
  assert.equal(r.bookings,1); assert.equal(r.attended,0); assert.deepEqual([...r.waits],[0]);
});
test('walk-ins can wait 30 minutes and leave before minute 45', () => {
  const arrivals = empty(); arrivals[0] = 4;
  assert.deepEqual([...runDay({attendance:[],arrivals},0).waits],[0,15,30]);
});
test('closing clears the final queue', () => {
  const arrivals = empty(); arrivals[15] = 4;
  assert.deepEqual([...runDay({attendance:[],arrivals},0).waits],[0]);
});
test('paired demand is repeatable and capacity is conserved', () => {
  const rows = compare(base);
  assert.deepEqual(rows,compare(base));
  for (const r of rows) { assert.equal(r.visits+r.idle,16); assert.ok(r.visits<=16 && r.visits>=0); }
  assert.equal(selectPolicy(rows,70,45).held,4);
  assert.equal(selectPolicy(rows,100,100),undefined);
});
test('ties favor the smallest hold and absent demand waives only its own floor', () => {
  const rows = compare({...base,requests:0,walkins:0});
  assert.equal(selectPolicy(rows,100,100).held,0);
});

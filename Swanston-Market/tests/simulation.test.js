import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb,events} from '../server/db.js';
import {simulate} from '../server/simulation.js';
import {report,assure} from '../server/reports.js';
test('60-day history reconciles across five independent seeds',()=>{
 const db=openDb(':memory:');
 for(const seed of [1,17,999,260925,4294967295]){const id=simulate(db,{seed}),r=report(db,id);assert.equal(r.assurance.status,'PASS',JSON.stringify(r.assurance));assert.equal(r.days.length,60);assert.ok(r.totals.openingValue<=4000000);assert.equal(r.config.openingCash,1500000);assert.ok(r.totals.transactions<=r.totals.customers);assert.ok(r.totals.waste>0);assert.ok(r.totals.lost>0);}
 db.close();
});
test('history and config cannot be edited; new runs retain previous evidence',()=>{
 const db=openDb(':memory:'),a=simulate(db,{seed:1}),before=JSON.stringify(events(db,a));
 assert.throws(()=>db.prepare('UPDATE history SET day=2 WHERE run_id=?').run(a),/append-only/);
 assert.throws(()=>db.prepare('DELETE FROM history WHERE run_id=?').run(a),/append-only/);
 assert.throws(()=>db.prepare('UPDATE runs SET seed=2 WHERE id=?').run(a),/frozen/);
 assert.throws(()=>db.prepare('DELETE FROM runs WHERE id=?').run(a),/retained/);
 const b=simulate(db,{seed:2});assert.notEqual(a,b);assert.equal(JSON.stringify(events(db,a)),before);db.close();
});
test('assurance catches corrupted revenue, cash, inventory and expired-lot sales',()=>{
 const db=openDb(':memory:'),id=simulate(db,{seed:5}),r=report(db,id),base=events(db,id);
 for(const mutate of [h=>h.find(e=>e.type==='transaction').total++,h=>h.find(e=>e.type==='cash').balance++,h=>h.find(e=>e.type==='daily').inventory[0].qty++,h=>{const s=h.find(e=>e.type==='sale');h.find(e=>e.lot===s.lot&&e.type==='opening').expires=s.day;}]){const h=structuredClone(base);mutate(h);assert.equal(assure(r.config,h).status,'FAIL');}db.close();
});
test('zero-cash stress run never overspends and remains internally consistent',()=>{
 const db=openDb(':memory:'),id=simulate(db,{seed:1,openingCash:0}),r=report(db,id);assert.equal(r.assurance.status,'PASS');assert.ok(events(db,id).filter(e=>e.type==='cash').every(e=>e.balance>=0));db.close();
});

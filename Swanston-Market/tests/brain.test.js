import test from 'node:test';
import assert from 'node:assert/strict';
import {stockSignals,affordableQuantity} from '../server/brain.js';
test('purchasing caps, partial orders and zero-cash deferral',()=>{
 assert.equal(affordableQuantity(10,250,100),2);
 assert.equal(affordableQuantity(10,99,100),0);
 assert.equal(affordableQuantity(10,0,100),0);
 assert.equal(affordableQuantity(3,10000,100),3);
});
test('slow-mover response has an observation window and separate stock signals',()=>{
 assert.equal(stockSignals({stock:100,forecast:2,averageSales:1,day:6}).slow,false);
 assert.equal(stockSignals({stock:100,forecast:2,averageSales:1,day:7}).slow,true);
 assert.equal(stockSignals({stock:0,forecast:2,averageSales:1,day:7}).condition,'sold_out');
 assert.equal(stockSignals({stock:3,forecast:2,averageSales:1,day:7}).condition,'low_stock');
 assert.equal(stockSignals({stock:4,forecast:2,averageSales:1,day:7}).condition,null);
});

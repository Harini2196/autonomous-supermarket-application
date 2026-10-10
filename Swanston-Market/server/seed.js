import {openDb} from './db.js';
import {simulate} from './simulation.js';
const db=openDb();const existing=db.prepare('SELECT id FROM runs WHERE submitted=1').get();
console.time('Simulation');console.log('Submitted Run:',existing?.id||simulate(db,{submitted:true}));console.timeEnd('Simulation');db.close();

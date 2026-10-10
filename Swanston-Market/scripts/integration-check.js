import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3017'},windowsHide:true,stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server start timed out')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('error',reject);});
 const base='http://localhost:3017',get=async path=>{const response=await fetch(base+path);assert.equal(response.status,200);return response.json();};
 assert.equal((await fetch(base)).status,200);
 const runs=await get('/api/runs'),submitted=runs.find(r=>r.submitted),before=await get(`/api/runs/${submitted.id}/report`);
 assert.equal(before.assurance.status,'PASS');
 const response=await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:77})});
 const created=await response.json();assert.equal(response.status,201,JSON.stringify(created));
 const after=await get(`/api/runs/${created.id}/report`);assert.equal(after.assurance.status,'PASS');
 assert.deepEqual(await get(`/api/runs/${submitted.id}/report`),before);
 assert.ok((await get(`/api/runs/${submitted.id}/days/60`)).some(e=>e.type==='daily'));
 assert.equal((await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"seed":-1}'})).status,400);
 console.log(JSON.stringify({cleanStartup:'PASS',submitted:submitted.id,newRun:'PASS',submittedUnchanged:true,simulationMs:created.milliseconds}));
}finally{server.kill();}

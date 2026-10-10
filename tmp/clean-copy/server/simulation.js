import {randomUUID} from 'node:crypto';
import {catalogue,assumptions} from './catalogue.js';
import {stockSignals,affordableQuantity} from './brain.js';
export function simulate(db,{seed=260925,submitted=false,openingCash=assumptions.openingCash}={}) {
 const id=randomUUID(),config={...assumptions,openingCash,products:catalogue};
 if(catalogue.reduce((s,p)=>s+p.cost*p.initialQty,0)>4000000)throw Error('Opening budget exceeded');
 let state=seed>>>0,seq=0,cash=openingCash,lotId=0,txId=0;
 const rand=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const int=(a,b)=>a+Math.floor(rand()*(b-a+1));
 const weighted=(items,weight)=>{let n=rand()*items.reduce((s,p)=>s+weight(p),0);return items.find(p=>(n-=weight(p))<0)||items.at(-1);};
 const stocks=Object.fromEntries(catalogue.map(p=>[p.id,[]])),past=[]; let pending=[];
 const insert=db.prepare('INSERT INTO history VALUES(?,?,?,?,?,?)');
 const record=(day,type,data={},product=null)=>{insert.run(id,++seq,day,type,product,JSON.stringify(data));return seq;};
 const qty=p=>stocks[p.id].reduce((s,l)=>s+l.qty,0);
 const receive=(p,n,day,order=null)=>{const lot={id:++lotId,qty:n,received:day,expires:p.perishable?day+p.shelfLife:null};stocks[p.id].push(lot);record(day,order?'receipt':'opening',{qty:n,cost:p.cost,lot:lot.id,expires:lot.expires,order},p.id);};
 db.exec('BEGIN');
 try {
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?)').run(id,new Date().toISOString(),seed,JSON.stringify(config),submitted?1:0);
 catalogue.forEach(p=>receive(p,p.initialQty,1));
 for(let day=1;day<=60;day++){
  const openingCashDay=cash,received=pending;pending=[];
  received.forEach(o=>receive(o.p,o.qty,day,o.seq));
  let waste=0,revenue=0,cogs=0,units=0,transactions=0,lost=0;
  for(const p of catalogue)for(const l of stocks[p.id])if(l.qty&&l.expires!==null&&l.expires<=day){record(day,'expiry',{qty:l.qty,value:l.qty*p.cost,lot:l.id,expires:l.expires},p.id);waste+=l.qty*p.cost;l.qty=0;}
  const date=new Date(`${config.startDate}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+day-1);const dow=date.getUTCDay(),weekend=dow===0||dow===6;
  const customers=Math.round((weekend?105:150)*(dow===5?1.1:1)*(0.8+rand()*0.4));
  const requested={},sold={};
  for(let customer=1;customer<=customers;customer++){
   const r=rand(),mission=r<.45?'Lunch':r<.85?'Top-up':'Essentials';
   const weights=mission==='Lunch'?[1,6,4,1,2,9,.1,.1]:mission==='Top-up'?[5,3,2,5,5,2,1,1]:[3,1,1,2,1,.5,6,5];
   const cats=[...new Set(catalogue.map(p=>p.category))];const basket={};
   const lines=mission==='Lunch'?int(1,4):mission==='Top-up'?int(3,7):int(2,5);
   const hour=mission==='Lunch'?int(11,14):mission==='Top-up'?int(16,21):int(8,19);
   for(let line=0;line<lines;line++){const cat=weighted(cats,c=>weights[cats.indexOf(c)]),p=weighted(catalogue.filter(p=>p.category===cat),p=>p.popularity);basket[p.id]=(basket[p.id]||0)+(rand()<.15?2:1);}
   const cid=`D${day}-C${customer}`,tid=++txId;let total=0,transactionUnits=0;
   record(day,'customer',{customer:cid,mission,hour,requested:basket});
   for(const [pid,n] of Object.entries(basket)){
    const p=catalogue.find(p=>p.id===pid);requested[pid]=(requested[pid]||0)+n;let need=n;
    for(const l of stocks[pid]){if(!need)break;const take=Math.min(need,l.qty);if(!take)continue;
     if(l.expires!==null&&l.expires<=day)throw Error('Expired sale');
     l.qty-=take;need-=take;total+=take*p.price;cogs+=take*p.cost;transactionUnits+=take;sold[pid]=(sold[pid]||0)+take;
     record(day,'sale',{transaction:tid,customer:cid,qty:take,price:p.price,cost:p.cost,revenue:take*p.price,cogs:take*p.cost,lot:l.id,expires:l.expires},pid);
    }
    if(need){lost+=need;record(day,'unmet',{customer:cid,qty:need},pid);}
   }
   if(transactionUnits){transactions++;units+=transactionUnits;revenue+=total;cash+=total;record(day,'transaction',{transaction:tid,customer:cid,hour,mission,total,units:transactionUnits});record(day,'cash',{reason:'sale',transaction:tid,delta:total,balance:cash});}
  }
  past.push({requested,sold});const window=past.slice(-7),candidates=[];
  for(const p of catalogue){
   const forecast=Math.max(.5,window.reduce((s,d)=>s+(d.requested[p.id]||0),0)/window.length),avgSales=window.reduce((s,d)=>s+(d.sold[p.id]||0),0)/window.length,q=qty(p);
   const {condition,slow}=stockSignals({stock:q,forecast,averageSales:avgSales,day});
   if(condition)record(day,'brain',{condition,stock:q,forecast,action:day===60?'Horizon ended: report only':slow?'Suppress order: slow mover':'Evaluate replenishment'},p.id);
   const near=stocks[p.id].filter(l=>l.qty&&l.expires!==null&&l.expires-day<=2).reduce((s,l)=>s+l.qty,0);
   if(near)record(day,'brain',{condition:'near_expiry',qty:near,action:'Prioritise first-expiring stock; remove at expiry'},p.id);
   if(slow)record(day,'brain',{condition:'slow_mover',stock:q,averageSales:avgSales,action:'Suppress replenishment; recommend smaller opening allocation'},p.id);
   if(condition&&!slow&&day<60){const target=Math.ceil(forecast*(p.perishable?Math.min(3,p.shelfLife-1):5));candidates.push({p,wanted:Math.max(0,target-q),cover:q/forecast});}
  }
  let spend=0;
  candidates.sort((a,b)=>a.cover-b.cover||a.p.id.localeCompare(b.p.id));
  for(const {p,wanted} of candidates){const n=affordableQuantity(wanted,cash,p.cost);
   if(n<wanted)record(day,'brain',{condition:'cash_constrained',wanted,affordable:n,cash,action:n?'Place partial order':'Defer order'},p.id);
   if(n){const before=cash;cash-=n*p.cost;spend+=n*p.cost;const order=record(day,'order',{qty:n,cost:p.cost,total:n*p.cost,cashBefore:before,cashAfter:cash,arrivalDay:day+1},p.id);pending.push({p,qty:n,seq:order});record(day,'cash',{reason:'order',order,delta:-n*p.cost,balance:cash});record(day,'brain',{condition:'replenishment',order,qty:n,action:`Paid now; receive Day ${day+1}`},p.id);}
  }
  const inventory=catalogue.map(p=>({id:p.id,qty:qty(p),value:qty(p)*p.cost}));
  record(day,'daily',{date:date.toISOString().slice(0,10),weekend,customers,transactions,units,revenue,cogs,grossProfit:revenue-cogs,waste,lost,spend,openingCash:openingCashDay,closingCash:cash,inventory,inventoryValue:inventory.reduce((s,p)=>s+p.value,0)});
 }
 db.exec('COMMIT');return id;
 }catch(e){db.exec('ROLLBACK');throw e;}
}

const prisma=require("../config/prisma");
const {LRU,LFU,GDS,CAAC}=require("./policies");
const {calculateScore}=require("../services/cache/scoreCalculator");
const {cache}=require("../config/env");
function makeRequests(scenario,n){
  const cheap=Array.from({length:10},(_,i)=>({key:`product:P${String(i+1).padStart(3,"0")}`,cost:.1,size:10000,latency:5}));
  const expensive={key:"recommendation:U100",cost:9,size:50000,latency:2000};
  const out=[];
  for(let i=0;i<n;i++){
    if(scenario==="expensive-rare") out.push(i<n*.7?cheap[i%10]:i%20===0?expensive:cheap[i%10]);
    else if(scenario==="spike") out.push(i<n*.6?cheap[i%10]:({key:"product:P004",cost:.1,size:10000,latency:5}));
    else if(scenario==="gradual-shift") out.push(i<n/2?cheap[i%5]:cheap[5+(i%5)]);
    else out.push(cheap[i%10]);
  }
  return out;
}
function runPolicy(policyName,requests){
  const P={LRU,LFU,GDS,CAAC}[policyName]; 
  const engine=x=>calculateScore({frequency:Math.min(1,x.freq/20),recency:Math.min(1,x.last/Math.max(1,x.inserted+10)),retrievalCost:Math.min(1,x.cost/10),latency:Math.min(1,x.latency/2000),trend:Math.min(1,x.freq/10),objectSizeBytes:x.size}).finalScore;
  const p=policyName==="CAAC"?new CAAC(cache.capacity,engine):new P(cache.capacity);
  let hits=0,misses=0,cost=0,latencies=[];
  for(const r of requests){
    const start=Date.now(); if(p.get(r.key)!==null){hits++;latencies.push(1);continue;}
    misses++;cost+=r.cost;latencies.push(r.latency);p.put(r.key,{},r.cost,r.size);
  }
  const sorted=[...latencies].sort((a,b)=>a-b),p95=sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)];
  return {policy:policyName,totalRequests:requests.length,hits,misses,hitRate:hits/requests.length,avgLatencyMs:latencies.reduce((a,b)=>a+b,0)/latencies.length,p95LatencyMs:p95,backendCalls:misses,estimatedCost:cost,costSaved:requests.reduce((s,r)=>s+r.cost,0)-cost,memoryUsed:p.map.size};
}
async function runBenchmark(scenario="expensive-rare",requests=200){
  const workload=makeRequests(scenario,Math.min(5000,Math.max(10,Number(requests))));
  const results=["LRU","LFU","GDS","CAAC"].map(p=>runPolicy(p,workload));
  const rows=[];
  for(const r of results) rows.push(await prisma.benchmarkRun.create({data:{policy:r.policy,scenario,totalRequests:r.totalRequests,hits:r.hits,misses:r.misses,avgLatencyMs:r.avgLatencyMs,p95LatencyMs:r.p95LatencyMs,backendCalls:r.backendCalls,estimatedCost:r.estimatedCost,costSaved:r.costSaved,memoryUsed:r.memoryUsed}}));
  return {scenario,results:rows};
}
module.exports={runBenchmark,makeRequests};

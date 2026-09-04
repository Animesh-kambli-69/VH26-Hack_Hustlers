class Policy {
  constructor(capacity) { this.capacity=capacity; this.map=new Map(); this.tick=0; }
  get(key){const x=this.map.get(key); if(!x)return null; x.last=++this.tick;x.freq++;return x.value;}
  put(key,value,cost,size){
    this.tick++; if(this.map.has(key)){const x=this.map.get(key);x.value=value;x.freq++;x.last=this.tick;return null;}
    let evicted=null;
    if(this.map.size>=this.capacity){ evicted=this.chooseEviction(); this.map.delete(evicted); }
    this.map.set(key,{value,cost,size,freq:1,last:this.tick,inserted:this.tick}); return evicted;
  }
}
class LRU extends Policy { chooseEviction(){return [...this.map.entries()].sort((a,b)=>a[1].last-b[1].last)[0][0];} }
class LFU extends Policy { chooseEviction(){return [...this.map.entries()].sort((a,b)=>a[1].freq-b[1].freq || a[1].last-b[1].last)[0][0];} }
class GDS extends Policy { chooseEviction(){return [...this.map.entries()].sort((a,b)=>(a[1].cost/Math.max(1,a[1].size))-(b[1].cost/Math.max(1,b[1].size)))[0][0];} }
class CAAC extends Policy {
  constructor(capacity,engine){super(capacity);this.engine=engine;}
  score(x){return this.engine(x);}
  chooseEviction(){
    return [...this.map.entries()].sort((a,b)=>this.score(a[1])-this.score(b[1]))[0][0];
  }
}
module.exports={LRU,LFU,GDS,CAAC};

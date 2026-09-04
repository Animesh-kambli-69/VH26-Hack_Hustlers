const {LRU,LFU,GDS,CAAC}=require("../src/benchmarks/policies");
const engine=x=>x.cost/Math.max(1,x.size)*10000;
test("LRU evicts least recent",()=>{const p=new LRU(2);p.put("a",1,1,1);p.put("b",2,1,1);p.get("a");expect(p.put("c",3,1,1)).toBe("b");});
test("LFU evicts least frequent",()=>{const p=new LFU(2);p.put("a",1,1,1);p.put("b",2,1,1);p.get("a");expect(p.put("c",3,1,1)).toBe("b");});
test("GDS-style prefers cost per size",()=>{const p=new GDS(2);p.put("cheap",1,1,100);p.put("valuable",2,10,100);expect(p.put("x",3,5,100)).toBe("cheap");});
test("CAAC chooses lowest score",()=>{const p=new CAAC(2,x=>x.cost);p.put("a",1,1,1);p.put("b",2,10,1);expect(p.put("c",3,5,1)).toBe("a");});

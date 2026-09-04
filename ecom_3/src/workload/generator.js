const {makeRequests}=require("../benchmarks/benchmarkEngine");
module.exports={generate:(scenario,count=100)=>makeRequests(scenario,count)};

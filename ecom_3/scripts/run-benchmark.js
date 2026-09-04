require("dotenv").config();
const {runBenchmark}=require("../src/benchmarks/benchmarkEngine");
runBenchmark(process.argv[2]||"expensive-rare",Number(process.argv[3]||200)).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exit(1);});

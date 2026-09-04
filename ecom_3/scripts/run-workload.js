const {generate}=require("../src/workload/generator");
const scenario=process.argv[2]||"steady"; const count=Number(process.env.REQUESTS||100);
console.log(JSON.stringify({scenario,requests:generate(scenario,count)},null,2));

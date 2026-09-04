const {calculateScore}=require("../src/services/cache/scoreCalculator");
test("mandatory cheap-vs-expensive scenario is score-driven",()=>{
  const cheap=calculateScore({frequency:1,recency:.9,retrievalCost:.01,latency:.01,trend:.8,objectSizeBytes:10000});
  const expensive=calculateScore({frequency:.1,recency:.2,retrievalCost:1,latency:1,trend:.2,objectSizeBytes:50000});
  expect(expensive.finalScore).toBeGreaterThan(cheap.finalScore);
  expect(expensive.finalScore).toBeGreaterThan(0);
});

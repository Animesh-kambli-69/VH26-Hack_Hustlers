const {calculateRecency,calculateTrend,calculateScore}=require("../src/services/cache/scoreCalculator");
test("recency decays with age",()=>{expect(calculateRecency(new Date(Date.now()-1000))).toBeGreaterThan(calculateRecency(new Date(Date.now()-100000)));});
test("trend is normalized",()=>{expect(calculateTrend(10,2)).toBeLessThanOrEqual(1);});
test("expensive object can score higher than cheap frequent object",()=>{
  const cheap=calculateScore({frequency:1,recency:.9,retrievalCost:.01,latency:.01,trend:.9,objectSizeBytes:10000}).finalScore;
  const expensive=calculateScore({frequency:.1,recency:.3,retrievalCost:1,latency:1,trend:.2,objectSizeBytes:50000}).finalScore;
  expect(expensive).toBeGreaterThan(cheap);
});

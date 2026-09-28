const ccRates={
  "sla-white":{name:"SLA ABS White",minimum:1000,lowRate:35,highRate:32,threshold:100},
  "sla-clear":{name:"SLA ABS Clear Transparent",minimum:1500,lowRate:60,highRate:55,threshold:100},
  "mjf-pa12":{name:"MJF Nylon PA12 Grey",minimum:2000,lowRate:60,highRate:55,threshold:100},
  "sls-pa12":{name:"SLS Nylon PA12 White",minimum:2000,lowRate:60,highRate:55,threshold:100},
  "figure-pro":{name:"Figure Pro Black / Rubber",minimum:2500,lowRate:250,highRate:200,threshold:20}
};
function updateCCPrice(){
  const material=document.querySelector("#cc-material")?.value;
  const volume=Number(document.querySelector("#cc-volume")?.value||0);
  const price=document.querySelector("#cc-price");
  const breakdown=document.querySelector("#cc-breakdown");
  const rate=ccRates[material];
  if(!rate||!price||!breakdown)return;
  if(volume<=0){price.textContent="₹0";breakdown.textContent="Enter the model volume to calculate.";return;}
  const perCC=volume<rate.threshold?rate.lowRate:rate.highRate;
  const calculated=volume*perCC;
  const total=Math.max(rate.minimum,calculated);
  price.textContent="₹"+Math.round(total).toLocaleString("en-IN");
  breakdown.textContent=calculated<rate.minimum
    ? `${volume} CC × ₹${perCC}/CC = ₹${Math.round(calculated).toLocaleString("en-IN")} • Minimum charge ₹${rate.minimum.toLocaleString("en-IN")}`
    : `${volume} CC × ₹${perCC}/CC`;
}
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelector("#cc-material")?.addEventListener("change",updateCCPrice);
  document.querySelector("#cc-volume")?.addEventListener("input",updateCCPrice);
  updateCCPrice();
});

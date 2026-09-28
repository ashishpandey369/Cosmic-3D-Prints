(function(){

const SUPPORT_MIN_RATE=0.15;
const SUPPORT_MAX_RATE=0.30;

const ccRates={
  "sla-white":{minimum:1000,lowRate:35,highRate:32,threshold:100},
  "sla-clear":{minimum:1500,lowRate:60,highRate:55,threshold:100},
  "mjf-pa12":{minimum:2000,lowRate:60,highRate:55,threshold:100},
  "sls-pa12":{minimum:2000,lowRate:60,highRate:55,threshold:100},
  "figure-pro":{minimum:2500,lowRate:250,highRate:200,threshold:20}
};

function updateCCPrice(){
  const material=document.querySelector("#cc-material")?.value;
  const volume=Number(document.querySelector("#cc-volume")?.value||0);
  const price=document.querySelector("#cc-price");
  const breakdown=document.querySelector("#cc-breakdown");
  const estimate=document.querySelector("#cc-support-estimate");
  const rate=ccRates[material];
  if(!rate||!price||!breakdown)return;
  if(volume<=0){
    price.textContent="₹0";
    breakdown.textContent="Upload a model or enter CC manually.";
    if(estimate)estimate.innerHTML="";
    return;
  }
  const per=volume<rate.threshold?rate.lowRate:rate.highRate;
  const quantity=Math.max(1,Number(document.querySelector("#quote-quantity")?.value||1));
  const raw=volume*per;
  const supportMinCC=volume*SUPPORT_MIN_RATE;
  const supportMaxCC=volume*SUPPORT_MAX_RATE;
  const totalMinCC=volume+supportMinCC;
  const totalMaxCC=volume+supportMaxCC;
  const baseTotal=raw*quantity;
  const minTotal=totalMinCC*per*quantity;
  const maxTotal=totalMaxCC*per*quantity;
  price.textContent="₹"+Math.round(baseTotal).toLocaleString("en-IN");
  const one=volume.toFixed(2)+" CC × ₹"+per+"/CC = ₹"+Math.round(raw).toLocaleString("en-IN");
  breakdown.textContent=quantity>1?one+" • "+quantity+" copies = ₹"+Math.round(baseTotal).toLocaleString("en-IN"):one;
  if(estimate){
    estimate.innerHTML=`
      <strong>Estimated support &amp; final material range</strong>
      <span>Model material: <b>${volume.toFixed(2)} CC</b></span>
      <span>Estimated support material: <b>${supportMinCC.toFixed(2)}–${supportMaxCC.toFixed(2)} CC</b> <small>(15–30% planning range)</small></span>
      <span>Estimated total print material: <b>${totalMinCC.toFixed(2)}–${totalMaxCC.toFixed(2)} CC</b></span>
      <div class="cc-support-price">Estimated printing price: <b>₹${Math.round(minTotal).toLocaleString("en-IN")}–₹${Math.round(maxTotal).toLocaleString("en-IN")}</b></div>
      <small>Support usage is only an estimate. Actual supports depend on model geometry, orientation, support settings and the slicer.</small>`;
  }
}

function formatName(file){
  const ext=file.name.toLowerCase().split(".").pop();
  return ({stl:"STL",obj:"OBJ",3mf:"3MF",glb:"GLB",gltf:"GLTF",ply:"PLY",off:"OFF",step:"STEP",stp:"STEP",iges:"IGES",igs:"IGES",fbx:"FBX",3ds:"3DS",dae:"DAE",amf:"AMF",x3d:"X3D",wrl:"VRML",zip:"ZIP"})[ext]||ext.toUpperCase();
}

document.addEventListener("DOMContentLoaded",()=>{
  const input=document.querySelector("#cc-file");
  const volume=document.querySelector("#cc-volume");
  const status=document.querySelector("#cc-file-status");
  const name=document.querySelector("#cc-file-name");
  const preview=document.querySelector("#model-preview");
  let previewTimer=null;

  input?.addEventListener("change",async()=>{
    const file=input.files?.[0];
    if(!file)return;
    if(previewTimer)clearTimeout(previewTimer);
    preview?.classList.remove("visible");
    name.textContent=file.name;
    status.className="cc-file-status";
    volume.readOnly=false;
    volume.value="";
    updateCCPrice();

    const format=formatName(file);
    status.textContent=/\.(step|stp|iges|igs)$/i.test(file.name)
      ?"Loading CAD engine and preparing "+format+" model…"
      :"Loading "+format+" model and calculating volume…";

    try{
      if(!window.CosmicModelIO?.parseFile)throw new Error("3D model engine is still loading. Please wait a moment and select the file again.");
      const parsed=await window.CosmicModelIO.parseFile(file);
      const cc=parsed.volumeCC;
      if(!Number.isFinite(cc)||cc<=0)throw new Error("The model has no positive enclosed volume.");
      volume.value=cc.toFixed(2);
      volume.readOnly=true;
      status.className="cc-file-status success";
      status.textContent="Calculated volume: "+cc.toFixed(2)+" CC • "+format+" ready";
      updateCCPrice();
      previewTimer=setTimeout(()=>{
        preview?.classList.add("visible");
        window.CosmicPreview?.loadModel(file).catch(()=>{});
      },250);
    }catch(e){
      volume.readOnly=false;
      status.className="cc-file-status error";
      status.textContent=(e?.message||"Could not calculate this file. Enter CC manually.")+" You can still enter CC manually if needed.";
      preview?.classList.remove("visible");
    }
  });

  document.querySelector("#cc-material")?.addEventListener("change",updateCCPrice);
  volume?.addEventListener("input",updateCCPrice);
  document.querySelector("#quote-quantity")?.addEventListener("input",updateCCPrice);
  updateCCPrice();
});

window.CosmicCC={updateCCPrice};
})();
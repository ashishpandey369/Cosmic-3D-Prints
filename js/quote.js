document.addEventListener("DOMContentLoaded",()=>{
  const modelInput=document.querySelector("#cc-file");
  const modelName=document.querySelector("#cc-file-name");
  const modelStatus=document.querySelector("#cc-file-status");
  if(modelInput){
    modelInput.addEventListener("change",()=>{
      const file=modelInput.files?.[0];
      if(file){
        if(modelName) modelName.textContent=file.name;
        if(modelStatus && !window.CosmicModelIO) modelStatus.textContent="Model selected. Starting the 3D model engine…";
      }
    });
  }
});

document.addEventListener("DOMContentLoaded",()=>{
  const submit=document.querySelector("#quote-submit"),note=document.querySelector("#quote-submit-note"),ref=document.querySelector("#quote-reference");
  ref?.addEventListener("change",()=>{
    const files=[...ref.files],label=document.querySelector(".quote-secondary-upload");
    if(label) label.innerHTML="<span>✓</span> "+(files.length?files.length+" reference file"+(files.length>1?"s":"")+" selected":"Add reference images or files");
  });
  submit?.addEventListener("click",()=>{
    const name=document.querySelector("#quote-name")?.value.trim(),contact=document.querySelector("#quote-contact")?.value.trim(),description=document.querySelector("#quote-description")?.value.trim();
    if(!name||!contact||!description){note.textContent="Please add your name, phone/WhatsApp number and a short description of your idea.";note.className="quote-submit-note error";return}
    const material=document.querySelector("#cc-material")?.selectedOptions?.[0]?.textContent||"",volume=document.querySelector("#cc-volume")?.value||"Not calculated",quantity=document.querySelector("#quote-quantity")?.value||"1";
    const message="Hello Cosmic 3D Prints, I need a custom design/print quote.\n\nName: "+name+"\nContact: "+contact+"\nMaterial: "+material+"\nVolume: "+volume+" CC\nQuantity: "+quantity+"\n\nIdea: "+description;
    window.location.href="https://wa.me/919448588793?text="+encodeURIComponent(message);
  });
});
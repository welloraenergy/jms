import {collection,addDoc,updateDoc,doc,getDocs,query,where,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
const stages=[
 {key:"quotation",title:"1. Quotation Stage",fields:[["reference","QUOTATION REFERENCE"],["date","QUOTATION DATE","date"],["client","CLIENT","client"],["description","DESCRIPTION"],["estimatedLoadOut","ESTIMATED LOAD OUT"],["loadOutLocation","LOAD OUT LOCATION"],["minimumRentalDays","MIN. RENTAL DURATION (DAYS)","number"],["paymentTermsDays","PAYMENT TERMS (DAYS)","number"],["rentalItemType","RENTAL ITEM TYPE"],["subRentCompany","SUB-RENT COMPANY"],["subRentQuotation","SUB-RENT QUOTATION REFERENCE AND DATE"],["welloraSubRentPO","WELLORA ENERGY'S PO REFERENCE AND DATE FOR SUB-RENT"],["rentalItemPreparation","RENTAL ITEM PREPARATION"],["quotationStatus","QUOTATION STATUS"],["remarks","REMARKS"]]},
 {key:"clientPO",title:"2. Client Purchase Order",fields:[["reference","CLIENT PO REFERENCE"],["date","CLIENT PO DATE","date"],["loadOut","PO LOAD OUT","date"],["rentalDurationDays","TOTAL RENTAL DURATION (DAYS)","number"],["totalAmount","PO TOTAL AMOUNT","amount"],["currency","PO CURRENCY","currency"],["collectionType","COLLECTION TYPE"],["deliveryPreparation","DELIVERY PREPARATION"],["remarks","REMARKS"]]},
 {key:"delivery",title:"3. Wellora Delivery Ticket",fields:[["reference","DT REFERENCE"],["date","DT DATE","date"],["deliveryType","FULL/PARTIAL DELIVERY","delivery"],["deliveryStatus","DELIVERY STATUS"],["ticketStatus","DT STATUS"],["initialInvoiceDue","INITIAL INVOICE DUE TO SUBMIT TO CLIENT BY","date"],["remarks","REMARKS"]]},
 {key:"return",title:"4. Wellora Return Ticket",fields:[["reference","RT REFERENCE"],["date","RT DATE","date"],["actualRentalDuration","ACTUAL RENTAL DURATION","number"],["returnType","FULL/PARTIAL RETURN","return"],["returnStatus","RETURN STATUS"],["ticketStatus","RT STATUS"],["remarks","REMARKS"]]},
 {key:"invoice",title:"5. Wellora Invoice",fields:[["reference","INVOICE REFERENCE"],["date","INVOICE DATE","date"],["submissionDue","INVOICE SUBMISSION TO CLIENT DUE","date"],["invoiceStatus","INVOICE STATUS"],["totalAmount","TOTAL INVOICE AMOUNT","amount"],["currency","INVOICE CURRENCY","currency"],["remarks","REMARKS"]]}
];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalizeReference=v=>String(v||"").trim().replace(/\s+/g," ").toUpperCase();
async function uniqueId(reference){const bytes=new TextEncoder().encode(normalizeReference(reference));const hash=await crypto.subtle.digest("SHA-256",bytes);return "ref_"+Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
const vals=j=>{const r={...j.stages};r.quotation={reference:j.reference||"",date:j.quotationDate||"",client:j.clientId||"",description:j.description||"",...(r.quotation||{})};return r;};
const companyLabel=(id,companies)=>companies.find(c=>c.id===id)?.name||id||"";
function control(k,label,type,value,companies){
 const name=k,labelText=esc(label),v=esc(value);
 if(type==="currency")return `<label class="j-field">${labelText}<select name="${name}">${["MYR","USD"].map(x=>`<option value="${x}" ${x===(value||"MYR")?"selected":""}>${x}</option>`).join("")}</select></label>`;
 if(type==="client")return `<label class="j-field">${labelText}<select name="${name}" required><option value="">Select client</option>${companies.filter(c=>c.isClient&&c.status==="active").map(c=>`<option value="${esc(c.id)}" ${c.id===value?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>`;
 if(type==="delivery"||type==="return")return `<label class="j-field">${labelText}<select name="${name}"><option value="">Select</option>${["Full","Partial"].map(x=>`<option ${x===value?"selected":""}>${x}</option>`).join("")}</select></label>`;
 return `<label class="j-field">${labelText}${label==="REMARKS"||label==="DESCRIPTION"?`<textarea name="${name}" rows="2">${v}</textarea>`:`<input name="${name}" type="${type==="date"?"date":(type==="number"||type==="amount")?"number":"text"}" ${(type==="number"||type==="amount")?'min="0" step="any"':""} value="${v}">`}</label>`;
}
const filled=(s,v)=>s.fields.some(([k])=>k!=="currency"&&String(v?.[k]??"").trim());
const display=(s,k,t,v,companies)=>t==="client"?companyLabel(v?.[k],companies):t==="amount"&&v?.[k]!==""&&v?.[k]!=null?`${v.currency||"MYR"} ${v[k]}`:(t==="currency"?(v?.[k]||"MYR"):(v?.[k]||""));
function stageFields(s,v,companies){return s.fields.map(([k,l,t])=>control(k,l,t,v?.[k]??"",companies)).join("");}
function buildForm(j,companies){const stagesData=vals(j||{});let active=stages.find(s=>!filled(s,stagesData[s.key]))?.key||"quotation";return `<form id="stageJobForm"><p class="j-note">Complete the relevant fields in each stage. Expand any stage to edit it. Client and quotation reference are required.</p>${stages.map(s=>`<details class="j-stage" ${s.key===active?"open":""}><summary>${esc(s.title)} <small>${filled(s,stagesData[s.key])?"Recorded":"Not recorded"}</small></summary><div class="j-grid">${stageFields(s,stagesData[s.key],companies)}</div></details>`).join("")}<div class="j-actions"><button type="submit">${j?.id?"Save Job Changes":"Create Job"}</button><button type="button" id="cancelStageForm">Cancel</button></div><p id="stageError" class="j-note" role="alert"></p></form>`;}
function gather(f){const fd=new FormData(f),data={};for(const s of stages){data[s.key]={};for(const [k] of s.fields)data[s.key][k]=String(fd.get(s.key+"__"+k)||"").trim();}return data;}
function prefixedForm(j,companies){
 const stageData=vals(j||{}),active=stages.find(s=>!filled(s,stageData[s.key]))?.key||"quotation";
 return `<form id="stageJobForm"><p class="j-note">Expand stages and fill in the relevant information. Quotation reference and Client are required.</p>${stages.map(s=>`<details class="j-stage" ${s.key===active?"open":""}><summary>${esc(s.title)} <small>${filled(s,stageData[s.key])?"Recorded":"Not recorded"}</small></summary><div class="j-grid">${s.fields.map(([k,l,t])=>control(s.key+"__"+k,l,t,stageData[s.key]?.[k]??"",companies).replace(s.key==="quotation"&&k==="date"?"type=\\"date\\"":"__no_match__",s.key==="quotation"&&k==="date"?"type=\\"date\\" required":"__no_match__")).join("")}</div></details>`).join("")}<div class="j-actions"><button type="submit">${j?.id?"Save Job Changes":"Create Job"}</button><button type="button" id="cancelStageForm">Cancel</button></div><p id="stageError" role="alert" class="j-note"></p></form>`;
}
export function jobCards(jobs,companies){
 return jobs.map(j=>{let v=vals(j);return `<div class="j-card"><div class="j-row"><strong>${esc(v.quotation.reference||j.reference||"Unnamed job")}</strong><span class="j-sub">${esc(j.status||"In progress")}</span></div><p class="j-sub">${esc(companyLabel(v.quotation.client||j.clientId,companies)||j.clientName)} · ${esc(v.quotation.description||j.description||"")}</p><div class="j-actions"><button type="button" data-jobview="${esc(j.id)}">View Details</button><button type="button" data-jobedit="${esc(j.id)}">Edit Stages</button><button type="button" data-jobcsv="${esc(j.id)}">Export CSV</button><button type="button" data-jobpdf="${esc(j.id)}">Print / PDF</button></div></div>`;}).join("")||'<div class="j-card">No jobs yet.</div>';
}
export function jobDetail(j,companies){
 const v=vals(j);return `<div class="j-card"><h3>${esc(v.quotation.reference||j.reference)}</h3><p class="j-note">${esc(companyLabel(v.quotation.client,companies)||j.clientName)}</p>${stages.map(s=>`<details class="j-stage" ${s.key==="quotation"?"open":""}><summary>${esc(s.title)}</summary><dl class="j-details">${s.fields.map(([k,l,t])=>`<div><dt>${esc(l)}</dt><dd>${esc(display(s,k,t,v[s.key],companies))||"—"}</dd></div>`).join("")}</dl></details>`).join("")}</div>`;
}
export function initJobActions(root,{db,user,companies,jobs,reload,render}){
 const region=()=>document.getElementById("jmsFormRegion");
 async function openForm(j){
  region().innerHTML=`<div class="j-card"><h3>${j?"Edit Job":"New Job"}</h3>${prefixedForm(j,companies)}</div>`;
  document.getElementById("cancelStageForm").onclick=()=>region().innerHTML="";
  document.getElementById("stageJobForm").onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget,stagesData=gather(form);
   const q=stagesData.quotation,client=companies.find(c=>c.id===q.client&&c.isClient&&c.status==="active");
   if(!q.reference||!client){document.getElementById("stageError").textContent="Enter a quotation reference and select an active client.";return;}
   if(!q.date){document.getElementById("stageError").textContent="Quotation date is required to file the job under the correct month.";return;}
   if(j&&normalizeReference(q.reference)!==normalizeReference(j.reference)){
     document.getElementById("stageError").textContent="Quotation reference cannot be changed after creation. Contact the manager if a reference needs correction.";return;
   }
   const payload={stages:stagesData,reference:q.reference,referenceKey:normalizeReference(q.reference),jobPeriod:q.date.slice(0,7),quotationDate:q.date,description:q.description,clientId:q.client,clientName:client.name,updatedBy:user.uid,updatedAt:serverTimestamp()};
   const btn=form.querySelector('[type="submit"]');btn.disabled=true;
   try{
     if(j)await updateDoc(doc(db,"jobs",j.id),payload);
     else {
       const stableId=await uniqueId(q.reference);
       const legacy=await getDocs(query(collection(db,"jobs"),where("reference","==",q.reference)));
       if(!legacy.empty)throw new Error("A job with this quotation reference already exists. Open and edit the existing job.");
       const target=doc(db,"jobs",stableId);
       await runTransaction(db,async tx=>{
         const existing=await tx.get(target);
         if(existing.exists())throw new Error("A job with this quotation reference already exists. Open and edit the existing job.");
         tx.set(target,{...payload,status:"In progress",createdBy:user.uid,createdAt:serverTimestamp()});
       });
     }
     await reload();render();document.getElementById("jmsNotice").textContent="Job saved.";
   }
   catch(err){document.getElementById("stageError").textContent="Save failed: "+err.message;btn.disabled=false;}
  };region().scrollIntoView({block:"nearest",behavior:"smooth"});
 }
 function exportCSV(j){
  const v=vals(j),rows=[["STAGE","FIELD","VALUE"]];
  for(const s of stages)for(const [k,l,t] of s.fields)rows.push([s.title,l,t==="client"?companyLabel(v[s.key]?.[k],companies):v[s.key]?.[k]||""]);
  const csv=rows.map(r=>r.map(x=>{let y=String(x??"");if(/^[=+@\-\t\r]/.test(y))y="'"+y;return '"'+y.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="JMS-"+String(j.reference).replace(/[^a-z0-9-_]/gi,"_")+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function printJob(j){
  const v=vals(j);const w=window.open("","_blank");if(!w){alert("Allow pop-ups to print or save as PDF.");return;}
  const sections=stages.map(s=>`<section><h2>${esc(s.title)}</h2><table>${s.fields.map(([k,l,t])=>`<tr><th>${esc(l)}</th><td>${esc(t==="client"?companyLabel(v[s.key]?.[k],companies):v[s.key]?.[k])||"—"}</td></tr>`).join("")}</table></section>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>JMS ${esc(j.reference)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:20px;font-size:12px}h1{font-size:21px}h2{font-size:15px;background:#e9e5d7;padding:8px;break-after:avoid}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;text-align:left;overflow-wrap:anywhere}th{width:42%;background:#f5f5f5}section{break-inside:avoid;margin-top:15px}@page{size:A4 portrait;margin:13mm}</style></head><body><h1>Wellora JMS — Job Details</h1><p>${esc(j.reference)} · ${esc(j.clientName)}</p>${sections}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
 }
 document.getElementById("newJob")?.addEventListener("click",()=>openForm(null));
 root.querySelectorAll("[data-jobedit]").forEach(b=>b.onclick=()=>openForm(jobs.find(j=>j.id===b.dataset.jobedit)));
 root.querySelectorAll("[data-jobview]").forEach(b=>b.onclick=()=>{region().innerHTML=jobDetail(jobs.find(j=>j.id===b.dataset.jobview),companies);region().scrollIntoView({block:"nearest",behavior:"smooth"});});
 root.querySelectorAll("[data-jobcsv]").forEach(b=>b.onclick=()=>exportCSV(jobs.find(j=>j.id===b.dataset.jobcsv)));
 root.querySelectorAll("[data-jobpdf]").forEach(b=>b.onclick=()=>printJob(jobs.find(j=>j.id===b.dataset.jobpdf)));
}

import {jobCards,initJobActions} from "./job-stages.js";
import {collection,addDoc,updateDoc,doc,getDocs,query,orderBy,serverTimestamp} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
let db,role,user,companies=[],jobs=[],tab="clients",editing=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const manager=()=>role==="manager"||role==="superadmin";
const field=(key,label,val="",type="text")=>`<label class="j-field">${esc(label)}<input name="${key}" type="${type}" value="${esc(val)}"></label>`;
const card=(html)=>`<div class="j-card">${html}</div>`;
const shared=c=>`<div class="j-grid">${field("name","Company name",c.name)}${field("registrationNo","Registration number",c.registrationNo)}</div>`;
const details=(prefix,c)=>`<div class="j-grid">${field(prefix+"Address","Business address",c.address)}${field(prefix+"Contact","Contact person",c.contactPerson)}${field(prefix+"Phone","Contact number",c.phone)}${field(prefix+"Email","Contact email",c.email,"email")}${prefix==="client"?field("clientRegistrationStatus","Registration status",c.registrationStatus)+field("clientDeadline","Registration deadline",c.deadline,"date")+field("clientRemarks","Remarks",c.remarks):""}</div>`;
function buttons(){return `<nav class="j-nav">${[["clients","Clients"],["vendors","Vendors"],["jobs","Jobs"]].map(([k,v])=>`<button type="button" data-tab="${k}" class="${tab===k?"selected":""}">${v}</button>`).join("")}</nav><p class="j-note">Global company register · Client and Vendor records remain separate in views and exports.</p>`;}
function viewCompany(c){let p=c[tab==="clients"?"client":"vendor"]||{};return card(`<div class="j-row"><strong>${esc(c.name)}</strong>${manager()?`<button data-edit="${c.id}">Edit</button>`:""}</div><div class="j-sub">${esc(c.registrationNo||"No registration no.")} · ${esc(p.contactPerson||"No contact")} · ${esc(p.phone||"No phone")}</div><div class="j-sub">${esc(p.email||"")} ${p.address?" · "+esc(p.address):""}</div>${tab==="clients"?`<div class="j-sub">Registration: ${esc(p.registrationStatus||"—")} · Deadline: ${esc(p.deadline||"—")}</div>`:""}`);}
function render(){
 const root=$("jmsModules");if(!root)return;
 const options=companies.filter(c=>c.isClient&&c.status==="active").map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
 let content;
 if(tab==="jobs"){
  content=`<div class="j-row"><h3>Jobs</h3><button id="newJob">+ New Job</button></div>`+jobCards(jobs,companies);
 }else{
  let rows=companies.filter(c=>c[tab==="clients"?"isClient":"isVendor"]&&c.status==="active");
  content=`<div class="j-row"><h3>${tab==="clients"?"Client":"Vendor"} Register</h3><div class="j-actions">${manager()?'<button id="newCompany">+ Add Company</button>':""}<button id="exportRegister">Export CSV</button></div></div><input id="companySearch" placeholder="Search companies" aria-label="Search companies">`+
  `<div id="companyResults">${rows.length?rows.map(viewCompany).join(""):card("No entries yet.")}</div>`;
 }
 root.innerHTML=buttons()+content+`<div id="jmsFormRegion"></div><p id="jmsNotice" class="j-note" role="status"></p>`;
 root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
 if($("newCompany"))$("newCompany").onclick=()=>openCompany();
 if(tab==="jobs")initJobActions(root,{db,user,companies,jobs,reload,render});
 if($("exportRegister"))$("exportRegister").onclick=exportRegister;
 root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openCompany(companies.find(c=>c.id===b.dataset.edit)));
 if($("companySearch"))$("companySearch").oninput=e=>{
  const term=e.target.value.toLowerCase();const rows=companies.filter(c=>c[tab==="clients"?"isClient":"isVendor"]&&c.status==="active"&&[c.name,c.registrationNo,c[tab==="clients"?"client":"vendor"]?.contactPerson].join(" ").toLowerCase().includes(term));
  $("companyResults").innerHTML=rows.length?rows.map(viewCompany).join(""):card("No matching companies.");
  $("companyResults").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openCompany(companies.find(c=>c.id===b.dataset.edit)));
 };
}
function openCompany(c={}){
 $("jmsFormRegion").innerHTML=card(`<h3>${c.id?"Edit":"Register"} Company</h3><form id="companyForm">${shared(c)}<div class="j-row"><label><input type="checkbox" name="isClient" ${c.id?(c.isClient?"checked":""):"checked"}> Client</label><label><input type="checkbox" name="isVendor" ${c.isVendor?"checked":""}> Vendor</label></div><section id="clientFields"><h4>Client information</h4>${details("client",c.client||{})}</section><section id="vendorFields"><h4>Vendor information</h4>${details("vendor",c.vendor||{})}</section><label class="j-field">Company status<select name="status"><option value="active" ${c.status!=="inactive"?"selected":""}>Active</option><option value="inactive" ${c.status==="inactive"?"selected":""}>Inactive</option></select></label><div class="j-actions"><button type="submit">Save company</button><button type="button" id="cancelForm">Cancel</button></div></form>`);
 const form=$("companyForm");
 function toggle(){ $("clientFields").hidden=!form.elements.isClient.checked;$("vendorFields").hidden=!form.elements.isVendor.checked;}
 form.elements.isClient.onchange=toggle;form.elements.isVendor.onchange=toggle;toggle();
 $("cancelForm").onclick=()=>{$("jmsFormRegion").innerHTML="";};
 form.onsubmit=async e=>{
  e.preventDefault();if(!form.elements.isClient.checked&&!form.elements.isVendor.checked)return alert("Select Client and/or Vendor.");
  const v=new FormData(form);const get=k=>(v.get(k)||"").toString().trim();
  const make=p=>({address:get(p+"Address"),contactPerson:get(p+"Contact"),phone:get(p+"Phone"),email:get(p+"Email")});
  const client={...make("client"),registrationStatus:get("clientRegistrationStatus"),deadline:get("clientDeadline"),remarks:get("clientRemarks")};
  const vendor=make("vendor");
  const data={name:get("name"),registrationNo:get("registrationNo"),isClient:form.elements.isClient.checked,isVendor:form.elements.isVendor.checked,status:get("status"),client,vendor,updatedAt:serverTimestamp(),updatedBy:user.uid};
  if(!data.name)return alert("Company name is required.");
  try{form.querySelector('[type="submit"]').disabled=true;
   if(c.id)await updateDoc(doc(db,"companies",c.id),data);
   else await addDoc(collection(db,"companies"),{...data,createdAt:serverTimestamp(),createdBy:user.uid});
   await reload();render();$("jmsNotice").textContent="Company saved.";
  }catch(err){alert("Save failed: "+err.message);form.querySelector('[type="submit"]').disabled=false;}
 };
 $("jmsFormRegion").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function openJob(options){
 $("jmsFormRegion").innerHTML=card(`<h3>New Job</h3><form id="jobForm"><div class="j-grid">${field("reference","Quotation / Job reference")}${field("quotationDate","Quotation date","","date")}<label class="j-field">Client<select name="clientId" required><option value="">Select client</option>${options}</select></label>${field("description","Description")}</div><div class="j-actions"><button type="submit">Create job</button><button type="button" id="cancelForm">Cancel</button></div></form>`);
 $("cancelForm").onclick=()=>{$("jmsFormRegion").innerHTML="";};
 $("jobForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,v=new FormData(f),cid=v.get("clientId"),c=companies.find(x=>x.id===cid);if(!c)return alert("Select a client");
 const ref=String(v.get("reference")||"").trim();if(!ref)return alert("Reference required");
 try{f.querySelector('[type="submit"]').disabled=true;await addDoc(collection(db,"jobs"),{reference:ref,quotationDate:String(v.get("quotationDate")||""),description:String(v.get("description")||""),clientId:cid,clientName:c.name,status:"In progress",createdBy:user.uid,updatedBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await reload();render();$("jmsNotice").textContent="Job created.";}catch(err){alert("Job save failed: "+err.message);f.querySelector('[type="submit"]').disabled=false;}
 };
 $("jmsFormRegion").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function exportRegister(){
 const p=tab==="clients"?"client":"vendor";
 const headers=["Company","Registration No","Contact Person","Phone","Email","Address",...(p==="client"?["Registration Status","Deadline","Remarks"]:[])];
 const rows=companies.filter(c=>c[p==="client"?"isClient":"isVendor"]&&c.status==="active").map(c=>{let v=c[p]||{};return [c.name,c.registrationNo,v.contactPerson,v.phone,v.email,v.address,...(p==="client"?[v.registrationStatus,v.deadline,v.remarks]:[])];});
 const csv=[headers,...rows].map(r=>r.map(x=>{let s=String(x??"");if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="jms-"+p+"s.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function reload(){
 const [co,jo]=await Promise.all([getDocs(collection(db,"companies")),getDocs(collection(db,"jobs"))]);
 companies=co.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
 jobs=jo.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.reference.localeCompare(b.reference));
}
export async function startModules(firestore,currentUser,currentRole){
 db=firestore;user=currentUser;role=currentRole;
 const root=$("jmsModules");root.innerHTML="<p>Loading registers…</p>";
 try{await reload();render();}catch(err){root.textContent="Could not load JMS entries: "+err.message;}
}

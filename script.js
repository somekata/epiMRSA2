const REQUIRED = ["collection_date","ward","POT1","POT2","POT3","hospital","specimen"];
let raw = [];
let filtered = [];
let lastSignals = [];
const el = id => document.getElementById(id);
// ---- tabs ----
el("tabs").addEventListener("click", (e)=>{
 const btn = e.target.closest(".tab");
 if(!btn) return;
 const tab = btn.dataset.tab;
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b===btn));
 document.querySelectorAll(".tabpage").forEach(p=>{
   p.classList.toggle("active", p.id === `tab-${tab}`);
 });
});
// ---- events ----
el("csvFile").addEventListener("change", handleFile);
el("loadSampleBtn").addEventListener("click", loadSample);
el("applyBtn").addEventListener("click", applyFilters);
el("wardFilter").addEventListener("change", applyFilters);
el("hospitalFilter").addEventListener("change", applyFilters);
el("scanBtn").addEventListener("click", scanSignals);
el("searchBox").addEventListener("input", renderRawTable);
// ---- CSV parsing ----
function parseCSV(text){
 const lines = text.replace(/\r/g,"").split("\n").filter(l=>l.trim());
 const header = splitLine(lines[0]);
 const rows=[];
 for(let i=1;i<lines.length;i++){
   const cols = splitLine(lines[i]);
   const o={};
   header.forEach((h,ix)=>o[h]=cols[ix] ?? "");
   rows.push(o);
 }
 return rows;
}
function splitLine(line){
 const out=[]; let cur=""; let q=false;
 for(const c of line){
   if(c === '"'){ q=!q; continue; }
   if(c === "," && !q){ out.push(cur); cur=""; continue; }
   cur+=c;
 }
 out.push(cur);
 return out.map(s=>s.trim());
}
function handleFile(e){
 const f=e.target.files[0];
 if(!f) return;
 const r=new FileReader();
 r.onload=()=>{
   raw=parseCSV(r.result);
   standardize();
   initUI();
   applyFilters();
 };
 r.readAsText(f,"utf-8");
}
async function loadSample(){
 const res = await fetch("mrsa_sample_100records.csv");
 const txt = await res.text();
 raw=parseCSV(txt);
 standardize();
 initUI();
 applyFilters();
}
// ---- standardize ----
function standardize(){
 raw.forEach(d=>{
   d.collection_date = toDate(d.collection_date);
   d.test_date = toDate(d.test_date);
   d.ward = d.ward || "unknown";
   d.hospital = d.hospital || "unknown";
   d.specimen = d.specimen || "unknown";
   d.onset_type = d.onset_type || "unknown";
   d.clindamycin_R = num(d.clindamycin_R);
   d.vancomycin_MIC = num(d.vancomycin_MIC);
   d.daptomycin_MIC = num(d.daptomycin_MIC);
   d.POT = `${d.POT1}-${d.POT2}-${d.POT3}`;
 });
 const cols = Object.keys(raw[0]||{});
 const missing = REQUIRED.filter(c=>!cols.includes(c));
 el("colCheck").textContent = missing.length
   ? `不足カラム：${missing.join(", ")}`
   : `OK：必要カラムは揃っています`;
}
function initUI(){
 const wards=[...new Set(raw.map(d=>d.ward))].sort();
 el("wardFilter").innerHTML =
   `<option value="ALL">ALL</option>`+
   wards.map(w=>`<option value="${w}">${w}</option>`).join("");
 const hosps=[...new Set(raw.map(d=>d.hospital))].sort();
 el("hospitalFilter").innerHTML =
   `<option value="ALL">ALL</option>`+
   hosps.map(h=>`<option value="${h}">${h}</option>`).join("");
 const dates=raw.map(d=>d.collection_date).filter(Boolean).sort((a,b)=>a-b);
 if(dates.length){
   el("startDate").value=toISO(dates[0]);
   el("endDate").value=toISO(dates[dates.length-1]);
 }
}
// ---- filtering ----
function applyFilters(){
 const sd = el("startDate").value ? new Date(el("startDate").value) : null;
 const ed = el("endDate").value ? new Date(el("endDate").value) : null;
 const ward = el("wardFilter").value;
 const hosp = el("hospitalFilter").value;
 filtered = raw.filter(d=>{
   if(!d.collection_date) return false;
   if(sd && d.collection_date < sd) return false;
   if(ed && d.collection_date > ed) return false;
   if(ward!=="ALL" && d.ward!==ward) return false;
   if(hosp!=="ALL" && d.hospital!==hosp) return false;
   return true;
 });
 // rerender all views
 renderStats();
 renderWardBar();
 renderSpecimenPie();
 renderTotalLine();
 renderPOTTrend();
 renderPOTProfile();
 renderRawTable();
 clearSignals();
}
// ---- Overview stats ----
function renderStats(){
 const total=filtered.length;
 const uniqPOT=new Set(filtered.map(d=>d.POT)).size;
 const wardTop=topKey(countBy(filtered,"ward"));
 const hospTop=topKey(countBy(filtered,"hospital"));
 el("stats").innerHTML=`
<div class="stat"><div class="label">分離数</div><div class="value">${total}</div></div>
<div class="stat"><div class="label">ユニークPOT</div><div class="value">${uniqPOT}</div></div>
<div class="stat"><div class="label">最多病棟</div><div class="value">${wardTop||"-"}</div></div>
<div class="stat"><div class="label">最多施設</div><div class="value">${hospTop||"-"}</div></div>
 `;
}
// ---- Chart helpers ----
function setupCanvas(id){
 const c = el(id);
 const ctx = c.getContext("2d");
 ctx.clearRect(0,0,c.width,c.height);
 return {c, ctx};
}
function axes(ctx, pad, w, h){
 ctx.strokeStyle="#3a457a"; ctx.lineWidth=1;
 ctx.beginPath();
 ctx.moveTo(pad.l,pad.t);
 ctx.lineTo(pad.l,pad.t+h);
 ctx.lineTo(pad.l+w,pad.t+h);
 ctx.stroke();
}
// ---- Overview: Ward bar ----
function renderWardBar(){
 const {c, ctx} = setupCanvas("wardBar");
 if(!filtered.length){ drawText(ctx,"データなし",20,40); return; }
 const counts = countBy(filtered, "ward");
 const keys = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
 const vals = keys.map(k=>counts[k]);
 const maxY = Math.max(3, ...vals);
 const pad={l:50,r:15,t:15,b:45};
 const w=c.width-pad.l-pad.r, h=c.height-pad.t-pad.b;
 axes(ctx,pad,w,h);
 // y grid
 ctx.fillStyle="#a9b1d6"; ctx.font="12px sans-serif";
 for(let i=0;i<=4;i++){
   const y=pad.t+h-(h*i/4), v=Math.round(maxY*i/4);
   ctx.fillText(v,8,y+4);
   ctx.strokeStyle="#1e264a"; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+w,y); ctx.stroke();
 }
 const barW = w/keys.length*0.7;
 keys.forEach((k,ix)=>{
   const x = pad.l + (w*ix/keys.length) + (w/keys.length - barW)/2;
   const bh = h*counts[k]/maxY;
   ctx.fillStyle="#7aa2f7";
   ctx.fillRect(x, pad.t+h-bh, barW, bh);
   ctx.fillStyle="#e8ecff";
   ctx.fillText(k, x-2, pad.t+h+18);
 });
}
// ---- Overview: Specimen pie ----
function renderSpecimenPie(){
 const {c, ctx} = setupCanvas("specimenPie");
 if(!filtered.length){ drawText(ctx,"データなし",20,40); return; }
 const counts = countBy(filtered, "specimen");
 const keys = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
 const total = keys.reduce((s,k)=>s+counts[k],0);
 const cx=c.width/2, cy=c.height/2, r=Math.min(cx,cy)*0.7;
 const colors=["#9ece6a","#7aa2f7","#ff9e64","#bb9af7","#f7768e","#2ac3de"];
 let start= -Math.PI/2;
 keys.forEach((k,ix)=>{
   const frac = counts[k]/total;
   const end = start + frac*2*Math.PI;
   ctx.beginPath();
   ctx.moveTo(cx,cy);
   ctx.arc(cx,cy,r,start,end);
   ctx.closePath();
   ctx.fillStyle=colors[ix%colors.length];
   ctx.fill();
   start=end;
 });
 // legend
 ctx.font="12px sans-serif";
 keys.forEach((k,ix)=>{
   const y=12+ix*16;
   ctx.fillStyle=colors[ix%colors.length];
   ctx.fillRect(8,y-9,10,10);
   ctx.fillStyle="#e8ecff";
   ctx.fillText(`${k} (${Math.round(counts[k]/total*100)}%)`, 22,y);
 });
}
// ---- Overview: total per month line ----
function renderTotalLine(){
 const {c, ctx} = setupCanvas("totalLine");
 if(!filtered.length){ drawText(ctx,"データなし",20,40); return; }
 const monthly = groupByMonth(filtered);
 const months = Object.keys(monthly).sort();
 const vals = months.map(m=>monthly[m].length);
 const maxY = Math.max(3, ...vals);
 const pad={l:50,r:15,t:15,b:45};
 const w=c.width-pad.l-pad.r, h=c.height-pad.t-pad.b;
 axes(ctx,pad,w,h);
 // y grid
 ctx.fillStyle="#a9b1d6"; ctx.font="12px sans-serif";
 for(let i=0;i<=4;i++){
   const y=pad.t+h-(h*i/4), v=Math.round(maxY*i/4);
   ctx.fillText(v,8,y+4);
   ctx.strokeStyle="#1e264a"; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+w,y); ctx.stroke();
 }
 // x labels + line
 ctx.strokeStyle="#9ece6a"; ctx.lineWidth=2;
 ctx.beginPath();
 vals.forEach((v,ix)=>{
   const x=pad.l+(w*ix/(months.length-1||1));
   const y=pad.t+h-(h*v/maxY);
   if(ix===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
   ctx.fillStyle="#a9b1d6";
   ctx.fillText(months[ix], x-18, pad.t+h+18);
 });
 ctx.stroke();
}
// ---- Trend: top 5 POT line ----
function renderPOTTrend(){
 const {c, ctx} = setupCanvas("potTrendCanvas");
 if(!filtered.length){ drawText(ctx,"データなし",20,40); return; }
 const monthly=groupByMonth(filtered);
 const months=Object.keys(monthly).sort();
 const potCounts=countBy(filtered,"POT");
 const topPOTs=Object.entries(potCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
 const series=topPOTs.map(p=>months.map(m=>monthly[m].filter(d=>d.POT===p).length));
 const maxY=Math.max(3,...series.flat());
 const pad={l:55,r:15,t:15,b:45};
 const w=c.width-pad.l-pad.r, h=c.height-pad.t-pad.b;
 axes(ctx,pad,w,h);
 // y grid
 ctx.fillStyle="#a9b1d6"; ctx.font="12px sans-serif";
 for(let i=0;i<=5;i++){
   const y=pad.t+h-(h*i/5), v=Math.round(maxY*i/5);
   ctx.fillText(v,8,y+4);
   ctx.strokeStyle="#1e264a"; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+w,y); ctx.stroke();
 }
 // x labels
 months.forEach((m,ix)=>{
   const x=pad.l+(w*ix/(months.length-1||1));
   ctx.fillStyle="#a9b1d6";
   ctx.fillText(m,x-18,pad.t+h+18);
 });
 const colors=["#7aa2f7","#9ece6a","#ff9e64","#bb9af7","#f7768e"];
 series.forEach((arr,si)=>{
   ctx.strokeStyle=colors[si%colors.length];
   ctx.lineWidth=2; ctx.beginPath();
   arr.forEach((v,ix)=>{
     const x=pad.l+(w*ix/(months.length-1||1));
     const y=pad.t+h-(h*v/maxY);
     if(ix===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
   });
   ctx.stroke();
 });
 // legend
 topPOTs.forEach((p,si)=>{
   ctx.fillStyle=colors[si%colors.length];
   ctx.fillRect(pad.l+si*180,2,10,10);
   ctx.fillStyle="#e8ecff";
   ctx.fillText(p,pad.l+si*180+14,12);
 });
}
// ---- Profile: heatmap + cards ----
function renderPOTProfile(){
 renderPotWardHeatmap();
 renderPotCards();
}
function renderPotWardHeatmap(){
 const {c, ctx} = setupCanvas("potWardHeatmap");
 if(!filtered.length){ drawText(ctx,"データなし",20,40); return; }
 const pots = [...new Set(filtered.map(d=>d.POT))].sort();
 const wards = [...new Set(filtered.map(d=>d.ward))].sort();
 const table = {};
 let maxV=1;
 wards.forEach(w=>{
   table[w]={};
   pots.forEach(p=>{
     const v = filtered.filter(d=>d.ward===w && d.POT===p).length;
     table[w][p]=v;
     if(v>maxV) maxV=v;
   });
 });
 const pad={l:120,r:10,t:20,b:60};
 const w=c.width-pad.l-pad.r, h=c.height-pad.t-pad.b;
 const cellW=w/pots.length, cellH=h/wards.length;
 // cells
 wards.forEach((ward,iy)=>{
   pots.forEach((pot,ix)=>{
     const v=table[ward][pot];
     const alpha = v/maxV;
     ctx.fillStyle=`rgba(122,162,247,${0.15+0.85*alpha})`;
     ctx.fillRect(pad.l+ix*cellW, pad.t+iy*cellH, cellW-1, cellH-1);
   });
 });
 // labels
 ctx.fillStyle="#e8ecff"; ctx.font="12px sans-serif";
 wards.forEach((ward,iy)=>{
   const y=pad.t+iy*cellH+cellH*0.6;
   ctx.fillText(ward, 8, y);
 });
 pots.forEach((pot,ix)=>{
   const x=pad.l+ix*cellW+2;
   ctx.save();
   ctx.translate(x, pad.t+h+4);
   ctx.rotate(-Math.PI/3);
   ctx.fillText(pot,0,0);
   ctx.restore();
 });
 // border
 ctx.strokeStyle="#243064";
 ctx.strokeRect(pad.l, pad.t, w, h);
}
function renderPotCards(){
 const pots = groupBy(filtered, d=>d.POT);
 const potKeys = Object.keys(pots).sort((a,b)=>pots[b].length-pots[a].length);
 const cards = potKeys.map(pot=>{
   const arr=pots[pot], n=arr.length;
   const wardTop=topKey(countBy(arr,"ward"));
   const specTop=topKey(countBy(arr,"specimen"));
   const onsetTop=topKey(countBy(arr,"onset_type"));
   const cldmRate=arr.filter(d=>d.clindamycin_R===1).length/n;
   const vancHigh=arr.filter(d=>d.vancomycin_MIC>=2).length/n;
   const dapHigh=arr.filter(d=>d.daptomycin_MIC>=1).length/n;
   const label = autoLabel({wardTop,specTop,onsetTop,cldmRate,vancHigh,dapHigh});
   const sim = similarPOTs(pot).join(", ") || "—";
   return `
<div class="pot-card">
<div class="pot-title">${pot} <span class="tag">${n} isolates</span></div>
<div class="tags">
<span class="tag">Ward: ${wardTop||"-"}</span>
<span class="tag">Specimen: ${specTop||"-"}</span>
<span class="tag">Onset: ${onsetTop||"-"}</span>
<span class="tag ${cldmRate>0.6?"bad":cldmRate>0.3?"warn":"good"}">
           CLDM-R ${Math.round(cldmRate*100)}%
</span>
<span class="tag ${vancHigh>0.2?"warn":"good"}">
           VCM MIC≥2 ${Math.round(vancHigh*100)}%
</span>
<span class="tag ${dapHigh>0.2?"warn":"good"}">
           DAP MIC≥1 ${Math.round(dapHigh*100)}%
</span>
</div>
<div class="desc" style="margin-top:7px"><b>自動ラベル：</b> ${label}</div>
<div class="desc"><b>類似POT：</b> ${sim}</div>
</div>
   `;
 }).join("");
 el("potCards").innerHTML = cards || `<div class="desc">POTなし</div>`;
}
function autoLabel(p){
 if(p.wardTop==="ICU" && p.specTop==="blood") return "ICU侵襲・重症型";
 if(p.wardTop==="ER" && p.onsetTop==="community-onset") return "市中由来・救急皮膚/軟部型";
 if(p.wardTop==="LTC") return "慢性施設・持ち込み保菌型";
 if(p.cldmRate>0.6) return "CLDM高耐性・院内定着型";
 return "散発型（明確な偏りなし）";
}
function similarPOTs(targetPot){
 const vecs = buildPotVectors();
 const keys = Object.keys(vecs);
 if(!vecs[targetPot]) return [];
 const tv = vecs[targetPot];
 const sims = keys.filter(k=>k!==targetPot).map(k=>[k, cosine(tv, vecs[k])])
   .sort((a,b)=>b[1]-a[1]);
 return sims.slice(0,3).filter(x=>x[1]>0.65).map(x=>x[0]);
}
function buildPotVectors(){
 const pots = groupBy(filtered, d=>d.POT);
 const wards = [...new Set(filtered.map(d=>d.ward))];
 const specs = [...new Set(filtered.map(d=>d.specimen))];
 const onsets = [...new Set(filtered.map(d=>d.onset_type))];
 const vecs = {};
 for(const pot of Object.keys(pots)){
   const arr=pots[pot], n=arr.length||1;
   const v=[];
   wards.forEach(w=>v.push(arr.filter(d=>d.ward===w).length/n));
   specs.forEach(s=>v.push(arr.filter(d=>d.specimen===s).length/n));
   onsets.forEach(o=>v.push(arr.filter(d=>d.onset_type===o).length/n));
   v.push(arr.filter(d=>d.clindamycin_R===1).length/n);
   v.push(arr.filter(d=>d.vancomycin_MIC>=2).length/n);
   v.push(arr.filter(d=>d.daptomycin_MIC>=1).length/n);
   vecs[pot]=v;
 }
 return vecs;
}
function cosine(a,b){
 let dot=0,na=0,nb=0;
 for(let i=0;i<a.length;i++){
   dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i];
 }
 if(na===0||nb===0) return 0;
 return dot/Math.sqrt(na*nb);
}
// ---- Signals: sliding window scan + timeline ----
function scanSignals(){
 const windowDays = num(el("windowDays").value)||14;
 const thresholdK = num(el("thresholdK").value)||3;
 const byWardPot=groupBy(filtered,d=>`${d.ward}__${d.POT}`);
 const signals=[];
 for(const key of Object.keys(byWardPot)){
   const arr=byWardPot[key].slice().sort((a,b)=>a.collection_date-b.collection_date);
   let left=0;
   for(let right=0; right<arr.length; right++){
     while(arr[right].collection_date - arr[left].collection_date > windowDays*86400000){
       left++;
     }
     const k=right-left+1;
     if(k>=thresholdK){
       const chunk=arr.slice(left,right+1);
       signals.push({
         ward:chunk[0].ward,
         pot:chunk[0].POT,
         k,
         sDate:chunk[0].collection_date,
         eDate:chunk[chunk.length-1].collection_date,
         hospitals:[...new Set(chunk.map(d=>d.hospital))],
         specimen:topKey(countBy(chunk,"specimen"))
       });
       left=right; // avoid duplicates
     }
   }
 }
 signals.sort((a,b)=>b.k-a.k);
 lastSignals = signals;
 el("signals").innerHTML = signals.length
   ? signals.map(s=>`
<div class="signal">
<div class="head"><div>⚠ ${s.ward} / ${s.pot}</div><div>${s.k}件</div></div>
<div class="meta">
         期間：${toISO(s.sDate)}〜${toISO(s.eDate)}<br>
         施設：${s.hospitals.join(", ")} / 主検体：${s.specimen}
</div>
</div>
   `).join("")
   : `<p class="mini">シグナルなし（設定を緩めると出ます）</p>`;
 renderSignalTimeline();
}
function renderSignalTimeline(){
 const {c, ctx} = setupCanvas("signalTimeline");
 if(!lastSignals.length){ drawText(ctx,"シグナルなし",20,40); return; }
 const allDates = filtered.map(d=>d.collection_date).filter(Boolean).sort((a,b)=>a-b);
 const minD = allDates[0], maxD = allDates[allDates.length-1];
 const span = maxD - minD || 1;
 const pad={l:140,r:10,t:20,b:20};
 const w=c.width-pad.l-pad.r;
 const rowH=26;
 lastSignals.slice(0,6).forEach((s,iy)=>{
   const y=pad.t+iy*rowH;
   const x1=pad.l + w*(s.sDate-minD)/span;
   const x2=pad.l + w*(s.eDate-minD)/span;
   ctx.fillStyle="rgba(247,118,142,0.85)";
   ctx.fillRect(x1,y+5,Math.max(2,x2-x1),rowH-10);
   ctx.fillStyle="#e8ecff"; ctx.font="12px sans-serif";
   ctx.fillText(`${s.ward} / ${s.pot} (${s.k})`, 8, y+17);
 });
 // axis dates
 ctx.fillStyle="#a9b1d6"; ctx.font="11px sans-serif";
 ctx.fillText(toISO(minD), pad.l, c.height-6);
 ctx.fillText(toISO(maxD), pad.l+w-70, c.height-6);
}
function clearSignals(){
 lastSignals=[];
 el("signals").innerHTML="";
 const {ctx} = setupCanvas("signalTimeline");
 drawText(ctx,"スキャン後に表示",20,40);
}
// ---- Raw table + search ----
function renderRawTable(){
 const t=el("rawTable");
 const q = (el("searchBox").value||"").toLowerCase().trim();
 const data = !q ? filtered : filtered.filter(d=>{
   const pot=d.POT?.toLowerCase()||"";
   const ward=d.ward?.toLowerCase()||"";
   const spec=d.specimen?.toLowerCase()||"";
   const pid=d.patient_id?.toLowerCase()||"";
   return [pot,ward,spec,pid].some(x=>x.includes(q));
 });
 if(!data.length){ t.innerHTML="<tr><td>データなし</td></tr>"; return; }
 const cols=Object.keys(data[0]);
 t.innerHTML=`
<thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}</tr></thead>
<tbody>
     ${data.map(d=>`
<tr>${cols.map(c=>`<td>${formatCell(d[c])}</td>`).join("")}</tr>
     `).join("")}
</tbody>
 `;
}
function formatCell(v){
 if(v instanceof Date) return toISO(v);
 return v ?? "";
}
// ---- helpers ----
function num(x){ const v=parseFloat(x); return Number.isFinite(v)?v:0; }
function toDate(x){ if(!x) return null; const d=new Date(x); return isNaN(d)?null:d; }
function toISO(d){ return d? d.toISOString().slice(0,10):""; }
function countBy(arr,key){
 const m={}; arr.forEach(d=>{ const k=d[key]||"unknown"; m[k]=(m[k]||0)+1; });
 return m;
}
function topKey(m){
 let best=null,bv=-1;
 for(const k in m){ if(m[k]>bv){bv=m[k];best=k;} }
 return best;
}
function groupBy(arr,fn){
 const m={}; arr.forEach(d=>{ const k=fn(d); (m[k]=m[k]||[]).push(d); });
 return m;
}
function groupByMonth(arr){
 const m={};
 arr.forEach(d=>{
   const mo=d.collection_date.getFullYear()+"-"+String(d.collection_date.getMonth()+1).padStart(2,"0");
   (m[mo]=m[mo]||[]).push(d);
 });
 return m;
}
function drawText(ctx,txt,x,y){
 ctx.fillStyle="#a9b1d6"; ctx.font="14px sans-serif"; ctx.fillText(txt,x,y);
}
// init empty canvases
["wardBar","specimenPie","totalLine","potTrendCanvas","potWardHeatmap","signalTimeline"].forEach(id=>{
 const c=el(id);
 if(c){
   const ctx=c.getContext("2d");
   drawText(ctx,"CSV読み込み後に表示",20,40);
 }
});
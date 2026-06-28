// PAGE SYSTEM
function showPage(p){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'))
  const pg=document.getElementById('page-'+p)
  if(pg){pg.classList.add('active');window.scrollTo(0,0)}
  sessionStorage.setItem('db_lastPage',p)
  renderSQL()
}
function scrollTo2(id){
  setTimeout(()=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth'})},150)
}


// ===== REAL ACCOUNTS (Firebase Authentication + Firestore — shared across every device) =====
let currentClientCache=null, currentStaffCache=null
function currentClient(){ return currentClientCache }
function currentStaff(){ return currentStaffCache }

let authReadyPromise = new Promise(resolve=>{
  fbAuth.onAuthStateChanged(async user=>{
    currentClientCache=null; currentStaffCache=null
    if(user){
      try{
        const doc = await fbDB.collection('users').doc(user.uid).get()
        if(doc.exists){
          const data=doc.data()
          if(data.role==='client') currentClientCache={name:data.name,phone:data.phone,email:data.email,created:data.created,uid:user.uid}
          else currentStaffCache={name:data.name,email:data.email,role:data.role,uid:user.uid}
        }
      }catch(e){ console.warn('Could not load user profile:',e.message) }
    }
    resolve()
  })
})

// Stay on the page the person was on, instead of bouncing back to Home on every refresh.
authReadyPromise.then(()=>{
  const last=sessionStorage.getItem('db_lastPage')
  if(!last||last==='home'||last==='clientauth'||last==='staffauth')return
  if(last==='client'){
    const u=currentClient()
    if(u){ showPage('client'); applyClientSession(u) }
    else sessionStorage.removeItem('db_lastPage')
  } else if(last==='admin'||last==='analyst'){
    const u=currentStaff()
    if(u && u.role===last){ showPage(last) }
    else sessionStorage.removeItem('db_lastPage')
  }
})

async function goClient(){
  await authReadyPromise
  const u=currentClient()
  if(u){ showPage('client'); applyClientSession(u) }
  else { showPage('clientauth') }
}
function authSwitch(which){
  document.getElementById('atab-login').classList.toggle('on',which==='login')
  document.getElementById('atab-signup').classList.toggle('on',which==='signup')
  document.getElementById('authpane-login').style.display=which==='login'?'block':'none'
  document.getElementById('authpane-signup').style.display=which==='signup'?'block':'none'
}
async function clientSignup(){
  const name=document.getElementById('su_name').value.trim()
  const phone=document.getElementById('su_phone').value.trim()
  const email=document.getElementById('su_email').value.trim().toLowerCase()
  const pass=document.getElementById('su_pass').value
  const err=document.getElementById('authError2')
  if(!name||!email||!pass){ err.textContent='Please fill in your name, email, and password.'; err.style.display='block'; return }
  if(pass.length<6){ err.textContent='Password must be at least 6 characters.'; err.style.display='block'; return }
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.createUserWithEmailAndPassword(email,pass)
    const created=Date.now()
    await fbDB.collection('users').doc(cred.user.uid).set({name,phone,email,role:'client',created})
    currentClientCache={name,phone,email,created,uid:cred.user.uid}
    showPage('client'); applyClientSession(currentClientCache)
  }catch(e){
    err.textContent = e.code==='auth/email-already-in-use' ? 'An account with this email already exists. Try logging in.'
      : e.code==='auth/invalid-email' ? 'Please enter a valid email address.'
      : (e.message||'Could not create account. Please try again.')
    err.style.display='block'
  }
}
async function clientLogin(){
  const email=document.getElementById('li_email').value.trim().toLowerCase()
  const pass=document.getElementById('li_pass').value
  const err=document.getElementById('authError')
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.signInWithEmailAndPassword(email,pass)
    const doc=await fbDB.collection('users').doc(cred.user.uid).get()
    if(!doc.exists || doc.data().role!=='client'){
      await fbAuth.signOut()
      err.textContent='This account does not have client access.'; err.style.display='block'; return
    }
    const data=doc.data()
    currentClientCache={name:data.name,phone:data.phone,email:data.email,created:data.created,uid:cred.user.uid}
    showPage('client'); applyClientSession(currentClientCache)
  }catch(e){
    err.textContent='Incorrect email or password.'; err.style.display='block'
  }
}
function clientLogout(){
  fbAuth.signOut(); currentClientCache=null
  showPage('home')
}

// ===== STAFF ACCOUNTS (Admin + Analysts — created via seedStaffOnce(), see chat instructions) =====
async function seedStaffOnce(){
  const staff=[
    {email:'henry@statvisionconsultancy.co.ke',pass:'admin123',name:'Henry Gitau Michuku',role:'admin'},
    {email:'simon@statvisionconsultancy.co.ke',pass:'analyst123',name:'Simon Macharia',role:'analyst'},
    {email:'joseph@statvisionconsultancy.co.ke',pass:'analyst123',name:'Joseph Machuki',role:'analyst'}
  ]
  for(const s of staff){
    try{
      const cred=await fbAuth.createUserWithEmailAndPassword(s.email,s.pass)
      await fbDB.collection('users').doc(cred.user.uid).set({name:s.name,email:s.email,role:s.role,created:Date.now()})
      console.log('✓ Created staff account:',s.email)
    }catch(e){
      console.log(s.email,'→',e.code==='auth/email-already-in-use'?'already exists, skipping':e.message)
    }
  }
  await fbAuth.signOut()
  console.log('Done. You can now use Staff Login on the website.')
}
window.seedStaffOnce=seedStaffOnce

let staffWantsRole=null
async function goStaff(){ staffWantsRole=null; await routeStaff() }
async function goAdmin(){ staffWantsRole='admin'; await routeStaff() }
async function goAnalyst(){ staffWantsRole='analyst'; await routeStaff() }
async function routeStaff(){
  await authReadyPromise
  const u=currentStaff()
  if(u && (!staffWantsRole || u.role===staffWantsRole)){
    showPage(u.role==='admin'?'admin':'analyst')
  } else {
    showPage('staffauth')
  }
}
async function staffLogin(){
  const email=document.getElementById('st_email').value.trim().toLowerCase()
  const pass=document.getElementById('st_pass').value
  const err=document.getElementById('staffAuthError')
  err.style.display='none';err.textContent=''
  try{
    const cred=await fbAuth.signInWithEmailAndPassword(email,pass)
    const doc=await fbDB.collection('users').doc(cred.user.uid).get()
    const data=doc.exists?doc.data():null
    if(!data || (data.role!=='admin'&&data.role!=='analyst')){
      await fbAuth.signOut()
      err.textContent='This account does not have staff access.'; err.style.display='block'; return
    }
    if(staffWantsRole && data.role!==staffWantsRole){
      await fbAuth.signOut()
      err.textContent=`This account does not have ${staffWantsRole} access.`; err.style.display='block'; return
    }
    currentStaffCache={name:data.name,email:data.email,role:data.role,uid:cred.user.uid}
    showPage(data.role==='admin'?'admin':'analyst')
  }catch(e){
    err.textContent='Incorrect email or password.'; err.style.display='block'
  }
}
function staffLogout(){
  fbAuth.signOut(); currentStaffCache=null
  showPage('home')
}
function applyClientSession(u){
  const initials=(u.name||'? ?').split(' ').filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('')
  const av=document.getElementById('cUserAvatar'), nm=document.getElementById('cUserName')
  if(av)av.textContent=initials
  if(nm)nm.textContent=u.name
  const sl=document.getElementById('pbiSlicerName');if(sl)sl.textContent=u.name
  const pn=document.getElementById('prof_name'),pe=document.getElementById('prof_email'),pp=document.getElementById('prof_phone'),pc=document.getElementById('prof_created')
  if(pn)pn.value=u.name||''
  if(pe)pe.value=u.email||''
  if(pp)pp.value=u.phone||''
  if(pc)pc.value=u.created?new Date(u.created).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'
  // pre-fill the order form with this client's details
  const fn=document.getElementById('ord_name'), fe=document.getElementById('ord_email'), fp=document.getElementById('ord_phone')
  if(fn)fn.value=u.name||''
  if(fe)fe.value=u.email||''
  if(fp)fp.value=u.phone||''
  renderMyOrders(u.email)
  pbiRenderClientPortal()
}
function renderMyOrders(email){
  const wrap=document.getElementById('myOrdersBody')
  if(!wrap)return
  const mine=sqlData.filter(r=>r.email && r.email.toLowerCase()===String(email).toLowerCase())
  if(mine.length===0){
    wrap.innerHTML=`<tr><td colspan="9" style="text-align:center;color:var(--sl);padding:1.4rem">No orders yet — click "+ New Order" to submit your first project.</td></tr>`
  } else {
    wrap.innerHTML=mine.map(r=>{
      const files=getFiles(r.id)
      const deliverable=files.analyst.length?downloadLinksHTML(files.analyst):'<span style="color:var(--sl);font-size:.74rem">Not ready yet</span>'
      return `<tr><td><strong>${r.id}</strong></td><td>${r.project}</td><td>${r.tool}</td><td>${r.analyst}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${deliverable}</td><td><button class="db1 dbb" onclick="generateInvoicePDF('${r.id}')">⬇ PDF</button></td></tr>`
    }).join('')
  }
  renderMyInvoices(mine)
}
function renderMyInvoices(mine){
  const wrap=document.getElementById('myInvoicesBody')
  if(!wrap)return
  if(!mine.length){
    wrap.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--sl);padding:1.4rem">No invoices yet — they'll appear here once you place an order.</td></tr>`
    return
  }
  wrap.innerHTML=mine.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.project}</td><td>${r.analyst}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td><button class="db1 dbb" onclick="generateInvoicePDF('${r.id}')">⬇ PDF</button></td></tr>`).join('')
}

// ===== FILE STORAGE (browser-local — see chat note on real shared storage) =====
function getFiles(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  return (r&&r.files) ? r.files : {client:[],analyst:[]}
}
function setFiles(orderId,obj){
  return fbDB.collection('orders').doc(orderId).set({files:obj},{merge:true})
}
async function uploadFilesToStorage(orderId,role,fileList){
  const results=[]
  for(const f of [...fileList]){
    const path=`orders/${orderId}/${role}/${Date.now()}_${f.name}`
    const ref=fbStorage.ref(path)
    await ref.put(f)
    const url=await ref.getDownloadURL()
    results.push({name:f.name,url,size:f.size,type:f.type||'application/octet-stream'})
  }
  return results
}
function downloadLinksHTML(files){
  if(!files||!files.length)return '<span style="color:var(--sl);font-size:.74rem">None</span>'
  return files.map(f=>`<a href="${f.url}" target="_blank" rel="noopener" style="display:block;font-size:.78rem;color:var(--b2);margin-bottom:.2rem">📎 ${f.name}</a>`).join('')
}

// NAV
window.addEventListener('scroll',()=>document.getElementById('mainNav').classList.toggle('scrolled',window.scrollY>30))
function toggleMM(){document.getElementById('mmenu').classList.toggle('open')}

// PARTICLES
;(function(){
  const c=document.getElementById('hparts');if(!c)return
  const cols=['rgba(66,165,245,.5)','rgba(245,166,35,.4)','rgba(255,255,255,.12)']
  for(let i=0;i<20;i++){
    const d=document.createElement('div'),s=Math.random()*4+2
    d.className='part'
    d.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;background:${cols[i%3]};animation-duration:${Math.random()*18+12}s;animation-delay:${Math.random()*10}s`
    c.appendChild(d)
  }
})()

// ===== POWER BI TILE GRID (hero) — live data =====
const PBI = {
  count: 487,
  pipeline: 2.0, // $bn
  revenue: 461, // $M
  trend: [30,34,32,38,42,40,46,48],
  mix: [38,26,20,16],
  byMonth: [20,28,35,48,55,62,70,78,82,88,92,95],
  avgRevA: [60,75,45,85,55],
  avgRevB: [40,55,30,65,42],
  win: [12,80,25,18,30,15],
  avgRev2: [55,70,40,80,60,45]
}
function pbiClamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}

function pbiDrawTrend(){
  const el=document.getElementById('pt2');if(!el)return
  const pts=PBI.trend.map((v,i)=>[6+i*14,46-(v/50)*40])
  const line=pts.map(p=>p.join(',')).join(' ')
  el.innerHTML=`<polyline points="${line}" fill="none" stroke="#1ABC9C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`+
    pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#1ABC9C"/>`).join('')
}
function pbiDrawMix(){
  const el=document.getElementById('pt3');if(!el)return
  const cols=['#1ABC9C','#34495E','#F0625A','#F2C94C']
  const total=PBI.mix.reduce((a,b)=>a+b,0)
  let x=4,h=''
  PBI.mix.forEach((v,i)=>{
    const w=(v/total)*102
    h+=`<rect x="${x}" y="20" width="${w}" height="12" fill="${cols[i]}" opacity=".9"/>`
    x+=w
  })
  el.innerHTML=h
}
function pbiDrawByMonth(){
  const el=document.getElementById('pt5');if(!el)return
  const cols=['#34495E','#1ABC9C','#F0625A','#F2C94C']
  const max=Math.max(...PBI.byMonth)
  let h=''
  PBI.byMonth.forEach((v,i)=>{
    const bw=15,x=6+i*18.5,bh=(v/max)*46
    h+=`<rect x="${x}" y="${50-bh}" width="${bw}" height="${bh}" fill="${cols[i%cols.length]}" opacity=".88" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawAvgRevenue(){
  const el=document.getElementById('pt6');if(!el)return
  let h=''
  PBI.avgRevA.forEach((v,i)=>{
    const y=4+i*10.6
    h+=`<rect x="60" y="${y}" width="${v*0.9}" height="7" fill="#34495E" rx="1"/>
        <rect x="${60-PBI.avgRevB[i]*0.9}" y="${y}" width="${PBI.avgRevB[i]*0.9}" height="7" fill="#F0625A" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawWin(){
  const el=document.getElementById('pt7');if(!el)return
  const max=Math.max(...PBI.win)
  let h=''
  PBI.win.forEach((v,i)=>{
    const bw=12,x=8+i*16,bh=(v/max)*42
    h+=`<rect x="${x}" y="${48-bh}" width="${bw}" height="${bh}" fill="#34495E" opacity=".85" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiDrawAvgRevenue2(){
  const el=document.getElementById('pt8');if(!el)return
  const max=Math.max(...PBI.avgRev2)
  let h=''
  PBI.avgRev2.forEach((v,i)=>{
    const y=4+i*8,bw=(v/max)*95
    h+=`<rect x="6" y="${y}" width="${bw}" height="5.5" fill="#F0625A" opacity=".88" rx="1"/>`
  })
  el.innerHTML=h
}
function pbiUpdateNumbers(){
  const c1=document.getElementById('pt1'),c4=document.getElementById('pt4'),c9=document.getElementById('pt9')
  if(c1)c1.textContent=Math.round(PBI.count)
  if(c4)c4.textContent='$'+PBI.pipeline.toFixed(1)+'bn'
  if(c9)c9.textContent='$'+Math.round(PBI.revenue)+'M'
}
function pbiFlash(id){
  const el=document.getElementById(id);if(!el)return
  el.style.opacity=.25
  setTimeout(()=>{el.style.opacity=1},150)
}
function pbiRenderAll(){
  pbiDrawTrend();pbiDrawMix();pbiDrawByMonth();pbiDrawAvgRevenue();pbiDrawWin();pbiDrawAvgRevenue2();pbiUpdateNumbers()
}
function pbiPulse(){
  PBI.count=pbiClamp(PBI.count+(Math.random()-0.45)*6,420,560);pbiFlash('pt1')
  PBI.pipeline=pbiClamp(PBI.pipeline+(Math.random()-0.5)*0.08,1.6,2.4);pbiFlash('pt4')
  PBI.revenue=pbiClamp(PBI.revenue+(Math.random()-0.45)*10,380,520);pbiFlash('pt9')
  PBI.trend=PBI.trend.map(v=>pbiClamp(v+(Math.random()-0.45)*4,20,50))
  let mt=0;PBI.mix=PBI.mix.map(v=>{const nv=pbiClamp(v+(Math.random()-0.5)*3,8,45);mt+=nv;return nv})
  PBI.mix=PBI.mix.map(v=>v/mt*100)
  PBI.byMonth=PBI.byMonth.map(v=>pbiClamp(v+(Math.random()-0.4)*5,15,98))
  PBI.avgRevA=PBI.avgRevA.map(v=>pbiClamp(v+(Math.random()-0.5)*8,30,95))
  PBI.avgRevB=PBI.avgRevB.map(v=>pbiClamp(v+(Math.random()-0.5)*8,20,70))
  PBI.win=PBI.win.map(v=>pbiClamp(v+(Math.random()-0.5)*6,8,85))
  PBI.avgRev2=PBI.avgRev2.map(v=>pbiClamp(v+(Math.random()-0.5)*8,25,85))
  pbiRenderAll()
}
window.addEventListener('load',()=>{
  pbiRenderAll()
  setInterval(pbiPulse,1700)
})

// SERVICES TICKER (left to right)
const SVCS=[
  {ic:'📈',t:'Quantitative Analysis',d:'Regression, ANOVA, factor analysis',tags:['SPSS','Stata','R','Python']},
  {ic:'💬',t:'Qualitative Analysis',d:'Thematic coding, narrative, discourse',tags:['NVivo','Atlas.ti']},
  {ic:'🔀',t:'Mixed Methods',d:'Combined quant + qual research',tags:['All tools']},
  {ic:'🗂️',t:'Primary Data Collection',d:'Survey design, deployment, interviews',tags:['KoboToolbox']},
  {ic:'🧹',t:'Data Cleaning & Prep',d:'Deduplication, outliers, restructuring',tags:['Python','R','Excel']},
  {ic:'📞',t:'Statistical Consultation',d:'Research design, methodology advice',tags:['Advisory']},
  {ic:'📉',t:'Data Visualisation',d:'Charts, dashboards, infographics',tags:['ggplot2','matplotlib']},
  {ic:'📝',t:'Report Writing',d:'APA, Harvard, Chicago, custom format',tags:['APA','Harvard']},
]
;(function(){
  const row=document.getElementById('svrow');if(!row)return
  const double=[...SVCS,...SVCS]
  row.innerHTML=double.map(s=>`<div class="scard"><div class="scic">${s.ic}</div><h3>${s.t}</h3><p>${s.d}</p><div class="stags">${s.tags.map(t=>`<span class="stag">${t}</span>`).join('')}</div></div>`).join('')
  const tick=document.getElementById('topTicker');if(!tick)return
  const items=['📈 Quantitative Analysis','📊 SPSS Expert','🐍 Python Data Science','📉 R Visualisation','🔬 Mixed Methods Research','🗂️ Primary Data Collection','📝 APA & Harvard Reports','💬 Qualitative Coding','🧹 Data Cleaning','📞 Statistical Consultation','🎓 Dissertation Support','🏢 Business Intelligence','🌍 NGO Impact Evaluation','🏥 Health Research']
  const dbl=[...items,...items]
  tick.innerHTML=dbl.map(i=>`<span class="titem">${i}</span><span class="tsep">◆</span>`).join('')
})()

// SQL TABLE DATA
let sqlData=[]
// Live sync: sqlData always mirrors the 'orders' collection in Firestore.
// Every browser (client, analyst, admin) sees the same data, in real time.
fbDB.collection('orders').onSnapshot(snap=>{
  sqlData=snap.docs.map(d=>({id:d.id,...d.data()}))
  renderSQL()
},err=>console.warn('Orders sync error:',err.message))

const scls={'In Progress':'b-pr','Confirmed':'b-pn','Draft Review':'b-rv','Completed':'b-dn','Pending':'b-pn','Overdue':'b-ov'}
const ANALYSTS=['Henry G. Michuku','Simon Macharia','Joseph Machuki','Unassigned']
function analystSelect(id,current){
  return `<select onchange="assignAnalyst('${id}',this.value)" style="font-size:.78rem;padding:.25rem .4rem;border:1px solid var(--br);border-radius:6px;background:#fff">`+
    ANALYSTS.map(a=>`<option ${a===current?'selected':''}>${a}</option>`).join('')+`</select>`
}
function assignAnalyst(id,name){
  const r=sqlData.find(x=>x.id===id)
  if(!r)return
  const newStatus=(r.status==='Pending'&&name!=='Unassigned')?'Confirmed':r.status
  fbDB.collection('orders').doc(id).update({analyst:name,status:newStatus})
}

// ===== PROJECTS TABLE (Admin — unified with real sqlData, no duplicate fake table) =====
let projectFilter='all'
function openAddProjectModal(){
  document.getElementById('addProjectForm').style.display='block'
  const n=sqlData.length+1
  document.getElementById('np_ref').value=`DB-2025-${n.toString().padStart(3,'0')}`
  document.getElementById('addProjectForm').scrollIntoView({behavior:'smooth',block:'center'})
}
function saveProject(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:''}
  const ref=v('np_ref')||`DB-${Date.now()}`
  if(!v('np_client')||!v('np_title')){ alert('Please fill in at least the client name and project title.'); return }
  fbDB.collection('orders').doc(ref).set({
    client:v('np_client'), email:v('np_email')||'—', phone:v('np_phone')||'—', org:'—',
    project:v('np_title'), service:v('np_service'), tool:v('np_tool')||'TBD', format:'—',
    analyst:v('np_analyst'), deadline:v('np_deadline')||'TBD',
    total:v('np_budget')||'0', deposit:'0', balance:v('np_budget')||'0',
    status:v('np_status')||'Pending', files:{client:[],analyst:[]}
  })
  document.getElementById('addProjectForm').style.display='none'
  ;['np_ref','np_client','np_email','np_phone','np_title','np_tool','np_date','np_deadline','np_budget'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})
}
function filterProjects(btn,status){
  projectFilter=status
  document.querySelectorAll('#adtab-orders .fb2').forEach(b=>b.classList.remove('on'))
  if(btn)btn.classList.add('on')
  renderProjectsTable()
}
function renderProjectsTable(){
  const tb=document.getElementById('projectsBody')
  if(!tb)return
  const rows=projectFilter==='all'?sqlData:sqlData.filter(r=>r.status===projectFilter)
  tb.innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>—</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>${analystSelect(r.id,r.analyst)}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td><button class="db1 dbb" onclick="alert('Order ${r.id}\\nClient: ${r.client}\\nStatus: ${r.status}')">View</button></td></tr>`).join('')
    : `<tr><td colspan="13" style="text-align:center;color:var(--sl);padding:1.4rem">No orders match this filter yet.</td></tr>`
}
function exportProjects(){ exportCSV() }

function generateInvoicePDF(orderId){
  const r=sqlData.find(x=>x.id===orderId)
  if(!r){ alert('Order not found.'); return }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({unit:'mm',format:'a4'})
  const pw=210
  const moneyFmt=v=>'KES '+Math.round(moneyNum(v)).toLocaleString()

  // Header band
  doc.setFillColor(10,26,61) // dark navy
  doc.rect(0,0,pw,32,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(18)
  doc.text('StatVision Consultancy',15,15)
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  doc.text('Professional Data Analysis & Research Services · Nairobi, Kenya',15,21)
  doc.text('hello@statvisionconsultancy.co.ke  ·  +254 748 216 918',15,26)

  doc.setTextColor(20,20,30)
  doc.setFont('helvetica','bold')
  doc.setFontSize(16)
  doc.text('INVOICE / RECEIPT',pw-15,15,{align:'right'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  doc.text('Order #: '+r.id,pw-15,21,{align:'right'})
  doc.text('Date: '+new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),pw-15,26,{align:'right'})

  // Bill to
  let y=44
  doc.setFontSize(10)
  doc.setFont('helvetica','bold')
  doc.text('BILLED TO',15,y)
  doc.setFont('helvetica','normal')
  doc.text(r.client||'—',15,y+6)
  doc.text(r.email||'—',15,y+11)
  doc.text(r.phone||'—',15,y+16)

  doc.setFont('helvetica','bold')
  doc.text('ANALYST ASSIGNED',pw-15,y,{align:'right'})
  doc.setFont('helvetica','normal')
  doc.text(r.analyst||'Unassigned',pw-15,y+6,{align:'right'})

  // Service table
  y+=28
  doc.setFillColor(243,242,241)
  doc.rect(15,y,pw-30,9,'F')
  doc.setFont('helvetica','bold')
  doc.setFontSize(9)
  doc.text('SERVICE / PROJECT',18,y+6)
  doc.text('TOOL',120,y+6)
  doc.text('FORMAT',145,y+6)
  doc.text('AMOUNT',pw-18,y+6,{align:'right'})
  y+=9
  doc.setDrawColor(225,223,221)
  doc.line(15,y,pw-15,y)
  y+=8
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  const projectLines=doc.splitTextToSize(r.project||'—',95)
  doc.text(projectLines,18,y)
  doc.text(r.tool||'—',120,y)
  doc.text(r.format||'—',145,y)
  doc.text(moneyFmt(r.total),pw-18,y,{align:'right'})
  y+=Math.max(8,projectLines.length*5)+6
  doc.line(15,y,pw-15,y)

  // Financial summary
  y+=12
  const sx=pw-85
  doc.setFontSize(10)
  doc.setFont('helvetica','normal')
  doc.text('Total Service Price',sx,y); doc.text(moneyFmt(r.total),pw-15,y,{align:'right'})
  y+=7
  doc.text('Amount Paid',sx,y); doc.setTextColor(16,124,16); doc.text(moneyFmt(r.deposit),pw-15,y,{align:'right'}); doc.setTextColor(20,20,30)
  y+=7
  doc.setDrawColor(20,20,30)
  doc.line(sx,y+2,pw-15,y+2)
  y+=9
  doc.setFont('helvetica','bold')
  doc.setFontSize(11)
  doc.text('Balance Due',sx,y)
  doc.setTextColor(moneyNum(r.balance)>0?209:16, moneyNum(r.balance)>0?52:124, moneyNum(r.balance)>0?68:16)
  doc.text(moneyFmt(r.balance),pw-15,y,{align:'right'})
  doc.setTextColor(20,20,30)

  // Status
  y+=14
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  doc.text('Order Status: '+(r.status||'Pending'),15,y)

  // Official stamp (bottom right) — rotated circular seal
  const sxC=pw-48, syC=y+38, rad=22
  doc.saveGraphicsState && doc.saveGraphicsState()
  doc.setDrawColor(178,34,34)
  doc.setTextColor(178,34,34)
  doc.setLineWidth(0.8)
  doc.circle(sxC,syC,rad,'S')
  doc.circle(sxC,syC,rad-3,'S')
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.2)
  doc.text('STATVISION CONSULTANCY',sxC,syC-9,{align:'center',angle:0})
  doc.setFontSize(6.4)
  doc.text('OFFICIALLY APPROVED',sxC,syC-3,{align:'center'})
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.8)
  doc.text('Henry Gitau Michuku',sxC,syC+3,{align:'center'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(6.4)
  doc.text('Chief Executive Officer',sxC,syC+8,{align:'center'})
  doc.text(new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),sxC,syC+13,{align:'center'})

  // Footer note
  doc.setTextColor(120,120,120)
  doc.setFont('helvetica','italic')
  doc.setFontSize(8)
  doc.text('This is a system-generated invoice from StatVision Consultancy. For queries, contact hello@statvisionconsultancy.co.ke',15,285)

  doc.save(`Invoice-${r.id}.pdf`)
}

function renderAdminOverview(){
  const active=document.getElementById('adKpiActive')
  if(!active)return // admin overview not in DOM context yet
  const activeOrders=sqlData.filter(r=>r.status!=='Completed').length
  const totalPaid=sqlData.reduce((s,r)=>s+moneyNum(r.deposit),0)
  const totalBalance=sqlData.reduce((s,r)=>s+moneyNum(r.balance),0)
  const totalClients=new Set(sqlData.map(r=>(r.email||'').toLowerCase()).filter(Boolean)).size

  document.getElementById('adKpiActive').textContent=activeOrders
  document.getElementById('adKpiActiveSub').textContent=sqlData.length?`${sqlData.length} total order${sqlData.length===1?'':'s'}`:'No orders yet'
  document.getElementById('adKpiRevenue').textContent='KES '+Math.round(totalPaid).toLocaleString()
  document.getElementById('adKpiClients').textContent=totalClients
  document.getElementById('adKpiBalance').textContent='KES '+Math.round(totalBalance).toLocaleString()

  // Revenue summary (real numbers, no fake trend line)
  const rs=document.getElementById('adRevenueSummary')
  if(rs){
    const totalValue=sqlData.reduce((s,r)=>s+moneyNum(r.total),0)
    if(sqlData.length===0){
      rs.innerHTML=`<p style="color:var(--sl);font-size:.84rem;text-align:center;padding:1.4rem 0">No orders have been made yet — revenue will appear here once clients submit and pay for projects.</p>`
    } else {
      rs.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .2rem;border-bottom:1px solid var(--br)"><span style="font-size:.84rem;color:var(--sl)">Total Order Value</span><strong style="font-family:var(--fd)">KES ${Math.round(totalValue).toLocaleString()}</strong></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .2rem;border-bottom:1px solid var(--br)"><span style="font-size:.84rem;color:var(--sl)">Total Collected (Deposits)</span><strong style="font-family:var(--fd);color:#107C10">KES ${Math.round(totalPaid).toLocaleString()}</strong></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .2rem"><span style="font-size:.84rem;color:var(--sl)">Outstanding Balance</span><strong style="font-family:var(--fd);color:#D13438">KES ${Math.round(totalBalance).toLocaleString()}</strong></div>`
    }
  }

  // Status breakdown chart (real counts only)
  const sc=document.getElementById('adStatusChart')
  if(sc){
    const order=['Pending','Confirmed','In Progress','Draft Review','Completed','Overdue']
    const colors={'Pending':'#F5A623','Confirmed':'#42A5F5','In Progress':'#1976D2','Draft Review':'#9C27B0','Completed':'#43A047','Overdue':'#E53935'}
    const counts=order.map(s=>sqlData.filter(r=>r.status===s).length)
    const max=Math.max(1,...counts)
    if(sqlData.length===0){
      sc.innerHTML=`<text x="140" y="78" text-anchor="middle" font-size="11" fill="#90A4AE">No orders yet</text>`
    } else {
      const used=order.filter((s,i)=>counts[i]>0)
      const usedCounts=counts.filter(c=>c>0)
      const slotW=260/Math.max(1,used.length)
      let out=''
      used.forEach((s,i)=>{
        const c=usedCounts[i], h=(c/max)*95, x=10+i*slotW, w=Math.min(45,slotW-15)
        out+=`<rect x="${x}" y="${120-h}" width="${w}" height="${h}" rx="5" fill="${colors[s]}" opacity=".88"/>`
        out+=`<text x="${x+w/2}" y="${120-h-7}" text-anchor="middle" font-size="10" font-weight="700" fill="${colors[s]}">${c}</text>`
        out+=`<text x="${x+w/2}" y="135" text-anchor="middle" font-size="7.5" fill="#546E7A">${s}</text>`
      })
      sc.innerHTML=out
    }
  }

  // Recent activity (built from real orders, most recent first)
  const ra=document.getElementById('adRecentActivity')
  if(ra){
    if(sqlData.length===0){
      ra.innerHTML=`<div style="padding:1.4rem;text-align:center;color:var(--sl);font-size:.85rem">No activity yet — this feed will fill up as clients submit orders and analysts work on them.</div>`
    } else {
      ra.innerHTML=sqlData.slice(-6).reverse().map(r=>{
        const icon=r.status==='Completed'?'✅':r.status==='Draft Review'?'📤':r.status==='Pending'?'🆕':'📋'
        return `<div style="padding:.85rem 1.4rem;border-bottom:1px solid var(--br);display:flex;align-items:center;gap:.85rem"><span>${icon}</span><div style="flex:1"><strong style="font-size:.84rem">${r.id} — ${r.project}</strong><div style="font-size:.75rem;color:var(--sl)">${r.client} · Analyst: ${r.analyst} · <span class="badge ${scls[r.status]||'b-pn'}" style="font-size:.65rem">${r.status}</span></div></div><button class="db1 dbb" onclick="adTab('orders',null)">View</button></div>`
      }).join('')
    }
  }
}
function renderSQL(){
  const tb=document.getElementById('sqlBody')
  if(tb)tb.innerHTML=sqlData.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.org}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${analystSelect(r.id,r.analyst)}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td></tr>`).join('')
  const ao=document.getElementById('adminOrderBody')
  if(ao)ao.innerHTML=sqlData.map(r=>{
    const files=getFiles(r.id)
    return `<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.project}</td><td>${r.tool}</td><td>${analystSelect(r.id,r.analyst)}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${downloadLinksHTML(files.client)}</td><td><button class="db1 dbb" onclick="alert('Order ${r.id} details:\\n\\nClient: ${r.client}\\nProject: ${r.project}\\nAnalyst: ${r.analyst}\\nStatus: ${r.status}')">View</button></td></tr>`
  }).join('')
  const rw=document.getElementById('reportTableWrap')
  if(rw)rw.innerHTML=`<table><thead><tr><th>Order ID</th><th>Client</th><th>Email</th><th>Phone</th><th>Organisation</th><th>Project</th><th>Service</th><th>Tool</th><th>Format</th><th>Analyst</th><th>Deadline</th><th>Total</th><th>Deposit</th><th>Balance</th><th>Status</th></tr></thead><tbody>`+sqlData.map(r=>`<tr><td>${r.id}</td><td>${r.client}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.org}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${r.analyst}</td><td>${r.deadline}</td><td>KES ${r.total}</td><td>KES ${r.deposit}</td><td>KES ${r.balance}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td></tr>`).join('')+`</tbody></table>`
  const cu=currentClient();if(cu){renderMyOrders(cu.email);pbiRenderClientPortal()}
  renderAnalystUI()
  renderProjectsTable()
  renderAdminOverview()
}
function renderAnalystUI(){
  const ab=document.getElementById('anAssignBody')
  if(ab){
    const assigned=sqlData.filter(r=>r.status!=='Pending')
    ab.innerHTML=assigned.length?assigned.map(r=>{
      const files=getFiles(r.id)
      return `<tr><td><strong>${r.id}</strong></td><td>${r.client}</td><td>${r.project}</td><td>${r.service}</td><td>${r.tool}</td><td>${r.format}</td><td>${r.deadline}</td><td><span class="badge ${scls[r.status]||'b-pn'}">${r.status}</span></td><td>${downloadLinksHTML(files.client)}</td><td><button class="db1 dba" onclick="anGoUpload('${r.id}')">Upload</button> <button class="db1 dbb" onclick="anTab('msgs',null)">Chat</button></td></tr>`
    }).join(''):`<tr><td colspan="10" style="text-align:center;color:var(--sl);padding:1.2rem">No assigned orders yet.</td></tr>`
  }
  const sel=document.getElementById('anUploadOrder')
  if(sel){
    const prev=sel.value
    sel.innerHTML=sqlData.map(r=>`<option value="${r.id}">${r.id} — ${r.client} — ${r.project}</option>`).join('')
    if(prev && sqlData.some(r=>r.id===prev)) sel.value=prev
    anShowOrderFiles()
  }
}
function anGoUpload(orderId){
  anTab('upload',document.querySelector('#page-analyst .snav[onclick*="upload"]'))
  const sel=document.getElementById('anUploadOrder')
  if(sel){ sel.value=orderId; anShowOrderFiles() }
}
function anShowOrderFiles(){
  const sel=document.getElementById('anUploadOrder'), box=document.getElementById('anClientFiles')
  if(!sel||!box)return
  const files=getFiles(sel.value)
  box.innerHTML=downloadLinksHTML(files.client)
}
async function uploadDeliverable(){
  const sel=document.getElementById('anUploadOrder')
  const orderId=sel?sel.value:null
  const fileInput=document.getElementById('anFile')
  const statusEl=document.getElementById('anUploadStatus')
  if(!orderId){statusEl.style.color='#D13438';statusEl.textContent='⚠ Select an order first.';return}
  if(!fileInput||!fileInput.files.length){statusEl.style.color='#D13438';statusEl.textContent='⚠ Choose at least one file to upload.';return}
  statusEl.style.color='var(--sl)';statusEl.textContent='Uploading...'
  try{
    const newFiles=await uploadFilesToStorage(orderId,'analyst',fileInput.files)
    const files=getFiles(orderId)
    const updatedAnalystFiles=files.analyst.concat(newFiles)
    const type=document.getElementById('anDelivType').value
    const newStatus = type==='Final Deliverable' ? 'Completed' : 'Draft Review'
    await fbDB.collection('orders').doc(orderId).update({'files.analyst':updatedAnalystFiles,status:newStatus})
    statusEl.style.color='#107C10'
    statusEl.textContent='✓ Uploaded! Client has been notified and can now download it from their dashboard.'
    fileInput.value='';document.getElementById('anFn').textContent=''
    document.getElementById('anUploadNotes').value=''
    anShowOrderFiles()
  }catch(e){
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Upload failed: '+e.message
  }
}
function addRow(){
  const n=sqlData.length+1
  const id=`DB-2025-${n.toString().padStart(3,'0')}`
  fbDB.collection('orders').doc(id).set({client:'New Client',email:'client@email.com',phone:'+254 7XX XXX XXX',org:'Organisation',project:'New Project',service:'Quantitative',tool:'SPSS',format:'APA 7th',analyst:'Unassigned',deadline:'TBD',total:'0',deposit:'0',balance:'0',status:'Pending',files:{client:[],analyst:[]}})
  alert('New order row added!')
}
function exportCSV(){
  const h=['Order ID','Client','Email','Phone','Organisation','Project','Service','Tool','Format','Analyst','Deadline','Total','Deposit','Balance','Status']
  const rows=sqlData.map(r=>[r.id,r.client,r.email,r.phone,r.org,r.project,r.service,r.tool,r.format,r.analyst,r.deadline,'KES '+r.total,'KES '+r.deposit,'KES '+r.balance,r.status].map(v=>`"${v}"`).join(','))
  const c=[h.join(','),...rows].join('\n')
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(c);a.download='StatVision Consultancy_Orders.csv';a.click()
}
window.addEventListener('load',renderSQL)

// COUNT UP
function countUp(el,t,dur=1800){
  let s=0;const f=ts=>{if(!s)s=ts;const p=Math.min((ts-s)/dur,1),v=Math.floor(p*t),sp=el.querySelector('span');el.innerHTML=v+(sp?sp.outerHTML:'');if(p<1)requestAnimationFrame(f)}
  requestAnimationFrame(f)
}
const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.isIntersecting){e.target.classList.add('vis');const n=e.target.querySelector('.snum[data-t]');if(n&&!n.dataset.done){n.dataset.done=1;countUp(n,+n.dataset.t)}}
}),{threshold:.15})
document.querySelectorAll('.fu').forEach(el=>obs.observe(el))

// DASHBOARD TABS
function cTab(n,btn){
  document.querySelectorAll('#page-client .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-client [id^=ctab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('ctab-'+n);if(el)el.style.display='block'
  const t={overview:'Client Overview',orders:'My Orders',messages:'Messages',docs:'Documents',invoices:'Invoices & Receipts',notifs:'Notifications',profile:'Profile & Settings'}
  document.getElementById('cTabTitle').textContent=t[n]||n
}
function anTab(n,btn){
  document.querySelectorAll('#page-analyst .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-analyst [id^=antab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('antab-'+n);if(el)el.style.display='block'
  const t={overview:'Analyst Dashboard',assignments:'My Assignments',calendar:'Deadline Calendar',msgs:'Client Messages',upload:'Upload Deliverable',profile:'My Profile'}
  document.getElementById('anTabTitle').textContent=t[n]||n
}
function adTab(n,btn){
  document.querySelectorAll('#page-admin .snav').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')
  document.querySelectorAll('#page-admin [id^=adtab-]').forEach(d=>d.style.display='none')
  const el=document.getElementById('adtab-'+n);if(el)el.style.display='block'
  const t={overview:'Admin Overview',orders:'All Orders',tracker:'Project Tracker',clients:'Client Management',analysts:'Analyst Accounts',finance:'Financial Management',reports:'Reports & Analytics',notifs:'Notification Centre',content:'Website Content'}
  document.getElementById('adTabTitle').textContent=t[n]||n
  renderSQL()
}
function filt(btn,f){btn.closest('.filt').querySelectorAll('.fb2').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
function toggleCreateAnalyst(){const f=document.getElementById('createAnalystForm');f.style.display=f.style.display==='none'?'block':'none'}

// MODAL
let mStep=1
function openModal(){document.getElementById('orderModal').classList.add('open');document.body.style.overflow='hidden'}
function closeModal(){document.getElementById('orderModal').classList.remove('open');document.body.style.overflow=''}
function mNext(){
  if(mStep<3){
    document.getElementById('ms'+mStep).style.display='none';mStep++
    document.getElementById('ms'+mStep).style.display='block'
    document.getElementById('sd'+(mStep-1)).classList.remove('on');document.getElementById('sd'+mStep).classList.add('on')
    document.getElementById('mprev').style.display='inline-flex'
    if(mStep===3)document.getElementById('mnext').textContent='Submit Project ✓'
  } else {
    submitOrder()
  }
}
// Formspree endpoint — connected to gitauhenry467@gmail.com via https://formspree.io/f/xeeboeqy
const FORMSPREE_ENDPOINT='https://formspree.io/f/xeeboeqy'
async function submitOrder(){
  const v=id=>{const el=document.getElementById(id);return el?el.value:''}
  const data={
    name:v('ord_name'),email:v('ord_email'),phone:v('ord_phone'),org:v('ord_org')||'—',
    country:v('ord_country'),service:v('ord_service'),datatype:v('ord_datatype'),tool:v('ord_tool'),
    format:v('ord_format'),deliverable:v('ord_deliverable'),description:v('ord_desc'),
    draft_deadline:v('ord_draftdue'),final_deadline:v('ord_finaldue'),notes:v('ord_notes')||'—'
  }
  if(!data.name||!data.email||!data.service){
    document.getElementById('ordStatus').textContent='⚠ Please fill in your name, email, and service type.'
    document.getElementById('ordStatus').style.color='#D13438'
    return
  }
  const statusEl=document.getElementById('ordStatus')
  const btn=document.getElementById('mnext')
  statusEl.style.color='var(--sl)';statusEl.textContent='Submitting your project...'
  btn.disabled=true

  const fileInput=document.getElementById('mfile')
  const n=sqlData.length+1
  const newId=`DB-2025-${n.toString().padStart(3,'0')}`

  let clientFiles=[]
  try{
    if(fileInput&&fileInput.files.length){
      statusEl.textContent='Uploading your files...'
      clientFiles=await uploadFilesToStorage(newId,'client',fileInput.files)
    }
  }catch(e){ console.warn('File upload failed:',e.message) }

  statusEl.textContent='Submitting your project...'

  fetch(FORMSPREE_ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({
      _subject:`New StatVision Consultancy Order — ${data.name}`,
      _replyto:data.email,
      attached_files:clientFiles.map(f=>f.name).join(', ')||'None',
      ...data
    })
  }).then(res=>{
    if(!res.ok) throw new Error('Submission failed')
    return res.json()
  }).then(async ()=>{
    // write the real order straight to Firestore — visible instantly to Admin/Analyst/Client everywhere
    await fbDB.collection('orders').doc(newId).set({
      client:data.name,email:data.email,phone:data.phone,
      org:data.org,project:data.description?data.description.slice(0,40)+'…':data.service,service:data.datatype||data.service,
      tool:data.tool||'TBD',format:data.format||'TBD',analyst:'Unassigned',deadline:data.final_deadline||'TBD',
      total:'0',deposit:'0',balance:'0',status:'Pending',
      files:{client:clientFiles,analyst:[]}
    })
    statusEl.style.color='#107C10'
    statusEl.textContent='✓ Submitted! Check your email for confirmation.'
    setTimeout(()=>{
      closeModal();mStep=1;btn.disabled=false;statusEl.textContent=''
      ;[1,2,3].forEach(i=>{document.getElementById('ms'+i).style.display=i===1?'block':'none';document.getElementById('sd'+i).className='sdt'+(i===1?' on':'')})
      document.getElementById('mprev').style.display='none';btn.textContent='Continue →'
      if(fileInput)fileInput.value=''
      const fn=document.getElementById('mfn');if(fn)fn.textContent=''
    },1800)
  }).catch(()=>{
    btn.disabled=false
    statusEl.style.color='#D13438'
    statusEl.textContent='⚠ Could not submit online. Please email hello@statvisionconsultancy.co.ke or call +254 748 216 918 directly.'
  })
}
function mPrev(){
  if(mStep>1){
    document.getElementById('ms'+mStep).style.display='none';mStep--
    document.getElementById('ms'+mStep).style.display='block'
    document.getElementById('sd'+(mStep+1)).classList.remove('on');document.getElementById('sd'+mStep).classList.add('on')
    if(mStep===1)document.getElementById('mprev').style.display='none'
    document.getElementById('mnext').textContent='Continue →'
  }
}

// CHAT
function openChat(){document.getElementById('chatPan').classList.toggle('open');document.querySelector('.cbdg').style.display='none'}
const reps=['Great! How many variables and respondents does your dataset have?','That sounds like a great project. I would recommend SPSS or R for this. Shall I help you set up an order?','We handle data collection too — we design the questionnaire, deploy it, then analyse the results.','Turnaround is 3–7 days depending on complexity. We agree on a deadline when you place your order.','Click "Start Your Project" to submit your details and I will be assigned to your case right away!']
let rIdx=0
function sendChat(){
  const i=document.getElementById('chatIn'),m=i.value.trim();if(!m)return
  const c=document.getElementById('chatMsgs')
  c.innerHTML+=`<div class="msg c">${m}</div>`;i.value='';c.scrollTop=c.scrollHeight
  setTimeout(()=>{c.innerHTML+=`<div class="msg a">${reps[rIdx%reps.length]}</div>`;c.scrollTop=c.scrollHeight;rIdx++},900)
}
// ===== CLIENT PORTAL — REAL ACCOUNT DATA (no simulation) =====
let pbiPaused = false;
function pbiPause(){
  pbiPaused = !pbiPaused;
  document.getElementById('pbiPauseBtn').textContent = pbiPaused ? '▶ Resume' : '⏸ Pause';
}
function moneyNum(s){ return parseFloat(String(s).replace(/,/g,''))||0 }

const pbiKpis = [
  {label:'Active Orders', value:0, fmt:v=>Math.round(v).toString()},
  {label:'Completed', value:0, fmt:v=>Math.round(v).toString()},
  {label:'Balance Due (KES)', value:0, fmt:v=>'KES '+Math.round(v).toLocaleString()},
  {label:'Total Paid (KES)', value:0, fmt:v=>'KES '+Math.round(v).toLocaleString()},
];
const pbiKpiRow = document.getElementById('pbiKpiRow');
if(pbiKpiRow){
  pbiKpis.forEach((k,i)=>{
    const el=document.createElement('div');
    el.className='pbi-card';
    el.innerHTML=`<div class="pl">${k.label}</div><div class="pv" id="pbiKpiVal${i}">${k.fmt(k.value)}</div>`;
    pbiKpiRow.appendChild(el);
  });
}
const pbiBarSvg=document.getElementById('pbiBarChart');
const pbiDonutSvg=document.getElementById('pbiDonut');

function pbiRenderBars(mine){
  if(!pbiBarSvg)return;
  const w=720,h=190,padB=20,slots=8;
  const barW=(w/slots)-24;
  const recent=mine.slice(-slots);
  const bars=Array.from({length:slots},(_,i)=>{
    const r=recent[i-(slots-recent.length)];
    return r?{a:moneyNum(r.deposit)/1000,b:moneyNum(r.total)/1000}:{a:0,b:0}
  });
  const maxV=Math.max(1,...bars.map(d=>Math.max(d.a,d.b)));
  const scale=(h-padB)/maxV;
  let out='';
  bars.forEach((d,i)=>{
    const x=i*(w/slots)+6;
    const ha=d.a*scale, hb=d.b*scale;
    out+=`<rect x="${x}" y="${h-padB-ha}" width="${barW/2}" height="${ha}" fill="#F2C811" rx="2"/>`;
    out+=`<rect x="${x+barW/2+2}" y="${h-padB-hb}" width="${barW/2}" height="${hb}" fill="#1565C0" rx="2"/>`;
  });
  out+=`<line x1="0" y1="${h-padB}" x2="${w}" y2="${h-padB}" stroke="#E1DFDD" stroke-width="1"/>`;
  pbiBarSvg.innerHTML=out;
}

function pbiRenderDonut(totalPaid,balanceDue){
  if(!pbiDonutSvg)return;
  const total=totalPaid+balanceDue;
  const c=document.getElementById('pbiDonutCenter');
  const l=document.getElementById('pbiDonutList');
  if(total<=0){
    pbiDonutSvg.innerHTML=`<circle cx="60" cy="60" r="46" fill="none" stroke="#E1DFDD" stroke-width="15"/>`;
    if(c)c.innerHTML=`<div class="v">KES 0</div><div class="l">No payments yet</div>`;
    if(l)l.innerHTML=`<div><span>Total Paid</span><b>KES 0</b></div><div><span>Balance Due</span><b>KES 0</b></div>`;
    return;
  }
  const segs=[{label:'Total Paid',value:totalPaid,color:'#1565C0'},{label:'Balance Due',value:balanceDue,color:'#D13438'}];
  const r=46,cx=60,cy=60,thick=15;
  let angle=-90,paths='';
  segs.forEach(d=>{
    if(d.value<=0)return;
    const frac=d.value/total, sweep=frac*360, large=sweep>180?1:0;
    const x1=cx+r*Math.cos(angle*Math.PI/180), y1=cy+r*Math.sin(angle*Math.PI/180);
    const end=angle+sweep;
    const x2=cx+r*Math.cos(end*Math.PI/180), y2=cy+r*Math.sin(end*Math.PI/180);
    paths+=`<path d="M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${d.color}" stroke-width="${thick}" stroke-linecap="round"/>`;
    angle=end+3;
  });
  pbiDonutSvg.innerHTML=paths;
  if(c)c.innerHTML=`<div class="v">KES ${Math.round(total).toLocaleString()}</div><div class="l">Total</div>`;
  if(l)l.innerHTML=`<div><span>Total Paid</span><b>KES ${Math.round(totalPaid).toLocaleString()}</b></div><div><span>Balance Due</span><b>KES ${Math.round(balanceDue).toLocaleString()}</b></div>`;
}

function pbiRenderRecentOrders(mine){
  const body=document.getElementById('pbiOrdersBody');
  if(!body)return;
  if(mine.length===0){
    body.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--sl);padding:1.2rem">No orders yet — submit your first project to see it here.</td></tr>`;
    return;
  }
  const clsMap={'In Progress':'prog','Confirmed':'done','Draft Review':'review','Completed':'done','Pending':'review'};
  body.innerHTML=mine.slice(-6).reverse().map(r=>
    `<tr><td><strong>${r.id}</strong></td><td>${r.project}</td><td>${r.tool}</td><td>${r.analyst}</td><td>${r.deadline}</td><td><span class="pbi-status ${clsMap[r.status]||'review'}">${r.status}</span></td></tr>`
  ).join('');
}

function pbiRenderClientPortal(){
  const cu=currentClient();
  const mine=cu?sqlData.filter(r=>r.email && r.email.toLowerCase()===cu.email.toLowerCase()):[];
  const active=mine.filter(r=>r.status!=='Completed').length;
  const completed=mine.filter(r=>r.status==='Completed').length;
  const totalPaid=mine.reduce((s,r)=>s+moneyNum(r.deposit),0);
  const balanceDue=mine.reduce((s,r)=>s+moneyNum(r.balance),0);

  pbiKpis[0].value=active; pbiKpis[1].value=completed; pbiKpis[2].value=balanceDue; pbiKpis[3].value=totalPaid;
  pbiKpis.forEach((k,i)=>{ const v=document.getElementById('pbiKpiVal'+i); if(v)v.textContent=k.fmt(k.value); });

  pbiRenderBars(mine);
  pbiRenderDonut(totalPaid,balanceDue);
  pbiRenderRecentOrders(mine);
}
function pbiRefresh(){ pbiRenderClientPortal(); }

pbiRenderClientPortal();

function clientSend(){
  const i=document.getElementById('clientChatIn'),m=i.value.trim();if(!m)return
  const c=document.getElementById('clientMsgs')
  c.innerHTML+=`<div class="msg c">${m}</div>`;i.value='';c.scrollTop=c.scrollHeight
  setTimeout(()=>{c.innerHTML+=`<div class="msg a">Thank you for the note — I will incorporate that into the analysis and update you shortly.</div>`;c.scrollTop=c.scrollHeight},900)
}
function analystSend(){
  const i=document.getElementById('analystChatIn'),m=i.value.trim();if(!m)return
  const c=document.getElementById('analystMsgs')
  c.innerHTML+=`<div class="msg a">${m}</div>`;i.value='';c.scrollTop=c.scrollHeight
}
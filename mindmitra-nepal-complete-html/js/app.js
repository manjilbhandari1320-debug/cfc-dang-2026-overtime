(() => {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let role='client', mode='signin', userName='Demo User';
const labels={client:'Student / Employee',counsellor:'Counsellor',organization:'Organization',admin:'Admin',super_admin:'Super Admin'};
const nav={
client:[['dashboard','🏠','Dashboard'],['assessment','🧠','Assessment'],['reports','✨','AI Reports'],['counsellors','🩺','Counsellors'],['appointments','📅','Appointments'],['resources','📚','Resources'],['crisis','🆘','Crisis Support'],['privacy','🔒','Privacy & Consent']],
counsellor:[['dashboard','🏠','Dashboard'],['profile','👤','Professional Profile'],['availability','🗓️','Availability'],['appointments','📅','Appointment Requests'],['clients','📄','Client Reports'],['notes','📝','Counsellor Notes']],
organization:[['dashboard','🏠','Dashboard'],['members','👥','Students / Employees'],['create-user','➕','Create User'],['bulk','📥','Bulk Import'],['groups','🏷️','Departments'],['analytics','📊','Anonymous Reports'],['counsellors','🩺','Counsellors'],['billing','💳','Subscription']],
admin:[['dashboard','🏠','Dashboard'],['organizations','🏢','Organizations'],['verification','✅','Counsellor Verification'],['users','👥','Users'],['assessments','🧠','Assessments'],['risk','⚠️','Risk Settings'],['helplines','☎️','Helplines'],['audit','📋','Audit Logs']],
super_admin:[['dashboard','🏠','Global Dashboard'],['admins','🛡️','Admin Accounts'],['organizations','🏢','Organizations'],['security','🔐','Security'],['system','⚙️','Platform Settings'],['billing','💳','Plans & Billing'],['audit','📋','Global Audit Logs']]
};
const configured=window.MINDMITRA_SUPABASE_URL&&!window.MINDMITRA_SUPABASE_URL.includes('YOUR_PROJECT_REF');
const sb=configured?window.supabase.createClient(window.MINDMITRA_SUPABASE_URL,window.MINDMITRA_SUPABASE_ANON_KEY):null;
$$('[data-open-auth]').forEach(b=>b.onclick=()=>openAuth(b.dataset.openAuth));
function openAuth(r){role=r;mode='signin';$('#auth-modal').classList.remove('hidden');updateAuth()}
$('#close-auth').onclick=()=>$('#auth-modal').classList.add('hidden');
$$('[data-auth-role]').forEach(b=>b.onclick=()=>{role=b.dataset.authRole;mode='signin';updateAuth()});
$$('[data-auth-mode]').forEach(b=>b.onclick=()=>{if(!['admin','super_admin'].includes(role)){mode=b.dataset.authMode;updateAuth()}});
function updateAuth(){
$$('[data-auth-role]').forEach(b=>b.classList.toggle('active',b.dataset.authRole===role));
$$('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
const restricted=['admin','super_admin'].includes(role);
$('[data-auth-mode="signup"]').classList.toggle('hidden',restricted);
$('#restricted-note').classList.toggle('hidden',!restricted);
$('#signup-fields').classList.toggle('hidden',mode!=='signup');
$('#org-type-wrap').classList.toggle('hidden',!(mode==='signup'&&role==='organization'));
$('#counsellor-extra').classList.toggle('hidden',!(mode==='signup'&&role==='counsellor'));
$('#first-login-note').classList.toggle('hidden',role!=='client');
$('#auth-submit').textContent=mode==='signup'?'Create Account':'Sign In';
}
$('#demo-login').onclick=()=>enterApp(labels[role]+' Demo');
$('#auth-form').onsubmit=async e=>{
e.preventDefault(); const email=$('#auth-email').value.trim(),password=$('#auth-password').value;
if(!email||!password)return showError('Enter your email or username and password.');
if(!sb)return showError('Add Supabase URL and anon key, or use the demo button.');
try{
const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;
const {data:p,error:pe}=await sb.from('profiles').select('full_name,role').eq('id',data.user.id).single();if(pe)throw pe;
if(p.role!==role){await sb.auth.signOut();throw new Error('This account belongs to another portal.')}
enterApp(p.full_name||email);
}catch(err){showError(err.message)}
};
function showError(m){$('#auth-error').textContent=m;$('#auth-error').classList.remove('hidden')}
function enterApp(name){userName=name;$('#auth-modal').classList.add('hidden');$('#public-site').classList.add('hidden');$('#role-app').classList.remove('hidden');$('#sidebar-role').textContent=labels[role]+' Portal';$('#user-badge').textContent=name[0].toUpperCase();$('#crisis-shortcut').classList.toggle('hidden',role!=='client');renderNav();go('dashboard')}
function renderNav(){const n=$('#sidebar-nav');n.innerHTML='';nav[role].forEach(([id,icon,label])=>{const b=document.createElement('button');b.className='sidebar-link';b.dataset.page=id;b.innerHTML=`<span>${icon}</span>${label}`;b.onclick=()=>go(id);n.append(b)})}
function go(page){$$('.sidebar-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const item=nav[role].find(x=>x[0]===page);$('#page-title').textContent=item?item[2]:'Dashboard';$('#page-subtitle').textContent=labels[role]+' Portal';$('#panel-content').innerHTML=render(page)}
$('#logout').onclick=async()=>{if(sb)await sb.auth.signOut();$('#role-app').classList.add('hidden');$('#public-site').classList.remove('hidden')};
$('#menu-btn').onclick=()=>$('#sidebar').classList.toggle('open');$('#crisis-shortcut').onclick=()=>go('crisis');
const stats=a=>`<div class="dashboard-grid">${a.map(x=>`<div class="stat-card"><small>${x[0]}</small><b>${x[1]}</b><span class="text-xs text-gray-500">${x[2]||''}</span></div>`).join('')}</div>`;
const panel=(t,b)=>`<section class="panel-card mt-5"><h3 class="font-bold">${t}</h3><div class="mt-4">${b}</div></section>`;
const table=(h,r)=>`<div class="table-wrap"><table class="data-table"><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
function render(page){
if(page==='dashboard'){
if(role==='client')return stats([['Assessment','65%'],['Latest summary','Balanced'],['Appointment','1'],['Counsellors','12']])+panel('Next steps','Complete your assessment, review suggestions and browse counsellors.');
if(role==='counsellor')return stats([['Pending requests','6'],['Confirmed today','3'],['Authorized reports','9'],['Urgent review','1']])+panel('Recent requests',table(['Client','Concern','Action'],[['Anonymous Client 104','Moderate','<button class="action">Review</button>'],['Anonymous Client 117','General support','<button class="action">Open</button>']]));
if(role==='organization')return stats([['Registered users','486'],['Participation','74%'],['Completion','62%'],['Appointments','31']])+panel('Anonymous wellness trend','Low concern 58% · Moderate 28% · Elevated 11% · Review 3%');
if(role==='admin')return stats([['Organizations','38'],['Users','8,420'],['Verified counsellors','64'],['Pending','9']])+panel('Pending actions',table(['Item','Type','Action'],[['Dr. A. Sharma','Counsellor application','<button class="action">Review</button>'],['Sunrise College','Organization','<button class="action">Open</button>']]));
return stats([['Admins','7'],['Organizations','38'],['Monthly active users','5,940'],['Security alerts','2']])+panel('Global controls','Manage administrators, security policies, plans, retention and integrations.');
}
if(page==='assessment')return panel('Wellness Assessment','<div class="mb-4 text-sm text-gray-500">Question 3 of 20</div><h2 class="text-xl font-bold">How often have you felt overwhelmed by study or work pressure recently?</h2><button class="assessment-option">Not at all</button><button class="assessment-option">Several days</button><button class="assessment-option">More than half the days</button><button class="assessment-option">Nearly every day</button>');
if(page==='crisis')return panel('Get Immediate Help','<div class="p-4 bg-red-50 rounded-xl"><b>If you may be in immediate danger, contact a trusted adult, local emergency service, or nearby hospital now.</b><p class="mt-2 text-sm">Only verified, admin-managed helplines should be displayed in production.</p></div>');
if(page==='create-user')return panel('Create Student or Employee','<div class="grid md:grid-cols-2 gap-4"><input class="form-input" placeholder="Full name"><input class="form-input" placeholder="Temporary username"><input class="form-input" placeholder="Temporary password"><select class="form-input"><option>Student</option><option>Employee</option></select></div><button class="btn-primary mt-4">Create account</button>');
if(page==='verification')return panel('Counsellor Verification',table(['Name','Licence','Status','Action'],[['Dr. Sunita Sharma','NPC-2044','Pending','<button class="action">Review</button>'],['Bikash Thapa','NPC-1982','More info needed','<button class="action">Open</button>']]));
if(page==='counsellors')return panel('Verified Counsellors','<div class="grid md:grid-cols-3 gap-4"><div class="info-chip"><b>Dr. Sunita Sharma</b><p>Clinical Psychology · Anxiety · English/Nepali</p></div><div class="info-chip"><b>Bikash Thapa</b><p>Stress Management · Workplace Wellness</p></div><div class="info-chip"><b>Maya Gurung</b><p>Young Adults · Family Support</p></div></div>');
return panel((nav[role].find(x=>x[0]===page)||['','','Module'])[2],'<p class="text-gray-600">This frontend module is included as a working demo screen and is ready to connect to Supabase data.</p>');
}
$('#year').textContent=new Date().getFullYear();
})();
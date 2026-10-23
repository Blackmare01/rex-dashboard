(() => {
  const KEY = 'rex-dashboard-v1';
  const defaults = { moderationEnabled:true, requireReason:true, actionDm:true, modLogging:true, modChannel:'# mod-logs', automodEnabled:false, spamFilter:true, inviteFilter:true, wordFilter:false, mentionFilter:true, automodAction:'Delete message and notify moderators', welcomeEnabled:true, welcomeChannel:'# welcome', welcomeMessage:'Hey {user}, welcome to {server}! 🎉 Make yourself at home.', welcomeCard:false, goodbyeEnabled:false, goodbyeChannel:'# welcome', goodbyeMessage:'{user} has left {server}. We wish them well.', prefix:'/', language:'English (US)', timezone:'Asia/Kolkata (UTC+5:30)', privateReplies:false };
  const activities = [
    {type:'moderation',icon:'⌑',text:'<b>NovaMod</b> warned <b>@duskfall</b>',detail:'Reason: Excessive self-promotion',time:'12 minutes ago',tag:'WARNING'},
    {type:'members',icon:'＋',text:'<b>@pixelpioneer</b> joined the server',detail:'Member count is now 2,481',time:'38 minutes ago',tag:'MEMBER'},
    {type:'moderation',icon:'⌑',text:'<b>NovaMod</b> timed out <b>@spambot_42</b>',detail:'Duration: 10 minutes · AutoMod',time:'1 hour ago',tag:'TIMEOUT'},
    {type:'bot',icon:'✳',text:'<b>Rex</b> posted a welcome message',detail:'Sent to # welcome',time:'2 hours ago',tag:'BOT'},
    {type:'members',icon:'＋',text:'<b>@luna.exe</b> joined the server',detail:'Invited by @Alex Morgan',time:'3 hours ago',tag:'MEMBER'},
    {type:'moderation',icon:'⌑',text:'<b>NovaMod</b> cleared 12 messages in # general',detail:'Bulk message cleanup',time:'5 hours ago',tag:'CLEANUP'},
    {type:'bot',icon:'✳',text:'<b>Rex</b> command settings updated',detail:'Prefix set to /',time:'Yesterday',tag:'BOT'},
    {type:'moderation',icon:'⌑',text:'<b>NovaMod</b> banned <b>@raid_account</b>',detail:'Reason: Raid protection',time:'Yesterday',tag:'BAN'}
  ];
  const commands = [
    ['/rank','View your rank and XP','utility',1204,true],['/play','Play music in a voice channel','music',986,true],['/avatar','View a member’s avatar','utility',642,true],['/help','Browse all Rex commands','utility',398,true],['/warn','Issue a warning to a member','moderation',187,true],['/timeout','Timeout a member','moderation',94,true],['/kick','Remove a member from the server','moderation',32,true],['/ban','Ban a member from the server','moderation',12,true],['/8ball','Ask the magic 8-ball a question','fun',280,true],['/meme','Get a random meme','fun',156,true],['/queue','View the music queue','music',144,true],['/skip','Skip the current track','music',91,true]
  ];
  let stored; try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { stored = {}; }
  let state = { ...defaults, ...stored };
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let toastTimer;
  function toast(message) { const t=$('#toast'); t.textContent=message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2400); }
  function save(message) { localStorage.setItem(KEY,JSON.stringify(state)); updateSetup(); if(message) toast(message); }
  function syncControls() { $$('[data-setting]').forEach(el=>{const k=el.dataset.setting;if(el.type==='checkbox')el.checked=!!state[k];else el.value=state[k]??defaults[k]??'';}); if($('#charCount'))$('#charCount').textContent=(state.welcomeMessage||'').length; }
  function updateSetup(){const n=(state.welcomeEnabled?1:0)+(state.automodEnabled?1:0)+2;$('#setupDone').textContent=n;$('#progressPercent').textContent=(n*25)+'%';const steps=$$('.setup-step');steps[2].classList.toggle('complete',!!state.welcomeEnabled);steps[2].querySelector('span').className=state.welcomeEnabled?'step-check':'step-circle';steps[2].querySelector('span').textContent=state.welcomeEnabled?'✓':'3';steps[3].classList.toggle('complete',!!state.automodEnabled);steps[3].querySelector('span').className=state.automodEnabled?'step-check':'step-circle';steps[3].querySelector('span').textContent=state.automodEnabled?'✓':'4';}
  function renderActivity(target,filter='all',search=''){const container=$(target);if(!container)return;const q=search.trim().toLowerCase();const rows=activities.filter(a=>(filter==='all'||a.type===filter)&&(!q||(a.text+a.detail+a.tag).toLowerCase().includes(q)));container.innerHTML=rows.map(a=>`<div class="activity-item"><span class="activity-icon ${a.type==='moderation'?'warn':a.type==='members'?'join':''}">${a.icon}</span><div class="activity-copy">${a.text}<small>${a.detail}</small></div><span class="activity-tag">${a.tag}</span><small class="activity-time">${a.time}</small></div>`).join('')||'<div class="empty-state">No activity matches your search.</div>';}
  function renderCommands(){const q=($('#commandSearch')?.value||'').toLowerCase(),category=$('#categoryFilter')?.value||'all';const shown=commands.filter(c=>(category==='all'||c[2]===category)&&(c[0]+c[1]).toLowerCase().includes(q));$('#commandRows').innerHTML=shown.map((c,i)=>`<div class="command-row"><code>${c[0]}</code><span>${c[1]}</span><small>${c[3].toLocaleString()} uses</small><button class="tag ${c[4]?'':'off'}" data-command-index="${commands.indexOf(c)}">${c[4]?'ENABLED':'DISABLED'}</button></div>`).join('')||'<div class="empty-state">No commands found.</div>';}
  function navigate(name){const page=$(`#page-${name}`);if(!page)return;$$('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');$$('.side-link').forEach(x=>x.classList.toggle('active',x.dataset.page===name));const title=name==='welcome'?'Welcome & goodbye':name==='automod'?'AutoMod':name==='logs'?'Server logs':name[0].toUpperCase()+name.slice(1);$('#crumb').textContent=title;history.replaceState(null,'','#'+name);window.scrollTo(0,0);}
  function modal(title,body,action='Got it'){ $('#modalTitle').textContent=title;$('#modalText').textContent=body;$('#modalAction').textContent=action;$('#modal').classList.remove('hidden'); }
  $$('.side-link').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  $$('[data-setting]').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{state[el.dataset.setting]=el.type==='checkbox'?el.checked:el.value;save();}));
  $('#inviteBtn').addEventListener('click',()=>modal('Invite Rex','A real Discord invite opens through OAuth after you connect a Rex bot application. This dashboard preview is running locally.','Sounds good'));
  $('#serverSelect').addEventListener('click',()=>modal('Your servers','Nova Community is the demo server selected for this dashboard. Connect Discord OAuth to load your real servers.'));
  $('#helpBtn').addEventListener('click',()=>modal('Rex dashboard help','Use the left menu to configure moderation, AutoMod, welcome messages and commands. Your changes save automatically in this browser.'));
  $('#modalClose').addEventListener('click',()=>$('#modal').classList.add('hidden'));$('#modalAction').addEventListener('click',()=>$('#modal').classList.add('hidden'));$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').classList.add('hidden')});
  $('#previewWelcome').addEventListener('click',()=>{const message=(state.welcomeMessage||'').replaceAll('{user}','@Alex Morgan').replaceAll('{server}','Nova Community');const p=$('#welcomePreview');p.textContent=message;p.classList.remove('hidden');});
  $('#welcomeMessage').addEventListener('input',e=>$('#charCount').textContent=e.target.value.length);
  $('#commandSearch').addEventListener('input',renderCommands);$('#categoryFilter').addEventListener('change',renderCommands);
  $('#commandRows').addEventListener('click',e=>{const b=e.target.closest('[data-command-index]');if(!b)return;const c=commands[Number(b.dataset.commandIndex)];c[4]=!c[4];b.classList.toggle('off',!c[4]);b.textContent=c[4]?'ENABLED':'DISABLED';toast(`${c[0]} ${c[4]?'enabled':'disabled'}`);});
  $('#logSearch').addEventListener('input',()=>renderActivity('#fullActivity',$('#logFilter').value,$('#logSearch').value));$('#logFilter').addEventListener('change',()=>renderActivity('#fullActivity',$('#logFilter').value,$('#logSearch').value));$('#loadMore').addEventListener('click',()=>toast('You’re all caught up.'));
  $('#disconnectBtn').addEventListener('click',()=>modal('Disconnect Rex?','This demo cannot disconnect an actual Discord bot. In a connected deployment, this action would remove Rex from the server.','Understood'));
  $('#resetBtn').addEventListener('click',()=>{state={...defaults};localStorage.removeItem(KEY);syncControls();updateSetup();toast('Demo settings reset');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').classList.add('hidden')});
  syncControls();updateSetup();renderActivity('#activityList');renderActivity('#fullActivity');renderCommands();const initial=location.hash.slice(1);if(initial&&$(`#page-${initial}`))navigate(initial);
})();

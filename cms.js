
import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, setDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const configured=!Object.values(firebaseConfig).some(v=>String(v).includes('PASTE_'))&&!ADMIN_UID.includes('PASTE_');
const DEMO=window.CHEONSANGHEUN_DEMO===true;
const editRequested=new URLSearchParams(location.search).get('edit')==='1';
const defaults={
  story:{title:'이야기',intro:'현재 진행되는 이야기를 장면 단위로 읽습니다.',status:'locked',lockedMessage:'아직 공개되지 않은 이야기입니다.',kicker:'VISUAL NOVEL · STORY'},
  character:{title:'인물',intro:'천상흔의 인물들을 기록합니다.',status:'locked',lockedMessage:'아직 공개되지 않은 인물 기록입니다.',kicker:'CHARACTER INDEX'},
  archive:{title:'기록',intro:'이야기가 지나간 자리에 남은 기록을 보관합니다.',status:'locked',lockedMessage:'아직 공개되지 않은 기록입니다.',kicker:'ARCHIVE · 記錄庫'}
};
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=ts=>{try{return ts?.toDate?.().toLocaleString('ko-KR')||''}catch{return''}};
const label=s=>s==='story'?'이야기':s==='character'?'인물':'기록';

let admin=false,currentUser=null,db=null,auth=null;
let cache=[], pageCache={}, activeSection='story';
let activeEpisodeId=null, activeSceneIndex=0, autoTimer=null, logRows=[];
let editingScenes=[], editingEpisodeId=null, editingSceneIndex=-1;
let currentArchiveId=null;
let archiveReplayScenes=[], archiveReplayIndex=0;
let localPreviewDataUrl='';

/* ---------- R2 MEDIA UPLOADER ---------- */
function r2Config(){return window.CHEONSANGHEUN_R2||{}}
function r2Ready(){const c=r2Config();return !!(c.enabled&&c.endpoint&&!String(c.endpoint).includes('PASTE_'))}
function r2Endpoint(){return String(r2Config().endpoint||'').replace(/\/$/,'')}
function dispatchInput(el){el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))}
function chooseFile(accept='*/*'){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.style.display='none';document.body.appendChild(input);input.addEventListener('change',()=>{const f=input.files?.[0]||null;input.remove();resolve(f)},{once:true});input.addEventListener('cancel',()=>{input.remove();resolve(null)},{once:true});input.click()})}
async function uploadR2File(file,kind,button){
  if(!admin||!currentUser)throw new Error('관리자 로그인 후 업로드할 수 있습니다.');
  if(!r2Ready())throw new Error('R2 Worker가 아직 연결되지 않았습니다. r2-config.js에 Worker 주소를 넣어 주세요.');
  const maxImage=20*1024*1024,maxAudio=50*1024*1024;
  if(file.type.startsWith('image/')&&file.size>maxImage)throw new Error('이미지는 20MB 이하만 업로드할 수 있습니다.');
  if(file.type.startsWith('audio/')&&file.size>maxAudio)throw new Error('사운드는 50MB 이하만 업로드할 수 있습니다.');
  const old=button?.textContent;if(button){button.classList.add('is-busy');button.textContent='업로드 중…'}
  try{
    const token=await currentUser.getIdToken(true);
    const res=await fetch(`${r2Endpoint()}/upload?kind=${encodeURIComponent(kind||'misc')}`,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name||'file')},body:file});
    let data={};try{data=await res.json()}catch{}
    if(!res.ok)throw new Error(data.error||`업로드 실패 (${res.status})`);
    if(!data.url)throw new Error('업로드 주소를 받지 못했습니다.');
    return data;
  }finally{if(button){button.classList.remove('is-busy');button.textContent=old||'파일 업로드'}}
}
async function removeR2Asset(value){
  const url=String(value||'').trim();if(!url)return;
  if(!r2Ready()||!url.startsWith(r2Endpoint()+'/media/'))return;
  if(!admin||!currentUser)throw new Error('관리자 로그인 후 삭제할 수 있습니다.');
  const token=await currentUser.getIdToken(true);
  const res=await fetch(url,{method:'DELETE',headers:{'Authorization':`Bearer ${token}`}});
  if(!res.ok){let d={};try{d=await res.json()}catch{}throw new Error(d.error||`저장소 삭제 실패 (${res.status})`)}
}
document.addEventListener('click',async e=>{
  const up=e.target.closest('[data-r2-upload]');
  if(up){
    e.preventDefault();
    const target=document.getElementById(up.dataset.r2Target||'');if(!target)return;
    try{const file=await chooseFile(up.dataset.r2Accept||'*/*');if(!file)return;const data=await uploadR2File(file,up.dataset.r2Kind||'misc',up);target.value=data.url;dispatchInput(target)}
    catch(err){console.error(err);alert(err.message||'파일 업로드에 실패했습니다.')}
    return;
  }
  const del=e.target.closest('[data-r2-remove]');
  if(del){
    e.preventDefault();const target=document.getElementById(del.dataset.r2Target||'');if(!target)return;
    const value=target.value.trim();if(!value)return;
    if(!confirm('이 파일 연결을 삭제할까요? R2에 업로드한 파일이면 저장소에서도 삭제됩니다.'))return;
    const old=del.textContent;del.textContent='삭제 중…';del.disabled=true;
    try{await removeR2Asset(value);target.value='';dispatchInput(target)}catch(err){console.error(err);alert(err.message||'삭제에 실패했습니다.')}finally{del.textContent=old;del.disabled=false}
  }
});

const vnAudio={muted:true,bgm:new Audio(),amb:new Audio(),se:new Audio(),bgmUrl:'',ambUrl:'',episodeId:''};
vnAudio.bgm.loop=true;vnAudio.amb.loop=true;vnAudio.bgm.volume=.55;vnAudio.amb.volume=.42;vnAudio.se.volume=.75;
const replayAudio={muted:false,bgm:new Audio(),amb:new Audio(),se:new Audio(),bgmUrl:'',ambUrl:''};
replayAudio.bgm.loop=true;replayAudio.amb.loop=true;replayAudio.bgm.volume=.55;replayAudio.amb.volume=.42;replayAudio.se.volume=.75;
async function playAudio(a,muted){if(muted||!a?.src)return;try{await a.play()}catch(e){}}
function setTrack(state,key,url){const a=state[key];if(!a)return;if(!url){a.pause();a.removeAttribute('src');a.load();state[key+'Url']='';return}if(state[key+'Url']!==url){a.pause();a.src=url;a.load();state[key+'Url']=url}playAudio(a,state.muted)}
function applyVnSound(ep,scene){
  if(vnAudio.episodeId!==ep.id){vnAudio.episodeId=ep.id;setTrack(vnAudio,'bgm',ep.bgmUrl||'');setTrack(vnAudio,'amb','')}
  if(scene.bgmAction==='set')setTrack(vnAudio,'bgm',scene.bgmUrl||'');else if(scene.bgmAction==='stop')setTrack(vnAudio,'bgm','');
  if(scene.ambAction==='set')setTrack(vnAudio,'amb',scene.ambUrl||'');else if(scene.ambAction==='stop')setTrack(vnAudio,'amb','');
  if(scene.seUrl&&!vnAudio.muted){vnAudio.se.pause();vnAudio.se.src=scene.seUrl;vnAudio.se.currentTime=0;playAudio(vnAudio.se,false)}
}
function updateVnSoundButton(){const b=$('#vnSound');if(!b)return;b.textContent=vnAudio.muted?'SOUND OFF':'SOUND ON';b.classList.toggle('is-active',!vnAudio.muted)}
function toggleVnSound(){vnAudio.muted=!vnAudio.muted;if(vnAudio.muted){vnAudio.bgm.pause();vnAudio.amb.pause();vnAudio.se.pause()}else{playAudio(vnAudio.bgm,false);playAudio(vnAudio.amb,false)}updateVnSoundButton()}

const demoContent=[
 {id:'ep-01',section:'story',status:'public',sortOrder:1,subtitle:'第一章',title:'비가 그친 자리',excerpt:'선계의 오래된 정원에서 처음 마주친 두 사람.',bgmUrl:'',scenes:[
   {kind:'narration',speaker:'',text:'비가 그친 뒤에도 처마 끝에서는 한참 동안 물방울이 떨어졌다.',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''},
   {kind:'dialogue',speaker:'연화',text:'“아직 돌아가지 않았습니까?”',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''},
   {kind:'dialogue',speaker:'백연',text:'“이곳까지 따라올 줄은 몰랐군.”',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'arc-01',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''},
   {kind:'narration',speaker:'',text:'두 사람 사이로 젖은 나뭇잎이 한 장 떨어졌다. 그날의 만남은 훗날 하나의 기록으로 남았다.',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''}
 ]},
 {id:'ep-02',section:'story',status:'public',sortOrder:2,subtitle:'第二章',title:'끊어진 길',excerpt:'아직 작성 중인 다음 장.',bgmUrl:'',scenes:[
   {kind:'narration',speaker:'',text:'다음 장면을 이곳에 이어서 작성할 수 있습니다.',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''}
 ]},
 {id:'arc-01',section:'archive',status:'public',sortOrder:1,subtitle:'STORY',dateLabel:'記錄 001',title:'선계 정원에서의 조우',excerpt:'첫 번째 이야기를 지나면 열리는 기록.',body:'비가 그친 선계의 정원에서 두 존재가 처음 마주쳤다.\n\n이 기록은 당시 장면을 그대로 다시 볼 수 있는 예시이다.',imageUrl:'',unlockMode:'story',replayEpisode:'第一章 · 비가 그친 자리',replayScenes:[
   {kind:'dialogue',speaker:'백연',text:'“이곳까지 따라올 줄은 몰랐군.”',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'arc-01',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''}
 ]},
 {id:'arc-02',section:'archive',status:'public',sortOrder:2,subtitle:'WORLD',dateLabel:'記錄 002',title:'삼계에 관한 공개 기록',excerpt:'처음부터 열려 있는 일반 기록의 예시.',body:'아카이브에는 스토리 해금 기록뿐 아니라 운영진이 직접 작성한 세계관 문서나 공지도 함께 넣을 수 있다.',imageUrl:'',unlockMode:'always'},
 {id:'char-01',section:'character',status:'public',sortOrder:1,subtitle:'CHARACTER',title:'인물 기록 예시',excerpt:'캐릭터 페이지는 기존 카드형 구조를 유지하며 추후 상세 프로필과 연결할 수 있습니다.',body:''}
];
const demoPages={
 story:{...defaults.story,status:'public'},
 character:{...defaults.character,status:'public'},
 archive:{...defaults.archive,status:'public'}
};

const unlockKey='cheonsangheun-unlocked-archives-v1';
function unlockedSet(){
  try{return new Set(JSON.parse(localStorage.getItem(unlockKey)||'[]'))}catch{return new Set()}
}
function unlockArchive(id){
  if(!id)return;
  const s=unlockedSet();
  if(!s.has(id)){s.add(id);localStorage.setItem(unlockKey,JSON.stringify([...s]));renderArchive();}
}
function isArchiveUnlocked(p){return admin||p.unlockMode!=='story'||unlockedSet().has(p.id)}

function applyPage(key){
  const root=$(`[data-cms-section="${key}"]`),data=pageCache[key]||defaults[key];
  if(root){
    root.querySelector('[data-cms-title]')?.replaceChildren(document.createTextNode(data.title||defaults[key].title));
    root.querySelector('[data-cms-intro]')?.replaceChildren(document.createTextNode(data.intro||''));
    root.querySelector('[data-cms-kicker]')?.replaceChildren(document.createTextNode(data.kicker||''));
  }
  const panel=$(`.panel[data-panel="${key}"]`), lock=panel?.querySelector('.private-panel'), cms=panel?.querySelector(key==='character'?'.character-live':'.cms-panel');
  if(lock){
    lock.querySelector('h2').textContent=data.title||defaults[key].title;
    lock.querySelector('p').textContent=data.lockedMessage||defaults[key].lockedMessage;
  }
  if(admin || DEMO || data.status==='public'){if(cms)cms.style.display=key==='character'?'block':'flex';if(lock)lock.style.display='none'}
  else{if(cms)cms.style.display='none';if(lock)lock.style.display='grid'}
}

async function loadPages(){
  if(DEMO||!configured){pageCache={...demoPages};['story','character','archive'].forEach(applyPage);return}
  for(const key of ['story','character','archive']){
    let data={...defaults[key]};
    try{const s=await getDoc(doc(db,'pages',key));if(s.exists())data={...data,...s.data()}}catch(e){}
    pageCache[key]=data; applyPage(key);
  }
}
async function loadContent(){
  if(DEMO||!configured){cache=structuredClone(demoContent)}
  else if(admin){
    const s=await getDocs(collection(db,'content')); cache=s.docs.map(d=>({id:d.id,...d.data()}))
  }else{
    try{const s=await getDocs(query(collection(db,'content'),where('status','==','public')));cache=s.docs.map(d=>({id:d.id,...d.data()}))}catch(e){cache=[]}
  }
  cache.sort((a,b)=>((a.sortOrder??999999)-(b.sortOrder??999999))||((b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)));
  renderStory();renderCharacter();renderArchive();
}
function visibleFor(key){return cache.filter(p=>p.section===key&&(admin||DEMO||p.status==='public'))}

/* ---------- VISUAL NOVEL ---------- */
function episodes(){return visibleFor('story')}
function renderStory(){
  const root=$('[data-cms-section="story"]'); if(!root)return;
  const list=$('#vnEpisodeList'),status=root.querySelector('[data-cms-status]'),eps=episodes();
  status.textContent=admin?`${eps.length}개 에피소드 · 실제 페이지에서 장면을 바로 편집할 수 있습니다.`:'';
  if(!eps.length){
    list.innerHTML='<div class="cms-empty">아직 공개된 이야기가 없습니다.</div>';
    activeEpisodeId=null;renderScene();return;
  }
  if(!activeEpisodeId||!eps.some(e=>e.id===activeEpisodeId))activeEpisodeId=eps[0].id;
  list.innerHTML=eps.map(e=>`<article class="vn-episode-card ${e.id===activeEpisodeId?'is-active':''}" data-episode-id="${e.id}">
    <small>${esc(e.subtitle||'CHAPTER')}</small><b>${esc(e.title||'(제목 없음)')}</b><p>${esc(e.excerpt||'')}</p>
  </article>`).join('');
  $$('[data-episode-id]').forEach(el=>el.onclick=()=>{activeEpisodeId=el.dataset.episodeId;activeSceneIndex=0;logRows=[];renderStory();});
  renderScene();
}
function currentEpisode(){return episodes().find(e=>e.id===activeEpisodeId)}
function safeImg(el,src){
  if(!el)return;
  if(src){el.src=src;el.hidden=false}else{el.removeAttribute('src');el.hidden=true}
}
function renderScene(){
  const ep=currentEpisode(),empty=$('#vnEmptyArt');
  if(!ep){$('#vnChapterLabel').textContent='STORY';$('#vnSceneCount').textContent='—';$('#vnSpeaker').textContent='';$('#vnText').textContent='에피소드를 선택하면 이야기가 시작됩니다.';return}
  const scenes=Array.isArray(ep.scenes)?ep.scenes:[];
  if(!scenes.length){activeSceneIndex=0;$('#vnChapterLabel').textContent=ep.subtitle||'STORY';$('#vnSceneCount').textContent='00 / 00';$('#vnSpeaker').textContent='';$('#vnText').textContent='아직 장면이 없습니다.';safeImg($('#vnLeftChar'),'');safeImg($('#vnRightChar'),'');safeImg($('#vnCg'),'');$('#vnStageBg').style.backgroundImage='';return}
  activeSceneIndex=Math.max(0,Math.min(activeSceneIndex,scenes.length-1));
  const s=scenes[activeSceneIndex]||{};
  $('#vnChapterLabel').textContent=ep.subtitle||ep.title||'STORY';
  $('#vnSceneCount').textContent=`${String(activeSceneIndex+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}`;
  $('#vnProgress').textContent=`${ep.title||''} · ${activeSceneIndex+1}/${scenes.length}`;
  $('#vnSpeaker').textContent=s.speaker||'';
  $('#vnText').textContent=s.text||'';
  const stage=$('#vnStageBg');
  if(s.background){stage.style.backgroundImage=`linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.18)),url("${s.background.replace(/"/g,'%22')}")`;empty.style.display='none'}
  else{stage.style.backgroundImage='';empty.style.display='flex'}
  safeImg($('#vnLeftChar'),s.leftImage); safeImg($('#vnRightChar'),s.rightImage); safeImg($('#vnCg'),s.cgImage);
  if(s.cgImage)empty.style.display='none';
  if(s.effect==='fade'){stage.animate([{opacity:.35},{opacity:1}],{duration:360,easing:'ease-out'})}
  applyVnSound(ep,s);
  if(s.archiveId)unlockArchive(s.archiveId);
  if(s.autoArchiveId)unlockArchive(s.autoArchiveId);
  if(!logRows.length || logRows.at(-1)?.idx!==activeSceneIndex)logRows.push({idx:activeSceneIndex,speaker:s.speaker||'',text:s.text||''});
  renderLog();
}
function nextScene(){
  const ep=currentEpisode(),scenes=ep?.scenes||[];if(!scenes.length)return;
  if(activeSceneIndex<scenes.length-1){activeSceneIndex++;renderScene()}else stopAuto();
}
function prevScene(){if(activeSceneIndex>0){activeSceneIndex--;renderScene()}}
function renderLog(){
  const p=$('#vnLogPanel');if(!p)return;
  p.innerHTML=logRows.map(r=>`<div class="vn-log-row">${r.speaker?`<b>${esc(r.speaker)}</b>`:''}${esc(r.text)}</div>`).join('')||'<div class="vn-log-row">아직 기록된 대사가 없습니다.</div>';
}
function stopAuto(){if(autoTimer){clearInterval(autoTimer);autoTimer=null}$('#vnAuto')?.classList.remove('is-active')}
$('#vnNext')?.addEventListener('click',nextScene);$('#vnBack')?.addEventListener('click',prevScene);
$('#vnStageBg')?.addEventListener('click',e=>{if(e.target.closest('button'))return;if(!$('#vnLogPanel').hidden)return;nextScene()});
$('#vnLog')?.addEventListener('click',()=>{$('#vnLogPanel').hidden=!$('#vnLogPanel').hidden});
$('#vnMenu')?.addEventListener('click',()=>{$('.vn-chapter-drawer')?.scrollIntoView({behavior:'smooth',block:'nearest'})});
$('#vnAuto')?.addEventListener('click',()=>{if(autoTimer){stopAuto();return}$('#vnAuto').classList.add('is-active');autoTimer=setInterval(nextScene,4200)});
$('#vnSound')?.addEventListener('click',toggleVnSound);updateVnSoundButton();

/* ---------- CHARACTER · 10 PAIRS / 20 PROFILES ---------- */
const pairKeys=Array.from({length:10},(_,i)=>`pair${String(i+1).padStart(2,'0')}`);
const pairRows=['외형','성격','능력','천명 또는 목표','중요한 인연','기타'];
function pairMap(){return window.CHEONSANGHEUN_PAIR_DATA||{}}
function mergePair(target,source){
 if(!target||!source)return target;
 Object.assign(target,source);
 if(source.left)target.left={...(target.left||{}),...source.left};
 if(source.right)target.right={...(target.right||{}),...source.right};
 return target;
}
function refreshPairCards(){
 const pairs=pairMap();
 pairKeys.forEach((key,i)=>{
   const p=pairs[key];const btn=document.querySelector(`[data-pair="${key}"]`);if(!p||!btn)return;
   const b=btn.querySelector('.pair-option-info b'),small=btn.querySelector('.pair-option-info small');
   if(b)b.textContent=p.title||`페어 ${String(i+1).padStart(2,'0')}`;
   if(small)small.textContent=p.subtitle||'페어 기록';
   if(p.previewImage)btn.style.setProperty('--pairPreview',`url("${String(p.previewImage).replace(/"/g,'%22')}")`);else btn.style.removeProperty('--pairPreview');
 });
}
async function loadCharacterPairs(){
 refreshPairCards();
 if(DEMO||!configured||!admin||!db)return;
 try{
   const snap=await getDocs(collection(db,'characterPairs'));
   const pairs=pairMap();
   snap.docs.forEach(s=>{if(pairs[s.id])mergePair(pairs[s.id],s.data())});
   refreshPairCards();
 }catch(e){console.warn('character pairs load failed',e)}
}
function renderCharacter(){refreshPairCards()}
function rowValue(side,label){const found=(side?.rows||[]).find(r=>(Array.isArray(r)?r?.[0]:r?.label)===label);return Array.isArray(found)?(found?.[1]||''):(found?.value||'')}
function setPairInput(id,v=''){const el=$('#'+id);if(el)el.value=v??''}
function pairPreview(elId,src,label){const el=$('#'+elId);if(!el)return;el.style.backgroundImage=src?`url("${String(src).replace(/"/g,'%22')}")`:'';el.textContent=src?'':label}
function fillPairEditor(key){
 const p=pairMap()[key];if(!p)return;
 $('#pairEditorKey').value=key;$('#pairEditorHeading').textContent=`${p.title||key.toUpperCase()} · 프로필 편집`;
 setPairInput('pairTitleInput',p.title);setPairInput('pairSubtitleInput',p.subtitle);setPairInput('pairPreviewInput',p.previewImage||'');
 pairPreview('pairCardPreview',p.previewImage,'PAIR CARD PREVIEW');
 for(const [prefix,side,img] of [['pairLeft',p.left,p.leftImage],['pairRight',p.right,p.rightImage]]){
   setPairInput(prefix+'Image',img||'');setPairInput(prefix+'Name',side?.name);setPairInput(prefix+'Catch',side?.catchphrase);setPairInput(prefix+'Quote',side?.quote);setPairInput(prefix+'Gender',side?.gender);setPairInput(prefix+'Height',side?.height);setPairInput(prefix+'Age',side?.age);setPairInput(prefix+'Race',side?.race);setPairInput(prefix+'Realm',side?.realm);
   setPairInput(prefix+'Appearance',rowValue(side,'외형'));setPairInput(prefix+'Personality',rowValue(side,'성격'));setPairInput(prefix+'Ability',rowValue(side,'능력'));setPairInput(prefix+'Destiny',rowValue(side,'천명 또는 목표'));setPairInput(prefix+'Relation',rowValue(side,'중요한 인연'));setPairInput(prefix+'Other',rowValue(side,'기타'));
 }
 pairPreview('pairLeftPreview',p.leftImage,'LEFT FULLBODY');pairPreview('pairRightPreview',p.rightImage,'RIGHT FULLBODY');$('#pairEditorStatus').textContent='';
}
function openPairEditor(key='pair01'){if(!admin)return;fillPairEditor(pairMap()[key]?key:'pair01');openShade('pairEditorShade')}
function collectSide(prefix){return {name:$('#'+prefix+'Name').value.trim(),quote:$('#'+prefix+'Quote').value.trim(),catchphrase:$('#'+prefix+'Catch').value.trim(),gender:$('#'+prefix+'Gender').value.trim(),height:$('#'+prefix+'Height').value.trim(),age:$('#'+prefix+'Age').value.trim(),race:$('#'+prefix+'Race').value.trim(),realm:$('#'+prefix+'Realm').value.trim(),rows:[{label:'외형',value:$('#'+prefix+'Appearance').value},{label:'성격',value:$('#'+prefix+'Personality').value},{label:'능력',value:$('#'+prefix+'Ability').value},{label:'천명 또는 목표',value:$('#'+prefix+'Destiny').value},{label:'중요한 인연',value:$('#'+prefix+'Relation').value},{label:'기타',value:$('#'+prefix+'Other').value}]}}
async function savePairProfile(){
 if(!admin)return;const key=$('#pairEditorKey').value;const payload={title:$('#pairTitleInput').value.trim()||key.toUpperCase(),subtitle:$('#pairSubtitleInput').value.trim(),previewImage:$('#pairPreviewInput').value.trim(),leftImage:$('#pairLeftImage').value.trim(),rightImage:$('#pairRightImage').value.trim(),left:collectSide('pairLeft'),right:collectSide('pairRight'),editorName:$('#cmsEditorName')?.value.trim()||'',authorUid:currentUser.uid,updatedAt:serverTimestamp()};
 try{await setDoc(doc(db,'characterPairs',key),payload,{merge:true});mergePair(pairMap()[key],payload);refreshPairCards();$('#pairEditorStatus').textContent='저장됨';const dialog=$('#pairDialog');if(dialog?.open&&dialog.dataset.activePair===key&&window.CHEONSANGHEUN_OPEN_PAIR){dialog.close();setTimeout(()=>window.CHEONSANGHEUN_OPEN_PAIR(key),30)}}catch(e){console.error('pair save failed',e);$('#pairEditorStatus').textContent=`저장 실패 · ${e?.code||e?.message||'unknown error'}`}
}
$('#characterPairManager')?.addEventListener('click',()=>openPairEditor($('#pairDialog')?.dataset.activePair||'pair01'));
$('#pairProfileEditBtn')?.addEventListener('click',()=>openPairEditor($('#pairDialog')?.dataset.activePair||'pair01'));
$('#pairEditorClose')?.addEventListener('click',()=>closeShade('pairEditorShade'));
$('#pairEditorKey')?.addEventListener('change',e=>fillPairEditor(e.target.value));
$('#pairPreviewInput')?.addEventListener('input',e=>pairPreview('pairCardPreview',e.target.value.trim(),'PAIR CARD PREVIEW'));
$('#pairLeftImage')?.addEventListener('input',e=>pairPreview('pairLeftPreview',e.target.value.trim(),'LEFT FULLBODY'));
$('#pairRightImage')?.addEventListener('input',e=>pairPreview('pairRightPreview',e.target.value.trim(),'RIGHT FULLBODY'));
$('#pairSaveBtn')?.addEventListener('click',savePairProfile);

/* ---------- ARCHIVE ---------- */
function renderArchive(){
 const root=$('[data-cms-section="archive"]');if(!root)return;
 const list=$('#archiveCmsList'),status=root.querySelector('[data-cms-status]'),posts=visibleFor('archive');
 status.textContent=admin?`${posts.length}개 기록 · 스토리 장면에 기록 해금을 연결할 수 있습니다.`:'';
 if(!posts.length){list.innerHTML='<div class="cms-empty">아직 작성된 기록이 없습니다.</div>';$('#archiveCmsDetail').innerHTML=archiveEmpty();return}
 if(!currentArchiveId||!posts.some(p=>p.id===currentArchiveId&&isArchiveUnlocked(p)))currentArchiveId=posts.find(isArchiveUnlocked)?.id||null;
 list.innerHTML=posts.map(p=>{const unlocked=isArchiveUnlocked(p);return `<article class="archive-record-card ${unlocked?'':'locked'} ${p.id===currentArchiveId?'is-active':''}" data-archive-id="${p.id}">
   <div class="archive-record-thumb" ${unlocked&&p.imageUrl?`style="background-image:url('${p.imageUrl}')"`:''}>${unlocked?'錄':'鎖'}</div>
   <div><small>${esc(p.dateLabel||p.subtitle||'RECORD')}</small><b>${unlocked?esc(p.title||'(제목 없음)'):'未解放 · 잠긴 기록'}</b><p>${unlocked?esc(p.excerpt||''):'이야기를 진행하면 열립니다.'}</p></div>
 </article>`}).join('');
 list.querySelectorAll('[data-archive-id]').forEach(el=>el.onclick=()=>{
   const p=posts.find(x=>x.id===el.dataset.archiveId);if(!p)return;
   if(!isArchiveUnlocked(p) && !admin)return;
   currentArchiveId=p.id;renderArchive();
 });
 const active=posts.find(p=>p.id===currentArchiveId);
 $('#archiveCmsDetail').innerHTML=active&&isArchiveUnlocked(active)?archiveDetail(active):archiveEmpty();
 $('#archiveCmsDetail').querySelector('[data-archive-replay]')?.addEventListener('click',e=>openArchiveReplay(e.currentTarget.dataset.archiveReplay));
}
function archiveEmpty(){return `<div class="archive-detail-empty"><span>錄</span><h3>기록을 선택해 주세요.</h3><p>스토리를 진행하며 해금된 기록과 공개된 문서가 이곳에 펼쳐집니다.</p></div>`}
function archiveDetail(p){const replay=Array.isArray(p.replayScenes)&&p.replayScenes.length;return `<div class="archive-detail"><div class="archive-detail-head"><small>${esc(p.dateLabel||p.subtitle||'RECORD')}</small><h3>${esc(p.title||'')}</h3></div>${p.imageUrl?`<img class="archive-detail-image" src="${esc(p.imageUrl)}" alt="">`:''}<div class="archive-detail-body">${esc(p.body||p.excerpt||'')}</div>${replay?`<button class="archive-replay-btn" data-archive-replay="${p.id}">다시 보기 · 再見</button><div class="archive-replay-meta">${esc(p.replayEpisode||'STORY RECORD')} · ${p.replayScenes.length} SCENES</div>`:''}<div class="archive-related">${p.unlockMode==='story'?'STORY UNLOCK RECORD':'OPEN RECORD'}${p.editorName?' · '+esc(p.editorName):''}</div></div>`}


/* ---------- ARCHIVE REPLAY ---------- */
function openArchiveReplay(id){
 const p=cache.find(x=>x.id===id&&x.section==='archive');if(!p||!Array.isArray(p.replayScenes)||!p.replayScenes.length)return;
 archiveReplayScenes=structuredClone(p.replayScenes);archiveReplayIndex=0;$('#archiveReplayTitle').textContent=p.title||'기록 다시 보기';renderArchiveReplay();openShade('archiveReplayShade');
}
function renderArchiveReplay(){
 const s=archiveReplayScenes[archiveReplayIndex]||{},stage=$('#archiveReplayStage');
 $('#archiveReplayCount').textContent=`${String(archiveReplayIndex+1).padStart(2,'0')} / ${String(archiveReplayScenes.length).padStart(2,'0')}`;
 $('#archiveReplaySpeaker').textContent=s.speaker||'';$('#archiveReplayText').textContent=s.text||'';
 if(s.background)stage.style.backgroundImage=`linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.16)),url("${String(s.background).replace(/"/g,'%22')}")`;else stage.style.backgroundImage='';
 safeImg($('#archiveReplayLeft'),s.leftImage);safeImg($('#archiveReplayRight'),s.rightImage);safeImg($('#archiveReplayCg'),s.cgImage);
 if(s.bgmAction==='set')setTrack(replayAudio,'bgm',s.bgmUrl||'');else if(s.bgmAction==='stop')setTrack(replayAudio,'bgm','');
 if(s.ambAction==='set')setTrack(replayAudio,'amb',s.ambUrl||'');else if(s.ambAction==='stop')setTrack(replayAudio,'amb','');
 if(s.seUrl&&!replayAudio.muted){replayAudio.se.pause();replayAudio.se.src=s.seUrl;replayAudio.se.currentTime=0;playAudio(replayAudio.se,false)}
 if(s.effect==='fade')stage.animate([{opacity:.35},{opacity:1}],{duration:320,easing:'ease-out'});
}
function closeArchiveReplay(){closeShade('archiveReplayShade');archiveReplayScenes=[];archiveReplayIndex=0;replayAudio.bgm.pause();replayAudio.amb.pause();replayAudio.se.pause()}
$('#archiveReplayPrev')?.addEventListener('click',()=>{if(archiveReplayIndex>0){archiveReplayIndex--;renderArchiveReplay()}});
$('#archiveReplayNext')?.addEventListener('click',()=>{if(archiveReplayIndex<archiveReplayScenes.length-1){archiveReplayIndex++;renderArchiveReplay()}});
$('#archiveReplayStage')?.addEventListener('click',()=>{if(archiveReplayIndex<archiveReplayScenes.length-1){archiveReplayIndex++;renderArchiveReplay()}});
$('#archiveReplayClose')?.addEventListener('click',closeArchiveReplay);$('#archiveReplayExit')?.addEventListener('click',closeArchiveReplay);
$('#archiveReplaySound')?.addEventListener('click',()=>{replayAudio.muted=!replayAudio.muted;if(replayAudio.muted){replayAudio.bgm.pause();replayAudio.amb.pause();replayAudio.se.pause()}else{playAudio(replayAudio.bgm,false);playAudio(replayAudio.amb,false)}$('#archiveReplaySound').textContent=replayAudio.muted?'SOUND OFF':'SOUND ON'});

/* ---------- GENERAL INLINE EDITOR ---------- */
const editorRemembered=localStorage.getItem('cheonsangheun-editor-name')||'';
if($('#cmsEditorName'))$('#cmsEditorName').value=editorRemembered;
function showCmsForAdmin(){
 document.body.classList.add('cms-editing');
 $$('[data-cms-page-edit],[data-cms-new]').forEach(b=>b.style.display='');
 if($('#vnNewEpisode'))$('#vnNewEpisode').style.display='';
 if($('#vnEditEpisode'))$('#vnEditEpisode').style.display='';
 if($('#vnEditScene'))$('#vnEditScene').style.display='';
 if($('#archiveEditRecord'))$('#archiveEditRecord').style.display='';
}
function hideAdminControls(){document.body.classList.remove('cms-editing')}
function openPage(key){
 activeSection=key;const p=pageCache[key]||defaults[key];
 $('#cmsPageHeading').textContent=`${p.title||label(key)} 페이지 편집`;$('#cmsPageTitle').value=p.title||'';$('#cmsPageIntro').value=p.intro||'';$('#cmsPageStatus').value=p.status||'locked';$('#cmsLockedMessage').value=p.lockedMessage||'';$('#cmsPageKicker').value=p.kicker||'';$('#cmsPageStatusText').textContent='';
 openShade('cmsPageShade');
}
function resetDoc(sec){
 activeSection=sec||'archive';if(activeSection==='story'){newEpisode();return}
 $('#cmsDocId').value='';$('#cmsSection').value=activeSection;$('#cmsVisibility').value='private';$('#cmsSortOrder').value='';$('#cmsSubtitle').value='';$('#cmsDateLabel').value='';$('#cmsTitle').value='';$('#cmsExcerpt').value='';$('#cmsBody').value='';$('#cmsImageUrl').value='';$('#cmsUnlockMode').value='always';previewGenericImage('');$('#cmsDocHeading').textContent=`새 ${label(activeSection)} 문서`;$('#cmsDeleteDoc').style.display='none';$('#cmsDocStatus').textContent='';openShade('cmsDocShade')
}
function openDoc(id){
 const p=cache.find(x=>x.id===id);if(!p)return;if(p.section==='story'){openEpisodeEditor(p.id);return}
 activeSection=p.section||'archive';$('#cmsDocId').value=p.id;$('#cmsSection').value=activeSection;$('#cmsVisibility').value=p.status||'private';$('#cmsSortOrder').value=p.sortOrder??'';$('#cmsSubtitle').value=p.subtitle||'';$('#cmsDateLabel').value=p.dateLabel||'';$('#cmsTitle').value=p.title||'';$('#cmsExcerpt').value=p.excerpt||'';$('#cmsBody').value=p.body||'';$('#cmsImageUrl').value=p.imageUrl||'';$('#cmsUnlockMode').value=p.unlockMode||'always';previewGenericImage(p.imageUrl||'');$('#cmsEditorName').value=p.editorName||editorRemembered;$('#cmsDocHeading').textContent=p.title||'문서 편집';$('#cmsDeleteDoc').style.display='';$('#cmsDocStatus').textContent=fmt(p.updatedAt);openShade('cmsDocShade')
}
function previewGenericImage(src){const el=$('#cmsImagePreview');if(!el)return;el.style.backgroundImage=src?`url("${src}")`:'';el.innerHTML=src?'':'<span>IMAGE PREVIEW</span>'}
$('#cmsImageUrl')?.addEventListener('input',e=>previewGenericImage(e.target.value.trim()));
$('#cmsImageFile')?.addEventListener('change',e=>previewFile(e.target.files?.[0],url=>{localPreviewDataUrl=url;previewGenericImage(url)}));
function previewFile(file,done){if(!file)return;const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(file)}
function openShade(id){const el=$('#'+id);el?.classList.add('open');el?.setAttribute('aria-hidden','false')}
function closeShade(id){const el=$('#'+id);el?.classList.remove('open');el?.setAttribute('aria-hidden','true')}
$$('[data-cms-close="doc"]').forEach(b=>b.onclick=()=>closeShade('cmsDocShade'));
$$('[data-cms-close="page"]').forEach(b=>b.onclick=()=>closeShade('cmsPageShade'));
$$('[data-vn-close="episode"]').forEach(b=>b.onclick=()=>closeShade('vnEpisodeShade'));
$$('[data-vn-close="scene"]').forEach(b=>b.onclick=()=>closeShade('vnSceneShade'));
$$('.cms-editor-shade').forEach(sh=>sh.addEventListener('click',e=>{if(e.target===sh)closeShade(sh.id)}));
$$('[data-cms-new]').forEach(b=>b.onclick=()=>{const sec=b.closest('[data-cms-section]')?.dataset.cmsSection;if(sec==='character')return;resetDoc(sec)});
$$('[data-cms-page-edit]').forEach(b=>b.onclick=()=>openPage(b.closest('[data-cms-section]').dataset.cmsSection));

/* ---------- EPISODE / SCENE EDITOR ---------- */
function newEpisode(){editingEpisodeId=null;editingScenes=[];$('#vnEpisodeId').value='';$('#vnEpisodeVisibility').value='private';$('#vnEpisodeChapter').value='';$('#vnEpisodeOrder').value='';$('#vnEpisodeTitle').value='';$('#vnEpisodeExcerpt').value='';$('#vnEpisodeBgm').value='';$('#vnEpisodeHeading').textContent='새 에피소드';$('#vnDeleteEpisode').style.display='none';renderSceneEditorList();openShade('vnEpisodeShade')}
function openEpisodeEditor(id=activeEpisodeId){
 const ep=cache.find(x=>x.id===id&&x.section==='story');if(!ep)return;
 editingEpisodeId=ep.id;editingScenes=structuredClone(ep.scenes||[]);$('#vnEpisodeId').value=ep.id;$('#vnEpisodeVisibility').value=ep.status||'private';$('#vnEpisodeChapter').value=ep.subtitle||'';$('#vnEpisodeOrder').value=ep.sortOrder??'';$('#vnEpisodeTitle').value=ep.title||'';$('#vnEpisodeExcerpt').value=ep.excerpt||'';$('#vnEpisodeBgm').value=ep.bgmUrl||'';$('#vnEpisodeHeading').textContent=ep.title||'에피소드 편집';$('#vnDeleteEpisode').style.display='';renderSceneEditorList();openShade('vnEpisodeShade')
}
function renderSceneEditorList(){
 const list=$('#vnSceneEditorList');if(!list)return;
 list.innerHTML=editingScenes.length?editingScenes.map((s,i)=>`<div class="vn-scene-row" data-edit-scene="${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${s.kind==='narration'?'서술':s.kind==='cg'?'CG':'대사'}</b><p>${esc((s.speaker?s.speaker+' · ':'')+(s.text||''))}</p><div class="row-actions"><button data-up="${i}">↑</button><button data-down="${i}">↓</button><button data-scene-open="${i}">수정</button></div></div>`).join(''):'<div class="cms-empty">아직 장면이 없습니다. 장면 추가를 눌러 시작하세요.</div>';
 list.querySelectorAll('[data-scene-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();openSceneEditor(Number(b.dataset.sceneOpen))});
 list.querySelectorAll('[data-up]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=Number(b.dataset.up);if(i>0){[editingScenes[i-1],editingScenes[i]]=[editingScenes[i],editingScenes[i-1]];renderSceneEditorList()}});
 list.querySelectorAll('[data-down]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=Number(b.dataset.down);if(i<editingScenes.length-1){[editingScenes[i+1],editingScenes[i]]=[editingScenes[i],editingScenes[i+1]];renderSceneEditorList()}});
}
function refreshArchiveSelect(){
 const sel=$('#vnSceneArchive');if(!sel)return;
 const val=sel.value;sel.innerHTML='<option value="">없음</option>'+cache.filter(x=>x.section==='archive').map(x=>`<option value="${x.id}">${esc(x.dateLabel||'記錄')} · ${esc(x.title||'')}</option>`).join('');sel.value=val;
}
function openSceneEditor(i=-1){
 editingSceneIndex=i;
 const s=i>=0?editingScenes[i]:{kind:'dialogue',speaker:'',text:'',background:'',leftImage:'',rightImage:'',cgImage:'',effect:'fade',archiveId:'',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:'',soundNote:''};
 $('#vnSceneHeading').textContent=i>=0?`장면 ${i+1} 편집`:'새 장면';$('#vnSceneIndex').value=i;$('#vnSceneKind').value=s.kind||'dialogue';$('#vnSceneSpeaker').value=s.speaker||'';$('#vnSceneEffect').value=s.effect||'fade';$('#vnSceneText').value=s.text||'';$('#vnSceneBackground').value=s.background||'';$('#vnSceneLeft').value=s.leftImage||'';$('#vnSceneRight').value=s.rightImage||'';$('#vnSceneCg').value=s.cgImage||'';$('#vnSceneBgmAction').value=s.bgmAction||'keep';$('#vnSceneBgm').value=s.bgmUrl||'';$('#vnSceneSe').value=s.seUrl||'';$('#vnSceneAmbAction').value=s.ambAction||'keep';$('#vnSceneAmb').value=s.ambUrl||'';$('#vnSceneSoundNote').value=s.soundNote||'';refreshArchiveSelect();$('#vnSceneArchive').value=s.archiveId||'';previewSceneImage(s.cgImage||s.background||'');$('#vnDeleteScene').style.display=i>=0?'':'none';$('#vnSceneStatus').textContent='';openShade('vnSceneShade')
}
function previewSceneImage(src){const el=$('#vnScenePreview');if(!el)return;el.style.backgroundImage=src?`url("${src}")`:'';el.innerHTML=src?'':'<span>SCENE IMAGE PREVIEW</span>'}
['vnSceneBackground','vnSceneCg'].forEach(id=>$('#'+id)?.addEventListener('input',()=>previewSceneImage($('#vnSceneCg').value.trim()||$('#vnSceneBackground').value.trim())));
$('#vnSceneFile')?.addEventListener('change',e=>previewFile(e.target.files?.[0],url=>previewSceneImage(url)));
$('#vnAddScene')?.addEventListener('click',()=>openSceneEditor(-1));
$('#vnSaveScene')?.addEventListener('click',()=>{
 const s={kind:$('#vnSceneKind').value,speaker:$('#vnSceneSpeaker').value.trim(),text:$('#vnSceneText').value,background:$('#vnSceneBackground').value.trim(),leftImage:$('#vnSceneLeft').value.trim(),rightImage:$('#vnSceneRight').value.trim(),cgImage:$('#vnSceneCg').value.trim(),effect:$('#vnSceneEffect').value,archiveId:$('#vnSceneArchive').value,bgmAction:$('#vnSceneBgmAction').value,bgmUrl:$('#vnSceneBgm').value.trim(),ambAction:$('#vnSceneAmbAction').value,ambUrl:$('#vnSceneAmb').value.trim(),seUrl:$('#vnSceneSe').value.trim(),soundNote:$('#vnSceneSoundNote').value.trim()};
 if(editingSceneIndex>=0)editingScenes[editingSceneIndex]=s;else editingScenes.push(s);renderSceneEditorList();closeShade('vnSceneShade')
});
$('#vnDeleteScene')?.addEventListener('click',()=>{if(editingSceneIndex<0)return;if(confirm('이 장면을 삭제할까요?')){editingScenes.splice(editingSceneIndex,1);renderSceneEditorList();closeShade('vnSceneShade')}})
$('#vnNewEpisode')?.addEventListener('click',newEpisode);$('#vnEditEpisode')?.addEventListener('click',()=>openEpisodeEditor());$('#vnEditScene')?.addEventListener('click',()=>{const ep=currentEpisode();if(!ep)return;openEpisodeEditor(ep.id);setTimeout(()=>openSceneEditor(activeSceneIndex),50)});
$('#archiveEditRecord')?.addEventListener('click',()=>{if(currentArchiveId)openDoc(currentArchiveId)});

/* ---------- SAVE ---------- */
async function saveDoc(){
 if(!admin)return;const title=$('#cmsTitle').value.trim();if(!title){$('#cmsDocStatus').textContent='제목을 입력해 주세요.';return}
 const editorName=$('#cmsEditorName').value.trim();if(editorName)localStorage.setItem('cheonsangheun-editor-name',editorName);
 const payload={section:$('#cmsSection').value,status:$('#cmsVisibility').value,title,subtitle:$('#cmsSubtitle').value.trim(),dateLabel:$('#cmsDateLabel').value.trim(),excerpt:$('#cmsExcerpt').value.trim(),body:$('#cmsBody').value,sortOrder:$('#cmsSortOrder').value===''?null:Number($('#cmsSortOrder').value),imageUrl:$('#cmsImageUrl').value.trim(),unlockMode:$('#cmsUnlockMode').value,editorName,authorUid:currentUser.uid,updatedAt:serverTimestamp()};
 try{const id=$('#cmsDocId').value;if(id)await updateDoc(doc(db,'content',id),payload);else{payload.createdAt=serverTimestamp();const r=await addDoc(collection(db,'content'),payload);$('#cmsDocId').value=r.id}$('#cmsDocStatus').textContent='저장됨';await loadContent();closeShade('cmsDocShade')}catch(e){console.error(e);$('#cmsDocStatus').textContent='저장 실패'}
}
$('#cmsSaveDoc')?.addEventListener('click',saveDoc);
$('#cmsDeleteDoc')?.addEventListener('click',async()=>{const id=$('#cmsDocId').value;if(!id||!confirm('이 문서를 삭제할까요?'))return;try{await deleteDoc(doc(db,'content',id));await loadContent();closeShade('cmsDocShade')}catch(e){$('#cmsDocStatus').textContent='삭제 실패'}})
$('#cmsSavePage')?.addEventListener('click',async()=>{if(!admin)return;const payload={title:$('#cmsPageTitle').value.trim(),intro:$('#cmsPageIntro').value,status:$('#cmsPageStatus').value,lockedMessage:$('#cmsLockedMessage').value.trim(),kicker:$('#cmsPageKicker').value.trim(),updatedAt:serverTimestamp(),editorName:$('#cmsEditorName')?.value.trim()||''};try{await setDoc(doc(db,'pages',activeSection),payload,{merge:true});pageCache[activeSection]={...(pageCache[activeSection]||defaults[activeSection]),...payload};applyPage(activeSection);$('#cmsPageStatusText').textContent='저장됨';closeShade('cmsPageShade')}catch(e){$('#cmsPageStatusText').textContent='저장 실패'}})
function autoArchiveIdForEpisode(episodeId){return `story-${episodeId}`}
async function syncEpisodeArchive(episodeId,payload,scenesForSave){
 const archiveId=autoArchiveIdForEpisode(episodeId);
 const ref=doc(db,'content',archiveId);
 const snap=await getDoc(ref);
 const replayScenes=structuredClone(scenesForSave||[]);
 if(replayScenes.length&&payload.bgmUrl&&(replayScenes[0].bgmAction||'keep')==='keep'){
   replayScenes[0].bgmAction='set';replayScenes[0].bgmUrl=payload.bgmUrl;
 }
 const archivePayload={
   section:'archive',status:payload.status,title:payload.title,subtitle:'STORY',
   dateLabel:payload.subtitle||'STORY RECORD',excerpt:payload.excerpt||'',body:payload.excerpt||'',
   sortOrder:payload.sortOrder,imageUrl:(replayScenes.find(x=>x.cgImage)?.cgImage||replayScenes.find(x=>x.background)?.background||''),
   unlockMode:'story',replayEpisode:`${payload.subtitle||''}${payload.subtitle&&payload.title?' · ':''}${payload.title||''}`,
   replayEpisodeId:episodeId,replayScenes,sourceEpisodeId:episodeId,isAutoStoryArchive:true,
   editorName:payload.editorName||'',authorUid:currentUser.uid,updatedAt:serverTimestamp()
 };
 if(!snap.exists())archivePayload.createdAt=serverTimestamp();
 await setDoc(ref,archivePayload,{merge:true});
 return archiveId;
}

$('#vnSaveEpisode')?.addEventListener('click',async()=>{
 if(!admin)return;const title=$('#vnEpisodeTitle').value.trim();if(!title){$('#vnEpisodeStatus').textContent='제목을 입력해 주세요.';return}
 const payload={section:'story',status:$('#vnEpisodeVisibility').value,title,subtitle:$('#vnEpisodeChapter').value.trim(),excerpt:$('#vnEpisodeExcerpt').value.trim(),bgmUrl:$('#vnEpisodeBgm').value.trim(),sortOrder:$('#vnEpisodeOrder').value===''?null:Number($('#vnEpisodeOrder').value),scenes:structuredClone(editingScenes),editorName:$('#cmsEditorName')?.value.trim()||'',authorUid:currentUser.uid,updatedAt:serverTimestamp()};
 try{
   const wasNew=!editingEpisodeId;
   if(wasNew){payload.createdAt=serverTimestamp();const r=await addDoc(collection(db,'content'),payload);editingEpisodeId=r.id}
   const autoArchiveId=autoArchiveIdForEpisode(editingEpisodeId);
   const scenesForSave=structuredClone(editingScenes);
   if(scenesForSave.length)scenesForSave[scenesForSave.length-1].autoArchiveId=autoArchiveId;
   payload.scenes=scenesForSave;
   if(wasNew)await updateDoc(doc(db,'content',editingEpisodeId),{scenes:scenesForSave,updatedAt:serverTimestamp()});
   else await updateDoc(doc(db,'content',editingEpisodeId),payload);
   activeEpisodeId=editingEpisodeId;

   // STORY 전체를 ARCHIVE의 '다시 보기' 기록으로 자동 저장/업데이트합니다.
   await syncEpisodeArchive(editingEpisodeId,payload,scenesForSave);

   // 장면별로 별도 기록을 선택한 경우에는 기존 수동 연결도 그대로 유지합니다.
   const archiveIds=[...new Set(editingScenes.map(x=>x.archiveId).filter(Boolean))];
   const oldLinked=cache.filter(x=>x.section==='archive'&&!x.isAutoStoryArchive&&x.replayEpisodeId===editingEpisodeId&&!archiveIds.includes(x.id));
   for(const old of oldLinked){try{await updateDoc(doc(db,'content',old.id),{replayScenes:[],replayEpisode:'',replayEpisodeId:'',updatedAt:serverTimestamp()})}catch(err){console.warn('archive replay clear failed',old.id,err)}}
   for(const archiveId of archiveIds){
     const replayScenes=editingScenes.filter(x=>x.archiveId===archiveId).map(x=>structuredClone(x));
     if(replayScenes.length&&payload.bgmUrl&&(replayScenes[0].bgmAction||'keep')==='keep'){replayScenes[0].bgmAction='set';replayScenes[0].bgmUrl=payload.bgmUrl}
     try{await updateDoc(doc(db,'content',archiveId),{unlockMode:'story',replayEpisode:`${payload.subtitle||''}${payload.subtitle&&payload.title?' · ':''}${payload.title||''}`,replayEpisodeId:editingEpisodeId,replayScenes,updatedAt:serverTimestamp()})}catch(err){console.warn('archive replay sync failed',archiveId,err)}
   }
   $('#vnEpisodeStatus').textContent='저장됨 · ARCHIVE에도 기록됨';await loadContent();closeShade('vnEpisodeShade')
 }catch(e){console.error(e);$('#vnEpisodeStatus').textContent='저장 실패'}
});
$('#vnDeleteEpisode')?.addEventListener('click',async()=>{
 if(!editingEpisodeId||!confirm('이 에피소드를 삭제할까요?'))return;
 try{
   const episodeId=editingEpisodeId;
   await deleteDoc(doc(db,'content',episodeId));
   try{await deleteDoc(doc(db,'content',autoArchiveIdForEpisode(episodeId)))}catch(e){}
   const linked=cache.filter(x=>x.section==='archive'&&!x.isAutoStoryArchive&&x.replayEpisodeId===episodeId);
   for(const a of linked){try{await updateDoc(doc(db,'content',a.id),{replayScenes:[],replayEpisode:'',replayEpisodeId:'',updatedAt:serverTimestamp()})}catch(e){}}
   activeEpisodeId=null;editingEpisodeId=null;await loadContent();closeShade('vnEpisodeShade')
 }catch(e){$('#vnEpisodeStatus').textContent='삭제 실패'}
})

$('#cmsExitEdit')?.addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.delete('edit');location.href=u.pathname+u.hash});
$('#cmsLogout')?.addEventListener('click',async()=>{if(auth)await signOut(auth);location.href='./index.html'});

/* ---------- START ---------- */
async function start(){
 if(DEMO||!configured){
   admin=DEMO && new URLSearchParams(location.search).get('editor')==='1';
   if(admin)showCmsForAdmin();else hideAdminControls();
   await loadPages();await loadCharacterPairs();await loadContent();
   if(DEMO){$$('.rail button[data-locked="true"]').forEach(b=>{b.dataset.locked='false';b.querySelector('.rail-lock')?.remove()})}
   return;
 }
 const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 await setPersistence(auth,browserLocalPersistence);
 onAuthStateChanged(auth,async user=>{
   currentUser=user;admin=!!(user&&user.uid===ADMIN_UID);
   if(editRequested&&!admin){location.href='./admin.html';return}
   if(admin&&editRequested)showCmsForAdmin();else hideAdminControls();
   await loadPages();await loadCharacterPairs();await loadContent();
 });
}
start();

(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const svg=(body,w=1600,h=900)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
  const bgGarden=svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4f5754"/><stop offset=".55" stop-color="#27302e"/><stop offset="1" stop-color="#11100f"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="320" cy="260" r="210" fill="#93a89b" opacity=".18" filter="url(#b)"/><path d="M0 610 C350 520 620 690 940 575 C1220 475 1410 535 1600 500 L1600 900 L0 900Z" fill="#111513" opacity=".7"/><g fill="#d6d2c8" opacity=".22"><circle cx="1040" cy="190" r="5"/><circle cx="1090" cy="250" r="4"/><circle cx="980" cy="330" r="3"/></g>`);
  const bgCorridor=svg(`<defs><linearGradient id="g" y2="1"><stop stop-color="#423a34"/><stop offset="1" stop-color="#0e0c0b"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><path d="M410 0 L680 900 H0 V0Z" fill="#171411" opacity=".55"/><path d="M1190 0 L920 900 H1600 V0Z" fill="#171411" opacity=".55"/><rect x="690" y="80" width="220" height="680" fill="#b08c62" opacity=".12"/>`);
  const stand=(side)=>svg(`<defs><linearGradient id="p" x2="0" y2="1"><stop stop-color="${side==='left'?'#d8d0c8':'#c9d2d8'}"/><stop offset="1" stop-color="${side==='left'?'#56504a':'#4a535a'}"/></linearGradient></defs><ellipse cx="400" cy="210" rx="120" ry="145" fill="#ded5cc"/><path d="M285 205 Q400 20 520 205 L500 350 Q400 390 300 345Z" fill="${side==='left'?'#27313c':'#3d3134'}"/><path d="M170 880 Q210 430 400 365 Q600 430 640 880Z" fill="url(#p)"/><path d="M270 880 Q340 560 400 445 Q470 560 535 880Z" fill="#1e1b1a" opacity=".36"/>`,800,900);
  const leftStand=stand('left'), rightStand=stand('right');

  const episodes=[
    {id:'ep1',chapter:'第一章',title:'비가 그친 자리',excerpt:'스탠딩 없이 배경만으로도 시작할 수 있는 예시.',bgmUrl:'',scenes:[
      {kind:'narration',speaker:'',text:'비가 그친 뒤에도 처마 끝에서는 한참 동안 물방울이 떨어졌다.',background:bgGarden,leftImage:'',rightImage:'',cgImage:'',effect:'fade',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:''},
      {kind:'dialogue',speaker:'연화',text:'“아직 돌아가지 않았습니까?”',background:bgGarden,leftImage:'',rightImage:rightStand,cgImage:'',effect:'fade',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:''},
      {kind:'dialogue',speaker:'백연',text:'“이곳까지 따라올 줄은 몰랐군.”',background:bgGarden,leftImage:leftStand,rightImage:rightStand,cgImage:'',effect:'fade',unlock:'arc1',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:''},
      {kind:'narration',speaker:'',text:'인물이 사라지고 배경만 남았다. 장면마다 스탠딩은 자유롭게 비워둘 수 있다.',background:bgCorridor,leftImage:'',rightImage:'',cgImage:'',effect:'fade',bgmAction:'keep',bgmUrl:'',ambAction:'stop',ambUrl:'',seUrl:''}
    ]},
    {id:'ep2',chapter:'第二章',title:'끊어진 길',excerpt:'장면마다 이미지와 사운드를 다르게 지정할 수 있습니다.',bgmUrl:'',scenes:[
      {kind:'narration',speaker:'',text:'다음 장면을 이곳에 이어서 작성할 수 있습니다.',background:bgCorridor,leftImage:'',rightImage:'',cgImage:'',effect:'fade',bgmAction:'keep',bgmUrl:'',ambAction:'keep',ambUrl:'',seUrl:''}
    ]}
  ];
  const records=[
    {id:'arc1',date:'記錄 001',title:'선계 정원에서의 조우',excerpt:'第一章의 장면들을 당시 모습 그대로 다시 보는 기록.',body:'비가 그친 선계의 정원에서 두 존재가 처음 마주쳤다.\n\nARCHIVE의 다시 보기는 배경·스탠딩·대사·사운드 값을 장면 스냅샷으로 보존한다.',unlock:'story',replayEpisode:'第一章 · 비가 그친 자리',replayScenes:[]},
    {id:'arc2',date:'記錄 002',title:'삼계에 관한 공개 기록',excerpt:'처음부터 열려 있는 일반 기록의 예시.',body:'ARCHIVE에는 스토리 다시보기뿐 아니라 운영진이 직접 작성한 세계관 문서나 공지도 함께 넣을 수 있다.',unlock:'always'}
  ];
  records[0].replayScenes=episodes[0].scenes.slice(1,3).map(x=>({...x}));

  let epIndex=0, sceneIndex=0, log=[], unlocked=new Set(), archiveId='arc2', auto=null, replayScenes=[], replayIndex=0;

  const sound={muted:true,bgm:new Audio(),amb:new Audio(),se:new Audio(),bgmUrl:'',ambUrl:'',episodeId:''};
  sound.bgm.loop=true;sound.amb.loop=true;sound.bgm.volume=.55;sound.amb.volume=.42;sound.se.volume=.75;
  const play=async a=>{if(sound.muted||!a.src)return;try{await a.play()}catch(e){}};
  function setTrack(kind,url){const a=sound[kind];if(!a)return;if(!url){a.pause();a.removeAttribute('src');a.load();sound[kind+'Url']='';return}if(sound[kind+'Url']!==url){a.pause();a.src=url;a.load();sound[kind+'Url']=url}play(a)}
  function applySound(ep,s){if(sound.episodeId!==ep.id){sound.episodeId=ep.id;setTrack('bgm',ep.bgmUrl||'');setTrack('amb','')}
    if(s.bgmAction==='set')setTrack('bgm',s.bgmUrl||'');else if(s.bgmAction==='stop')setTrack('bgm','');
    if(s.ambAction==='set')setTrack('amb',s.ambUrl||'');else if(s.ambAction==='stop')setTrack('amb','');
    if(s.seUrl&&!sound.muted){sound.se.pause();sound.se.src=s.seUrl;sound.se.currentTime=0;play(sound.se)}
  }
  function updateSoundButton(){const b=$('#vnSound');if(!b)return;b.textContent=sound.muted?'SOUND OFF':'SOUND ON';b.classList.toggle('is-active',!sound.muted)}
  function toggleSound(){sound.muted=!sound.muted;if(sound.muted){sound.bgm.pause();sound.amb.pause();sound.se.pause()}else{play(sound.bgm);play(sound.amb)}updateSoundButton()}

  // Public demo: show all three sections directly in the main index.
  $$('.rail button[data-locked="true"]').forEach(b=>{b.dataset.locked='false';b.querySelector('.rail-lock')?.remove()});
  ['story','character','archive'].forEach(k=>{const sec=$(`[data-panel="${k}"]`);sec?.querySelector('.private-panel')?.style.setProperty('display','none');sec?.querySelector('.cms-panel')?.style.setProperty('display','flex')});
  const story=$('[data-cms-section="story"]');story?.querySelector('[data-cms-title]')?.replaceChildren(document.createTextNode('이야기'));story?.querySelector('[data-cms-intro]')?.replaceChildren(document.createTextNode('배경만, 한쪽 스탠딩, 양쪽 스탠딩, CG 등 장면마다 자유롭게 구성할 수 있습니다.'));story?.querySelector('[data-cms-kicker]')?.replaceChildren(document.createTextNode('VISUAL NOVEL · STORY'));
  const archive=$('[data-cms-section="archive"]');archive?.querySelector('[data-cms-title]')?.replaceChildren(document.createTextNode('기록'));archive?.querySelector('[data-cms-intro]')?.replaceChildren(document.createTextNode('스토리에서 지나간 장면을 같은 비주얼 노벨 형식으로 다시 봅니다.'));archive?.querySelector('[data-cms-kicker]')?.replaceChildren(document.createTextNode('ARCHIVE · 記錄庫'));
  const character=$('[data-cms-section="character"]');character?.querySelector('[data-cms-title]')?.replaceChildren(document.createTextNode('인물'));character?.querySelector('[data-cms-intro]')?.replaceChildren(document.createTextNode('캐릭터 페이지는 기존 카드형 구조를 유지하고 STORY·ARCHIVE와 연결할 수 있습니다.'));character?.querySelector('[data-cms-list]')?.replaceChildren(Object.assign(document.createElement('div'),{className:'cms-empty',textContent:'캐릭터 카드 / 상세 프로필 연결 영역'}));

  function img(id,src){const el=$(id);if(!el)return;if(src){el.src=src;el.hidden=false}else{el.hidden=true;el.removeAttribute('src')}}
  function renderEpisodes(){
    $('#vnEpisodeList').innerHTML=episodes.map((e,i)=>`<article class="vn-episode-card ${i===epIndex?'is-active':''}" data-i="${i}"><small>${e.chapter}</small><b>${e.title}</b><p>${e.excerpt}</p></article>`).join('');
    $$('#vnEpisodeList [data-i]').forEach(el=>el.onclick=()=>{epIndex=Number(el.dataset.i);sceneIndex=0;log=[];sound.episodeId='';renderEpisodes();renderScene()});
  }
  function renderScene(){
    const ep=episodes[epIndex], s=ep.scenes[sceneIndex], stage=$('#vnStageBg'), empty=$('#vnEmptyArt');
    $('#vnChapterLabel').textContent=ep.chapter;$('#vnSceneCount').textContent=`${String(sceneIndex+1).padStart(2,'0')} / ${String(ep.scenes.length).padStart(2,'0')}`;$('#vnProgress').textContent=`${ep.title} · ${sceneIndex+1}/${ep.scenes.length}`;$('#vnSpeaker').textContent=s.speaker||'';$('#vnText').textContent=s.text;
    stage.style.backgroundImage=s.background?`linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.20)),url("${s.background}")`:'';empty.style.display=(s.background||s.cgImage)?'none':'flex';img('#vnLeftChar',s.leftImage);img('#vnRightChar',s.rightImage);img('#vnCg',s.cgImage);applySound(ep,s);
    if(s.unlock){unlocked.add(s.unlock);renderArchive()}if(!log.some(x=>x.idx===sceneIndex))log.push({idx:sceneIndex,speaker:s.speaker,text:s.text});$('#vnLogPanel').innerHTML=log.map(x=>`<div class="vn-log-row">${x.speaker?`<b>${esc(x.speaker)}</b>`:''}${esc(x.text)}</div>`).join('');
  }
  function next(){const ep=episodes[epIndex];if(sceneIndex<ep.scenes.length-1){sceneIndex++;renderScene()}else if(auto){clearInterval(auto);auto=null;$('#vnAuto').classList.remove('is-active')}}
  function back(){if(sceneIndex>0){sceneIndex--;renderScene()}}
  $('#vnNext').onclick=next;$('#vnBack').onclick=back;$('#vnStageBg').onclick=e=>{if(!e.target.closest('button') && $('#vnLogPanel').hidden)next()};$('#vnLog').onclick=()=>$('#vnLogPanel').hidden=!$('#vnLogPanel').hidden;$('#vnAuto').onclick=()=>{if(auto){clearInterval(auto);auto=null;$('#vnAuto').classList.remove('is-active')}else{auto=setInterval(next,3500);$('#vnAuto').classList.add('is-active')}};$('#vnSound')?.addEventListener('click',toggleSound);updateSoundButton();

  function isUnlocked(r){return r.unlock!=='story'||unlocked.has(r.id)}
  function renderArchive(){
    const list=$('#archiveCmsList');list.innerHTML=records.map(r=>{const ok=isUnlocked(r);return `<article class="archive-record-card ${ok?'':'locked'} ${archiveId===r.id?'is-active':''}" data-r="${r.id}"><div class="archive-record-thumb">${ok?'錄':'鎖'}</div><div><small>${r.date}</small><b>${ok?r.title:'未解放 · 잠긴 기록'}</b><p>${ok?r.excerpt:'이야기를 진행하면 열립니다.'}</p></div></article>`}).join('');
    $$('#archiveCmsList [data-r]').forEach(el=>el.onclick=()=>{const r=records.find(x=>x.id===el.dataset.r);if(!isUnlocked(r))return;archiveId=r.id;renderArchive()});const r=records.find(x=>x.id===archiveId);
    $('#archiveCmsDetail').innerHTML=r&&isUnlocked(r)?`<div class="archive-detail"><div class="archive-detail-head"><small>${r.date}</small><h3>${r.title}</h3></div><div class="archive-detail-body">${esc(r.body)}</div>${r.replayScenes?.length?`<button class="archive-replay-btn" data-demo-replay>다시 보기 · 再見</button><div class="archive-replay-meta">${r.replayEpisode} · ${r.replayScenes.length} SCENES</div>`:''}<div class="archive-related">${r.unlock==='story'?'STORY UNLOCK RECORD':'OPEN RECORD'}</div></div>`:`<div class="archive-detail-empty"><span>錄</span><h3>기록을 선택해 주세요.</h3><p>스토리를 진행하며 해금된 기록과 공개 문서가 이곳에 펼쳐집니다.</p></div>`;$('[data-demo-replay]')?.addEventListener('click',()=>openReplay(r));
  }
  const replaySound={muted:false,bgm:new Audio(),amb:new Audio(),se:new Audio(),bgmUrl:'',ambUrl:''};replaySound.bgm.loop=true;replaySound.amb.loop=true;
  const rplay=async a=>{if(replaySound.muted||!a.src)return;try{await a.play()}catch(e){}};
  function rset(k,url){const a=replaySound[k];if(!url){a.pause();a.removeAttribute('src');a.load();replaySound[k+'Url']='';return}if(replaySound[k+'Url']!==url){a.pause();a.src=url;a.load();replaySound[k+'Url']=url}rplay(a)}
  function showReplayScene(){const s=replayScenes[replayIndex]||{},st=$('#archiveReplayStage');$('#archiveReplayCount').textContent=`${String(replayIndex+1).padStart(2,'0')} / ${String(replayScenes.length).padStart(2,'0')}`;$('#archiveReplaySpeaker').textContent=s.speaker||'';$('#archiveReplayText').textContent=s.text||'';st.style.backgroundImage=s.background?`linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.18)),url("${s.background}")`:'';img('#archiveReplayLeft',s.leftImage);img('#archiveReplayRight',s.rightImage);img('#archiveReplayCg',s.cgImage);if(s.bgmAction==='set')rset('bgm',s.bgmUrl||'');else if(s.bgmAction==='stop')rset('bgm','');if(s.ambAction==='set')rset('amb',s.ambUrl||'');else if(s.ambAction==='stop')rset('amb','');if(s.seUrl&&!replaySound.muted){replaySound.se.src=s.seUrl;replaySound.se.currentTime=0;rplay(replaySound.se)}}
  function openReplay(r){replayScenes=r.replayScenes||[];replayIndex=0;$('#archiveReplayTitle').textContent=r.title;showReplayScene();$('#archiveReplayShade').classList.add('open')}
  function closeReplay(){$('#archiveReplayShade').classList.remove('open');replaySound.bgm.pause();replaySound.amb.pause();replaySound.se.pause()}
  $('#archiveReplayPrev').onclick=()=>{if(replayIndex>0){replayIndex--;showReplayScene()}};$('#archiveReplayNext').onclick=()=>{if(replayIndex<replayScenes.length-1){replayIndex++;showReplayScene()}};$('#archiveReplayStage').onclick=()=>{if(replayIndex<replayScenes.length-1){replayIndex++;showReplayScene()}};$('#archiveReplayClose').onclick=closeReplay;$('#archiveReplayExit').onclick=closeReplay;$('#archiveReplaySound')?.addEventListener('click',()=>{replaySound.muted=!replaySound.muted;if(replaySound.muted){replaySound.bgm.pause();replaySound.amb.pause();replaySound.se.pause()}else{rplay(replaySound.bgm);rplay(replaySound.amb)}$('#archiveReplaySound').textContent=replaySound.muted?'SOUND OFF':'SOUND ON'});

  renderEpisodes();renderScene();renderArchive();setTimeout(()=>document.querySelector('[data-target="story"]')?.click(),200);
})();

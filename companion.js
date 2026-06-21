(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var buddy = document.createElement('div');
  buddy.id = 'buddy';
  buddy.innerHTML = '<div class="spritewrap"><div class="sprite" role="img" aria-label="Maskot Naše"></div></div>';
  var bubble = document.createElement('div');
  bubble.className = 'buddy-bubble';
  document.body.appendChild(buddy);
  document.body.appendChild(bubble);

  var page = document.getElementById('cards') ? (document.body.classList.contains('theme-auto') ? 'auto' : 'byd') : 'home';

  var L = {
    greet: {
      byd: ['Ahoj! Mrkneme na bydlení 🙂', 'Tak co dnes hledáme? 🏠'],
      auto: ['Ahoj! Jdem na autíčka 🚗', 'Vyber si fáro 🔧'],
      home: ['Vyber sekci a jdeme na to 🙂', 'Ahoj! Co dnes řešíme?']
    },
    idle: {
      byd: ['Nejlevnější metr má ten nahoře 👆','Klikni na kartu, otevřu inzerát.','Dáš odkaz a já doplním cenu i dojezd.','Hypotéku počítám sám 🏦','Poznámku přidáš přes 📝 na kartě.'],
      auto: ['Vítěz je nahoře ⭐','Filtruj podle značky.','Dáš odkaz ze sauto.cz a doplním to.','Ceny ti přepočítám na koruny.'],
      home: ['Bydlení vlevo, auta vpravo.','Co dnes vybíráme? 🙂']
    },
    add: ['Pěkný kousek! 👍','Přidáno, koukáme dál 🔍','Hezky přibývá!'],
    del: ['Škoda… 😌','O jeden míň.','Tak nic, jdeme dál.'],
    note: ['Poznámka uložená 📝','Zapsáno!'],
    addopen: ['Hoď sem odkaz, zbytek dotáhnu.','Sreality i sauto, oboje umím 🔍'],
    poke: {
      byd: ['Jsem tu, kdyby něco 🙂','Která se ti líbí?','Mrkni na cenu za metr.'],
      auto: ['Hledáš fáro? Jsem tu 🚗','Mrkni na nájezd.','Která tě bere?'],
      home: ['Kam to bude? 🙂','Vyber sekci.']
    }
  };
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  var hideT, awake = true, idleT, sleepT, actT;
  function say(text, ms){
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(function(){ bubble.classList.remove('show'); }, ms || 3800);
  }
  function flash(cls, dur){
    buddy.classList.remove('jump','wiggle','hop','look');
    void buddy.offsetWidth;
    buddy.classList.add(cls);
    setTimeout(function(){ buddy.classList.remove(cls); }, dur || 800);
  }
  function wake(){
    if(!awake){ awake = true; buddy.classList.remove('sleep'); }
    clearTimeout(sleepT);
    sleepT = setTimeout(sleep, 70000);
  }
  function sleep(){ awake = false; buddy.classList.add('sleep'); lean(0,0); say('Zzz…', 2500); }

  function idleLoop(){
    clearTimeout(idleT);
    idleT = setTimeout(function(){
      if(awake && !document.hidden) say(pick(L.idle[page]));
      idleLoop();
    }, 24000);
  }
  // small spontaneous moves so it feels alive
  function actLoop(){
    clearTimeout(actT);
    actT = setTimeout(function(){
      if(awake && !document.hidden && !reduce) flash(Math.random()<0.5?'hop':'look', 950);
      actLoop();
    }, 6000 + Math.random()*5000);
  }

  // cursor follow — leans toward the pointer like it's watching
  var lastLean = 0;
  function lean(tx, rot){ buddy.style.transform = 'translateX('+tx+'px) rotate('+rot+'deg)'; }
  function onMove(e){
    if(reduce || !awake) return;
    var now = Date.now(); if(now - lastLean < 40) return; lastLean = now;
    var r = buddy.getBoundingClientRect();
    var cx = r.left + r.width/2;
    var dx = e.clientX - cx;
    var tx = Math.max(-10, Math.min(10, dx*0.02));
    var rot = Math.max(-12, Math.min(12, dx*0.025));
    lean(tx, rot);
  }
  window.addEventListener('mousemove', onMove, {passive:true});

  // greeting + loops
  setTimeout(function(){ say(pick(L.greet[page]), 4200); }, 700);
  idleLoop(); actLoop();
  sleepT = setTimeout(sleep, 70000);

  buddy.addEventListener('click', function(){ wake(); flash('jump'); say(pick(L.poke[page])); });

  ['mousemove','keydown','scroll','touchstart','click'].forEach(function(ev){
    window.addEventListener(ev, wake, {passive:true});
  });

  window.addEventListener('nase:react', function(e){
    wake();
    var t = e.detail;
    if(t==='add'){ flash('jump'); say(pick(L.add)); }
    else if(t==='del'){ flash('wiggle'); say(pick(L.del)); }
    else if(t==='note'){ flash('hop',950); say(pick(L.note)); }
  });

  document.addEventListener('click', function(e){
    if(e.target.closest && e.target.closest('#btn-add')){ wake(); say(pick(L.addopen)); }
  });
})();

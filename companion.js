(function(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { /* still show, just no idle wandering */ }
  var buddy = document.createElement('div');
  buddy.id = 'buddy';
  buddy.innerHTML = '<img src="img/mascot.png" alt="Maskot Naše">';
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

  var hideT, awake = true, idleT, sleepT;
  function say(text, ms){
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(function(){ bubble.classList.remove('show'); }, ms || 3800);
  }
  function react(cls){
    buddy.classList.remove('jump','wiggle');
    void buddy.offsetWidth;
    buddy.classList.add(cls);
    setTimeout(function(){ buddy.classList.remove(cls); }, 800);
  }
  function wake(){
    if(!awake){ awake = true; buddy.classList.remove('sleep'); }
    clearTimeout(sleepT);
    sleepT = setTimeout(sleep, 70000);
  }
  function sleep(){ awake = false; buddy.classList.add('sleep'); say('Zzz…', 2500); }

  function idleLoop(){
    clearTimeout(idleT);
    idleT = setTimeout(function(){
      if(awake && !document.hidden) say(pick(L.idle[page]));
      idleLoop();
    }, 24000);
  }

  // greeting
  setTimeout(function(){ say(pick(L.greet[page]), 4200); }, 700);
  idleLoop();
  sleepT = setTimeout(sleep, 70000);

  // mascot click
  buddy.addEventListener('click', function(){
    wake(); react('jump'); say(pick(L.poke[page]));
  });

  // wake on activity
  ['mousemove','keydown','scroll','touchstart','click'].forEach(function(ev){
    window.addEventListener(ev, wake, {passive:true});
  });

  // app reactions
  window.addEventListener('nase:react', function(e){
    wake();
    var t = e.detail;
    if(t==='add'){ react('jump'); say(pick(L.add)); }
    else if(t==='del'){ react('wiggle'); say(pick(L.del)); }
    else if(t==='note'){ say(pick(L.note)); }
  });

  // open add modal hint
  document.addEventListener('click', function(e){
    if(e.target.closest && e.target.closest('#btn-add')){ wake(); say(pick(L.addopen)); }
  });
})();

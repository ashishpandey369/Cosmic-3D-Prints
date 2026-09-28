(() => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ghGiftEnter{0%{transform:translateY(150px) scale(.62) rotate(-5deg);opacity:0}55%{transform:translateY(-10px) scale(1.05) rotate(1deg);opacity:1}100%{transform:translateY(0) scale(1) rotate(0);opacity:1}}
    @keyframes ghGiftLid{0%,42%{transform:translateY(0) rotate(0)}70%,100%{transform:translateY(-52px) rotate(-15deg)}}
    @keyframes ghGiftGlow{0%,100%{opacity:.18;transform:translate(-50%,-50%) scale(.78)}50%{opacity:.9;transform:translate(-50%,-50%) scale(1.3)}}
    @keyframes ghGiftSpark{0%{transform:translate(0,28px) scale(.15);opacity:0}28%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1.1);opacity:0}}
    @keyframes ghGiftPetal{0%{transform:translateY(35px) scale(.2) rotate(0);opacity:0}25%{opacity:.8}100%{transform:translateY(-125px) translateX(var(--x)) scale(1) rotate(180deg);opacity:0}}
    @keyframes ghGiftClose{to{opacity:0;visibility:hidden}}
    .gh-gift-ready{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(255,225,235,.98) 0%,rgba(255,244,247,.97) 38%,rgba(255,250,252,.98) 72%,rgba(255,255,255,.98) 100%);backdrop-filter:blur(9px);opacity:1;animation:ghGiftClose .45s ease 2.45s forwards;pointer-events:none}
    .gh-gift-ready:before,.gh-gift-ready:after{content:'';position:absolute;left:-15%;width:130%;height:72%;bottom:-35%;border-radius:50% 50% 0 0;background:radial-gradient(ellipse at center,rgba(235,126,160,.22),rgba(246,180,199,.1) 48%,transparent 72%);filter:blur(18px);animation:ghBgWave 1.65s ease-out both;pointer-events:none}.gh-gift-ready:after{animation-delay:.16s;opacity:.65;transform:scale(1.15)}
    @keyframes ghBgWave{0%{transform:translateY(100%) scale(1);opacity:0}20%{opacity:1}70%{opacity:.8}100%{transform:translateY(-20%) scale(1.08);opacity:0}}
    .gh-gift-ready-box{position:relative;width:150px;height:125px;z-index:5;animation:ghGiftEnter .7s cubic-bezier(.2,.8,.2,1) both}
    .gh-gift-glow{position:absolute;left:50%;top:55%;width:250px;height:180px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(231,112,151,.22);filter:blur(32px);animation:ghGiftGlow 1.15s ease-in-out infinite;z-index:-1}
    .gh-gift-body{position:absolute;left:18px;right:18px;bottom:8px;height:82px;border-radius:8px 8px 12px 12px;background:linear-gradient(135deg,#c06b8b,#a74b6d);box-shadow:0 20px 42px rgba(142,55,84,.22);overflow:hidden}.gh-gift-body:before{content:'';position:absolute;left:50%;top:0;bottom:0;width:18px;transform:translateX(-50%);background:#f1b6c9}
    .gh-gift-lid{position:absolute;left:8px;right:8px;top:30px;height:28px;border-radius:7px;background:linear-gradient(135deg,#d37d9d,#ad5275);box-shadow:0 8px 16px rgba(120,48,72,.18);transform-origin:15% 90%;z-index:3;animation:ghGiftLid .95s cubic-bezier(.2,.8,.2,1) both}.gh-gift-lid:after{content:'';position:absolute;left:50%;top:-5px;width:18px;height:38px;transform:translateX(-50%);background:#f1b6c9;border-radius:4px}
    .gh-gift-ribbon{position:absolute;left:50%;top:10px;width:5px;height:25px;transform:translateX(-50%);background:#ffd9e4;z-index:4;border-radius:5px}
    .gh-gift-spark{position:absolute;left:50%;top:38%;color:#d45d89;font-size:24px;font-weight:700;text-shadow:0 0 12px rgba(255,255,255,.8);animation:ghGiftSpark 1.1s ease-out both}.gh-spark-1{--x:-120px;--y:-92px;animation-delay:.34s}.gh-spark-2{--x:112px;--y:-84px;animation-delay:.43s}.gh-spark-3{--x:-88px;--y:82px;animation-delay:.52s;font-size:17px}.gh-spark-4{--x:100px;--y:74px;animation-delay:.61s;font-size:17px}
    .gh-gift-petal{position:absolute;left:50%;top:56%;width:10px;height:16px;border-radius:70% 30% 70% 30%;background:rgba(239,123,158,.72);animation:ghGiftPetal 1.45s ease-out both;z-index:2}.gh-petal-1{--x:-145px;animation-delay:.15s}.gh-petal-2{--x:-82px;animation-delay:.3s}.gh-petal-3{--x:70px;animation-delay:.42s}.gh-petal-4{--x:138px;animation-delay:.22s}
    .gh-gift-ready-message{position:relative;z-index:6;margin-top:22px;text-align:center;font-family:"DM Sans",Arial,sans-serif;color:#5f3546;animation:ghGiftMessage .55s ease .55s both}.gh-gift-ready-message strong{display:block;font-size:1.45rem;letter-spacing:.01em}.gh-gift-ready-message span{display:block;margin-top:7px;font-size:.9rem;color:#7d6870}
    @keyframes ghGiftMessage{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
    /* Premium visual polish */
    .hero-card,.occasion-card,.product-image,.newsletter-section,.hero-art .gift-box,.card-one,.card-two{border-radius:24px}
    .product-image,.occasion-card{box-shadow:0 8px 28px rgba(38,32,25,.045)}
    .product-card a{border-radius:24px;overflow:hidden;transition:transform .28s ease,box-shadow .28s ease}
    .product-card a:hover{transform:translateY(-5px);box-shadow:0 20px 42px rgba(38,32,25,.12)}
    .occasion-card:hover{box-shadow:0 16px 34px rgba(38,32,25,.09)}
    .hero-card{border:1px solid rgba(255,255,255,.82)}
    /* Glass reflection sweep: keep the original accent color, only a narrow highlight turns white */
    .hero-content h1 span{display:inline-block;color:var(--accent);background:linear-gradient(110deg,var(--accent) 0%,var(--accent) 40%,rgba(255,255,255,.98) 48%,var(--accent) 56%,var(--accent) 100%);background-size:260% 100%;background-position:115% 0;background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 0 12px rgba(166,93,71,.12);animation:ghGlassSweep 5.2s cubic-bezier(.45,0,.2,1) infinite}
    @keyframes ghGlassSweep{0%,24%{background-position:115% 0}50%{background-position:-25% 0}68%,100%{background-position:-25% 0}}
    .hero-content h1 span:after{content:'';display:inline-block;width:1px;height:.82em;margin-left:-.08em;vertical-align:-.04em;background:rgba(255,255,255,.72);filter:blur(1px);opacity:0;animation:ghGlassEdge 5.2s cubic-bezier(.45,0,.2,1) infinite}
    @keyframes ghGlassEdge{0%,30%{opacity:0;transform:translateX(-120px) skewX(-18deg)}48%{opacity:.7;transform:translateX(0) skewX(-18deg)}56%,100%{opacity:0;transform:translateX(80px) skewX(-18deg)}}
    @media(prefers-reduced-motion:reduce){.gh-gift-ready *,.gh-gift-ready{animation-duration:.01ms!important;animation-iteration-count:1!important}.hero-content h1 span,.hero-content h1 span:after{animation:none}.hero-content h1 span{background-position:50% 0}.product-card a,.occasion-card{transition:none}}
  `;
  document.head.appendChild(style);

  function showGiftReady() {
    document.querySelector('.gh-gift-ready')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'gh-gift-ready';
    overlay.setAttribute('aria-label', 'Your gift is ready to pack');
    overlay.setAttribute('role', 'status');
    overlay.innerHTML = '<div class="gh-gift-ready-box"><div class="gh-gift-glow"></div><div class="gh-gift-body"></div><div class="gh-gift-lid"></div><div class="gh-gift-ribbon"></div><span class="gh-gift-spark gh-spark-1">✦</span><span class="gh-gift-spark gh-spark-2">✦</span><span class="gh-gift-spark gh-spark-3">✧</span><span class="gh-gift-spark gh-spark-4">✧</span><span class="gh-gift-petal gh-petal-1"></span><span class="gh-gift-petal gh-petal-2"></span><span class="gh-gift-petal gh-petal-3"></span><span class="gh-gift-petal gh-petal-4"></span></div><div class="gh-gift-ready-message"><strong>Your gift is ready to pack 🎁</strong><span>Added to your cart successfully.</span></div>';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 3100);
  }

  window.showGiftReady = showGiftReady;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('#add-to-cart');
    if (!button || button.disabled) return;
    showGiftReady();
  });
})();

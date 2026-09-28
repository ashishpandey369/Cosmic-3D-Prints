document.addEventListener('DOMContentLoaded', () => {
  const occasions = document.querySelector('#occasions');
  if (!occasions || document.querySelector('#budget-navigation')) return;

  const style = document.createElement('style');
  style.textContent = `
    #budget-navigation{padding:78px 0 84px;background:rgba(255,250,246,.72);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .budget-heading{max-width:680px;margin-bottom:30px}
    .budget-heading h2{margin:0;font-family:'Playfair Display',Georgia,serif;font-size:clamp(2.1rem,4vw,3.5rem);line-height:.98;letter-spacing:-.045em}
    .budget-heading h2 em{color:var(--accent);font-weight:600}
    .budget-heading p:last-child{max-width:600px;color:var(--muted);margin:13px 0 0;font-size:.9rem}
    .budget-tree{display:grid;grid-template-columns:repeat(5,1fr);gap:0;position:relative;padding:14px 0 10px}
    .budget-tree:before{content:'';position:absolute;left:6%;right:6%;top:50%;height:4px;transform:translateY(-50%);border-radius:999px;background:linear-gradient(90deg,#e7c77d,#e85d73,#c98672,#9677c7,#df6579);box-shadow:0 0 0 2px rgba(255,255,255,.8),0 6px 16px rgba(90,60,50,.08)}
    .budget-node{position:relative;display:flex;flex-direction:column;justify-content:space-between;min-height:150px;padding:22px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,var(--budget-light),var(--budget-soft));color:var(--ink);text-decoration:none;overflow:hidden;box-shadow:0 8px 24px rgba(38,32,25,.06);transition:transform .24s ease,box-shadow .24s ease,border-color .24s ease}
    .budget-node:before{content:'';position:absolute;inset:auto -22% -52% 24%;height:105px;border-radius:50%;background:var(--budget-glow);filter:blur(18px);opacity:.55;pointer-events:none}
    .budget-node:after{content:'→';position:absolute;right:18px;bottom:16px;font-size:1.15rem;color:var(--budget-color);transition:transform .24s ease}
    .budget-node:hover{transform:translateY(-5px);border-color:var(--budget-color);box-shadow:0 20px 42px rgba(38,32,25,.12)}
    .budget-node:not(:last-child):after{content:'›';right:-9px;bottom:50%;transform:translateY(50%);width:20px;height:20px;display:grid;place-items:center;border-radius:50%;background:#fff;border:1px solid var(--line);font-size:.8rem;color:var(--budget-color);z-index:3}
    .budget-node:hover:after{transform:translateX(4px)}
    .budget-node small{position:relative;font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--budget-color);font-weight:700}
    .budget-node strong{position:relative;font-family:'Playfair Display',Georgia,serif;font-size:1.55rem;line-height:1.05;max-width:150px}
    .budget-node span{position:relative;font-size:.72rem;color:var(--muted)}
    .budget-node:nth-child(1){--budget-color:#c98735;--budget-light:#fff8e9;--budget-soft:#fffdf8;--budget-glow:#f4d58e}
    .budget-node:nth-child(2){--budget-color:#e24f67;--budget-light:#fff0f3;--budget-soft:#fff8f5;--budget-glow:#f5a6b6}
    .budget-node:nth-child(3){--budget-color:#a65d47;--budget-light:#fff4ed;--budget-soft:#fffaf5;--budget-glow:#e8b49f}
    .budget-node:nth-child(4){--budget-color:#7b5bb7;--budget-light:#f4efff;--budget-soft:#fcf9ff;--budget-glow:#cbb9ee}
    .budget-node:nth-child(5){--budget-color:#d44b63;--budget-light:#ffecef;--budget-soft:#fff6f7;--budget-glow:#f29aaa}
    @media(max-width:1000px){.budget-tree{grid-template-columns:repeat(3,1fr);row-gap:14px}.budget-tree:before{left:4%;right:4%}}
    @media(max-width:760px){
      #budget-navigation{padding:42px 0 48px}
      .budget-heading{margin-bottom:18px}
      .budget-heading h2{font-size:2rem}
      .budget-heading p:last-child{margin-top:9px}
      .budget-tree{display:flex;flex-direction:column;gap:0;position:relative;padding:6px 0 10px}
      .budget-tree:before{content:'';position:absolute;top:14px;bottom:22px;left:50%;width:4px;transform:translateX(-50%);border-radius:999px;background:linear-gradient(to bottom,#e7c77d,#e85d73,#c98672,#9677c7,#df6579);box-shadow:0 0 0 2px rgba(255,255,255,.8),0 6px 18px rgba(90,60,50,.1)}
      .budget-node{z-index:1;width:70%;min-height:88px;margin:0 auto 12px;padding:13px 17px;border-radius:14px;box-shadow:0 8px 18px rgba(38,32,25,.09)}
      .budget-node:nth-child(odd){transform:translateX(-15%) rotate(-3deg)}
      .budget-node:nth-child(even){transform:translateX(15%) rotate(3deg)}
      .budget-node:before{opacity:.42}
      .budget-node:not(:last-child):after{content:'';right:50%;bottom:-12px;transform:translateX(50%);width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid var(--line);z-index:3}
      .budget-node:nth-child(even):after{left:auto;right:50%;transform:translateX(50%)}
      .budget-node:hover{transform:translateY(-2px) translateX(-15%) rotate(-3deg)}
      .budget-node:nth-child(even):hover{transform:translateY(-2px) translateX(15%) rotate(3deg)}
      .budget-node small{font-size:.56rem;letter-spacing:.1em}
      .budget-node strong{font-size:1.12rem;max-width:175px}
      .budget-node span{font-size:.62rem}
    }
    @media(max-width:430px){
      .budget-node{width:76%;min-height:82px;padding:12px 15px;margin-bottom:10px}
      .budget-node:nth-child(odd){transform:translateX(-12%) rotate(-3deg)}
      .budget-node:nth-child(even){transform:translateX(12%) rotate(3deg)}
      .budget-node:hover{transform:translateY(-2px) translateX(-12%) rotate(-3deg)}
      .budget-node:nth-child(even):hover{transform:translateY(-2px) translateX(12%) rotate(3deg)}
      .budget-node strong{font-size:1.04rem}
      .budget-tree:before{width:4px}
    }
    @media(prefers-reduced-motion:reduce){.budget-node{transition:none}}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.id = 'budget-navigation';
  section.className = 'section';
  section.innerHTML = `<div class="container"><div class="budget-heading"><p class="eyebrow">Shop by budget</p><h2>Find the right gift <em>for every budget.</em></h2><p>Choose a price range and continue directly to the matching gift categories and products.</p></div><div class="budget-tree" aria-label="Gift budgets"><a class="budget-node" href="shop.html?price=under-999"><small>Budget 01</small><strong>Under ₹999</strong><span>Explore categories →</span></a><a class="budget-node" href="shop.html?price=999-1999"><small>Budget 02</small><strong>₹999 – ₹1,999</strong><span>Explore categories →</span></a><a class="budget-node" href="shop.html?price=1999-2999"><small>Budget 03</small><strong>₹2,000 – ₹2,999</strong><span>Explore categories →</span></a><a class="budget-node" href="shop.html?price=3000-4999"><small>Budget 04</small><strong>₹3,000 – ₹4,999</strong><span>Explore categories →</span></a><a class="budget-node" href="shop.html?price=5000-plus"><small>Budget 05</small><strong>₹5,000+</strong><span>Explore categories →</span></a></div></div>`;
  occasions.insertAdjacentElement('afterend', section);
});

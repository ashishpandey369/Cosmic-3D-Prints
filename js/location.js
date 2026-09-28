document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('.location-button');
  const header = document.querySelector('.site-header');
  const headerInner = header?.querySelector('.header-inner');
  if (!button || !header || !headerInner) return;

  const style = document.createElement('style');
  style.textContent = `
    .location-button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 13px;border:1px solid rgba(32,32,30,.08);border-radius:999px;background:#f0eee9;color:#20201e;font:600 .86rem/1 'DM Sans',Arial,sans-serif;cursor:pointer;white-space:nowrap;transition:background .2s ease,transform .2s ease}
    .location-button:hover{background:#e8e5df;transform:translateY(-1px)}
    .location-button small{font:500 .68rem/1 'DM Sans',Arial,sans-serif;color:#77716a}
    .gh-mobile-location{display:none}
    .gh-location-backdrop{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;padding:20px;background:rgba(32,32,30,.34);backdrop-filter:blur(7px);opacity:0;animation:ghLocationIn .22s ease forwards}
    .gh-location-modal{width:min(440px,100%);padding:30px;border-radius:24px;background:#fffdf9;box-shadow:0 28px 80px rgba(32,32,30,.22);position:relative}
    .gh-location-close{position:absolute;right:14px;top:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f0eee9;color:#20201e;font-size:1.25rem;cursor:pointer}
    .gh-location-modal .eyebrow{margin-bottom:9px}.gh-location-modal h2{margin:0;font:700 2rem/1.05 'Playfair Display',Georgia,serif;letter-spacing:-.035em}.gh-location-copy{margin:10px 0 20px;color:#706e68;font-size:.84rem}
    .gh-location-form{display:flex;gap:9px}.gh-location-form input{flex:1;min-width:0;height:48px;padding:0 15px;border:1px solid #d8d1c6;border-radius:12px;background:#fff;color:#20201e;font:500 .9rem 'DM Sans',Arial,sans-serif;outline:none}.gh-location-form input:focus{border-color:#a65d47;box-shadow:0 0 0 3px rgba(166,93,71,.1)}
    .gh-location-form button{height:48px;padding:0 18px;border:0;border-radius:12px;background:#20201e;color:#fff;font:700 .82rem 'DM Sans',Arial,sans-serif;cursor:pointer}.gh-location-form button:disabled{opacity:.6;cursor:wait}.gh-location-note{margin:12px 0 0;color:#8a857d;font-size:.72rem}
    .gh-location-result{margin:13px 0 0;padding:12px 13px;border-radius:12px;background:#f6f2eb;color:#514b44;font-size:.78rem;line-height:1.45}.gh-location-result strong{display:block;color:#20201e;font-size:.86rem}.gh-location-result.error{background:#fff1f1;color:#9b3f3f}
    @keyframes ghLocationIn{to{opacity:1}}
    @media(max-width:760px){
      .header-actions .location-button{display:none}
      .gh-mobile-location{display:flex;width:100%;min-height:50px;padding:0 18px;align-items:center;justify-content:space-between;gap:12px;border:0;border-top:1px solid rgba(32,32,30,.07);border-bottom:1px solid rgba(32,32,30,.08);background:#f6f1ff;color:#20201e;font:600 .92rem/1 'DM Sans',Arial,sans-serif;text-align:left;cursor:pointer}
      .gh-mobile-location .gh-location-label{display:flex;align-items:center;gap:10px;min-width:0}
      .gh-mobile-location .gh-location-icon{font-size:1.2rem;color:#7053a6}
      .gh-mobile-location .gh-location-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
      .gh-mobile-location .gh-location-copy strong{font-weight:700}
      .gh-mobile-location .gh-location-copy small{font:500 .72rem/1.1 'DM Sans',Arial,sans-serif;color:#77716a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}
      .gh-mobile-location .gh-location-arrow{font-size:1.35rem;color:#20201e}
      .gh-location-modal{padding:26px 20px}.gh-location-modal h2{font-size:1.7rem}.gh-location-form{flex-direction:column}.gh-location-form button{width:100%}
    }
    @media(prefers-reduced-motion:reduce){.location-button{transition:none}.gh-location-backdrop{animation:none;opacity:1}}
  `;
  document.head.appendChild(style);

  const mobileBar = document.createElement('button');
  mobileBar.className = 'gh-mobile-location';
  mobileBar.type = 'button';
  mobileBar.setAttribute('aria-label', 'Set delivery location');
  mobileBar.innerHTML = '<span class="gh-location-label"><span class="gh-location-icon">⌖</span><span class="gh-location-copy"><strong>Where to deliver?</strong><small data-mobile-location-label>Set location</small></span></span><span class="gh-location-arrow">›</span>';
  header.appendChild(mobileBar);

  const readSavedLocation = () => {
    try {
      const raw = localStorage.getItem('gifty-hamper-location');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.pincode) return parsed;
      return { pincode: raw };
    } catch {
      return null;
    }
  };

  const updateLabel = () => {
    const saved = readSavedLocation();
    const desktopLabel = button.querySelector('[data-location-label]');
    const mobileLabel = mobileBar.querySelector('[data-mobile-location-label]');
    const place = saved?.area || saved?.pincode || 'Set location';
    if (desktopLabel) desktopLabel.textContent = place;
    if (mobileLabel) mobileLabel.textContent = saved?.pincode ? `${place} • ${saved.pincode}` : place;
  };
  updateLabel();

  const close = (backdrop) => backdrop?.remove();

  const lookupPincode = async (pincode) => {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Location service unavailable');
    const data = await response.json();
    const record = data?.[0];
    const offices = record?.PostOffice || [];
    if (record?.Status !== 'Success' || !offices.length) throw new Error('No location found for this PIN code');

    const first = offices[0];
    return {
      pincode,
      area: first.Name || first.District || 'Area found',
      district: first.District || '',
      state: first.State || '',
      country: first.Country || 'India'
    };
  };

  const open = () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'gh-location-backdrop';
    backdrop.innerHTML = '<div class="gh-location-modal" role="dialog" aria-modal="true" aria-labelledby="gh-location-title"><button class="gh-location-close" type="button" aria-label="Close location selector">×</button><p class="eyebrow">Delivery location</p><h2 id="gh-location-title">Where should we deliver?</h2><p class="gh-location-copy">Enter the recipient PIN code and we will identify the delivery area.</p><form class="gh-location-form"><input name="pincode" inputmode="numeric" autocomplete="postal-code" maxlength="6" placeholder="Enter 6-digit PIN code" required><button type="submit">Find location</button></form><div class="gh-location-result" hidden></div><p class="gh-location-note">The area is looked up from the PIN code. Actual delivery availability will connect to WooCommerce later.</p></div>';
    document.body.appendChild(backdrop);

    const modal = backdrop.querySelector('.gh-location-modal');
    const input = backdrop.querySelector('input');
    const submit = backdrop.querySelector('form button');
    const result = backdrop.querySelector('.gh-location-result');
    const saved = readSavedLocation();
    input.value = saved?.pincode || '';
    input.focus();

    backdrop.querySelector('.gh-location-close').addEventListener('click', () => close(backdrop));
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(backdrop); });

    backdrop.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!/^\d{6}$/.test(value)) {
        input.setCustomValidity('Please enter a valid 6-digit PIN code.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      submit.disabled = true;
      submit.textContent = 'Finding…';
      result.hidden = true;
      result.classList.remove('error');

      try {
        const location = await lookupPincode(value);
        localStorage.setItem('gifty-hamper-location', JSON.stringify(location));
        updateLabel();
        result.innerHTML = `<strong>${location.area}</strong>${location.district ? `${location.district}, ` : ''}${location.state}${location.pincode ? ` — ${location.pincode}` : ''}`;
        result.hidden = false;
        submit.textContent = 'Saved';
        setTimeout(() => close(backdrop), 650);
      } catch (error) {
        result.textContent = error.message === 'No location found for this PIN code' ? 'We could not find a location for this PIN code. Please check the number and try again.' : 'We could not look up this PIN right now. Please try again.';
        result.classList.add('error');
        result.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Find location';
      }
    });

    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(backdrop); });
  };

  button.addEventListener('click', open);
  mobileBar.addEventListener('click', open);
});

/* Temporary catalog data. This module is deliberately isolated so it can later be replaced by WooCommerce API data. */
const DEFAULT_GIFTS = [
  { id: 'little-joy', name: 'The Little Joy Hamper', description: 'Thoughtful everyday gifting', price: 1499, occasion: 'Birthday', categories: ['Gift Sets', 'Appreciation Gifts'], label: 'Everyday', imageClass: 'image-sage' },
  { id: 'good-things', name: 'Good Things Gift Box', description: 'A warm collection of favourites', price: 1999, occasion: 'Thank You', categories: ['Gift Sets', 'Premium Gifts'], label: 'Curated', imageClass: 'image-sand' },
  { id: 'just-for-you', name: 'Just For You Hamper', description: 'Made for meaningful moments', price: 2499, occasion: 'Birthday', categories: ['Gift Sets', 'Celebration Gifts'], label: 'Special', imageClass: 'image-rose' },
  { id: 'signature-luxe', name: 'Signature Luxe Hamper', description: 'Premium gifting, beautifully packed', price: 3999, occasion: 'Corporate', categories: ['Premium Gifts', 'Employee Gifts', 'Gift Sets'], label: 'Premium', imageClass: 'image-night' },
  { id: 'festive-glow', name: 'Festive Glow Box', description: 'A bright celebration in a box', price: 1799, occasion: 'Festive', categories: ['Festive Gifts', 'Gift Sets'], label: 'Festive', imageClass: 'image-sand' },
  { id: 'office-cheer', name: 'Office Cheer Hamper', description: 'A polished team appreciation gift', price: 2299, occasion: 'Corporate', categories: ['Office Accessories', 'Employee Gifts', 'Appreciation Gifts'], label: 'Teams', imageClass: 'image-sage' },
  { id: 'warm-thanks', name: 'Warm Thanks Box', description: 'A simple way to say thank you', price: 1299, occasion: 'Thank You', categories: ['Appreciation Gifts', 'Gift Sets'], label: 'Thoughtful', imageClass: 'image-rose' },
  { id: 'grand-celebration', name: 'Grand Celebration Hamper', description: 'A premium gift for big moments', price: 4999, occasion: 'Festive', categories: ['Celebration Gifts', 'Premium Gifts', 'Gift Sets'], label: 'Premium', imageClass: 'image-night' }
];

const PRICE_RANGES = [
  {id:'under-999', label:'Under ₹999', matches: price => price < 999},
  {id:'999-1999', label:'₹999 – ₹1,999', matches: price => price >= 999 && price <= 1999},
  {id:'1999-2999', label:'₹2,000 – ₹2,999', matches: price => price >= 2000 && price <= 2999},
  {id:'3000-4999', label:'₹3,000 – ₹4,999', matches: price => price >= 3000 && price <= 4999},
  {id:'5000-plus', label:'₹5,000+', matches: price => price >= 5000}
];

function getPriceRange(price) { return PRICE_RANGES.find(range => range.matches(Number(price) || 0)) || PRICE_RANGES[0]; }

import {
  DEFAULT_CATALOG,
  getDiscountPercent,
  loadPublicCatalog
} from "./catalog-store.js?v=3";
import { loadCategories } from "./category-store.js";

let GIFTS = DEFAULT_CATALOG.map(product => ({ ...product }));


function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function productCard(product) {
  const slug = product.id;
  const images = (Array.isArray(product.images) ? product.images : (product.image ? [product.image] : [])).filter(Boolean);
  const safeName = String(product.name || 'Gift').replace(/"/g, '&quot;');
  const hasImages = images.length > 0;
  const imageCount = images.length;
  const initialVisual = hasImages
    ? `<img class="product-photo" src="${images[0].replace(/"/g, '&quot;')}" alt="${safeName}" loading="lazy" data-carousel-image>`
    : `<span class="product-placeholder-label">${product.label || ''}</span><b>${product.name.split(' ').slice(0, 2).join('<br>')}</b>`;

  const controls = imageCount > 1 ? `
    <button type="button" class="product-carousel-arrow product-carousel-prev" data-carousel-prev aria-label="Previous image">‹</button>
    <button type="button" class="product-carousel-arrow product-carousel-next" data-carousel-next aria-label="Next image">›</button>
    <div class="product-carousel-dots" aria-label="Product image selector">
      ${images.map((_, index) => `<button type="button" class="product-carousel-dot${index === 0 ? ' active' : ''}" data-carousel-dot="${index}" aria-label="View image ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('')}
    </div>
    <span class="product-image-count">${imageCount} photos</span>
  ` : '';

  const originalPrice = Number(product.price) || 0;
  const currentPrice = Number(product.salePrice || product.price) || 0;
  const discount = getDiscountPercent(product);
  const priceMarkup = discount
    ? `<div class="product-card-price"><del>${formatPrice(originalPrice)}</del><strong>${formatPrice(currentPrice)}</strong><span>${discount}% OFF</span></div>`
    : `<div class="product-card-price"><strong>${formatPrice(currentPrice)}</strong></div>`;

  return `<article class="product-card" data-product-id="${slug}" data-product-images='${JSON.stringify(images).replace(/'/g, '&#39;')}'>
    <div class="product-image ${product.imageClass || ''} product-image-carousel">
      ${initialVisual}
      ${controls}
    </div>
    <a class="product-card-details" href="product.html?id=${encodeURIComponent(slug)}">
      <div class="product-info">
        <div><h3>${product.name}</h3><p>${product.description}</p><small class="product-sku-label">SKU: ${product.sku || "—"}</small></div>
        ${priceMarkup}
      </div>
    </a>
  </article>`;
}

function setupProductCarousels() {
  document.querySelectorAll('.product-card[data-product-id] .product-image-carousel').forEach(visual => {
    if (visual.dataset.productLinkBound === 'true') return;
    visual.dataset.productLinkBound = 'true';
    visual.setAttribute('role', 'link');
    visual.setAttribute('tabindex', '0');
    const card = visual.closest('.product-card');
    const id = card?.dataset.productId;
    const openProduct = () => { if (id) window.location.href = 'product.html?id=' + encodeURIComponent(id); };
    visual.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openProduct();
    });
    visual.addEventListener('keydown', event => {
      if (event.target.closest('button')) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProduct(); }
    });
  });


  document.querySelectorAll('.product-card[data-product-images]').forEach(card => {
    let images = [];
    try { images = JSON.parse(card.dataset.productImages || '[]'); } catch (_) { images = []; }
    if (images.length < 2) return;

    const visual = card.querySelector('.product-image-carousel');
    const image = card.querySelector('[data-carousel-image]');
    const dots = [...card.querySelectorAll('[data-carousel-dot]')];
    let index = 0;

    const showImage = nextIndex => {
      index = (nextIndex + images.length) % images.length;
      image.src = images[index];
      image.alt = `${card.querySelector('h3')?.textContent || 'Gift'} image ${index + 1}`;
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    card.querySelector('[data-carousel-prev]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showImage(index - 1);
    });
    card.querySelector('[data-carousel-next]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showImage(index + 1);
    });
    dots.forEach(dot => dot.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showImage(Number(dot.dataset.carouselDot));
    }));

    let startX = null;
    visual.addEventListener('touchstart', event => { startX = event.touches[0]?.clientX ?? null; }, {passive:true});
    visual.addEventListener('touchend', event => {
      if (startX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      if (Math.abs(delta) > 40) showImage(index + (delta < 0 ? 1 : -1));
      startX = null;
    }, {passive:true});
  });
}

function applyBudgetFromUrl() {
  const key = new URLSearchParams(window.location.search).get('price');
  if (!key) return;
  const input = document.querySelector(`input[name="price"][value="${key}"]`);
  if (input) input.checked = true;

  const labels = {
    'under-999': 'Under ₹999',
    '999-1999': '₹999 – ₹1,999',
    '1999-2999': '₹2,000 – ₹2,999',
    '3000-4999': '₹3,000 – ₹4,999',
    'over-5000': '₹5,000+'
  };
  const heading = document.querySelector('.shop-hero h1');
  const eyebrow = document.querySelector('.shop-hero .eyebrow');
  if (heading && labels[key]) heading.innerHTML = `Gifts <em>${labels[key]}</em>`;
  if (eyebrow && labels[key]) eyebrow.textContent = 'Budget collection';
}

function renderCatalog(urlCollection = new URLSearchParams(window.location.search).get('collection')) {
  const grid = document.querySelector('#catalog-products');
  if (!grid) return;

  const rawSearch = (document.querySelector('#catalog-search')?.value || '').trim().toLowerCase();
  const searchTerms = rawSearch.split(',').map(term => term.trim()).filter(Boolean).map(term => term.replace(/-\d+$/, ''));
  const majorCategories = [...document.querySelectorAll('input[name="major-category"]:checked')].map(input => input.value);
  const categories = [...document.querySelectorAll('input[name="category"]:checked')].map(input => input.value);
  const occasions = [...document.querySelectorAll('input[name="occasion"]:checked')].map(input => input.value);
  const prices = [...document.querySelectorAll('input[name="price"]:checked')].map(input => input.value);
  const sort = document.querySelector('#sort-products')?.value || 'featured';
  const mostSoldOnly = urlCollection === 'most-sold';

  let products = GIFTS.filter(product => {
    const searchable = `${product.name} ${product.sku || ''} ${product.id} ${product.description} ${product.occasion} ${(product.categories || []).join(' ')} ${product.majorCategory || 'Gifts for Everyone'}`.toLowerCase();
    const matchesSearch = !searchTerms.length || searchTerms.some(term => searchable.includes(term));
    const matchesMajorCategory = !majorCategories.length || majorCategories.includes(product.majorCategory || 'Gifts for Everyone');
    const matchesCategory = !categories.length || categories.some(category => (product.categories || []).includes(category));
    const matchesOccasion = !occasions.length || occasions.includes(product.occasion);
    const matchesPrice = !prices.length || prices.some(range => PRICE_RANGES.some(item => item.id === range && item.matches(Number(product.salePrice || product.price) || 0)));
    const matchesMostSold = !mostSoldOnly || product.mostSold === true;
    return matchesSearch && matchesMajorCategory && matchesCategory && matchesOccasion && matchesPrice && matchesMostSold;
  });

  if (sort === 'price-low') products.sort((a, b) => (Number(a.salePrice || a.price) || 0) - (Number(b.salePrice || b.price) || 0));
  if (sort === 'price-high') products.sort((a, b) => (Number(b.salePrice || b.price) || 0) - (Number(a.salePrice || a.price) || 0));
  if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));

  grid.innerHTML = products.map(productCard).join('');
  setupProductCarousels();
  const count = document.querySelector('#product-count');
  if (count) count.textContent = `${products.length} ${products.length === 1 ? 'gift' : 'gifts'}`;
  const empty = document.querySelector('#empty-state');
  if (empty) empty.hidden = products.length !== 0;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sharedCatalog = await loadPublicCatalog();
    if (sharedCatalog.length) GIFTS = sharedCatalog;
  } catch (error) {
    console.error('Shared catalog load error:', error);
  }
  let sharedCategories = [];
  try {
    sharedCategories = await loadCategories();
  } catch (error) {
    console.error('Shared category load error:', error);
  }

  const readList = (key, fallback) => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(saved) && saved.length ? saved : fallback;
    } catch (_) { return fallback; }
  };

  const majorCategories = sharedCategories.length
    ? sharedCategories.filter(item => item.type === 'major').map(item => item.name)
    : readList('gifty-hamper-major-categories', ['Gifts for Everyone']).map(item => item === 'Gifts' ? 'Gifts for Everyone' : item);
  const minorCategories = sharedCategories.length
    ? sharedCategories.filter(item => item.type === 'minor').map(item => item.name)
    : [...new Set(readList('gifty-hamper-categories', [...new Set(DEFAULT_GIFTS.flatMap(product => product.categories || []))]))];

  const majorBox = document.querySelector('#major-category-filters');
  const minorBox = document.querySelector('#minor-category-filters');
  if (majorBox) {
    majorBox.innerHTML = majorCategories.map(value => '<label><input type="checkbox" name="major-category" value="' + value.replace(/"/g, '&quot;') + '"> ' + value + '</label>').join('');
  }
  if (minorBox) {
    minorBox.innerHTML = minorCategories.map(value => '<label><input type="checkbox" name="category" value="' + value.replace(/"/g, '&quot;') + '"> ' + value + '</label>').join('');
  }

  const priceGroup = document.querySelector('#filters input[name="price"]')?.closest('.filter-group');
  if (priceGroup) {
    priceGroup.querySelectorAll('label').forEach(label => label.remove());
    PRICE_RANGES.forEach(range => {
      const label = document.createElement('label');
      label.innerHTML = '<input type="checkbox" name="price" value="' + range.id + '"> ' + range.label;
      priceGroup.appendChild(label);
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlSearch = urlParams.get('search');
  const urlCategory = urlParams.get('category');
  const urlOccasion = urlParams.get('occasion');
  const urlCollection = urlParams.get('collection');
  const searchInput = document.querySelector('#catalog-search');
  if (searchInput && urlSearch) searchInput.value = urlSearch;
  const categoryInput = urlCategory ? [...document.querySelectorAll('input[name="category"]')].find(input => input.value.toLowerCase() === urlCategory.toLowerCase()) : null;
  if (categoryInput) categoryInput.checked = true;
  const majorInput = urlCategory ? [...document.querySelectorAll('input[name="major-category"]')].find(input => input.value.toLowerCase() === urlCategory.toLowerCase()) : null;
  if (majorInput) majorInput.checked = true;
  const occasionInput = urlOccasion ? [...document.querySelectorAll('input[name="occasion"]')].find(input => input.value.toLowerCase() === urlOccasion.toLowerCase()) : null;
  if (occasionInput) occasionInput.checked = true;

  applyBudgetFromUrl();
  if (urlCollection === 'most-sold') {
    const heading = document.querySelector('.shop-hero h1');
    const eyebrow = document.querySelector('.shop-hero .eyebrow');
    if (heading) heading.innerHTML = 'Most <em>sold gifts.</em>';
    if (eyebrow) eyebrow.textContent = 'Most Sold';
  }
  renderCatalog();
  document.querySelector('#catalog-search')?.addEventListener('input', renderCatalog);
  document.querySelector('#sort-products')?.addEventListener('change', renderCatalog);
  document.querySelectorAll('#filters input').forEach(input => input.addEventListener('change', renderCatalog));
  document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    document.querySelectorAll('#filters input').forEach(input => { input.checked = false; });
    const search = document.querySelector('#catalog-search');
    if (search) search.value = '';
    renderCatalog();
  });
  document.querySelector('[data-filter-toggle]')?.addEventListener('click', () => document.querySelector('#filters')?.classList.toggle('open'));
});
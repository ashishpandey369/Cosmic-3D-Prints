import { DEFAULT_CATALOG, getDiscountPercent, getRecentlyViewedIds, loadPublicCatalog } from "./catalog-store.js?v=2";
import { loadCategories } from "./category-store.js";

let catalog = DEFAULT_CATALOG.map(item => ({...item}));
let categoryRecords = [];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const imagesFor = product => (Array.isArray(product.images) ? product.images : (product.image ? [product.image] : [])).filter(Boolean);
const price = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0);

function categoryIcon(name){
  const value = name.toLowerCase();
  if (value.includes('birthday')) return '🎂';
  if (value.includes('corporate') || value.includes('office') || value.includes('employee')) return '💼';
  if (value.includes('festive') || value.includes('festival')) return '✨';
  if (value.includes('premium') || value.includes('lux')) return '🎁';
  if (value.includes('eco')) return '🌿';
  if (value.includes('electronic') || value.includes('gadget')) return '⚡';
  if (value.includes('celebration')) return '🎉';
  if (value.includes('appreciation') || value.includes('thank')) return '💝';
  if (value.includes('gift set')) return '🎀';
  if (value.includes('accessor')) return '👜';
  return '🎁';
}

function categoryImageMarkup(category) {
  if (category.image) {
    return '<img src="' + escapeHtml(category.image) + '" alt="" loading="lazy">';
  }
  return '<span class="category-chip-fallback">' + categoryIcon(category.name) + '</span>';
}

function renderCategories(){
  const target = document.querySelector('#home-categories');
  if (!target) return;

  const fallback = [];
  const seen = new Set();
  const add = (name, type = 'minor', image = '', id = '') => {
    const clean = String(name || '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    fallback.push({
      id: id || (type + '-' + key.replace(/[^a-z0-9]+/g, '-')),
      name: clean,
      type,
      image: String(image || '').trim(),
      order: fallback.length
    });
  };

  // Keep the complete shared category record, especially its image.
  // The previous homepage mapper only copied the name/type and accidentally
  // discarded the Firestore image field.
  categoryRecords.forEach(category => add(
    category.name,
    category.type,
    category.image,
    category.id
  ));
  if (!fallback.length) {
    catalog.forEach(product => add(product.majorCategory || 'Gifts for Everyone', 'major'));
    catalog.forEach(product => (product.categories || []).forEach(category => add(category, 'minor')));
  }

  const categories = fallback.slice(0, 15);
  target.innerHTML = categories.map(category => {
    const count = catalog.filter(product =>
      String(product.majorCategory || 'Gifts for Everyone').toLowerCase() === category.name.toLowerCase() ||
      (product.categories || []).some(value => String(value).toLowerCase() === category.name.toLowerCase())
    ).length;

    return '<a class="category-chip" href="shop.html?category=' + encodeURIComponent(category.name) + '">' +
      '<span class="category-chip-icon">' + categoryImageMarkup(category) + '</span>' +
      '<strong title="' + escapeHtml(category.name) + '">' + escapeHtml(category.name) + '</strong>' +
      '<small>' + count + ' ' + (count === 1 ? 'gift' : 'gifts') + '</small>' +
      '</a>';
  }).join('');
}

function productCard(product){
  const images = imagesFor(product);
  const current = Number(product.salePrice || product.price) || 0;
  const original = Number(product.price) || 0;
  const discount = getDiscountPercent(product);
  const imageMarkup = images.length
    ? '<img src="' + escapeHtml(images[0]) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
    : '<div class="market-product-placeholder">' + escapeHtml((product.label || 'GIFT') + ' • ' + product.name) + '</div>';
  return '<a class="market-product-card" href="product.html?id=' + encodeURIComponent(product.id) + '">' +
    '<div class="market-product-image">' + imageMarkup + '</div>' +
    '<div class="market-product-body"><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description || 'Thoughtfully curated gift') + '</p>' +
    '<div class="market-product-price">' + (discount ? '<del>' + price(original) + '</del>' : '') + '<strong>' + price(current) + '</strong>' + (discount ? '<span>' + discount + '% OFF</span>' : '') + '</div></div>' +
    '</a>';
}

function renderProducts(){
  const recentTarget = document.querySelector('#home-recent-products');
  const target = document.querySelector('#home-products');
  if (!recentTarget && !target) return;

  const recentIds = getRecentlyViewedIds();

  const recent = recentIds.map(id => catalog.find(product => product.id === id)).filter(Boolean).slice(0, 8);
  const forYou = catalog
    .filter(product => product.active !== false)
    .slice(0, 10);

  if (recentTarget) {
    recentTarget.innerHTML = recent.map(productCard).join('');
    const recentSection = document.querySelector('#recently-viewed');
    if (recentSection) recentSection.hidden = recent.length === 0;

    const left = document.querySelector('#recent-scroll-left');
    const right = document.querySelector('#recent-scroll-right');
    const updateScrollButtons = () => {
      const maxScroll = Math.max(0, recentTarget.scrollWidth - recentTarget.clientWidth);
      if (left) left.disabled = recentTarget.scrollLeft <= 2;
      if (right) right.disabled = recentTarget.scrollLeft >= maxScroll - 2;
    };
    const scroll = amount => recentTarget.scrollBy({left: amount, behavior: 'smooth'});
    left?.addEventListener('click', () => scroll(-Math.max(260, recentTarget.clientWidth * .72)));
    right?.addEventListener('click', () => scroll(Math.max(260, recentTarget.clientWidth * .72)));
    recentTarget.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    requestAnimationFrame(updateScrollButtons);
  }

  if (target) target.innerHTML = forYou.map(productCard).join('');
}
function runSearch(form){
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input?.value.trim() || '';
    if (value) window.location.href = 'shop.html?search=' + encodeURIComponent(value);
    else window.location.href = 'shop.html';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const shared = await loadPublicCatalog();
    if (shared.length) catalog = shared;
  } catch (error) {
    console.error('Home catalog load error:', error);
  }
  try {
    categoryRecords = await loadCategories();
  } catch (error) {
    console.error('Home category load error:', error);
    categoryRecords = [];
  }
  renderCategories();
  renderProducts();
  runSearch(document.querySelector('#home-search'));
  runSearch(document.querySelector('#header-search'));
});

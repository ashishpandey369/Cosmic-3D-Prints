import { DEFAULT_CATALOG, loadPublicCatalog } from "./catalog-store.js?v=2";
import { loadCategories } from "./category-store.js";

let catalog = DEFAULT_CATALOG.map(item => ({ ...item }));

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const iconFor = name => {
  const value = String(name || '').toLowerCase();
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
};

function buildFallbackCategories() {
  const result = [];
  const seen = new Set();
  const add = (name, type) => {
    const clean = String(name || '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push({ id: type + '-' + key.replace(/[^a-z0-9]+/g, '-'), name: clean, type, image: '', order: result.length });
  };
  catalog.forEach(product => add(product.majorCategory || 'Gifts for Everyone', 'major'));
  catalog.forEach(product => (product.categories || []).forEach(category => add(category, 'minor')));
  return result;
}

function render(categories, mostSoldOnly = false) {
  const grid = document.querySelector('#all-category-grid');
  const count = document.querySelector('#category-count');
  const empty = document.querySelector('#category-empty');
  if (!grid) return;

  if (!categories.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    if (count) count.textContent = '0 categories';
    return;
  }

  if (empty) empty.hidden = true;
  if (count) count.textContent = categories.length + (categories.length === 1 ? ' category' : ' categories');

  grid.innerHTML = categories.map(category => {
    const productCount = catalog.filter(product =>
      (!mostSoldOnly || product.mostSold === true) &&
      (
        String(product.majorCategory || 'Gifts for Everyone').toLowerCase() === category.name.toLowerCase() ||
        (product.categories || []).some(value => String(value).toLowerCase() === category.name.toLowerCase())
      )
    ).length;

    const visual = category.image
      ? '<img src="' + escapeHtml(category.image) + '" alt="' + escapeHtml(category.name) + '" loading="lazy">'
      : '<span class="all-category-fallback">' + iconFor(category.name) + '</span>';

    const href = mostSoldOnly
      ? 'shop.html?collection=most-sold&category=' + encodeURIComponent(category.name)
      : 'shop.html?category=' + encodeURIComponent(category.name);

    return '<a class="all-category-card" href="' + href + '">' +
      '<div class="all-category-image">' + visual + '</div>' +
      '<h2>' + escapeHtml(category.name) + '</h2>' +
      '<p>' + productCount + ' ' + (productCount === 1 ? 'gift' : 'gifts') + '</p>' +
      '<span class="all-category-type">' + (category.type === 'major' ? 'Major' : 'Category') + '</span>' +
    '</a>';
  }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sharedCatalog = await loadPublicCatalog();
    if (sharedCatalog.length) catalog = sharedCatalog;
  } catch (error) {
    console.error('Category page catalog load error:', error);
  }

  let categories = [];
  try {
    categories = await loadCategories();
  } catch (error) {
    console.error('Category page category load error:', error);
  }

  if (!categories.length) categories = buildFallbackCategories();

  const mostSoldOnly = new URLSearchParams(window.location.search).get('collection') === 'most-sold';
  if (mostSoldOnly) {
    categories = categories.filter(category =>
      catalog.some(product =>
        product.mostSold === true &&
        (
          String(product.majorCategory || 'Gifts for Everyone').toLowerCase() === category.name.toLowerCase() ||
          (product.categories || []).some(value => String(value).toLowerCase() === category.name.toLowerCase())
        )
      )
    );

    const heading = document.querySelector('.categories-hero h1');
    const eyebrow = document.querySelector('.categories-hero .eyebrow');
    if (heading) heading.innerHTML = 'Most <em>sold categories.</em>';
    if (eyebrow) eyebrow.textContent = 'Most Sold';
  }

  render(categories, mostSoldOnly);
});

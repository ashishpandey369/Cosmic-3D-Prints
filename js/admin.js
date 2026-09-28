import { auth, db, doc, getDoc, onAuthStateChanged } from "./firebase-auth.js";
import {
  DEFAULT_CATALOG,
  deleteCatalogProduct,
  generateSku,
  loadAdminCatalog,
  saveCatalogProduct,
  migrateMissingProductVisibility
} from "./catalog-store.js";
import { deleteCategory, loadCategories, saveCategory, categoryId } from "./category-store.js";
import { deleteImageFile, uploadImageFile, uploadImageUrl } from "./imagekit-store.js";

document.addEventListener('DOMContentLoaded', () => {
  const CAT_KEY = 'gifty-hamper-categories';
  const MAJOR_CAT_KEY = 'gifty-hamper-major-categories';
  const DEFAULT_CATS = ['For Him','For Her','For Husband','For Wife','For Boyfriend','For Girlfriend','For Parents','For Friends','For Employees','For Clients','Appreciation Gifts','Celebration Gifts','Eco Friendly Gifts','Festive Gifts','Gadgets and Electronic Gifts','Gift Sets','MR Gifts','Office Accessories','Premium Gifts'];
  const DEFAULT_MAJOR_CATS = ['Gifts for Everyone'];
  const OCC = ['Birthday','Anniversary','Rakhi','Corporate','Festive','Thank You','Personalized','Wedding','Other'];
  const DEFAULT_ADMIN_PRODUCTS = [
    {id:'little-joy',name:'The Little Joy Hamper',description:'Thoughtful everyday gifting',price:1499,occasion:'Birthday',categories:['Gift Sets','Appreciation Gifts'],label:'Everyday',imageClass:'image-sage'},
    {id:'good-things',name:'Good Things Gift Box',description:'A warm collection of favourites',price:1999,occasion:'Thank You',categories:['Gift Sets','Premium Gifts'],label:'Curated',imageClass:'image-sand'},
    {id:'just-for-you',name:'Just For You Hamper',description:'Made for meaningful moments',price:2499,occasion:'Birthday',categories:['Gift Sets','Celebration Gifts'],label:'Special',imageClass:'image-rose'},
    {id:'signature-luxe',name:'Signature Luxe Hamper',description:'Premium gifting, beautifully packed',price:3999,occasion:'Corporate',categories:['Premium Gifts','Employee Gifts','Gift Sets'],label:'Premium',imageClass:'image-night'},
    {id:'festive-glow',name:'Festive Glow Box',description:'A bright celebration in a box',price:1799,occasion:'Festive',categories:['Festive Gifts','Gift Sets'],label:'Festive',imageClass:'image-sand'},
    {id:'office-cheer',name:'Office Cheer Hamper',description:'A polished team appreciation gift',price:2299,occasion:'Corporate',categories:['Office Accessories','Employee Gifts','Appreciation Gifts'],label:'Teams',imageClass:'image-sage'},
    {id:'warm-thanks',name:'Warm Thanks Box',description:'A simple way to say thank you',price:1299,occasion:'Thank You',categories:['Appreciation Gifts','Gift Sets'],label:'Thoughtful',imageClass:'image-rose'},
    {id:'grand-celebration',name:'Grand Celebration Hamper',description:'A premium gift for big moments',price:4999,occasion:'Festive',categories:['Celebration Gifts','Premium Gifts','Gift Sets'],label:'Premium',imageClass:'image-night'}
  ];

  const getPriceRange = (price) => { const value = Number(price) || 0; if (value < 999) return 'Under ₹999'; if (value <= 1999) return '₹999 – ₹1,999'; if (value <= 2999) return '₹2,000 – ₹2,999'; if (value <= 4999) return '₹3,000 – ₹4,999'; return '₹5,000+'; };

  const $ = (selector) => document.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(Number(value) || 0);

  const normaliseProduct = (product) => ({
    ...product,
    stock: product.stock ?? 10,
    salePrice: product.salePrice ?? '',
    lowStock: product.lowStock ?? 5,
    featured: product.featured ?? false,
    active: product.active ?? true,
    majorCategory: product.majorCategory === 'Gifts' ? 'Gifts for Everyone' : (product.majorCategory || 'Gifts for Everyone'),
    priceRange: getPriceRange(product.salePrice || product.price),
    images: Array.isArray(product.images) && product.images.length
      ? product.images
      : (product.image ? [product.image] : [])
  });

  const defaults = () => DEFAULT_ADMIN_PRODUCTS.map(normaliseProduct);

  const readLegacyCatalog = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('gifty-hamper-catalog') || 'null');
      return Array.isArray(saved) && saved.length ? saved.map(normaliseProduct) : defaults();
    } catch (_) {
      return defaults();
    }
  };

  const readCategories = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CAT_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? [...new Set([...DEFAULT_CATS, ...saved])] : [...DEFAULT_CATS];
    } catch (_) {
      return [...DEFAULT_CATS];
    }
  };

  const saveCategories = (items) => localStorage.setItem(CAT_KEY, JSON.stringify(items));
  const saveMajorCategories = (items) => localStorage.setItem(MAJOR_CAT_KEY, JSON.stringify(items));

  let catalog = [];
  let categories = readCategories();
  let majorCategories = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MAJOR_CAT_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved.map(item => item === 'Gifts' ? 'Gifts for Everyone' : item) : [...DEFAULT_MAJOR_CATS];
    } catch (_) { return [...DEFAULT_MAJOR_CATS]; }
  })();
  let editingId = '';
  let categoryRecords = [];
  let categoryEditorImage = '';
  let categoryEditorImageFileId = '';
  let categoryEditorOriginalImageFileId = '';
  let categoryEditorPendingImage = null;
  let categoryEditorPendingObjectUrl = '';
  let mostSoldSelectedIds = new Set();
  let mostSoldSearch = '';


  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const uniqueCategoryId = (name, type) => {
    const base = categoryId(name, type);
    if (!categoryRecords.some(item => item.id === base)) return base;
    return base + '-' + Date.now().toString(36);
  };

  async function loadSharedCatalog() {
    await migrateMissingProductVisibility();
    catalog = await loadAdminCatalog();

    if (!catalog.length) {
      const legacy = readLegacyCatalog();
      const source = legacy.length ? legacy : DEFAULT_CATALOG;
      catalog = [];
      for (const product of source) {
        catalog.push(await saveCatalogProduct(product));
      }
    }

    render();
  }

  function fillOccasions() {
    $('#product-occasion').innerHTML = OCC.map(value => '<option value="' + value + '">' + value + '</option>').join('');
  }

  function renderMajorCategorySelect(selected = '') {
    const current = selected || majorCategories[0] || '';
    $('#product-major-category').innerHTML = majorCategories.map(category =>
      '<option value="' + category.replace(/"/g, '&quot;') + '"' + (category === current ? ' selected' : '') + '>' + category + '</option>'
    ).join('') || '<option value="">Create a major category first</option>';
  }

  function renderMinorCategoryChecks(selected = []) {
    $('#product-categories').innerHTML = categories.map(category =>
      '<label class="category-check"><input type="checkbox" value="' + category.replace(/"/g, '&quot;') + '"' +
      (selected.includes(category) ? ' checked' : '') + '><span>' + category + '</span></label>'
    ).join('') || '<p class="admin-help">Create a minor category first.</p>';
  }

  async function loadSharedCategories() {
    const loaded = await loadCategories();
    if (loaded.length) {
      categoryRecords = loaded;
    } else {
      const seeded = [];
      majorCategories.forEach((name, index) => seeded.push({
        id: uniqueCategoryId(name, 'major'), name, type: 'major', image: '', imageFileId: '', order: index
      }));
      categories.forEach((name, index) => seeded.push({
        id: uniqueCategoryId(name, 'minor'), name, type: 'minor', image: '', imageFileId: '', order: 100 + index
      }));
      for (const category of seeded) await saveCategory(category);
      categoryRecords = seeded;
    }

    majorCategories = categoryRecords.filter(item => item.type === 'major').map(item => item.name);
    categories = categoryRecords.filter(item => item.type === 'minor').map(item => item.name);
    saveMajorCategories(majorCategories);
    saveCategories(categories);
    renderCategoryManager();
  }

  function renderCategoryEditorPreview() {
    const preview = $('#category-editor-preview');
    const removeButton = $('#category-editor-remove-image');
    if (!preview) return;
    preview.innerHTML = categoryEditorImage
      ? '<div class="category-editor-preview-card"><img src="' + escapeHtml(categoryEditorImage) + '" alt="Category image preview"><span>Current image</span></div>'
      : '<div class="category-editor-empty">No image selected yet.</div>';
    if (removeButton) removeButton.hidden = !categoryEditorImage;
  }

  function renderCategoryManager() {
    const renderChip = category => {
      const image = category.image
        ? '<img src="' + escapeHtml(category.image) + '" alt="" loading="lazy">'
        : '<span class="category-chip-placeholder">🎁</span>';
      return '<div class="category-chip category-manager-chip">' +
        '<div class="category-chip-media">' + image + '</div>' +
        '<span class="category-chip-name" title="' + escapeHtml(category.name) + '">' + escapeHtml(category.name) + '</span>' +
        '<button type="button" data-edit-category="' + escapeHtml(category.id) + '" aria-label="Edit ' + escapeHtml(category.name) + '" title="Edit category">✎</button>' +
        '<button type="button" data-delete-category="' + escapeHtml(category.name) + '" data-category-id="' + escapeHtml(category.id) + '" data-category-type="' + category.type + '" aria-label="Delete ' + escapeHtml(category.name) + '" title="Delete category">×</button>' +
      '</div>';
    };

    $('#category-list').innerHTML = categoryRecords.filter(item => item.type === 'minor').map(renderChip).join('');
    $('#major-category-list').innerHTML = categoryRecords.filter(item => item.type === 'major').map(renderChip).join('');
    renderMajorCategorySelect($('#product-major-category')?.value || '');
    renderMinorCategoryChecks(getSelectedCategories());
  }

  function renderMostSoldManager() {
    const target = $('#most-sold-product-list');
    const selectedTarget = $('#most-sold-selected-list');
    const count = $('#most-sold-count');
    const searchInput = $('#most-sold-search');
    if (!target || !selectedTarget || !count) return;

    const selectedProducts = catalog
      .filter(product => mostSoldSelectedIds.has(product.id));

    count.textContent = mostSoldSelectedIds.size + ' selected';

    const query = mostSoldSearch.trim().toLowerCase();
    const products = catalog
      .filter(product => product.active !== false)
      .filter(product => {
        if (!query) return true;
        return [
          product.name,
          product.sku,
          product.id,
          ...(product.categories || []),
          product.majorCategory
        ].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aSelected = mostSoldSelectedIds.has(a.id) ? 0 : 1;
        const bSelected = mostSoldSelectedIds.has(b.id) ? 0 : 1;
        return aSelected - bSelected || String(a.name).localeCompare(String(b.name));
      });

    if (searchInput && searchInput.value !== mostSoldSearch) searchInput.value = mostSoldSearch;

    target.innerHTML = products.map(product => {
      const image = product.images?.[0] || '';
      const checked = mostSoldSelectedIds.has(product.id);
      return '<label class="most-sold-product-card' + (checked ? ' selected' : '') + '">' +
        '<input type="checkbox" data-most-sold-product="' + escapeHtml(product.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<div class="most-sold-product-media">' +
          (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '<span>🎁</span>') +
        '</div>' +
        '<div class="most-sold-product-info">' +
          '<strong>' + escapeHtml(product.name) + '</strong>' +
          '<small>' + escapeHtml(product.sku || product.id) + '</small>' +
          '<small>' + money(product.salePrice || product.price) + '</small>' +
        '</div>' +
        '<span class="most-sold-check">✓</span>' +
      '</label>';
    }).join('') || '<p class="admin-help">No active products match your search.</p>';

    selectedTarget.innerHTML = selectedProducts.map((product, index) => {
      const image = product.images?.[0] || '';
      return '<div class="most-sold-selected-card">' +
        '<span class="most-sold-selected-number">' + (index + 1) + '</span>' +
        '<div class="most-sold-selected-media">' +
          (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '<span>🎁</span>') +
        '</div>' +
        '<div class="most-sold-product-info">' +
          '<strong>' + escapeHtml(product.name) + '</strong>' +
          '<small>' + escapeHtml(product.sku || product.id) + '</small>' +
        '</div>' +
        '<button type="button" class="most-sold-selected-remove" data-most-sold-remove="' + escapeHtml(product.id) + '" aria-label="Remove ' + escapeHtml(product.name) + '" title="Remove">×</button>' +
      '</div>';
    }).join('') || '<div class="most-sold-empty">No products selected yet.</div>';
  }

  function loadMostSoldManager() {
    mostSoldSelectedIds = new Set(
      catalog.filter(product => product.mostSold === true).map(product => product.id)
    );
    renderMostSoldManager();
  }

  async function saveMostSoldManager() {
    const button = $('#save-most-sold');
    if (!button) return;

    if (mostSoldSelectedIds.size > MAX_MOST_SOLD_PRODUCTS) {
      alert('You can select up to ' + MAX_MOST_SOLD_PRODUCTS + ' products.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      const changedProducts = catalog.filter(product =>
        Boolean(product.mostSold) !== mostSoldSelectedIds.has(product.id)
      );

      for (const product of changedProducts) {
        const saved = await saveCatalogProduct({
          ...product,
          mostSold: mostSoldSelectedIds.has(product.id)
        });
        const index = catalog.findIndex(item => item.id === saved.id);
        if (index >= 0) catalog[index] = saved;
      }

      renderMostSoldManager();
      render();
    } catch (error) {
      console.error('Save most sold products error:', error);
      alert('Unable to save the Most Sold products. ' + (error?.message || 'Please try again.'));
      loadMostSoldManager();
    } finally {
      button.disabled = false;
      button.textContent = 'Save Most Sold products';
    }
  }

  function openCategoryEditor(id) {
    const category = categoryRecords.find(item => item.id === id);
    if (!category) return;
    $('#category-editor-id').value = category.id;
    $('#category-editor-type').value = category.type;
    $('#category-editor-name').value = category.name;
    $('#category-editor-image-url').value = category.image?.startsWith('data:image/') ? '' : (category.image || '');
    categoryEditorImage = category.image || '';
    categoryEditorImageFileId = category.imageFileId || '';
    categoryEditorOriginalImageFileId = category.imageFileId || '';
    categoryEditorPendingImage = null;
    categoryEditorPendingObjectUrl = '';
    $('#category-editor-title').textContent = 'Edit ' + (category.type === 'major' ? 'major' : 'minor') + ' category';
    renderCategoryEditorPreview();
    const modal = $('#category-editor-modal');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('category-editor-open');
  }

  function cleanupPendingCategoryUpload() {
    if (categoryEditorPendingObjectUrl) {
      URL.revokeObjectURL(categoryEditorPendingObjectUrl);
    }
    categoryEditorPendingObjectUrl = '';
    categoryEditorPendingImage = null;
    categoryEditorImageFileId = categoryEditorOriginalImageFileId;
  }

  function closeCategoryEditor(options = {}) {
    const modal = $('#category-editor-modal');
    if (options.cleanup !== false) void cleanupPendingCategoryUpload();
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('category-editor-open');
    categoryEditorImage = '';
    categoryEditorImageFileId = '';
    categoryEditorOriginalImageFileId = '';
    categoryEditorPendingImage = null;
    if (categoryEditorPendingObjectUrl) URL.revokeObjectURL(categoryEditorPendingObjectUrl);
    categoryEditorPendingObjectUrl = '';
    $('#category-editor-form').reset();
    renderCategoryEditorPreview();
  }

  function prepareImageBlob(file, maxSize, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        reject(new Error('Only PNG, JPG and WebP images are supported.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const sourceWidth = image.naturalWidth || image.width;
          const sourceHeight = image.naturalHeight || image.height;
          const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error('Unable to process the selected image.'));
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob) {
              reject(new Error('Unable to encode the selected image.'));
              return;
            }
            resolve(blob);
          }, 'image/webp', quality);
        };
        image.onerror = () => reject(new Error('Unable to read the selected image.'));
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Unable to read the selected image.'));
      reader.readAsDataURL(file);
    });
  }

  async function readCategoryImageFile(file) {
    return prepareImageBlob(file, 900, 0.82);
  }

  async function persistCategoryRename(type, oldName, newName) {
    if (oldName === newName) return;
    const affected = catalog.filter(product =>
      type === 'major'
        ? (product.majorCategory || 'Gifts for Everyone') === oldName
        : (product.categories || []).includes(oldName)
    );

    for (const product of affected) {
      const next = {
        ...product,
        majorCategory: type === 'major' && product.majorCategory === oldName ? newName : product.majorCategory,
        categories: type === 'minor'
          ? (product.categories || []).map(item => item === oldName ? newName : item)
          : product.categories
      };
      const saved = await saveCatalogProduct(next);
      const index = catalog.findIndex(item => item.id === saved.id);
      if (index >= 0) catalog[index] = saved;
    }
  }

  function getSelectedCategories() {
    return [...document.querySelectorAll('#product-categories input[type="checkbox"]:checked')].map(input => input.value);
  }

  function updatePriceRangeLabel() { const price = $('#product-sale-price').value ? Number($('#product-sale-price').value) : Number($('#product-price').value); $('#product-price-range').textContent = 'Automatic price category: ' + (price ? getPriceRange(price) : '—'); }

  function stats() {
    const active = catalog.filter(product => product.active !== false);
    $('#stat-products').textContent = catalog.length;
    $('#stat-active').textContent = active.length;
    $('#stat-low').textContent = catalog.filter(product => Number(product.stock) > 0 && Number(product.stock) <= Number(product.lowStock ?? 5)).length;
    $('#stat-out').textContent = catalog.filter(product => Number(product.stock) <= 0).length;
  }

  function render() {
    const rawQuery = ($('#admin-search').value || '').trim();
    const searchTerms = rawQuery
      .split(',')
      .map(term => term.trim().toLowerCase())
      .filter(Boolean);
    const status = $('#admin-status').value;

    const rows = catalog.filter(product => {
      const searchable = [
        product.name,
        product.sku,
        product.id,
        product.description,
        ...(product.categories || [])
      ].join(' ').toLowerCase();

      const statusMatch =
        status === 'all'
        || (status === 'active' && product.active !== false)
        || (status === 'draft' && product.active === false);

      const searchMatch =
        searchTerms.length === 0
        || searchTerms.some(term => searchable.includes(term));

      return searchMatch && statusMatch;
    });

    $('#admin-product-list').innerHTML = rows.map(product => {
      const stock = Number(product.stock) || 0;
      const stockClass = stock <= 0 ? 'stock-out' : stock <= Number(product.lowStock ?? 5) ? 'stock-low' : 'stock-ok';
      const image = product.images?.[0];
      return '<tr>' +
        '<td><div class="admin-product-cell">' + (image ? '<img src="' + image + '" alt="">' : '<span class="admin-thumb-placeholder">🎁</span>') +
        '<div><div class="admin-product-name">' + product.name + '</div><div class="admin-product-id">SKU: ' + (product.sku || 'Generating…') + ' <button type="button" class="copy-sku-button" data-copy-sku="' + (product.sku || '') + '" title="Copy SKU" aria-label="Copy SKU">⧉</button></div></div></div></td>' +
        '<td><strong>' + (product.majorCategory || 'Gifts') + '</strong><br><small>' + ((product.categories || []).join(', ') || '—') + '</small></td>' +
        '<td><strong>' + money(product.salePrice || product.price) + '</strong><br><small class="price-range-tag">' + getPriceRange(product.salePrice || product.price) + '</small></td>' +
        '<td class="' + stockClass + '">' + stock + '</td>' +
        '<td><span class="status-pill ' + (product.active === false ? 'draft' : '') + '">' + (product.active === false ? 'Draft' : 'Active') + '</span></td>' +
        '<td><div class="table-actions"><button type="button" data-edit="' + product.id + '">Edit</button><button type="button" data-delete="' + product.id + '">Delete</button></div></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="6">No products found.</td></tr>';

    stats();
  }

  function renderImagePreview() {
    const images = window.adminProductImages || [];
    $('#product-images-preview').innerHTML = images.map((src, index) =>
      '<div class="image-preview-card"><img src="' + src + '" alt="Product image ' + (index + 1) + '"><button type="button" data-remove-image="' + index + '" aria-label="Remove image">×</button>' +
      (index === 0 ? '<span>Main image</span>' : '<span>Image ' + (index + 1) + '</span>') + '</div>'
    ).join('');
  }

  function addImageRecord(result) {
    if (!result?.url) throw new Error('ImageKit did not return an image URL.');
    window.adminProductImages = [...(window.adminProductImages || []), result.url];
    window.adminProductImageFileIds = [...(window.adminProductImageFileIds || []), result.fileId || ''];
    if (result.fileId) {
      window.adminProductNewImageFileIds = [...(window.adminProductNewImageFileIds || []), result.fileId];
    }
    renderImagePreview();
  }

  async function uploadProductImageFile(file) {
    const blob = await prepareImageBlob(file, 1600, 0.82);
    const result = await uploadImageFile(blob, {
      folder: '/gifty-hamper/products',
      fileName: (file.name || 'product-image').replace(/\.[^.]+$/, '') + '.webp'
    });
    addImageRecord(result);
  }

  async function importProductImageUrl(url) {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Please use a public HTTP/HTTPS direct image URL.');
    }
    const result = await uploadImageUrl(url, {
      folder: '/gifty-hamper/products',
      fileName: 'imported-' + Date.now().toString(36) + '.webp'
    });
    addImageRecord(result);
  }

  async function cleanupPendingProductUploads() {
    const pending = [...new Set(window.adminProductNewImageFileIds || [])];
    window.adminProductNewImageFileIds = [];
    await Promise.allSettled(pending.map(fileId => deleteImageFile(fileId)));
  }

  function resetForm(options = {}) {
    const cleanup = options.cleanup !== false;
    if (cleanup) void cleanupPendingProductUploads();

    $('#product-form').reset();
    editingId = '';
    window.adminProductImages = [];
    window.adminProductImageFileIds = [];
    window.adminProductNewImageFileIds = [];
    window.adminProductRemovedImageFileIds = [];
    $('#product-active').checked = true;
    $('#product-low-stock').value = 5;
    $('#product-sku').value = generateSku();
    $('#editor-title').textContent = 'Add product';
    renderMajorCategorySelect('');
    renderMinorCategoryChecks([]);
    renderImagePreview();
    updatePriceRangeLabel();
  }

  function editProduct(id) {
    const product = catalog.find(item => item.id === id);
    if (!product) return;

    editingId = product.id;
    $('#product-name').value = product.name;
    $('#product-id').value = product.id;
    $('#product-sku').value = product.sku || generateSku();
    $('#product-price').value = product.price;
    $('#product-sale-price').value = product.salePrice ?? '';
    $('#product-stock').value = product.stock ?? 0;
    $('#product-low-stock').value = product.lowStock ?? 5;
    $('#product-occasion').value = product.occasion || OCC[0];
    $('#product-description').value = product.description || '';
    $('#product-label').value = product.label || '';
    $('#product-featured').checked = !!product.featured;
    $('#product-active').checked = product.active !== false;
    window.adminProductImages = [...(product.images || [])];
    window.adminProductImageFileIds = [...(product.imageKitFileIds || [])];
    window.adminProductNewImageFileIds = [];
    window.adminProductRemovedImageFileIds = [];
    renderMajorCategorySelect(product.majorCategory || '');
    renderMinorCategoryChecks(product.categories || []);
    renderImagePreview();
    $('#editor-title').textContent = 'Edit product';
    $('#product-editor').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  $('#product-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const existingId = $('#product-id').value.trim();
    const name = $('#product-name').value.trim();
    const price = Number($('#product-price').value) || 0;
    const salePriceValue = $('#product-sale-price').value.trim();
    const salePrice = salePriceValue ? Number(salePriceValue) : '';
    const selectedCategories = getSelectedCategories();
    const selectedMajorCategory = $('#product-major-category').value;

    if (!name || !price) {
      alert('Please enter a product name and price.');
      return;
    }

    if (salePrice !== '' && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)) {
      alert('Sale price must be lower than the original price to create a discount.');
      return;
    }

    if (!selectedMajorCategory) {
      alert('Please select a major category.');
      return;
    }

    if (!selectedCategories.length) {
      alert('Please select at least one minor category.');
      return;
    }

    let id = existingId;

    if (!id) {
      id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'product';

      if (catalog.some(item => item.id === id)) {
        id = id + '-' + Date.now().toString(36);
      }
    }

    const product = {
      id,
      sku: ($('#product-sku').value || generateSku()).trim().toUpperCase(),
      name,
      description: $('#product-description').value.trim(),
      price,
      salePrice,
      stock: Number($('#product-stock').value) || 0,
      lowStock: Number($('#product-low-stock').value) || 5,
      occasion: $('#product-occasion').value,
      majorCategory: selectedMajorCategory,
      categories: selectedCategories,
      label: $('#product-label').value.trim() || 'Gift',
      images: [...(window.adminProductImages || [])],
      imageKitFileIds: [...(window.adminProductImageFileIds || [])],
      featured: $('#product-featured').checked,
      active: $('#product-active').checked,
      imageClass: 'image-sage',
      priceRange: getPriceRange(salePrice !== '' ? salePrice : price)
    };

    const saveButton = $('#product-form button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      const savedProduct = await saveCatalogProduct(product);
      const removedImageFileIds = [...new Set(window.adminProductRemovedImageFileIds || [])];
      await Promise.allSettled(removedImageFileIds.map(fileId => deleteImageFile(fileId)));
      window.adminProductNewImageFileIds = [];
      window.adminProductRemovedImageFileIds = [];
      const index = catalog.findIndex(item => item.id === savedProduct.id);

      if (index >= 0) catalog[index] = savedProduct;
      else catalog.unshift(savedProduct);

      resetForm();
      render();
      alert('Product saved successfully. SKU: ' + savedProduct.sku);
    } catch (error) {
      console.error('Save product error:', error);
      if (error?.message === 'SKU_COLLISION') {
        alert('That SKU is already reserved. Please click Save again to generate another unique SKU.');
      } else {
        const detail = error?.message || error?.code || 'Unknown Firestore error';
        console.error('Detailed product save failure:', {
          code: error?.code,
          message: error?.message,
          name: error?.name
        });
        alert('Unable to save the product. ' + detail);
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save product';
    }
  });

  $('#admin-product-list').addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-copy-sku]');
    if (copyButton) {
      const sku = copyButton.dataset.copySku || '';
      navigator.clipboard.writeText(sku).then(() => {
        copyButton.textContent = '✓';
        setTimeout(() => { copyButton.textContent = '⧉'; }, 1200);
      }).catch(() => alert('Unable to copy SKU.'));
      return;
    }

    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');

    if (editButton) editProduct(editButton.dataset.edit);

    if (deleteButton) {
      const id = deleteButton.dataset.delete;
      if (confirm('Delete this product from the shared catalog?')) {
        try {
          const productToDelete = catalog.find(product => product.id === id);
          await deleteCatalogProduct(id);
          await Promise.allSettled((productToDelete?.imageKitFileIds || []).filter(Boolean).map(fileId => deleteImageFile(fileId)));
          catalog = catalog.filter(product => product.id !== id);
          render();
        } catch (error) {
          console.error('Delete product error:', error);
          alert('Unable to delete the product from the shared catalog. Please check Firebase rules.');
        }
      }
    }
  });

  $('#product-images-preview').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;

    const index = Number(button.dataset.removeImage);
    const fileId = window.adminProductImageFileIds?.[index] || '';

    window.adminProductImages.splice(index, 1);
    window.adminProductImageFileIds.splice(index, 1);

    if (fileId) {
      if ((window.adminProductNewImageFileIds || []).includes(fileId)) {
        window.adminProductNewImageFileIds = (window.adminProductNewImageFileIds || []).filter(id => id !== fileId);
        try {
          await deleteImageFile(fileId);
        } catch (error) {
          console.error('Delete newly uploaded ImageKit file error:', error);
        }
      } else {
        window.adminProductRemovedImageFileIds = [...(window.adminProductRemovedImageFileIds || []), fileId];
      }
    }

    renderImagePreview();
  });

  $('#add-image-url').addEventListener('click', async () => {
    const input = $('#product-image-url');
    const url = input.value.trim();
    if (!url) return;

    const button = $('#add-image-url');
    button.disabled = true;
    button.textContent = 'Uploading…';

    try {
      await importProductImageUrl(url);
      input.value = '';
    } catch (error) {
      console.error('ImageKit URL import error:', error);
      alert('Unable to import the image to ImageKit. ' + (error?.message || 'Please check the URL.'));
    } finally {
      button.disabled = false;
      button.textContent = '+ Add image URL';
    }
  });

  $('#product-image-files').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    const input = event.target;

    for (const file of files) {
      try {
        await uploadProductImageFile(file);
      } catch (error) {
        console.error('ImageKit product upload error:', error);
        alert('Unable to upload the image to ImageKit. ' + (error?.message || 'Please try again.'));
      }
    }

    input.value = '';
  });

  $('#most-sold-search').addEventListener('input', event => {
    mostSoldSearch = event.target.value || '';
    renderMostSoldManager();
  });

  $('#most-sold-product-list').addEventListener('change', event => {
    const input = event.target.closest('[data-most-sold-product]');
    if (!input) return;

    if (input.checked) {
      mostSoldSelectedIds.add(input.dataset.mostSoldProduct);
    } else {
      mostSoldSelectedIds.delete(input.dataset.mostSoldProduct);
    }

    renderMostSoldManager();
  });

  $('#most-sold-selected-list').addEventListener('click', event => {
    const button = event.target.closest('[data-most-sold-remove]');
    if (!button) return;
    mostSoldSelectedIds.delete(button.dataset.mostSoldRemove);
    renderMostSoldManager();
  });

  $('#save-most-sold').addEventListener('click', saveMostSoldManager);

  $('#create-major-category').addEventListener('click', async () => {
    const input = $('#new-major-category');
    const name = input.value.trim();
    if (!name) return;
    if (categoryRecords.some(category => category.type === 'major' && category.name.toLowerCase() === name.toLowerCase())) {
      alert('That major category already exists.');
      return;
    }
    try {
      const saved = await saveCategory({
        id: uniqueCategoryId(name, 'major'),
        name,
        type: 'major',
        image: '',
        imageFileId: '',
        order: categoryRecords.filter(item => item.type === 'major').length
      });
      categoryRecords.push(saved);
      majorCategories = categoryRecords.filter(item => item.type === 'major').map(item => item.name);
      saveMajorCategories(majorCategories);
      input.value = '';
      renderCategoryManager();
    } catch (error) {
      console.error('Create major category error:', error);
      alert('Unable to create the major category. Please check Firebase rules.');
    }
  });

  $('#create-category').addEventListener('click', async () => {
    const input = $('#new-category');
    const name = input.value.trim();
    if (!name) return;
    if (categoryRecords.some(category => category.type === 'minor' && category.name.toLowerCase() === name.toLowerCase())) {
      alert('That category already exists.');
      return;
    }
    try {
      const saved = await saveCategory({
        id: uniqueCategoryId(name, 'minor'),
        name,
        type: 'minor',
        image: '',
        imageFileId: '',
        order: 100 + categoryRecords.filter(item => item.type === 'minor').length
      });
      categoryRecords.push(saved);
      categories = categoryRecords.filter(item => item.type === 'minor').map(item => item.name);
      saveCategories(categories);
      input.value = '';
      renderCategoryManager();
    } catch (error) {
      console.error('Create minor category error:', error);
      alert('Unable to create the category. Please check Firebase rules.');
    }
  });

  async function deleteManagedCategory(id, name, type) {
    const category = categoryRecords.find(item => item.id === id);
    if (!category) return;

    if (type === 'major' && categoryRecords.filter(item => item.type === 'major').length <= 1) {
      alert('Keep at least one major category so products can be organised.');
      return;
    }

    const message = type === 'major'
      ? 'Delete the major category "' + name + '"? Products using it will be moved to the first remaining major category.'
      : 'Delete the category "' + name + '"? Products using it will keep their other categories.';
    if (!confirm(message)) return;

    try {
      if (type === 'major') {
        const fallback = categoryRecords.find(item => item.type === 'major' && item.id !== id);
        if (fallback) {
          for (const product of catalog.filter(item => item.majorCategory === name)) {
            const saved = await saveCatalogProduct({ ...product, majorCategory: fallback.name });
            const index = catalog.findIndex(item => item.id === saved.id);
            if (index >= 0) catalog[index] = saved;
          }
        }
      } else {
        for (const product of catalog.filter(item => (item.categories || []).includes(name))) {
          const saved = await saveCatalogProduct({
            ...product,
            categories: (product.categories || []).filter(item => item !== name)
          });
          const index = catalog.findIndex(item => item.id === saved.id);
          if (index >= 0) catalog[index] = saved;
        }
      }

      await deleteCategory(id);
      if (category.imageFileId) {
        await Promise.allSettled([deleteImageFile(category.imageFileId)]);
      }
      categoryRecords = categoryRecords.filter(item => item.id !== id);
      majorCategories = categoryRecords.filter(item => item.type === 'major').map(item => item.name);
      categories = categoryRecords.filter(item => item.type === 'minor').map(item => item.name);
      saveMajorCategories(majorCategories);
      saveCategories(categories);
      renderCategoryManager();
      render();
    } catch (error) {
      console.error('Delete category error:', error);
      alert('Unable to delete the category. Please check Firebase rules and try again.');
    }
  }

  $('#major-category-list').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-category]');
    if (editButton) return openCategoryEditor(editButton.dataset.editCategory);
    const deleteButton = event.target.closest('[data-delete-category]');
    if (!deleteButton) return;
    deleteManagedCategory(deleteButton.dataset.categoryId, deleteButton.dataset.deleteCategory, deleteButton.dataset.categoryType);
  });

  $('#category-list').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-category]');
    if (editButton) return openCategoryEditor(editButton.dataset.editCategory);
    const deleteButton = event.target.closest('[data-delete-category]');
    if (!deleteButton) return;
    deleteManagedCategory(deleteButton.dataset.categoryId, deleteButton.dataset.deleteCategory, deleteButton.dataset.categoryType);
  });

  function stageCategoryEditorImage(pendingImage) {
    if (categoryEditorPendingObjectUrl) {
      URL.revokeObjectURL(categoryEditorPendingObjectUrl);
      categoryEditorPendingObjectUrl = '';
    }

    categoryEditorPendingImage = pendingImage || null;

    if (pendingImage?.previewUrl) {
      categoryEditorPendingObjectUrl = pendingImage.previewUrl.startsWith('blob:')
        ? pendingImage.previewUrl
        : '';
      categoryEditorImage = pendingImage.previewUrl;
    } else if (pendingImage?.sourceUrl) {
      categoryEditorImage = pendingImage.sourceUrl;
    } else {
      categoryEditorImage = '';
    }

    categoryEditorImageFileId = categoryEditorOriginalImageFileId;
    renderCategoryEditorPreview();
  }

  $('#category-editor-add-url').addEventListener('click', async () => {
    const url = $('#category-editor-image-url').value.trim();
    if (!/^https?:\/\//i.test(url)) {
      alert('Please use a public HTTP/HTTPS direct image URL.');
      return;
    }

    const button = $('#category-editor-add-url');
    button.disabled = true;
    button.textContent = 'Uploading…';

    try {
      stageCategoryEditorImage({
        sourceUrl: url,
        fileName: 'category-' + Date.now().toString(36) + '.webp'
      });
      $('#category-editor-image-url').value = '';
    } catch (error) {
      console.error('ImageKit category URL import error:', error);
      alert('Unable to import the category image to ImageKit. ' + (error?.message || 'Please check the URL.'));
    } finally {
      button.disabled = false;
      button.textContent = 'Use image URL';
    }
  });

  $('#category-editor-image-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const blob = await readCategoryImageFile(file);
      const previewUrl = URL.createObjectURL(blob);
      stageCategoryEditorImage({
        blob,
        previewUrl,
        fileName: (file.name || 'category-image').replace(/\.[^.]+$/, '') + '.webp'
      });
      $('#category-editor-image-url').value = '';
    } catch (error) {
      console.error('ImageKit category upload error:', error);
      alert('Unable to upload the category image to ImageKit. ' + (error?.message || 'Please try again.'));
    }

    event.target.value = '';
  });

  $('#category-editor-remove-image').addEventListener('click', () => {
    if (categoryEditorPendingObjectUrl) {
      URL.revokeObjectURL(categoryEditorPendingObjectUrl);
      categoryEditorPendingObjectUrl = '';
    }
    categoryEditorPendingImage = { remove: true };
    categoryEditorImage = '';
    categoryEditorImageFileId = '';
    $('#category-editor-image-url').value = '';
    renderCategoryEditorPreview();
  });

  $('#category-editor-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#category-editor-id').value;
    const type = $('#category-editor-type').value;
    const oldCategory = categoryRecords.find(item => item.id === id);
    const name = $('#category-editor-name').value.trim();
    if (!oldCategory || !name) return;

    if (categoryRecords.some(item => item.type === type && item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
      alert('That category name already exists.');
      return;
    }

    const button = $('#save-category-editor');
    button.disabled = true;
    button.textContent = 'Saving…';

    let newlyUploadedFileId = '';
    let nextImage = categoryEditorImage;
    let nextImageFileId = categoryEditorImageFileId;

    try {
      // Stage uploads locally and only send them to ImageKit when the category
      // is actually saved. This prevents abandoned editors from creating
      // orphaned ImageKit files.
      if (categoryEditorPendingImage?.remove) {
        nextImage = '';
        nextImageFileId = '';
      } else if (categoryEditorPendingImage?.blob) {
        const result = await uploadImageFile(categoryEditorPendingImage.blob, {
          folder: '/gifty-hamper/categories',
          fileName: categoryEditorPendingImage.fileName || ('category-' + Date.now().toString(36) + '.webp')
        });
        nextImage = result.url;
        nextImageFileId = result.fileId || '';
        newlyUploadedFileId = result.fileId || '';
      } else if (categoryEditorPendingImage?.sourceUrl) {
        const result = await uploadImageUrl(categoryEditorPendingImage.sourceUrl, {
          folder: '/gifty-hamper/categories',
          fileName: categoryEditorPendingImage.fileName || ('category-' + Date.now().toString(36) + '.webp')
        });
        nextImage = result.url;
        nextImageFileId = result.fileId || '';
        newlyUploadedFileId = result.fileId || '';
      }

      await persistCategoryRename(type, oldCategory.name, name);
      const previousImageFileId = oldCategory.imageFileId || '';
      const saved = await saveCategory({
        ...oldCategory,
        name,
        image: nextImage,
        imageFileId: nextImageFileId
      });

      if (previousImageFileId && previousImageFileId !== nextImageFileId) {
        await Promise.allSettled([deleteImageFile(previousImageFileId)]);
      }

      categoryEditorOriginalImageFileId = nextImageFileId;
      categoryEditorImageFileId = nextImageFileId;
      categoryEditorPendingImage = null;
      if (categoryEditorPendingObjectUrl) URL.revokeObjectURL(categoryEditorPendingObjectUrl);
      categoryEditorPendingObjectUrl = '';
      categoryRecords = categoryRecords.map(item => item.id === id ? saved : item);
      majorCategories = categoryRecords.filter(item => item.type === 'major').map(item => item.name);
      categories = categoryRecords.filter(item => item.type === 'minor').map(item => item.name);
      saveMajorCategories(majorCategories);
      saveCategories(categories);
      closeCategoryEditor({ cleanup: false });
      renderCategoryManager();
      render();
    } catch (error) {
      if (newlyUploadedFileId) {
        await Promise.allSettled([deleteImageFile(newlyUploadedFileId)]);
      }
      console.error('Save category error:', error);
      alert('Unable to save the category. ' + (error?.message || 'Please check Firebase rules and try again.'));
    } finally {
      button.disabled = false;
      button.textContent = 'Save category';
    }
  });

  $('#close-category-editor').addEventListener('click', closeCategoryEditor);
  $('#cancel-category-editor').addEventListener('click', closeCategoryEditor);
  $('#category-editor-modal').addEventListener('click', event => {
    if (event.target.matches('[data-close-category-editor]')) closeCategoryEditor();
  });

  $('#product-price').addEventListener('input', updatePriceRangeLabel);
  $('#product-sale-price').addEventListener('input', updatePriceRangeLabel);
  $('#admin-search').addEventListener('input', render);
  $('#admin-status').addEventListener('change', render);

  $('#new-product').addEventListener('click', () => {
    resetForm();
    $('#product-editor').scrollIntoView({ behavior:'smooth', block:'start' });
  });

  $('#reset-form').addEventListener('click', resetForm);
  $('#cancel-edit').addEventListener('click', resetForm);

  $('#admin-refresh').addEventListener('click', async () => {
    try {
      await loadSharedCategories();
      await loadSharedCatalog();
      loadMostSoldManager();
    } catch (error) {
      console.error('Admin refresh error:', error);
      alert('Unable to refresh the shared catalog.');
    }
  });

  $('#export-catalog').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type:'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gifty-hamper-catalog.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  fillOccasions();
  renderCategoryManager();
  renderMostSoldManager();
  renderCategoryEditorPreview();
  resetForm();
  updatePriceRangeLabel();

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
      const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
      const role = user.uid && profile?.role ? profile.role : 'admin';
      const expiresAt = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
      const ownExpired = profile?.active === false || (expiresAt && expiresAt.getTime() <= Date.now());

      if (!['admin', 'owner', 'super_admin'].includes(role)) {
        alert('Your account does not have catalog access.');
        return;
      }

      // Do not start catalog reads for an expired/inactive account.
      // admin-feature-guard.js will replace the page with the correct access message.
      if (role !== 'super_admin' && ownExpired) return;

      if (role === 'admin') {
        const ownerSnapshot = profile?.ownerUid
          ? await getDoc(doc(db, 'users', profile.ownerUid))
          : null;
        const owner = ownerSnapshot?.exists() ? ownerSnapshot.data() : null;
        const ownerExpiry = owner?.expiresAt?.toDate ? owner.expiresAt.toDate() : null;
        const ownerExpired = !owner
          || owner.role !== 'owner'
          || owner.active === false
          || (ownerExpiry && ownerExpiry.getTime() <= Date.now());

        if (ownerExpired) return;
      }

      await loadSharedCategories();
      await loadSharedCatalog();
      loadMostSoldManager();
    } catch (error) {
      console.error('Shared catalog initialization error:', error);
      alert('Unable to load the shared product catalog. Please check Firestore rules.');
    }
  });
});
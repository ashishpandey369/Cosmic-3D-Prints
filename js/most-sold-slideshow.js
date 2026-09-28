import { loadPublicCatalog } from "./catalog-store.js";

const INTERVAL_MS = 1500;
let timer = null;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));

function productImage(product) {
  return product?.images?.[0] || product?.image || "";
}

function render(target, products, index) {
  const current = products[index];
  if (!current) {
    target.innerHTML = '<img src="assets/gifty-hampers.png" alt="Gifty Hamper" loading="eager">';
    return;
  }

  const image = productImage(current);
  const dots = products.map((_, dotIndex) =>
    '<button type="button" class="most-sold-dot' + (dotIndex === index ? ' active' : '') +
    '" data-most-sold-index="' + dotIndex + '" aria-label="Show slide ' + (dotIndex + 1) + '"></button>'
  ).join("");

  target.innerHTML =
    '<div class="most-sold-slideshow-frame">' +
      '<a class="most-sold-slide-link" href="shop.html?collection=most-sold" aria-label="View Most Sold products">' +
        (image
          ? '<img class="most-sold-slide-image" src="' + escapeHtml(image) + '" alt="' + escapeHtml(current.name || "Most sold gift") + '" loading="eager">'
          : '<div class="most-sold-slide-placeholder">🎁</div>') +
        '<div class="most-sold-slide-title">' + escapeHtml(current.name || "Most sold gift") + '</div>' +
      '</a>' +
      '<div class="most-sold-dots" aria-label="Most sold slideshow navigation">' + dots + '</div>' +
    '</div>';
}

async function init() {
  const target = document.querySelector("#most-sold-slideshow");
  if (!target) return;

  let products = [];
  try {
    products = (await loadPublicCatalog()).filter(product => product.mostSold === true);
  } catch (error) {
    console.error("Most sold slideshow load error:", error);
  }

  if (!products.length) {
    target.innerHTML = '<img src="assets/gifty-hampers.png" alt="Gifty Hamper" loading="eager">';
    return;
  }

  let index = Math.floor(Math.random() * products.length);

  const show = nextIndex => {
    index = (nextIndex + products.length) % products.length;
    render(target, products, index);
  };

  const randomNext = () => {
    if (products.length < 2) return;
    let next = Math.floor(Math.random() * products.length);
    while (next === index) next = Math.floor(Math.random() * products.length);
    show(next);
  };

  render(target, products, index);

  target.addEventListener("click", event => {
    const nextButton = event.target.closest("[data-most-sold-next]");
    const prevButton = event.target.closest("[data-most-sold-prev]");
    const dot = event.target.closest("[data-most-sold-index]");

    if (nextButton) {
      event.preventDefault();
      event.stopPropagation();
      randomNext();
      resetTimer();
    } else if (prevButton) {
      event.preventDefault();
      event.stopPropagation();
      show(index - 1);
      resetTimer();
    } else if (dot) {
      event.preventDefault();
      event.stopPropagation();
      show(Number(dot.dataset.mostSoldIndex) || 0);
      resetTimer();
    }
  });

  function resetTimer() {
    window.clearInterval(timer);
    timer = window.setInterval(randomNext, INTERVAL_MS);
  }

  resetTimer();
}

document.addEventListener("DOMContentLoaded", init);

(function () {
  'use strict';
  const user = (() => { try { return JSON.parse(localStorage.getItem('serveo_user') || 'null'); } catch { return null; } })();
  const userKey = String(user?.id || user?.username || 'guest');
  const storageKey = `serveo_category_badges_${userKey}`;
  const categories = Object.entries(typeof CATEGORIES !== 'undefined' ? CATEGORIES : {});
  const grid = document.getElementById('badge-grid');
  const userLabel = document.getElementById('badge-shop-user');

  document.getElementById('navbar-root').innerHTML = getNavbarHTML('badges');
  document.getElementById('footer-root').innerHTML = getFooterHTML();
  if (userLabel) userLabel.textContent = user ? `Signed in as ${user.name || user.username}${user.isAdmin ? ' · Organizer' : ''}` : 'Browsing as guest · Sign in to save demo badges';

  function readOwned() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  let owned = readOwned();

  if (grid) {
    grid.innerHTML = categories.map(([id, category], index) => {
      const price = 49 + index * 10;
      const isOwned = owned.includes(id);
      return `<article class="badge-product" style="--product-color:${category.color}">
        <div class="badge-product-preview" aria-label="Animated ${category.label} badge preview" role="img">${category.icon}</div>
        <h2>${category.label}</h2>
        <p>Interactive ${category.label.toLowerCase()} category icon for event cards and organizer highlights.</p>
        <div class="badge-product-actions"><span class="badge-product-price">₹${price} <small>demo</small></span>
          <button class="badge-buy" type="button" data-category="${id}" aria-pressed="${isOwned}" ${isOwned ? 'disabled' : ''}>${isOwned ? '✓ Owned' : 'Buy demo badge'}</button></div>
      </article>`;
    }).join('');

    grid.addEventListener('click', event => {
      const button = event.target.closest('.badge-buy');
      if (!button) return;
      if (!user) {
        showToast('Sign in or create an organizer demo account to save badges.', 'info');
        return;
      }
      const category = button.dataset.category;
      if (!owned.includes(category)) owned.push(category);
      try { localStorage.setItem(storageKey, JSON.stringify(owned)); }
      catch { showToast('Could not save this demo badge in this browser.', 'info'); return; }
      button.disabled = true;
      button.setAttribute('aria-pressed', 'true');
      button.textContent = '✓ Owned';
      showToast('Demo badge added to your badge collection. No payment was processed.');
    });
  }
})();

/* Ornis 2.0 cart: add to bag, cart drawer and line item updates via Shopify's Ajax Cart and Section Rendering APIs. */
(() => {
  const { facts } = window.Ornis;

  const sectionIdsFor = (extra) => {
    const ids = ['cart-drawer', 'cart-count'];
    if (extra && !ids.includes(extra)) ids.push(extra);
    return ids;
  };

  function renderSections(sections) {
    if (!sections) return;
    Object.entries(sections).forEach(([id, html]) => {
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      document.querySelectorAll(`[data-cart-section="${id}"]`).forEach((target) => {
        const fresh = doc.querySelector(`[data-cart-section="${id}"]`);
        if (fresh) target.replaceWith(document.importNode(fresh, true));
      });
    });
  }

  function openCartDrawer(opener) {
    const dialog = document.getElementById('CartDrawer');
    if (dialog) window.Ornis.openDialog(dialog, opener);
    return Boolean(dialog);
  }

  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.onSubmit = (event) => this.submit(event);
      this.form?.addEventListener('submit', this.onSubmit);
    }
    disconnectedCallback() { this.form?.removeEventListener('submit', this.onSubmit); }

    async submit(event) {
      event.preventDefault();
      const button = event.submitter || this.form.querySelector('[type="submit"]');
      if (!button || button.getAttribute('aria-disabled') === 'true' || button.classList.contains('is-loading')) return;
      // Idempotency: one request at a time, so a double tap never adds twice.
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-loading');
      this.setError('');

      const body = button.name ? new FormData(this.form, button) : new FormData(this.form);
      body.append('sections', sectionIdsFor().join(','));
      body.append('sections_url', window.location.pathname);

      try {
        const response = await fetch(facts.routes.cartAdd, {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body,
        });
        const data = await response.json();
        if (!response.ok || data.status) {
          this.setError(data.description || data.message || facts.strings.error);
          return;
        }
        renderSections(data.sections);
        window.Ornis.announce(facts.strings.addedToBag);
        const dialog = this.closest('dialog');
        if (dialog) window.Ornis.closeDialog(dialog);
        if (!openCartDrawer(button)) window.location.href = facts.routes.root + 'cart';
      } catch (error) {
        this.setError(facts.strings.error);
      } finally {
        button.classList.remove('is-loading');
        if (!button.dataset.soldOut) button.removeAttribute('aria-disabled');
      }
    }

    setError(message) {
      const box = this.querySelector('[data-form-error-message]');
      if (!box) return;
      box.textContent = message;
      box.hidden = !message;
    }
  }
  customElements.define('product-form', ProductForm);

  class CartItems extends HTMLElement {
    connectedCallback() {
      this.onClick = (event) => {
        const button = event.target.closest('[data-qty-change], [data-remove]');
        if (!button) return;
        event.preventDefault();
        const line = Number(button.dataset.line);
        const input = this.querySelector(`input[data-line="${line}"]`);
        let quantity = 0;
        if (button.dataset.qtyChange) quantity = Math.max(0, Number(input.value) + Number(button.dataset.qtyChange));
        this.update(line, quantity);
      };
      this.onChange = (event) => {
        const input = event.target.closest('input[data-line]');
        if (!input) return;
        this.update(Number(input.dataset.line), Math.max(0, Number(input.value) || 0));
      };
      this.addEventListener('click', this.onClick);
      this.addEventListener('change', this.onChange);
    }

    async update(line, quantity) {
      if (this.busy) return;
      this.busy = true;
      this.setAttribute('aria-busy', 'true');
      const ownSection = this.dataset.sectionId;
      try {
        const response = await fetch(facts.routes.cartChange, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ line, quantity, sections: sectionIdsFor(ownSection), sections_url: window.location.pathname }),
        });
        const data = await response.json();
        if (!response.ok || data.status) throw new Error(data.description || facts.strings.error);
        const focusedLine = document.activeElement?.dataset?.line;
        renderSections(data.sections);
        window.Ornis.announce(facts.strings.bagUpdated);
        // Keep focus somewhere sensible after the section is replaced.
        const restore = document.querySelector(`[data-cart-section="${ownSection}"] input[data-line="${focusedLine}"]`)
          || document.querySelector(`[data-cart-section="${ownSection}"] [data-cart-focus]`);
        restore?.focus();
      } catch (error) {
        const box = this.querySelector('[data-cart-error]');
        if (box) { box.textContent = error.message || facts.strings.error; box.hidden = false; }
      } finally {
        this.busy = false;
        this.removeAttribute('aria-busy');
      }
    }
  }
  customElements.define('cart-items', CartItems);

  /* Cart note saves quietly after typing stops. */
  document.addEventListener('input', (event) => {
    const note = event.target.closest('[data-cart-note]');
    if (!note) return;
    window.clearTimeout(note._timer);
    note._timer = window.setTimeout(() => {
      fetch(facts.routes.cart.replace('.js', '/update.js'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.value }),
      });
    }, 400);
  });
})();

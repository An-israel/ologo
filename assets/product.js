/* Ornis 2.0 product page: variant picker, gallery, sticky add to bag, recently viewed. */
(() => {
  const { facts } = window.Ornis;

  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.data = JSON.parse(this.querySelector('script[type="application/json"]').textContent);
      this.section = this.closest('[data-product-section]');
      this.onChange = () => this.update();
      this.addEventListener('change', this.onChange);
      this.refreshAvailability();
    }
    disconnectedCallback() { this.removeEventListener('change', this.onChange); }

    selectedOptions() {
      return [...this.querySelectorAll('fieldset')].map((fieldset) => fieldset.querySelector('input:checked')?.value);
    }

    update() {
      const selected = this.selectedOptions();
      const variant = this.data.variants.find((v) => v.options.every((value, i) => value === selected[i]));
      this.refreshAvailability();
      this.querySelectorAll('[data-selected-value]').forEach((el, i) => { el.textContent = selected[i] || ''; });

      const button = this.section.querySelector('[data-add-to-bag]');
      const idInputs = this.section.querySelectorAll('input[name="id"]');
      if (!variant) {
        this.setButton(button, false, facts.strings.unavailable);
        return;
      }
      idInputs.forEach((input) => { input.value = variant.id; });
      this.setButton(button, variant.available, variant.available ? facts.strings.addToBag : facts.strings.soldOut);

      const extra = this.data.extras[variant.id] || {};
      const template = document.getElementById(`PriceTemplate-${variant.id}`);
      this.section.querySelectorAll('[data-price-wrapper]').forEach((el) => {
        if (template) el.replaceChildren(template.content.cloneNode(true));
      });
      const sku = this.section.querySelector('[data-sku]');
      if (sku) sku.textContent = extra.sku || '';
      const stock = this.section.querySelector('[data-low-stock]');
      if (stock) stock.hidden = !extra.low;

      if (variant.featured_media) this.section.querySelector('media-gallery')?.show(variant.featured_media.id);
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
      window.Ornis.announce(`${selected.join(', ')}. ${this.section.querySelector('[data-price]')?.textContent.trim().replace(/\s+/g, ' ') || ''}`);
    }

    setButton(button, enabled, label) {
      if (!button) return;
      button.querySelector('[data-label]').textContent = label;
      if (enabled) {
        button.removeAttribute('aria-disabled');
        delete button.dataset.soldOut;
      } else {
        button.setAttribute('aria-disabled', 'true');
        button.dataset.soldOut = 'true';
      }
      const sticky = document.querySelector('[data-sticky-add] [data-label]');
      if (sticky) sticky.textContent = label;
    }

    /* Mark sizes that are sold out for the chosen colour as crossed out but still readable. */
    refreshAvailability() {
      const selected = this.selectedOptions();
      [...this.querySelectorAll('fieldset')].forEach((fieldset, position) => {
        fieldset.querySelectorAll('input').forEach((input) => {
          // A value is available when some in-stock variant has it and matches every option chosen before it (Colour, then Size).
          const available = this.data.variants.some((v) => v.available
            && v.options[position] === input.value
            && v.options.slice(0, position).every((value, i) => value === selected[i]));
          const label = input.nextElementSibling;
          label.classList.toggle('is-unavailable', !available);
          const hint = label.querySelector('[data-unavailable-hint]');
          if (hint) hint.hidden = available;
        });
      });
    }
  }
  customElements.define('variant-picker', VariantPicker);

  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-track]');
      this.slides = [...this.querySelectorAll('[data-media-id]')];
      this.counter = this.querySelector('[data-counter-current]');
      this.dots = [...this.querySelectorAll('[data-dot]')];
      this.thumbs = [...this.querySelectorAll('[data-thumb]')];
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) this.setActive(this.slides.indexOf(entry.target));
        });
      }, { root: this.track, threshold: [0.6] });
      this.slides.forEach((slide) => this.observer.observe(slide));
      this.onClick = (event) => {
        const control = event.target.closest('[data-dot], [data-thumb]');
        if (control) this.show(control.dataset.target);
        const zoom = event.target.closest('[data-zoom]');
        if (zoom) this.zoom(zoom);
      };
      this.addEventListener('click', this.onClick);
    }
    disconnectedCallback() { this.observer?.disconnect(); this.removeEventListener('click', this.onClick); }

    setActive(index) {
      if (index < 0) return;
      if (this.counter) this.counter.textContent = String(index + 1);
      this.dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
      this.thumbs.forEach((thumb, i) => thumb.setAttribute('aria-current', String(i === index)));
    }

    show(mediaId) {
      const slide = this.slides.find((s) => s.dataset.mediaId === String(mediaId));
      if (!slide) return;
      const behavior = window.Ornis.reducedMotion.matches ? 'auto' : 'smooth';
      this.track.scrollTo({ left: slide.offsetLeft - this.track.offsetLeft, top: slide.offsetTop - this.track.offsetTop, behavior });
      this.setActive(this.slides.indexOf(slide));
    }

    zoom(trigger) {
      const dialog = document.getElementById('ProductZoom');
      if (!dialog) return;
      const img = dialog.querySelector('img');
      img.src = trigger.dataset.zoom;
      img.alt = trigger.querySelector('img')?.alt || '';
      window.Ornis.openDialog(dialog, trigger);
    }
  }
  customElements.define('media-gallery', MediaGallery);

  /* Sticky add-to-bag bar on mobile once the main button scrolls away. */
  class StickyAdd extends HTMLElement {
    connectedCallback() {
      const main = document.querySelector('[data-add-to-bag]');
      if (!main) return;
      this.observer = new IntersectionObserver(([entry]) => {
        const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        this.hidden = !passed;
      });
      this.observer.observe(main);
      this.querySelector('button')?.addEventListener('click', () => {
        main.scrollIntoView({ block: 'center', behavior: window.Ornis.reducedMotion.matches ? 'auto' : 'smooth' });
        if (main.getAttribute('aria-disabled') !== 'true') main.click();
        else main.focus();
      });
    }
    disconnectedCallback() { this.observer?.disconnect(); }
  }
  customElements.define('sticky-add', StickyAdd);

  /* Recently viewed: handles stored per visitor, cards rendered by Shopify via the Section Rendering API. */
  class RecentlyViewed extends HTMLElement {
    async connectedCallback() {
      const key = 'ornis:recent';
      const current = this.dataset.handle;
      let handles = [];
      try { handles = JSON.parse(window.localStorage.getItem(key) || '[]'); } catch (e) { handles = []; }
      const toShow = handles.filter((h) => h !== current).slice(0, 4);
      try { window.localStorage.setItem(key, JSON.stringify([current, ...handles.filter((h) => h !== current)].slice(0, 12))); } catch (e) { /* storage blocked */ }
      if (!toShow.length) return;
      const list = this.querySelector('[data-list]');
      const cards = await Promise.all(toShow.map(async (handle) => {
        try {
          const doc = await window.Ornis.fetchDocument(`${facts.routes.root}products/${encodeURIComponent(handle)}?section_id=card-fragment`);
          return doc.querySelector('li');
        } catch (e) { return null; }
      }));
      cards.filter(Boolean).forEach((card) => list.append(document.importNode(card, true)));
      if (list.children.length) this.hidden = false;
    }
  }
  customElements.define('recently-viewed', RecentlyViewed);

  /* "You may also like": Shopify's own recommendations, fetched after the page loads. */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      this.observer = new IntersectionObserver(async ([entry]) => {
        if (!entry.isIntersecting) return;
        this.observer.disconnect();
        try {
          const doc = await window.Ornis.fetchDocument(this.dataset.url);
          const fresh = doc.querySelector('product-recommendations [data-list]');
          if (fresh && fresh.children.length) {
            this.querySelector('[data-list]').replaceWith(document.importNode(fresh, true));
            this.hidden = false;
          }
        } catch (e) { /* recommendations are optional */ }
      }, { rootMargin: '0px 0px 400px 0px' });
      this.observer.observe(this);
    }
    disconnectedCallback() { this.observer?.disconnect(); }
  }
  customElements.define('product-recommendations', ProductRecommendations);
})();

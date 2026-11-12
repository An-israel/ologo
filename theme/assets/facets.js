/* Ornis 2.0 collection and search filtering, sorting and "Load more". */
(() => {
  const { facts } = window.Ornis;

  class FacetForm extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.onChange = (event) => {
        if (event.target.closest('form[data-facet-form]')) this.apply(event.target.closest('form'));
      };
      this.onSubmit = (event) => {
        const form = event.target.closest('form[data-facet-form]');
        if (!form) return;
        event.preventDefault();
        this.apply(form);
      };
      this.onClick = (event) => {
        const link = event.target.closest('[data-facet-link]');
        if (!link) return;
        event.preventDefault();
        this.load(new URL(link.href, window.location.origin).search);
      };
      this.onPop = () => this.load(window.location.search, false);
      document.addEventListener('change', this.onChange);
      document.addEventListener('submit', this.onSubmit);
      document.addEventListener('click', this.onClick);
      window.addEventListener('popstate', this.onPop);
    }
    disconnectedCallback() {
      document.removeEventListener('change', this.onChange);
      document.removeEventListener('submit', this.onSubmit);
      document.removeEventListener('click', this.onClick);
      window.removeEventListener('popstate', this.onPop);
    }

    apply(form) {
      const params = new URLSearchParams();
      // Merge every facet form on the page (desktop sidebar, mobile drawer, sort) so they never disagree.
      new FormData(form).forEach((value, key) => { if (value !== '') params.append(key, value); });
      const q = new URLSearchParams(window.location.search).get('q');
      if (q && !params.has('q')) params.set('q', q);
      this.load(`?${params.toString()}`);
    }

    async load(search, push = true) {
      const url = `${window.location.pathname}${search}`;
      const sep = search.includes('?') && search.length > 1 ? '&' : '?';
      this.setAttribute('aria-busy', 'true');
      try {
        const doc = await window.Ornis.fetchDocument(`${window.location.pathname}${search}${sep}section_id=${this.sectionId}`);
        ['[data-results]', '[data-facets-desktop]', '[data-facets-drawer-body]', '[data-active-filters]', '[data-results-count]', '[data-sort]']
          .forEach((selector) => window.Ornis.replaceFrom(doc, selector));
        if (push) window.history.pushState({}, '', url);
        const count = doc.querySelector('[data-results-count]')?.textContent.trim();
        if (count) window.Ornis.announce(count);
        sessionStorage.removeItem(`ornis:more:${window.location.pathname}`);
      } catch (error) {
        window.location.href = url;
      } finally {
        this.removeAttribute('aria-busy');
      }
    }
  }
  customElements.define('facet-form', FacetForm);

  /* Load more keeps a real ?page=N link (works without JS) and remembers the loaded list for the back button. */
  class LoadMore extends HTMLElement {
    connectedCallback() {
      this.storeKey = `ornis:more:${window.location.pathname}`;
      this.restore();
      this.onClick = (event) => {
        const link = event.target.closest('a[data-next]');
        if (!link) return;
        event.preventDefault();
        this.next(link);
      };
      this.addEventListener('click', this.onClick);
      this.onHide = () => this.save();
      window.addEventListener('pagehide', this.onHide);
    }
    disconnectedCallback() { window.removeEventListener('pagehide', this.onHide); }

    get list() { return document.querySelector('[data-product-list]'); }

    async next(link) {
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('is-loading');
      try {
        const sectionId = this.dataset.sectionId;
        const href = new URL(link.href, window.location.origin);
        href.searchParams.set('section_id', sectionId);
        const doc = await window.Ornis.fetchDocument(href.toString());
        const items = [...doc.querySelectorAll('[data-product-list] > li')];
        const firstNew = items[0];
        items.forEach((item) => this.list.append(document.importNode(item, true)));
        window.Ornis.replaceFrom(doc, 'load-more [data-load-more-inner]', document);
        const pageUrl = new URL(link.href, window.location.origin);
        window.history.replaceState({}, '', pageUrl.pathname + pageUrl.search);
        window.Ornis.announce(doc.querySelector('[data-load-more-status]')?.textContent.trim() || '');
        // Move focus to the first new product so keyboard users continue from there.
        const focusTarget = firstNew && this.list.querySelector(`[data-product-id="${firstNew.dataset.productId}"] a`);
        focusTarget?.focus();
      } catch (error) {
        window.location.href = link.href;
      }
    }

    save() {
      const page = new URLSearchParams(window.location.search).get('page');
      if (!page || page === '1' || !this.list) return;
      try {
        sessionStorage.setItem(this.storeKey, JSON.stringify({ search: window.location.search, html: this.list.innerHTML, more: this.querySelector('[data-load-more-inner]')?.outerHTML || '', y: window.scrollY }));
      } catch (e) { /* storage full or blocked */ }
    }

    restore() {
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(this.storeKey) || 'null'); } catch (e) { saved = null; }
      if (!saved || saved.search !== window.location.search || !this.list) return;
      // The saved HTML was rendered by this store's own theme in this tab, so it is trusted markup.
      const doc = new DOMParser().parseFromString(`<ul>${saved.html}</ul>${saved.more}`, 'text/html');
      this.list.replaceChildren(...[...doc.querySelector('ul').children].map((li) => document.importNode(li, true)));
      const more = doc.querySelector('[data-load-more-inner]');
      const current = this.querySelector('[data-load-more-inner]');
      if (more && current) current.replaceWith(document.importNode(more, true));
      window.requestAnimationFrame(() => window.scrollTo(0, saved.y));
    }
  }
  customElements.define('load-more', LoadMore);
})();

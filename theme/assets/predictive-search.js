/* Ornis 2.0 predictive search: Shopify's native /search/suggest, ARIA combobox with arrow-key navigation. */
(() => {
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-predictive-results]');
      this.status = this.querySelector('[data-predictive-status]');
      this.cache = new Map();
      this.onInput = () => {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.search(this.input.value.trim()), 200);
      };
      this.onKey = (event) => this.keydown(event);
      this.input.addEventListener('input', this.onInput);
      this.input.addEventListener('keydown', this.onKey);
    }
    disconnectedCallback() {
      window.clearTimeout(this.timer);
      this.abort?.abort();
    }

    async search(term) {
      if (term.length < 2) { this.close(); return; }
      if (this.cache.has(term)) { this.render(this.cache.get(term)); return; }
      this.abort?.abort();
      this.abort = new AbortController();
      const root = window.Ornis.facts.routes.predictiveSearch;
      const params = new URLSearchParams({
        q: term,
        'resources[type]': 'product,collection,page',
        'resources[limit]': '6',
        'resources[options][fields]': 'title,product_type,variants.title,tag',
        section_id: 'predictive-search',
      });
      try {
        const doc = await window.Ornis.fetchDocument(`${root}?${params}`, { signal: this.abort.signal });
        const fragment = doc.querySelector('[data-predictive-fragment]');
        this.cache.set(term, fragment);
        this.render(fragment);
      } catch (error) {
        if (error.name !== 'AbortError') this.close();
      }
    }

    render(fragment) {
      if (!fragment) { this.close(); return; }
      this.results.replaceChildren(document.importNode(fragment, true));
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
      this.input.removeAttribute('aria-activedescendant');
      const count = this.results.querySelectorAll('[role="option"]').length;
      this.status.textContent = this.results.querySelector('[data-predictive-count]')?.textContent.trim() || String(count);
    }

    close() {
      this.results.hidden = true;
      this.results.replaceChildren();
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
    }

    keydown(event) {
      const options = [...this.results.querySelectorAll('[role="option"]')];
      if (event.key === 'Escape' && !this.results.hidden) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }
      if (!options.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
      const currentId = this.input.getAttribute('aria-activedescendant');
      let index = options.findIndex((o) => o.id === currentId);
      if (event.key === 'Enter') {
        if (index >= 0) { event.preventDefault(); options[index].querySelector('a')?.click(); }
        return;
      }
      event.preventDefault();
      index = event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
      options.forEach((o, i) => o.setAttribute('aria-selected', String(i === index)));
      this.input.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    }
  }
  customElements.define('predictive-search', PredictiveSearch);
})();

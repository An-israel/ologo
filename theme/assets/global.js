/* Ornis 2.0 global behaviour. Vanilla custom elements, no dependencies. */
(() => {
  const factsEl = document.getElementById('ShopFacts');
  const facts = factsEl ? JSON.parse(factsEl.textContent) : { routes: {}, strings: {} };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const Ornis = {
    facts,
    reducedMotion,
    announce(message) {
      const region = document.getElementById('LiveRegion');
      if (!region) return;
      region.textContent = '';
      window.setTimeout(() => { region.textContent = message; }, 50);
    },
    /** Fetch HTML and return a parsed Document. Section HTML is rendered and escaped by Liquid on Shopify's servers. */
    async fetchDocument(url, options = {}) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { ...options, signal: options.signal || controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return new DOMParser().parseFromString(await response.text(), 'text/html');
      } finally {
        window.clearTimeout(timer);
      }
    },
    replaceFrom(doc, selector, root = document) {
      const fresh = doc.querySelector(selector);
      const current = root.querySelector(selector);
      if (fresh && current) current.replaceWith(document.importNode(fresh, true));
    },
    openDialog(dialog, opener) {
      if (!dialog || dialog.open) return;
      dialog._opener = opener || document.activeElement;
      dialog.showModal();
      document.body.classList.add('has-overlay');
      const focusTarget = dialog.querySelector('[autofocus]') || dialog.querySelector('[data-dialog-close]');
      if (focusTarget) focusTarget.focus();
    },
    closeDialog(dialog) {
      if (!dialog || !dialog.open) return;
      dialog.close();
    },
  };
  window.Ornis = Ornis;

  /* Dialogs: any [data-dialog-open="ID"] opens <dialog id="ID">; [data-dialog-close] closes the parent dialog. */
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-dialog-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.dialogOpen);
      if (dialog) {
        event.preventDefault();
        Ornis.openDialog(dialog, opener);
      }
      return;
    }
    const closer = event.target.closest('[data-dialog-close]');
    if (closer) {
      Ornis.closeDialog(closer.closest('dialog'));
      return;
    }
    // Click on the backdrop closes the dialog.
    if (event.target instanceof HTMLDialogElement && event.target.open) {
      const rect = event.target.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) Ornis.closeDialog(event.target);
    }
  });
  document.addEventListener('close', (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('has-overlay');
    if (dialog._opener && document.contains(dialog._opener)) dialog._opener.focus();
  }, true);

  /* Accordions: <button class="accordion__toggle" aria-expanded aria-controls> */
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.accordion__toggle, [data-disclosure]');
    if (!toggle) return;
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!panel) return;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });

  /* Announcement bar: one message at a time, never faster than 6 s, pauses on hover, focus or reduced motion. */
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.slides = [...this.querySelectorAll('[data-slide]')];
      this.index = 0;
      this.interval = Math.max(6, Number(this.dataset.interval || 6)) * 1000;
      this.pauseButton = this.querySelector('[data-pause]');
      this.userPaused = false;
      this.onPrev = () => this.go(-1);
      this.onNext = () => this.go(1);
      this.onPause = () => { this.userPaused = !this.userPaused; this.updatePauseLabel(); this.schedule(); };
      this.onEnter = () => this.stop();
      this.onLeave = () => this.schedule();
      this.querySelector('[data-prev]')?.addEventListener('click', this.onPrev);
      this.querySelector('[data-next]')?.addEventListener('click', this.onNext);
      this.pauseButton?.addEventListener('click', this.onPause);
      this.addEventListener('mouseenter', this.onEnter);
      this.addEventListener('mouseleave', this.onLeave);
      this.addEventListener('focusin', this.onEnter);
      this.addEventListener('focusout', this.onLeave);
      this.schedule();
    }
    disconnectedCallback() {
      this.stop();
      this.removeEventListener('mouseenter', this.onEnter);
      this.removeEventListener('mouseleave', this.onLeave);
      this.removeEventListener('focusin', this.onEnter);
      this.removeEventListener('focusout', this.onLeave);
    }
    updatePauseLabel() {
      if (!this.pauseButton) return;
      this.pauseButton.setAttribute('aria-pressed', String(this.userPaused));
      this.pauseButton.querySelector('[data-label-pause]').hidden = this.userPaused;
      this.pauseButton.querySelector('[data-label-play]').hidden = !this.userPaused;
    }
    go(step) {
      if (this.slides.length < 2) return;
      this.slides[this.index].hidden = true;
      this.index = (this.index + step + this.slides.length) % this.slides.length;
      this.slides[this.index].hidden = false;
    }
    stop() { window.clearInterval(this.timer); }
    schedule() {
      this.stop();
      if (this.slides.length < 2 || this.userPaused || reducedMotion.matches) return;
      this.timer = window.setInterval(() => this.go(1), this.interval);
    }
  }
  customElements.define('announcement-bar', AnnouncementBar);

  /* Sticky header: visible on scroll up, hidden on scroll down. */
  class StickyHeader extends HTMLElement {
    connectedCallback() {
      this.lastY = window.scrollY;
      this.onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          const hide = y > this.lastY && y > 200 && !this.contains(document.activeElement) && !document.querySelector('.mega-menu [aria-expanded="true"]');
          this.classList.toggle('is-hidden', hide);
          this.lastY = y;
          this.ticking = false;
        });
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
    disconnectedCallback() { window.removeEventListener('scroll', this.onScroll); }
  }
  customElements.define('sticky-header', StickyHeader);

  /* Desktop mega menu: buttons with aria-expanded, Escape closes, click outside closes. */
  class MegaMenu extends HTMLElement {
    connectedCallback() {
      this.onClick = (event) => {
        const button = event.target.closest('[data-mega-toggle]');
        if (!button) return;
        const open = button.getAttribute('aria-expanded') === 'true';
        this.closeAll();
        if (!open) {
          button.setAttribute('aria-expanded', 'true');
          document.getElementById(button.getAttribute('aria-controls')).hidden = false;
        }
      };
      this.onKey = (event) => {
        if (event.key !== 'Escape') return;
        const openButton = this.querySelector('[data-mega-toggle][aria-expanded="true"]');
        if (openButton) { this.closeAll(); openButton.focus(); }
      };
      this.onDocClick = (event) => { if (!this.contains(event.target)) this.closeAll(); };
      this.addEventListener('click', this.onClick);
      this.addEventListener('keydown', this.onKey);
      document.addEventListener('click', this.onDocClick);
    }
    disconnectedCallback() { document.removeEventListener('click', this.onDocClick); }
    closeAll() {
      this.querySelectorAll('[data-mega-toggle][aria-expanded="true"]').forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        document.getElementById(button.getAttribute('aria-controls')).hidden = true;
      });
    }
  }
  customElements.define('mega-menu', MegaMenu);

  /* Newsletter offer: after 30 s or 50% scroll, once per visitor, closes with Escape (native dialog). */
  class NewsletterPopup extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('dialog');
      const key = 'ornis:newsletter-seen';
      try { if (window.localStorage.getItem(key) || this.dialog.querySelector('.form-message')) return; } catch (e) { return; }
      const show = () => {
        cleanup();
        if (document.querySelector('dialog[open]')) return;
        try { window.localStorage.setItem(key, '1'); } catch (e) { /* storage blocked */ }
        Ornis.openDialog(this.dialog, document.activeElement);
      };
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max >= 0.5) show();
      };
      const timer = window.setTimeout(show, 30000);
      const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
      this.cleanup = cleanup;
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    disconnectedCallback() { this.cleanup?.(); }
  }
  customElements.define('newsletter-popup', NewsletterPopup);

  /* "Cookie preferences" re-opens Shopify's own consent banner (Customer Privacy API). */
  window.addEventListener('load', () => {
    const button = document.querySelector('[data-cookie-preferences]');
    if (!button || !window.privacyBanner || typeof window.privacyBanner.showPreferences !== 'function') return;
    button.hidden = false;
    button.addEventListener('click', () => window.privacyBanner.showPreferences());
  });

  /* Forms: move focus to the first error so screen readers hear it. */
  window.addEventListener('DOMContentLoaded', () => {
    const error = document.querySelector('[data-form-error]');
    if (error) error.focus();
  });
})();

(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia('(max-width: 760px)').matches;

  const sections = document.querySelectorAll('.hero, .letter, .film, .star-game, .gifts, .wish, .night-note, .finale');
  let seed = 20261122;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const fields = [];
  sections.forEach((section, sectionIndex) => {
    const field = document.createElement('div');
    field.className = 'ambient-stars';
    field.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    const count = narrow ? 12 : 22;
    for (let index = 0; index < count; index += 1) {
      const star = document.createElement('span');
      star.className = 'ambient-stars__star';
      star.style.left = `${(4 + random() * 92).toFixed(2)}%`;
      star.style.top = `${(5 + random() * 90).toFixed(2)}%`;
      star.style.setProperty('--size', `${(1 + random() * (narrow ? 1.6 : 2.2)).toFixed(1)}px`);
      star.style.setProperty('--alpha', (0.16 + random() * (sectionIndex === 0 ? 0.5 : 0.27)).toFixed(2));
      star.style.setProperty('--duration', `${(2.8 + random() * 4.5).toFixed(2)}s`);
      star.style.setProperty('--delay', `${(-random() * 7).toFixed(2)}s`);
      fragment.appendChild(star);
    }
    field.appendChild(fragment);
    section.insertBefore(field, section.firstChild);
    fields.push(field);
  });

  if ('IntersectionObserver' in window) {
    const starObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.querySelector('.ambient-stars').classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { rootMargin: '100px 0px' });
    sections.forEach((section) => starObserver.observe(section));
  } else {
    fields.forEach((field) => field.classList.add('is-visible'));
  }

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const filmObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-illuminated');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.film').forEach((film) => filmObserver.observe(film));
  }

  const form = document.getElementById('nightNoteForm');
  const textarea = document.getElementById('nightNoteText');
  const count = document.getElementById('nightNoteCount');
  const sealed = document.getElementById('nightNoteSealed');
  const saved = document.getElementById('nightNoteSaved');
  const edit = document.getElementById('nightNoteEdit');
  const clear = document.getElementById('nightNoteClear');
  const section = document.getElementById('night-note');
  if (!form || !textarea || !count || !sealed || !saved || !edit || !clear || !section) return;

  const storageKey = 'birthday-night-note-v1';
  const updateCount = () => { count.textContent = `${textarea.value.length} / 120`; };
  const showNote = (value) => {
    saved.textContent = value;
    form.hidden = true;
    sealed.hidden = false;
  };

  textarea.addEventListener('input', updateCount);
  try {
    const previous = localStorage.getItem(storageKey);
    if (previous) {
      textarea.value = previous.slice(0, 120);
      showNote(textarea.value);
    }
  } catch (_) {
    // Writing the note still works when storage is unavailable.
  }
  updateCount();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = textarea.value.trim();
    if (!value) {
      textarea.focus();
      return;
    }
    textarea.value = value;
    updateCount();
    try { localStorage.setItem(storageKey, value); } catch (_) { /* Local display remains available. */ }
    showNote(value);
    if (!reducedMotion) {
      section.classList.remove('is-sealing');
      void section.offsetWidth;
      section.classList.add('is-sealing');
    }
  });

  edit.addEventListener('click', () => {
    sealed.hidden = true;
    form.hidden = false;
    section.classList.remove('is-sealing');
    textarea.focus();
  });

  clear.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); } catch (_) { /* The visible note can still be cleared. */ }
    textarea.value = '';
    saved.textContent = '';
    updateCount();
    sealed.hidden = true;
    form.hidden = false;
    section.classList.remove('is-sealing');
    textarea.focus();
  });
})();

(() => {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('main-menu');
  if (!toggle || !menu) return;
  const setExpanded = (value) => {
    toggle.setAttribute('aria-expanded', String(value));
    if (value) document.body.classList.add('nav-open');
    else document.body.classList.remove('nav-open');
  };
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setExpanded(!isOpen);
  });
  menu.addEventListener('click', (event) => {
    if (event.target.tagName === 'A') {
      setExpanded(false);
    }
  });
  const page = document.body.dataset.page;
  if (page) {
    menu.querySelectorAll('[data-page]').forEach((link) => {
      if (link.dataset.page === page) {
        link.classList.add('is-active');
      }
    });
  }
})();

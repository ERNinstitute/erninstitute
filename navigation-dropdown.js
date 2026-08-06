(function () {
  const nav = document.querySelector('#site-nav');
  if (!nav) return;

  const dropdowns = Array.from(nav.querySelectorAll('.nav-dropdown'));
  if (!dropdowns.length) return;

  const closeDropdowns = (except) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown !== except) dropdown.removeAttribute('open');
    });
  };

  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener('toggle', () => {
      if (dropdown.open) closeDropdowns(dropdown);
    });
    dropdown.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => dropdown.removeAttribute('open'));
    });
  });

  document.addEventListener('click', (event) => {
    if (!dropdowns.some((dropdown) => dropdown.contains(event.target))) {
      closeDropdowns();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDropdowns();
  });
})();

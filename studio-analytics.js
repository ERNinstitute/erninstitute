(() => {
  'use strict';

  // These deliberately coarse analytics events contain no research data,
  // effect sizes, CSV names, sample sizes, or dataset identifiers.
  function track(eventName) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, { event_category: 'ern_studio' });
  }

  const buttons = {
    'run-meta-analysis': 'studio_run_selected_clicked',
    'run-all-meta-analyses': 'studio_run_all_clicked',
    'download-workbook': 'studio_workbook_clicked',
    'download-workbook-results': 'studio_workbook_clicked',
    'download-results': 'studio_effect_csv_clicked',
    'download-meta-results': 'studio_model_csv_clicked',
    'download-pooled-forest': 'studio_forest_svg_clicked'
  };

  Object.entries(buttons).forEach(([id, eventName]) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => track(eventName));
  });

  window.addEventListener('ern:built-in-example-loaded', () => track('studio_demo_loaded'));
  window.addEventListener('ern:public-example-loaded', () => track('studio_public_data_loaded'));

  document.querySelectorAll('a[href="/repository.html"]').forEach((link) => {
    link.addEventListener('click', () => track('studio_repository_clicked'));
  });
  document.querySelectorAll('a[href="/tools/meta-analysis-studio/methods.html"]').forEach((link) => {
    link.addEventListener('click', () => track('studio_methods_clicked'));
  });
  document.querySelectorAll('a[href^="mailto:admin@erninstitute.com?subject=ERN%20Meta-Analysis"]').forEach((link) => {
    link.addEventListener('click', () => track('studio_feedback_clicked'));
  });
})();

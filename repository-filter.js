(() => {
  'use strict';

  const search = document.getElementById('repository-search');
  const topic = document.getElementById('repository-topic');
  const metric = document.getElementById('repository-metric');
  const reset = document.getElementById('repository-reset');
  const status = document.getElementById('repository-filter-status');
  const empty = document.getElementById('repository-empty');
  const cards = Array.from(document.querySelectorAll('#repository-dataset-grid .repository-dataset-card'));
  if (!search || !topic || !metric || !reset || !status || !empty || !cards.length) return;

  const matches = (values, selected) => selected === 'all' || values.split(/\s+/).includes(selected);

  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const card of cards) {
      const visible = (!query || card.textContent.toLocaleLowerCase().includes(query))
        && matches(card.dataset.topic || '', topic.value)
        && matches(card.dataset.metrics || '', metric.value);
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    status.textContent = `Showing ${shown} of ${cards.length} datasets`;
    empty.hidden = shown > 0;
    reset.hidden = !query && topic.value === 'all' && metric.value === 'all';
  }

  search.addEventListener('input', update);
  topic.addEventListener('change', update);
  metric.addEventListener('change', update);
  reset.addEventListener('click', () => {
    search.value = '';
    topic.value = 'all';
    metric.value = 'all';
    update();
    search.focus();
  });
  update();
})();

(() => {
  const modal = document.querySelector('#emailModal');
  const form = document.querySelector('#wallEmailForm');
  const email = document.querySelector('#wallEmailAddress');
  const submit = document.querySelector('#sendWallEmail');
  const message = document.querySelector('#wallEmailMessage');
  const heading = document.querySelector('#wallEmailTitle');
  const skip = document.querySelector('#skipWallEmail');
  let available = false;
  let photoId = '';
  const ready = fetch('/api/wall-email', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    .then(response => response.ok ? response.json() : { enabled: false })
    .then(config => { available = config.enabled === true; }).catch(() => {});
  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.querySelector('#uploadMain').focus({ preventScroll: true });
  }
  window.NarwhallEmail = {
    async show(id) {
      await ready;
      if (!available) return;
      photoId = id;
      form.reset(); form.hidden = false;
      email.disabled = false; submit.disabled = false;
      submit.textContent = 'Send me the link'; skip.textContent = 'No thanks';
      message.textContent = ''; message.hidden = true;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      heading.focus({ preventScroll: true });
    },
  };
  document.querySelector('#closeWallEmail').addEventListener('click', close);
  skip.addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled):not([tabindex="-1"])')].filter(el => !el.closest('[hidden]'));
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;
    submit.disabled = true; email.disabled = true;
    submit.textContent = 'Sending…'; message.hidden = true;
    try {
      const response = await fetch('/api/wall-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value.trim(), photoId, website: form.elements.website.value }),
        signal: AbortSignal.timeout(18000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send the link. Please try again.');
      form.hidden = true;
      message.textContent = 'Link sent! Check your inbox (and your spam folder).';
      skip.textContent = 'Back to the wall';
    } catch (error) {
      message.textContent = error.name === 'TimeoutError' ? 'Taking longer than expected. Try again, or return to the wall.' : error.message || 'Could not send the link. Please try again.';
      email.disabled = false; submit.disabled = false;
      submit.textContent = 'Send me the link';
    }
    message.hidden = false;
  });
})();

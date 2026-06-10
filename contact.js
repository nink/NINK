(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const statusEl = document.getElementById('contact-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(kind, message) {
    statusEl.hidden = false;
    statusEl.className = `waitlist-status ${kind}`;
    statusEl.textContent = message;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    statusEl.hidden = true;

    const payload = {
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim()
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Message failed to send. Please try again.');
      }

      setStatus('success', data.message || 'Thanks — your message was sent.');
      form.reset();
    } catch (err) {
      setStatus('error', err.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

(() => {
  const form = document.getElementById('waitlist-form');
  if (!form) return;

  const statusEl = document.getElementById('waitlist-status');
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
      email: form.email.value.trim()
    };

    try {
      const response = await fetch('/api/waitlist-register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      if (data.status === 'already_verified') {
        setStatus('success', `${data.message} You can go to dealcheck.nink.com directly.`);
        form.reset();
        return;
      }

      setStatus('success', data.message || 'Check your email for a confirmation link.');
      form.reset();
    } catch (err) {
      setStatus('error', err.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

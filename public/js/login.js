document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = '/chat.html';
      } else {
        errorDiv.textContent = data.error || 'Login failed';
        errorDiv.classList.remove('hidden');
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      errorDiv.classList.remove('hidden');
    }
  });
});
// Apply saved theme before first paint — prevents flash of wrong theme
(function () {
  if (localStorage.getItem('pnw-theme') === 'light') {
    document.documentElement.classList.add('light-theme');
  }
})();

function toggleTheme() {
  const light = document.documentElement.classList.toggle('light-theme');
  localStorage.setItem('pnw-theme', light ? 'light' : 'dark');
  _syncThemeBtn();
}

function _syncThemeBtn() {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const light = document.documentElement.classList.contains('light-theme');
  btn.textContent = light ? '🌙' : '☀️';
  btn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
}

document.addEventListener('DOMContentLoaded', _syncThemeBtn);

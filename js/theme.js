import { els, logoLightModeSrc, logoDarkModeSrc, historyBackgroundSrc, welcomeLogoSrc } from "./dom.js";

const toggleTheme = () => {
    const isDarkMode = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateLogoAndThemeButton(isDarkMode);
};


const updateLogoAndThemeButton = (isDarkMode) => {
    els.themeBtn.textContent = isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Noturno';
    els.appLogo.src = isDarkMode ? logoDarkModeSrc : logoLightModeSrc;
    els.welcomeLogo.src = welcomeLogoSrc;
    els.historyImg.src = historyBackgroundSrc;
};


export const initTheme = () => {
  if (els.themeBtn) els.themeBtn.onclick = () => toggleTheme();
  if (els.logoLink) els.logoLink.onclick = (e) => { e.preventDefault(); toggleTheme(); };
};

export { toggleTheme, updateLogoAndThemeButton };

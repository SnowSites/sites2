import { els } from "./dom.js";
import { initTheme, updateLogoAndThemeButton } from "./theme.js";
import { initUtils } from "./utils.js";
import { initTour } from "./tour.js";
import { initVendas } from "./vendas.js";
import { initDossier } from "./dossier.js";
import { initAdmin } from "./admin.js";
import { initOnlineAndLayout } from "./online.js";
import { initAuthHandlers, initAuthState } from "./auth.js";

// ===== Tema (aplicar preferência antes de tudo) =====
const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") document.body.classList.add("dark");
updateLogoAndThemeButton(savedTheme === "dark");

// ===== Tela de boas-vindas =====
const initWelcome = () => {
  if (!els.welcomeScreen) return;

  if (localStorage.getItem("hasVisited")) {
    els.welcomeScreen.style.display = "none";
  } else {
    els.welcomeScreen.classList.add("show");
    if (els.authScreen) els.authScreen.style.display = "none";
    if (els.mainCard) els.mainCard.style.display = "none";
  }

  if (els.enterBtn) {
    els.enterBtn.onclick = () => {
      localStorage.setItem("hasVisited", "true");
      els.welcomeScreen.classList.add("hidden");
      setTimeout(() => {
        els.welcomeScreen.style.display = "none";
      }, 500);
    };
  }
};

// ===== Boot =====
initTheme();
initUtils();
initTour();
initVendas();
initDossier();
initAdmin();
initOnlineAndLayout();
initAuthHandlers();
initAuthState();
initWelcome();

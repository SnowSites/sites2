import { els } from "./dom.js";

const clearTour = () => { if(tourOverlay) { tourOverlay.classList.remove('active'); setTimeout(() => { if (tourOverlay && tourOverlay.parentNode) tourOverlay.parentNode.removeChild(tourOverlay); tourOverlay = null; }, 300); } if (currentTooltip) { currentTooltip.classList.remove('active'); setTimeout(() => { if (currentTooltip && currentTooltip.parentNode) currentTooltip.parentNode.removeChild(currentTooltip); currentTooltip = null; }, 300); } document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight')); currentStepIndex = -1; };


const showNextTourStep = () => { if (currentStepIndex >= 0) { document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight')); if(currentTooltip) currentTooltip.classList.remove('active'); } currentStepIndex++; if (currentStepIndex >= tourSteps.length) { showToast("Tutorial concluído!", "success"); clearTour(); return; } const step = tourSteps[currentStepIndex]; const targetElement = els[step.element]; if (!targetElement) { clearTour(); return; } if (currentStepIndex === 0) { tourOverlay = document.createElement('div'); tourOverlay.id = 'tour-overlay'; document.body.appendChild(tourOverlay); setTimeout(() => tourOverlay.classList.add('active'), 10); } targetElement.classList.add('tour-highlight'); if(currentTooltip && currentTooltip.parentNode) document.body.removeChild(currentTooltip); currentTooltip = document.createElement('div'); currentTooltip.className = 'tour-tooltip'; currentTooltip.innerHTML = `<h4>${step.title}</h4><p>${step.content}</p><div><button class="tourNextBtn">${currentStepIndex === tourSteps.length - 1 ? 'Finalizar' : 'Próximo'}</button><button class="tourSkipBtn">Pular</button></div>`; document.body.appendChild(currentTooltip); const rect = targetElement.getBoundingClientRect(); let top = rect.top < currentTooltip.offsetHeight + 20 ? rect.bottom + window.scrollY + 10 : rect.top + window.scrollY - currentTooltip.offsetHeight - 10; let left = Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - currentTooltip.offsetWidth - 20)); currentTooltip.style.top = `${top}px`; currentTooltip.style.left = `${left}px`; setTimeout(() => currentTooltip.classList.add('active'), 10); currentTooltip.querySelector('.tourNextBtn').onclick = showNextTourStep; currentTooltip.querySelector('.tourSkipBtn').onclick = clearTour; targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); };


export const initTour = () => {
  if (els.tutorialBtn) els.tutorialBtn.onclick = () => {
    // começa do passo 0 (o script original usa variáveis internas; aqui mantemos compatibilidade)
    showNextTourStep(0);
  };
};
export { clearTour, showNextTourStep };

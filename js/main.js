import { auth, db, ref, get, onValue, query, orderByChild, equalTo, onAuthStateChanged } from "./firebase.js";
import { els } from "./dom.js";
import { state } from "./state.js";

import { initUtils } from "./utils.js";
import { showToast } from "./ui.js";
import { initOnlineAndLayout, updateUserActivity, monitorOnlineStatus } from "./online.js";
import { initTheme, updateLogoAndThemeButton } from "./theme.js";
import { initTour } from "./tour.js";
import { initDossier, migrateVendasToDossier, migrateVeiculosData } from "./dossier.js";
import { initVendas, toggleView, displaySalesHistory } from "./vendas.js";
import { initAdmin, loadAdminPanel } from "./admin.js";
import { initAuthHandlers, configurarInterfacePorTag } from "./auth.js";

// Expondo alguns helpers no window para compatibilidade entre módulos
window.__toggleView = toggleView;
window.__migrateVendasToDossier = migrateVendasToDossier;
window.__migrateVeiculosData = migrateVeiculosData;

initUtils();
initTheme();
initTour();
initVendas();
initDossier();
initAdmin();
initAuthHandlers();

// Auth state listener (trecho original, com estado centralizado)
onAuthStateChanged(auth, (user) => {
    if (user) {
        state.currentUser = user; 
        const userRef = ref(db, `usuarios/${user.uid}`);
        
        // INICIA O RASTREAMENTO DE ATIVIDADE
        updateUserActivity(); 
        monitorOnlineStatus(); // Inicia o monitoramento de status
        
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                state.currentUserData = snapshot.val(); 
            } else {
                const newUserProfile = {
                    displayName: user.displayName, 
                    email: user.email,
                    tag: 'Visitante' 
                };
                set(userRef, newUserProfile);
                state.currentUserData = newUserProfile; 
            }
            
            configurarInterfacePorTag(state.currentUserData.tag);
             
            if(state.vendasListener) state.vendasListener(); 
            
            let vendasRef;
            const userTagUpper = state.currentUserData.tag.toUpperCase();
            
            if (userTagUpper === 'ADMIN' || userTagUpper === 'HELLS') {
                vendasRef = ref(db, 'state.vendas');
            } else {
                vendasRef = query(ref(db, 'state.vendas'), orderByChild('registradoPorId'), equalTo(state.currentUser.uid));
            }

            state.vendasListener = onValue(vendasRef, (vendasSnapshot) => {
                state.vendas = [];
                vendasSnapshot.forEach((child) => {
                    state.vendas.push({ id: child.key, ...child.val() });
                });
                if (els.historyCard.style.display !== 'none') {
                    displaySalesHistory(state.vendas);
                }
            }, (error) => {
                console.error("Erro ao carregar state.vendas: ", error);
                if(error.code !== "PERMISSION_DENIED") {
                    showToast("Erro de permissão ao carregar histórico.", "error");
                }
            });
        }, (error) => {
            console.error("Erro ao ler dados do usuário:", error);
            showToast("Erro fatal ao ler permissões do usuário.", "error");
            configurarInterfacePorTag('Visitante'); 
        });

        els.authScreen.style.display = 'none';
        toggleView('main');

    } else {
        state.currentUser = null;
        state.currentUserData = null;
        state.vendaOriginalCliente = null; 
        state.vendaOriginalOrganizacao = null; 
        if (state.vendasListener) state.vendasListener(); 
        state.vendas = []; 
        
        els.authScreen.style.display = 'block';
        els.mainCard.style.display = 'none';
        els.historyCard.style.display = 'none';
        els.adminPanel.style.display = 'none'; 
        els.dossierCard.style.display = 'none';
        if(els.userStatus) els.userStatus.style.display = 'none';
        if(els.investigacaoBtn) els.investigacaoBtn.style.display = 'none';
    }
});

// --- Inicialização da UI ---
const savedTheme = localStorage.getItem('theme') || 'light';
if(savedTheme === 'dark') {
    document.body.classList.add('dark');
}
updateLogoAndThemeButton(savedTheme === 'dark');

if (localStorage.getItem('hasVisited')) {
    els.welcomeScreen.style.display = 'none';
} else {
    els.welcomeScreen.classList.add('show');
    els.authScreen.style.display = 'none';
    els.mainCard.style.display = 'none';
}

els.enterBtn.onclick = () => {
    localStorage.setItem('hasVisited', 'true');
    els.welcomeScreen.classList.add('hidden');
    setTimeout(() => {
        els.welcomeScreen.style.display = 'none';
    }, 500);
};



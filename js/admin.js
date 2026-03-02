import { db, ref, set, push, onValue, remove, get, query, orderByChild, equalTo, update } from "./firebase.js";
import { els } from "./dom.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";
import { formatInactivityTime } from "./utils.js";
import { monitorOnlineStatus } from "./online.js";

const saveHierarchyOrder = (orgName) => {
    const grid = els.dossierPeopleGrid;
    const children = Array.from(grid.children);
    
    if (children.length === 0 || !children[0].classList.contains('dossier-entry-card')) {
        return; 
    }
    
    const updates = {};
    children.forEach((card, index) => {
        const personId = card.dataset.id;
        if (personId) {
            updates[`dossies/${orgName}/${personId}/hierarquiaIndex`] = index;
        }
    });
    
    if (Object.keys(updates).length > 0) {
        update(ref(db), updates)
            .then(() => {
                showToast("Hierarquia atualizada!", "success");
                state.globalCurrentPeople = children.map((card, index) => {
                    const person = state.globalCurrentPeople.find(p => p.id === card.dataset.id);
                    if (person) {
                        person.hierarquiaIndex = index;
                    }
                    return person;
                }).filter(Boolean);
            })
            .catch((err) => {
                showToast(`Erro ao salvar hierarquia: ${err.message}`, "error");
            });
    }
};


const initSortable = (orgName) => {
    if (state.sortableInstance) {
        state.sortableInstance.destroy(); 
    }
    
    const grid = els.dossierPeopleGrid;
    
    const userTagUpper = state.currentUserData ? state.currentUserData.tag.toUpperCase() : 'VISITANTE';
    const canDrag = (userTagUpper === 'ADMIN' || userTagUpper === 'HELLS');
    
    state.sortableInstance = new Sortable(grid, {
        animation: 150,
        handle: '.dossier-entry-card', 
        disabled: !canDrag, 
        ghostClass: 'sortable-ghost', 
        onEnd: (evt) => {
            saveHierarchyOrder(orgName);
        }
    });
};


const saveOrgOrder = (showToastOnSuccess = true) => {
    const grid = els.dossierOrgGrid;
    const children = Array.from(grid.children).filter(el => el.classList.contains('dossier-org-card'));
    
    if (children.length === 0) {
        return;
    }
    
    const updates = {};
    children.forEach((card, index) => {
        const orgId = card.dataset.orgName;
        if (orgId) {
            updates[`organizacoes/${orgId}/ordemIndex`] = index;
        }
    });
    
    if (Object.keys(updates).length > 0) {
        update(ref(db), updates)
            .then(() => {
                if(showToastOnSuccess) showToast("Ordem das Bases atualizada!", "success");
                state.globalAllOrgs = children.map((card, index) => {
                    const org = state.globalAllOrgs.find(o => o.id === card.dataset.orgName);
                    if (org) {
                        org.ordemIndex = index;
                    }
                    return org;
                }).filter(Boolean);
            })
            .catch((err) => {
                showToast(`Erro ao salvar ordem das Bases: ${err.message}`, "error");
            });
    }
};


const initOrgSortable = () => {
    if (state.orgSortableInstance) {
        state.orgSortableInstance.destroy();
    }
    
    const grid = els.dossierOrgGrid;
    
    const userTagUpper = state.currentUserData ? state.currentUserData.tag.toUpperCase() : 'VISITANTE';
    const canDrag = (userTagUpper === 'ADMIN' || userTagUpper === 'HELLS');
    
    state.orgSortableInstance = new Sortable(grid, {
        animation: 150,
        handle: '.dossier-org-card', 
        group: 'orgs', 
        disabled: !canDrag, 
        ghostClass: 'sortable-ghost',
        filter: 'h3.dossier-org-title', 
        onEnd: (evt) => {
            saveOrgOrder();
        }
    });
};


const deleteUser = (uid, displayName) => {
    if (confirm(`ATENÇÃO:\n\nTem certeza que deseja apagar o usuário "${displayName}"?\n\nIsso removerá o registro dele do banco de dados (e suas permissões).\n\nIMPORTANTE: Para apagar o LOGIN dele permanentemente, você ainda precisará ir ao painel "Authentication" do Firebase.`)) {
        
        const userRef = ref(db, `usuarios/${uid}`);
        remove(userRef)
            .then(() => {
                showToast(`Usuário "${displayName}" apagado do banco de dados.`, 'success');
                loadAdminPanel();
            })
            .catch((error) => {
                showToast(`Erro ao apagar usuário: ${error.message}`, 'error');
            });
    }
};


const loadAdminPanel = async (fetchStatus = true) => {
    
    // 1. Garante que os dados de status online estejam disponíveis
    if (fetchStatus) {
        const statusSnapshot = await get(ref(db, 'onlineStatus'));
        const now = Date.now();
        state.globalOnlineStatus = {}; 
        
        if (statusSnapshot.exists()) {
            statusSnapshot.forEach(child => {
                const userStatus = child.val();
                const inactivity = now - userStatus.lastActive;
                const isOnline = inactivity < 60000; 
                
                state.globalOnlineStatus[child.key] = {
                    isOnline: isOnline,
                    inactivity: inactivity
                };
            });
        }
    }
    
    // CORREÇÃO: Colspan de 4 para 2
    els.adminUserListBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Carregando...</td></tr>';
    
    try {
        const usersSnapshot = await get(ref(db, 'usuarios'));
        if (!usersSnapshot.exists()) {
            // CORREÇÃO: Colspan de 4 para 2
            els.adminUserListBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Nenhum usuário encontrado.</td></tr>';
            return;
        }
        
        const usersList = [];
        usersSnapshot.forEach(userSnap => {
            const userData = userSnap.val();
            if (userData.displayName && userData.displayName.toLowerCase() === 'snow') {
                return;
            }
            usersList.push({ uid: userSnap.key, ...userData });
        });

        // Re-ordena: Online (Hells/Admin) > Offline (Hells/Admin) > Visitante
        const tagOrder = { 'ADMIN': 1, 'HELLS': 2, 'VISITANTE': 3 };
        
        usersList.sort((a, b) => {
            const statusA = state.globalOnlineStatus[a.uid] || { isOnline: false, inactivity: Infinity };
            const statusB = state.globalOnlineStatus[b.uid] || { isOnline: false, inactivity: Infinity };
            
            // 1. Ordem por Online vs Offline
            if (statusA.isOnline !== statusB.isOnline) {
                return statusA.isOnline ? -1 : 1; 
            }
            
            // 2. Ordem por Tag (Admin/Hells/Visitante)
            const tagA = (tagOrder[a.tag.toUpperCase()] || 4);
            const tagB = (tagOrder[b.tag.toUpperCase()] || 4);
            if (tagA !== tagB) {
                return tagA - tagB;
            }
            
            // 3. Ordem por Inatividade (Menos inativo primeiro)
            if (statusA.inactivity !== statusB.inactivity) {
                return statusA.inactivity - statusB.inactivity;
            }

            // 4. Ordem alfabética (fallback)
            return (a.displayName || '').localeCompare(b.displayName || '');
        });

        els.adminUserListBody.innerHTML = '';
        
        usersList.forEach(user => {
            const uid = user.uid;
            const userData = user;
            const status = state.globalOnlineStatus[uid] || { isOnline: false, inactivity: Infinity };
            
            const row = els.adminUserListBody.insertRow();
            
            // --- INÍCIO DA MODIFICAÇÃO (AGRUPAMENTO) ---
            // CÉLULA PRINCIPAL (Nome, Atividade, Tag)
            const mainCell = row.insertCell();
            mainCell.style.verticalAlign = 'top'; // Alinha no topo para a pilha
            mainCell.style.padding = '8px 6px'; // Espaçamento padrão

            // 1. Nome (com status dot)
            const nameDiv = document.createElement('div');
            nameDiv.style.display = 'flex';
            nameDiv.style.alignItems = 'center';
            nameDiv.style.fontWeight = '700';
            nameDiv.style.fontSize = '16px'; // Destaque para o nome
            nameDiv.style.marginBottom = '4px'; // Espaço abaixo do nome
            
            const statusDotClass = status.isOnline ? 'status-online' : 'status-offline';
            const displayNameText = userData.displayName || '(Sem nome)';
            
            nameDiv.innerHTML = `
                <span class="status-dot ${statusDotClass}" title="${status.isOnline ? 'Online' : 'Inativo'}" style="flex-shrink: 0;"></span>
                <span>${displayNameText}</span>
            `;
            mainCell.appendChild(nameDiv);

            // 2. Atividade
            const activitySpan = document.createElement('span');
            activitySpan.style.fontSize = '13px';
            activitySpan.style.display = 'block'; // Empilha abaixo do nome
            activitySpan.style.marginLeft = '20px'; // Indenta (abaixo do nome, alinhado com o texto)
            activitySpan.style.marginBottom = '8px'; // Espaço abaixo da atividade
            
            const statusText = status.isOnline 
                                ? `Ativo (agora)` 
                                : `Inativo há ${formatInactivityTime(status.inactivity)}`;
            activitySpan.textContent = statusText;

            if (status.isOnline) {
                activitySpan.style.color = '#00b33c';
            } else {
                activitySpan.style.color = 'var(--cor-erro)';
            }
            
            if (!status.isOnline && status.inactivity > 60000 * 60 * 24) { // Mais de 24h
                 activitySpan.textContent = 'Inativo há muito tempo';
                 activitySpan.style.color = '#888';
            }
            mainCell.appendChild(activitySpan);
            
            // 3. Permissão (Tag)
            const tagContainer = document.createElement('div');
            tagContainer.style.marginLeft = '20px'; // Indenta
            
            if (uid === state.currentUser.uid) {
                tagContainer.textContent = `👑 ${userData.tag} (Você)`;
                tagContainer.style.fontWeight = '600';
            } else {
                const select = document.createElement('select');
                select.style.width = 'auto'; // Ajusta ao conteúdo
                select.style.maxWidth = '200px';
                select.dataset.uid = uid; 
                
                const optVisitante = document.createElement('option');
                optVisitante.value = 'Visitante';
                optVisitante.textContent = 'Visitante';
                select.appendChild(optVisitante);
                
                const optHells = document.createElement('option');
                optHells.value = 'HELLS';
                optHells.textContent = 'Hells';
                select.appendChild(optHells);
                
                const optAdmin = document.createElement('option');
                optAdmin.value = 'ADMIN';
                optAdmin.textContent = '👑 Administrador';
                select.appendChild(optAdmin);
                
                select.value = userData.tag.toUpperCase() === 'HELLS' ? 'HELLS' : (userData.tag.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'Visitante');
                select.onchange = (e) => updateUserTag(e.target.dataset.uid, e.target.value);
                tagContainer.appendChild(select);
            }
            mainCell.appendChild(tagContainer);
            // --- FIM DA MODIFICAÇÃO (AGRUPAMENTO) ---

            
            // CÉLULA DE AÇÕES (Agora é a segunda célula)
            const actionsCell = row.insertCell();
            actionsCell.style.textAlign = 'center';
            actionsCell.style.verticalAlign = 'middle';
            
            if (uid === state.currentUser.uid) {
                actionsCell.textContent = '---';
            } else {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '❌';
                deleteBtn.className = 'danger action-btn'; 
                deleteBtn.style.padding = '5px 8px';
                deleteBtn.style.fontSize = '14px';
                deleteBtn.style.lineHeight = '1';
                
                deleteBtn.addEventListener('click', () => {
                    deleteUser(uid, userData.displayName);
                });
                
                actionsCell.appendChild(deleteBtn);
            }
        });
        
    } catch (error) {
        showToast(`Erro ao carregar usuários: ${error.message}`, 'error');
        // CORREÇÃO: Colspan de 4 para 2
        els.adminUserListBody.innerHTML = `<tr><td colspan="2" style="text-align: center;">Erro ao carregar. ${error.message}</td></tr>`;
    }
    
    try {
        const layoutSnapshot = await get(ref(db, 'configuracoesGlobais/layout'));
        if (layoutSnapshot.exists()) {
            const settings = layoutSnapshot.val();
            els.layoutToggleNightMode.checked = settings.enableNightMode;
            els.layoutToggleBottomPanel.checked = settings.enableBottomPanel;
            els.bottomPanelText.value = settings.bottomPanelText || '';
        }
    } catch (error) {
        if(error.code !== "PERMISSION_DENIED") {
            showToast(`Erro ao carregar configurações de layout: ${error.message}`, 'error');
        }
    }
};


const updateUserTag = (uid, newTag) => {
    const tagRef = ref(db, `usuarios/${uid}/tag`);
    set(tagRef, newTag)
        .then(() => {
            showToast("Permissão do usuário atualizada!", 'success');
        })
        .catch((error) => {
            showToast(`Erro ao atualizar tag: ${error.message}`, 'error');
        });
};


const updateGlobalLayout = (key, value) => {
    const layoutRef = ref(db, `configuracoesGlobais/layout/${key}`);
    set(layoutRef, value)
        .catch((error) => {
            showToast(`Erro ao salvar configuração: ${error.message}`, 'error');
        });
};


export const initAdmin = () => {
  if (els.adminPanelBtn) els.adminPanelBtn.onclick = () => toggleAdminPanel(true);
  if (els.toggleCalcBtnAdmin) els.toggleCalcBtnAdmin.onclick = () => toggleAdminPanel(false);
  if (els.migrateDossierBtn) els.migrateDossierBtn.onclick = () => window.confirm('Tem certeza? Execute UMA vez.') && (window.__migrateVendasToDossier && window.__migrateVendasToDossier());
  if (els.migrateVeiculosBtn) els.migrateVeiculosBtn.onclick = () => window.confirm('Tem certeza? Execute UMA vez.') && (window.__migrateVeiculosData && window.__migrateVeiculosData());
  if (els.layoutToggleNightMode) els.layoutToggleNightMode.onchange = () => updateGlobalLayout();
  if (els.layoutToggleBottomPanel) els.layoutToggleBottomPanel.onchange = () => updateGlobalLayout();
  if (els.saveBottomPanelTextBtn) els.saveBottomPanelTextBtn.onclick = () => updateGlobalLayout();
};

export const toggleAdminPanel = (open) => {
  if (!els.adminPanel) return;
  if (open) {
    if (window.__toggleView) window.__toggleView('admin');
    loadAdminPanel(true);
    monitorOnlineStatus();
  } else {
    if (window.__toggleView) window.__toggleView('main');
  }
};

export { loadAdminPanel, updateUserTag, updateGlobalLayout, deleteUser, initSortable, initOrgSortable };

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

/**
 * Carrega a lista de usuários e incorpora o status online.
 * @param {boolean} fetchStatus - Indica se deve buscar o status online se ainda não tiver.
 */
const loadAdminPanel = async (fetchStatus = true) => {
    
    // 1. Garante que os dados de status online estejam disponíveis
    if (fetchStatus) {
        const statusSnapshot = await get(ref(db, 'onlineStatus'));
        const now = Date.now();
        globalOnlineStatus = {}; 
        
        if (statusSnapshot.exists()) {
            statusSnapshot.forEach(child => {
                const userStatus = child.val();
                const inactivity = now - userStatus.lastActive;
                const isOnline = inactivity < 60000; 
                
                globalOnlineStatus[child.key] = {
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
            const statusA = globalOnlineStatus[a.uid] || { isOnline: false, inactivity: Infinity };
            const statusB = globalOnlineStatus[b.uid] || { isOnline: false, inactivity: Infinity };
            
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
            const status = globalOnlineStatus[uid] || { isOnline: false, inactivity: Infinity };
            
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
            
            if (uid === currentUser.uid) {
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
            
            if (uid === currentUser.uid) {
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

els.adminPanelBtn.onclick = () => toggleView('admin');
els.layoutToggleNightMode.onchange = (e) => updateGlobalLayout('enableNightMode', e.target.checked);
els.layoutToggleBottomPanel.onchange = (e) => updateGlobalLayout('enableBottomPanel', e.target.checked);



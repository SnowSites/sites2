const displaySalesHistory = (history) => {
    els.salesHistory.innerHTML = '';
    if (!currentUserData) { 
         return;
    }

    let vendasFiltradas = history;
    const userTagUpper = currentUserData.tag.toUpperCase();
    
    if (userTagUpper === 'VISITANTE') {
        vendasFiltradas = history.filter(v => v.registradoPorId === currentUser.uid);
    }

    if (vendasFiltradas.length === 0) {
        const row = els.salesHistory.insertRow();
        row.insertCell().colSpan = 9; 
        row.cells[0].textContent = "Nenhuma venda para exibir.";
        row.cells[0].style.textAlign = 'center';
        row.cells[0].style.padding = '20px';
        return;
    }

    vendasFiltradas.sort((a, b) => b.timestamp - a.timestamp);

    vendasFiltradas.forEach(venda => {
        const row = els.salesHistory.insertRow();
        
        const [data, hora] = venda.dataHora.split(', ');
        row.insertCell().innerHTML = `<span class="history-datetime-line">${data}</span><span class="history-datetime-line">${hora}</span>`;
        row.insertCell().textContent = capitalizeText(venda.cliente);
        row.insertCell().textContent = `${capitalizeText(venda.organizacao)} (${venda.organizacaoTipo})`;
        row.insertCell().textContent = venda.telefone;

        let produtos = [];
        if (venda.qtyTickets > 0) produtos.push(`${venda.qtyTickets} Tickets`);
        if (venda.qtyTablets > 0) produtos.push(`${venda.qtyTablets} Tablets`);
        if (venda.qtyNitro > 0) produtos.push(`${venda.qtyNitro} Nitro`);
        row.insertCell().textContent = capitalizeText(produtos.join(', '));
        
        const valorCell = row.insertCell();
        valorCell.className = 'valor-total-cell';
        valorCell.innerHTML = `<span>${formatCurrency(venda.valorTotal || 0)}</span><span class="valor-obs-text">(${valorDescricao[venda.tipoValor] || 'N/A'})`;

        row.insertCell().textContent = capitalizeText(venda.negociadoras);
        
        const registradoPorCell = row.insertCell();
        if (venda.registradoPor && venda.registradoPor.toLowerCase() === 'snow') {
            registradoPorCell.textContent = '???';
            registradoPorCell.style.fontStyle = 'italic';
            registradoPorCell.style.color = '#aaa';
        } else {
            registradoPorCell.textContent = venda.registradoPor || 'Desconhecido';
        }
        
        const actionsCell = row.insertCell();
        actionsCell.className = 'history-actions-cell';

        const podeModificar = 
            (userTagUpper === 'ADMIN') ||
            (userTagUpper === 'HELLS' && venda.registradoPorId === currentUser.uid) ||
            (userTagUpper === 'VISITANTE' && venda.registradoPorId === currentUser.uid);

        actionsCell.innerHTML = `
            <button class="action-btn muted edit-btn" ${!podeModificar ? 'disabled' : ''}>Editar</button>
            <button class="action-btn danger delete-btn" ${!podeModificar ? 'disabled' : ''}>Deletar</button>
            <button class="action-btn muted discord-btn">Discord</button>
        `;
        if(podeModificar){
            actionsCell.querySelector('.edit-btn').onclick = () => editVenda(venda.id);
            actionsCell.querySelector('.delete-btn').onclick = () => removeVenda(venda.id);
        }
        actionsCell.querySelector('.discord-btn').onclick = () => copyDiscordMessage(true, venda);
    });
};

const filterHistory = () => {
    const query = els.filtroHistorico.value.toLowerCase().trim();
    const filteredVendas = vendas.filter(v => 
        Object.values(v).some(val => String(val).toLowerCase().includes(query)) ||
        (v.qtyTickets > 0 && `tickets`.includes(query)) ||
        (v.qtyTablets > 0 && `tablets`.includes(query)) ||
        (v.qtyNitro > 0 && `nitro`.includes(query))
    );
    displaySalesHistory(query ? filteredVendas : vendas);
};

const exportToCsv = () => {
    if (vendas.length === 0) {
        showToast("Nenhum dado para exportar.", "error");
        return;
    }
    const headers = ["Data/Hora", "Cliente", "Organização", "Tipo", "Telefone", "Negociadoras", "Cargo", "Carro", "Placas", "Qtde Tickets", "Qtde Tablets", "Qtde Nitro", "Valor Total", "Tipo Valor", "Registrado Por"];
    const csvRows = vendas.map(v => [`"${v.dataHora}"`, `"${v.cliente}"`, `"${v.organizacao}"`, `"${v.organizacaoTipo}"`, `"${v.telefone}"`, `"${v.negociadoras}"`, `"${v.vendaValorObs}"`, `"${v.carro || ''}"`, `"${v.placas || ''}"`, v.qtyTickets, v.qtyTablets, v.qtyNitro, v.valorTotal, `"${valorDescricao[v.tipoValor]}"`, `"${v.registradoPor}"`].join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `historico_vendas_HA_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast("Histórico exportado para CSV!", "success");
};

const clearHistory = () => {
    if (currentUserData.tag.toUpperCase() !== 'ADMIN') {
        showToast("Apenas administradores podem limpar o histórico.", "error");
        return;
    }
    if (confirm("ATENÇÃO: Deseja APAGAR TODO o histórico de vendas? Esta ação é irreversível.")) {
        remove(ref(db, 'vendas'))
            .then(() => showToast("Histórico limpado.", "success"))
            .catch(e => showToast(`Erro: ${e.message}`, "error"));
    }
};

// **** INÍCIO DAS FUNÇÕES DO DOSSIÊ (v12) ****

// =============================================
// NOVAS FUNÇÕES DO LIGHTBOX
// =============================================
const showImageLightbox = (url) => {
    if (!url) return;
    els.lightboxImg.src = url;
    els.imageLightboxOverlay.style.display = 'block';
    els.imageLightboxModal.style.display = 'block';
};

const closeImageLightbox = () => {
    els.imageLightboxOverlay.style.display = 'none';
    els.imageLightboxModal.style.display = 'none';
    els.lightboxImg.src = ''; 
};
// =============================================

// =============================================
// INÍCIO: FUNÇÕES DE HIERARQUIA DE PESSOAS (SortableJS)
// =============================================

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
                globalCurrentPeople = children.map((card, index) => {
                    const person = globalCurrentPeople.find(p => p.id === card.dataset.id);
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
    if (sortableInstance) {
        sortableInstance.destroy(); 
    }
    
    const grid = els.dossierPeopleGrid;
    
    const userTagUpper = currentUserData ? currentUserData.tag.toUpperCase() : 'VISITANTE';
    const canDrag = (userTagUpper === 'ADMIN' || userTagUpper === 'HELLS');
    
    sortableInstance = new Sortable(grid, {
        animation: 150,
        handle: '.dossier-entry-card', 
        disabled: !canDrag, 
        ghostClass: 'sortable-ghost', 
        onEnd: (evt) => {
            saveHierarchyOrder(orgName);
        }
    });
};

// =============================================
// FIM: FUNÇÕES DE HIERARQUIA DE PESSOAS
// =============================================

// =============================================
// INÍCIO: FUNÇÕES DE ORDENAÇÃO DE BASES (SortableJS para Orgs)
// =============================================

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
                globalAllOrgs = children.map((card, index) => {
                    const org = globalAllOrgs.find(o => o.id === card.dataset.orgName);
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
    if (orgSortableInstance) {
        orgSortableInstance.destroy();
    }
    
    const grid = els.dossierOrgGrid;
    
    const userTagUpper = currentUserData ? currentUserData.tag.toUpperCase() : 'VISITANTE';
    const canDrag = (userTagUpper === 'ADMIN' || userTagUpper === 'HELLS');
    
    orgSortableInstance = new Sortable(grid, {
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
// =============================================
// FIM: FUNÇÕES DE ORDENAÇÃO DE BASES
// =============================================


// Nível 1: Mostra as Organizações (Bases)

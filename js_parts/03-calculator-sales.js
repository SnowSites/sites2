const calculate = () => {
  const { qtyTickets, qtyTablets, qtyNitro, tipoValor } = {
    qtyTickets: getQty(els.qtyTickets),
    qtyTablets: getQty(els.qtyTablets),
    qtyNitro: getQty(els.qtyNitro),
    tipoValor: els.tipoValor.value
  };
  const totalQuantities = { cobre: 0, plastico: 0, fita_adesiva: 0, lixo_eletronico: 0, aluminio: 0, vidro: 0, porca: 0, parafuso: 0, dinheiro_sujo: 0 };
  let totalValue = 0;
  const productValues = [];
  
  if (qtyTablets > 0) {
    totalQuantities.cobre += qtyTablets * perUnit.tablets.cobre;
    totalQuantities.plastico += qtyTablets * perUnit.tablets.plastico;
    totalQuantities.fita_adesiva += qtyTablets * perUnit.tablets.fita_adesiva;
    totalQuantities.lixo_eletronico += qtyTablets * perUnit.tablets.lixo_eletronico;
    const value = qtyTablets * valores.tablets[tipoValor];
    totalValue += value;
    productValues.push({ product: `Tablets (${qtyTablets} und.)`, value });
  }
  if (qtyTickets > 0) {
    totalQuantities.dinheiro_sujo += qtyTickets * perUnit.tickets.dinheiro_sujo;
    const value = qtyTickets * valores.tickets[tipoValor];
    totalValue += value;
    productValues.push({ product: `Tickets (${qtyTickets} und.)`, value });
  }
  if (qtyNitro > 0) {
    totalQuantities.aluminio += qtyNitro * perUnit.nitro.aluminio;
    totalQuantities.cobre += qtyNitro * perUnit.nitro.cobre;
    totalQuantities.vidro += qtyNitro * perUnit.nitro.vidro;
    totalQuantities.fita_adesiva += qtyNitro * perUnit.nitro.fita_adesiva;
    totalQuantities.porca += qtyNitro * perUnit.nitro.porca;
    totalQuantities.parafuso += qtyNitro * perUnit.nitro.parafuso;
    const value = qtyNitro * valores.nitro[tipoValor];
    totalValue += value;
    productValues.push({ product: `Nitro (${qtyNitro} und.)`, value });
  }
  
  const hasQuantities = qtyTickets > 0 || qtyTablets > 0 || qtyNitro > 0;
  if (hasQuantities) {
    updateResults(totalQuantities, productValues, totalValue);
  } else {
    els.results.style.display = 'none';
  }
  return { qtyTickets, qtyTablets, qtyNitro, totalValue, tipoValor, hasQuantities };
};

const updateResults = (totals, productValues, totalValue) => {
  els.results.style.display = 'block';
  els.resultsBody.innerHTML = Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([material, value]) => `<tr><td>${capitalizeText(material.replace(/_/g, ' '))}</td><td>${value.toLocaleString('pt-BR')}</td></tr>`)
    .join('');
  els.valuesBody.innerHTML = productValues.map(item => `<tr><td>${item.product}</td><td>${formatCurrency(item.value)}</td></tr>`).join('');
  els.valorTotalGeral.textContent = formatCurrency(totalValue);
};

const clearAllFields = () => {
  ['qtyTickets', 'qtyTablets', 'qtyNitro', 'nomeCliente', 'organizacao', 'negociadoras', 'vendaValorObs', 'carroVeiculo', 'placaVeiculo'].forEach(id => els[id].value = '');
  els.tipoValor.value = 'limpo';
  els.organizacaoTipo.value = 'CNPJ';
  els.telefone.value = '';
  els.results.style.display = 'none';
  document.querySelectorAll('.input-invalido').forEach(input => input.classList.remove('input-invalido'));
  
  if (vendaEmEdicaoId) {
    vendaEmEdicaoId = null;
    vendaOriginalRegistradoPor = null;
    vendaOriginalRegistradoPorId = null;
    vendaOriginalTimestamp = null;
    vendaOriginalDataHora = null;
    vendaOriginalCliente = null; 
    vendaOriginalOrganizacao = null; 
    vendaOriginalDossierOrg = null; 
    els.registerBtn.textContent = 'Registrar Venda';
  }
};

const validateFields = () => {
    let isValid = true;
    const camposObrigatorios = [ els.nomeCliente, els.telefone, els.negociadoras ];
    
    camposObrigatorios.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('input-invalido');
            isValid = false;
        } else {
            field.classList.remove('input-invalido');
        }
    });
    
    const tipoOrg = els.organizacaoTipo.value;
    if (tipoOrg === 'CNPJ') {
        if (!els.organizacao.value.trim()) {
            els.organizacao.classList.add('input-invalido');
            isValid = false;
        } else {
            els.organizacao.classList.remove('input-invalido');
        }
    } else {
        els.organizacao.classList.remove('input-invalido');
    }
    
    return isValid;
};

// =================================================================
// INÍCIO: LÓGICA DE SINCRONIZAÇÃO DO DOSSIÊ (v12)
// =================================================================

/**
 * Procura por um nome de pessoa em TODAS as organizações do dossiê.
 * Retorna os dados, a org e o ID se encontrar.
 */
const findDossierEntryGlobal = async (nome) => {
    if (!nome) return null;
    
    try {
        const dossiesRef = ref(db, 'dossies');
        const snapshot = await get(dossiesRef);
        
        if (!snapshot.exists()) return null;
        
        const dossies = snapshot.val();
        
        for (const orgKey in dossies) {
            const orgData = dossies[orgKey];
            for (const personId in orgData) {
                if (orgData[personId].nome && orgData[personId].nome.toLowerCase() === nome.toLowerCase()) {
                    return {
                        personData: orgData[personId],
                        oldOrg: orgKey,
                        personId: personId
                    };
                }
            }
        }
    } catch (error) {
        if(error.code !== "PERMISSION_DENIED") {
            console.error("Erro na busca global:", error);
        }
        return null;
    }
    return null; 
};

/**
 * Procura por um NOME PARCIAL de pessoa em TODAS as organizações do dossiê.
 * Retorna um array de resultados.
 */
const searchAllPeopleGlobal = async (query) => {
    if (!query) return [];
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    try {
        const dossiesRef = ref(db, 'dossies');
        const snapshot = await get(dossiesRef);
        
        if (!snapshot.exists()) return [];
        
        const dossies = snapshot.val();
        
        for (const orgKey in dossies) {
            const orgData = dossies[orgKey];
            for (const personId in orgData) {
                const person = orgData[personId];
                const nome = person.nome ? person.nome.toLowerCase() : '';
                
                if (nome.includes(queryLower)) {
                    results.push({
                        ...person,
                        id: personId,
                        org: orgKey 
                    });
                }
            }
        }
    } catch (error) {
        if(error.code !== "PERMISSION_DENIED") {
            console.error("Erro na busca global de pessoas:", error);
        }
    }
    return results;
};

/**
 * Mescla veículos de uma venda (formato string) com um objeto de veículos existente.
 * Usa a PLACA como chave única para evitar duplicatas.
 */
const parseAndMergeVeiculos = (vendaData, existingVeiculos = {}) => {
    const carros = (vendaData.carro || '').split(',').map(c => c.trim());
    const placas = (vendaData.placas || '').split(',').map(p => p.trim());
    const maxLen = Math.max(carros.length, placas.length);
    
    const merged = { ...existingVeiculos }; 

    for (let i = 0; i < maxLen; i++) {
        const carro = carros[i] || 'N/A';
        const placa = placas[i] || '';
        
        if (placa) {
            if (!merged[placa]) { 
                merged[placa] = { carro: carro, placa: placa, fotoUrl: '' };
            } else if (carro !== 'N/A' && merged[placa].carro === 'N/A') {
                merged[placa].carro = carro;
            }
        } else if (carro !== 'N/A') {
            const tempKey = `venda_${Date.now()}_${i}`;
            merged[tempKey] = { carro: carro, placa: '', fotoUrl: '' };
        }
    }
    return merged;
};


// Adiciona ou ATUALIZA entrada de pessoa no dossiê
const addDossierEntry = async (vendaData, dadosAntigos = null) => {
    const org = vendaData.organizacao.trim();
    const nome = vendaData.cliente.trim();
    
    if (!org || !nome) {
        console.warn("addDossierEntry: Org ou Nome faltando. Saindo.");
        return;
    }

    // Garante que a Organização exista em /organizacoes
    const orgRef = ref(db, `organizacoes/${org}`);
    get(orgRef).then(snapshot => {
        if (!snapshot.exists()) {
            set(orgRef, {
                nome: org,
                fotoUrl: '',
                info: 'Base registrada automaticamente via Venda.',
                ordemIndex: 9999 
            });
        }
    });

    // Procura por uma pessoa com o mesmo nome NESSA organização
    const dossierQuery = query(ref(db, `dossies/${org}`), orderByChild('nome'), equalTo(nome));
    
    try {
        const snapshot = await get(dossierQuery);
        
        if (snapshot.exists()) {
            // JÁ EXISTE: Atualiza a entrada existente
            let existingEntryId;
            let existingEntryData;
            snapshot.forEach(child => { 
                existingEntryId = child.key; 
                existingEntryData = child.val(); 
            });

            const updates = {};
            
            updates.numero = vendaData.telefone || existingEntryData.numero;
            updates.cargo = vendaData.vendaValorObs || existingEntryData.cargo;
            updates.data = vendaData.dataHora; 
            
            const baseVeiculos = (dadosAntigos ? dadosAntigos.veiculos : existingEntryData.veiculos) || {};
            updates.veiculos = parseAndMergeVeiculos(vendaData, baseVeiculos);

            if (dadosAntigos) {
                updates.fotoUrl = dadosAntigos.fotoUrl || existingEntryData.fotoUrl || '';
                updates.instagram = dadosAntigos.instagram || existingEntryData.instagram || '';
                updates.hierarquiaIndex = dadosAntigos.hierarquiaIndex !== undefined ? dadosAntigos.hierarquiaIndex : (existingEntryData.hierarquiaIndex !== undefined ? existingEntryData.hierarquiaIndex : 9999);
            }

            const updateRef = ref(db, `dossies/${org}/${existingEntryId}`);
            await update(updateRef, updates);

        } else {
            // NÃO EXISTE: Cria uma nova entrada
            const dossierEntry = { ...dadosAntigos };
            
            dossierEntry.nome = vendaData.cliente;
            dossierEntry.numero = vendaData.telefone;
            dossierEntry.organizacao = org;
            dossierEntry.cargo = vendaData.vendaValorObs || 'N/A';
            dossierEntry.data = vendaData.dataHora; 
            
            dossierEntry.veiculos = parseAndMergeVeiculos(vendaData, (dadosAntigos ? dadosAntigos.veiculos : {}));

            dossierEntry.fotoUrl = dossierEntry.fotoUrl || '';
            dossierEntry.instagram = dossierEntry.instagram || '';
            dossierEntry.hierarquiaIndex = dossierEntry.hierarquiaIndex !== undefined ? dossierEntry.hierarquiaIndex : 9999;
            
            await push(ref(db, `dossies/${org}`), dossierEntry);
        }
    } catch (err) {
        console.error("Erro ao adicionar/atualizar dossiê:", err);
        if(err.code !== "PERMISSION_DENIED") {
            showToast(`Erro ao sincronizar dossiê: ${err.message}`, "error");
        }
    }
};

// Atualiza o dossiê quando uma VENDA é editada
const updateDossierEntryOnEdit = async (oldNome, oldOrg, newVendaData) => {
    const newOrg = newVendaData.organizacao.trim();
    const newNome = newVendaData.cliente.trim();
    
    if (!oldOrg || !oldNome || !newOrg || !newNome) {
        console.warn("UpdateDossier: Faltando dados originais ou novos.");
        return;
    }

    const dossierQuery = query(ref(db, `dossies/${oldOrg}`), orderByChild('nome'), equalTo(oldNome));
    
    try {
        const snapshot = await get(dossierQuery);
        
        if (!snapshot.exists()) {
            const globalEntry = await findDossierEntryGlobal(newNome);
            
            let dadosAntigos = null;
            if (globalEntry && globalEntry.oldOrg !== newOrg) {
                dadosAntigos = globalEntry.personData;
                await remove(ref(db, `dossies/${globalEntry.oldOrg}/${globalEntry.personId}`));
                showToast(`"${newNome}" movido de "${globalEntry.oldOrg}" para "${newOrg}".`, "default", 4000);
            }
            
            addDossierEntry(newVendaData, dadosAntigos);
            return;
        }

        let existingEntryId;
        let existingEntryData;
        snapshot.forEach(child => { 
            existingEntryId = child.key;
            existingEntryData = child.val();
        });
        
        const newDossierData = {
            ...existingEntryData, 
            nome: newVendaData.cliente,
            numero: newVendaData.telefone,
            organizacao: newVendaData.organizacao,
            cargo: newVendaData.vendaValorObs || 'N/A',
            data: newVendaData.dataHora,
            veiculos: parseAndMergeVeiculos(newVendaData, existingEntryData.veiculos || {}),
        };

        if (oldOrg === newOrg) {
            const updateRef = ref(db, `dossies/${newOrg}/${existingEntryId}`);
            await set(updateRef, newDossierData); 
        } else {
            await remove(ref(db, `dossies/${oldOrg}/${existingEntryId}`));
            addDossierEntry(newVendaData, existingEntryData); 
        }

    } catch (err) {
        console.error("Erro ao sincronizar edição da venda com dossiê:", err);
        if(err.code !== "PERMISSION_DENIED") {
            showToast(`Erro ao sincronizar dossiê: ${err.message}`, "error");
        }
    }
};

// =================================================================
// FIM: LÓGICA DE SINCRONIZAÇÃO DO DOSSIÊ
// =================================================================

// =================================================================
// INÍCIO: FUNÇÃO DE AUTO-PREENCHIMENTO (NOVA v13)
// =================================================================
const autoFillFromDossier = async () => {
    if (vendaEmEdicaoId) return; 
    
    const nome = els.nomeCliente.value.trim();
    
    if (!nome) return; 

    try {
        const foundEntry = await findDossierEntryGlobal(nome);
        
        if (foundEntry && foundEntry.personData) {
            const data = foundEntry.personData;
            const orgBase = foundEntry.oldOrg;

            els.telefone.value = data.numero || '';
            els.vendaValorObs.value = data.cargo || ''; 
            
            if (orgBase.toUpperCase() === 'CPF') {
                els.organizacaoTipo.value = 'CPF';
                els.organizacao.value = ''; 
            } else if (orgBase.toUpperCase() === 'OUTROS') {
                els.organizacaoTipo.value = 'OUTROS';
                els.organizacao.value = ''; 
            } else {
                els.organizacaoTipo.value = 'CNPJ';
                els.organizacao.value = orgBase; 
            }
            
            showToast(`Dados de "${nome}" preenchidos do dossiê.`, "success");
        }
        
    } catch (error) {
        if(error.code !== "PERMISSION_DENIED") {
            console.error("Erro ao tentar auto-preencher:", error);
            showToast("Erro ao buscar dados do dossiê.", "error");
        }
    }
};
// =================================================================
// FIM: FUNÇÃO DE AUTO-PREENCHIMENTO
// =================================================================

const registerVenda = async () => {
  const { qtyTickets, qtyTablets, qtyNitro, totalValue, tipoValor, hasQuantities } = calculate();
  if (!hasQuantities) {
    showToast("É necessário calcular a venda antes de registrar.", "error");
    return;
  }
  if (!validateFields()) {
      showToast("Preencha os campos obrigatórios (marcados em vermelho).", "error");
      return;
  }
  if (!currentUser || !currentUser.displayName) {
      showToast("Erro: Usuário não autenticado.", "error");
      return;
  }
  
  const carro = els.carroVeiculo.value.trim();
  const placas = els.placaVeiculo.value.trim().toUpperCase();
  
  const newVenda = {
    timestamp: vendaEmEdicaoId ? vendaOriginalTimestamp : Date.now(), 
    dataHora: vendaEmEdicaoId ? vendaOriginalDataHora : new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    cliente: els.nomeCliente.value.trim(),
    organizacao: els.organizacao.value.trim(),
    organizacaoTipo: els.organizacaoTipo.value,
    telefone: els.telefone.value.trim(),
    negociadoras: els.negociadoras.value.trim(),
    vendaValorObs: els.vendaValorObs.value.trim(),
    carro: carro, 
    placas: placas,
    qtyTickets, qtyTablets, qtyNitro,
    valorTotal: totalValue,
    tipoValor,
    registradoPor: vendaEmEdicaoId ? vendaOriginalRegistradoPor : currentUser.displayName,
    registradoPorId: vendaEmEdicaoId ? vendaOriginalRegistradoPorId : currentUser.uid 
  };
  
  
  let dossierOrgDestino = '';
  if (newVenda.organizacaoTipo === 'CPF') {
      dossierOrgDestino = 'CPF';
  } else if (newVenda.organizacaoTipo === 'OUTROS') {
      dossierOrgDestino = 'Outros';
  } else { 
      dossierOrgDestino = newVenda.organizacao.trim();
  }
  
  let dadosAntigosParaMover = null;
  
  if (!vendaEmEdicaoId && dossierOrgDestino !== '' && newVenda.cliente !== '') {
      try {
          const existingEntry = await findDossierEntryGlobal(newVenda.cliente);
          
          if (existingEntry && existingEntry.oldOrg !== dossierOrgDestino) {
              
              dadosAntigosParaMover = { ...existingEntry.personData };
              
              await remove(ref(db, `dossies/${existingEntry.oldOrg}/${existingEntry.personId}`));
              
              showToast(`"${newVenda.cliente}" movido de "${existingEntry.oldOrg}" para "${dossierOrgDestino}".`, "default", 4000);
          }
      } catch (e) {
          if (e.code !== "PERMISSION_DENIED") {
              showToast(`Erro ao verificar dossiê global: ${e.message}`, "error");
          }
      }
  }
  

  const operation = vendaEmEdicaoId ? set(ref(db, `vendas/${vendaEmEdicaoId}`), newVenda) : push(ref(db, 'vendas'), newVenda);
  
  operation
      .then(() => {
          showToast(`Venda ${vendaEmEdicaoId ? 'atualizada' : 'registrada'} com sucesso!`, "success");
          
          const dossierVendaData = { ...newVenda }; 
          dossierVendaData.organizacao = dossierOrgDestino;

          if (dossierOrgDestino !== '') {
              if (vendaEmEdicaoId) {
                  updateDossierEntryOnEdit(vendaOriginalCliente, vendaOriginalDossierOrg, dossierVendaData);
              } else {
                  addDossierEntry(dossierVendaData, dadosAntigosParaMover);
              }
          }
          
          clearAllFields();
      })
      .catch((error) => {
          showToast(`Erro ao registrar venda: ${error.message}`, "error");
      });
};

const editVenda = (id) => {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    
    els.nomeCliente.value = venda.cliente || '';
    els.organizacao.value = venda.organizacao || '';
    els.organizacaoTipo.value = venda.organizacaoTipo || 'CNPJ';
    els.telefone.value = venda.telefone || '';
    els.negociadoras.value = venda.negociadoras || '';
    els.vendaValorObs.value = venda.vendaValorObs || '';
    els.tipoValor.value = venda.tipoValor || 'limpo';
    
    els.carroVeiculo.value = venda.carro || ''; 
    els.placaVeiculo.value = venda.placas || ''; 
    
    els.qtyTickets.value = venda.qtyTickets || 0;
    els.qtyTablets.value = venda.qtyTablets || 0;
    els.qtyNitro.value = venda.qtyNitro || 0;
    
    calculate(); 
    
    vendaEmEdicaoId = id;
    vendaOriginalRegistradoPor = venda.registradoPor;
    vendaOriginalRegistradoPorId = venda.registradoPorId;
    vendaOriginalTimestamp = venda.timestamp;
    vendaOriginalDataHora = venda.dataHora;
    
    vendaOriginalCliente = venda.cliente;
    vendaOriginalOrganizacao = venda.organizacao; 
    
    if (venda.organizacaoTipo === 'CPF') {
        vendaOriginalDossierOrg = 'CPF';
    } else if (venda.organizacaoTipo === 'OUTROS') {
        vendaOriginalDossierOrg = 'Outros';
    } else {
        vendaOriginalDossierOrg = venda.organizacao;
    }
    
    els.registerBtn.textContent = 'Atualizar Venda';
    toggleView('main'); 
    showToast(`Editando venda de ${venda.cliente}`, "default");
};

const removeVenda = (id) => {
    if (confirm("Tem certeza que deseja remover esta venda?")) {
        remove(ref(db, `vendas/${id}`))
            .then(() => {
                showToast("Venda removida.", "success");
            })
            .catch((error) => {
                showToast(`Erro ao remover: ${error.message}`, "error");
            });
    }
};

const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast("Mensagem copiada para o Discord!", "success");
      })
      .catch(err => {
        showToast("Erro ao copiar.", "error");
      });
};

const buildDiscordMessage = (vendaData) => {
    const { cliente, data, orgTipo, org, tel, produtos, valor, obs, negociadoras, cargo } = vendaData;
    return `
\`\`\`
Nome: ${cliente}
Data: ${data}
Organização: ${orgTipo} - ${org}
Telefone: ${tel}
Cargo: ${cargo}
Produto (Unidade): ${produtos}
Venda Valor: ${valor} (${obs})
Negociadoras: ${negociadoras}
\`\`\`
    `.trim();
};

const copyDiscordMessage = (isFromHistory = false, venda = null) => {
    let messageData;
    if (isFromHistory) {
        let produtos = [];
        if (venda.qtyTickets > 0) produtos.push(`Tickets (${venda.qtyTickets})`);
        if (venda.qtyTablets > 0) produtos.push(`Tablet (${venda.qtyTablets})`);
        if (venda.qtyNitro > 0) produtos.push(`Nitros (${venda.qtyNitro})`);
        
        messageData = {
            cliente: venda.cliente,
            data: venda.dataHora.split(', ')[0],
            orgTipo: venda.organizacaoTipo,
            org: venda.organizacao,
            tel: venda.telefone,
            cargo: venda.vendaValorObs || 'N/A',
            produtos: produtos.join(', '),
            valor: formatCurrency(venda.valorTotal || 0),
            obs: valorDescricao[venda.tipoValor],
            negociadoras: venda.negociadoras
        };
    } else {
        const { qtyTickets, qtyTablets, qtyNitro, totalValue, tipoValor, hasQuantities } = calculate();
        if (!hasQuantities) { showToast("Calcule uma venda antes de copiar.", "error"); return; }
        if (!validateFields()) { showToast("Preencha os dados da venda antes de copiar.", "error"); return; }
        
        let produtos = [];
        if (qtyTickets > 0) produtos.push(`Tickets (${qtyTickets})`);
        if (qtyTablets > 0) produtos.push(`Tablet (${qtyTablets})`);
        if (qtyNitro > 0) produtos.push(`Nitros (${qtyNitro})`);
        
        const dataAtual = new Date().toLocaleDateString('pt-BR');

        messageData = {
            cliente: els.nomeCliente.value.trim(),
            data: dataAtual,
            orgTipo: els.organizacaoTipo.value,
            org: els.organizacao.value.trim(),
            tel: els.telefone.value.trim(),
            cargo: els.vendaValorObs.value.trim() || 'N/A',
            produtos: produtos.join(', '),
            valor: formatCurrency(totalValue),
            obs: valorDescricao[tipoValor],
            negociadoras: els.negociadoras.value.trim()
        };
    }
    copyToClipboard(buildDiscordMessage(messageData));
};

const toggleView = (viewName) => {
    els.mainCard.style.display = 'none';
    els.historyCard.style.display = 'none';
    els.adminPanel.style.display = 'none';
    els.dossierCard.style.display = 'none';
    
    document.body.classList.remove('history-view-active', 'dossier-view-active');

    if (viewName === 'history') {
        document.body.classList.add('history-view-active');
        els.historyCard.style.display = 'block';
        els.historyImg.src = historyBackgroundSrc;
        els.filtroHistorico.value = ''; 
        displaySalesHistory(vendas); 
    } else if (viewName === 'admin') {
        els.adminPanel.style.display = 'block';
        monitorOnlineStatus(); // Inicia o monitoramento de status
        loadAdminPanel(true); // Garante que a lista de usuários seja carregada
    } else if (viewName === 'dossier') {
        document.body.classList.add('dossier-view-active');
        els.dossierCard.style.display = 'block';
        showDossierOrgs(); 
    } else {
        els.mainCard.style.display = 'block';
    }
};


const formatCurrency = (value) => {
  if (typeof value !== 'number' || isNaN(value)) { return 'R$ 0'; }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// =================================================================
// INÍCIO: ALTERAÇÃO (Correção do CPF e NKT)
// =================================================================
const capitalizeText = (text) => {
    if (!text) return '';
    
    const upperText = text.toUpperCase();
    
    // Exceções para Acrônimos (CNPJ, CPF, OUTROS, NKT)
    if (upperText === 'CPF' || upperText === 'OUTROS' || upperText === 'CNPJ' || upperText === 'NKT') {
        return upperText;
    }
    if (text === 'dinheiro sujo') return 'Dinheiro Sujo';
    
    // Lógica original (Capitalização de Sentença/Palavra)
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};
// =================================================================
// FIM: ALTERAÇÃO
// =================================================================

const showToast = (message, type = 'default', duration = 3000) => {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, duration);
};

const getQty = (element) => Math.max(0, parseInt(element.value) || 0);

const PREFIX = "(055) ";
const phoneMask = (value) => {
    let digits = value.replace(/\D/g, ""); 
    if (digits.startsWith("055")) { digits = digits.substring(3); }
    digits = digits.substring(0, 6); 
    let formattedNumber = digits.length > 3 ? `${digits.substring(0, 3)}-${digits.substring(3)}` : digits;
    return PREFIX + formattedNumber;
}

const camposTelefone = [els.telefone, els.editDossierNumero, els.addDossierNumero];

camposTelefone.forEach(campo => {
    if (campo) {
        campo.addEventListener('input', (e) => {
            e.target.value = e.target.value.length < PREFIX.length ? PREFIX : phoneMask(e.target.value);
        });
        campo.addEventListener('focus', (e) => {
            if (!e.target.value || e.target.value.length < PREFIX.length) { e.target.value = PREFIX; }
        });
    }
});

const atualizarRelogio = () => {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    els.dataVenda.value = `${dia}/${mes}/${ano} ${horas}:${minutos}`;
};
atualizarRelogio();
setInterval(atualizarRelogio, 30000);

const camposParaCapitalizar = [ 
    els.nomeCliente, els.organizacao, els.negociadoras, els.vendaValorObs, 
    els.carroVeiculo, 
    els.addDossierNome, els.addDossierOrganizacao, els.addDossierCargo, 
    els.editDossierNome, els.editDossierCargo, 
    els.orgNome,
    els.addModalCarroNome, els.editModalCarroNome 
];
camposParaCapitalizar.forEach(campo => {
  if (campo) {
    campo.addEventListener('input', (e) => {
      const { selectionStart, selectionEnd } = e.target;
      e.target.value = capitalizeText(e.target.value);
      e.target.setSelectionRange(selectionStart, selectionEnd);
    });
  }
});

// NÃO CAPITALIZAR INSTAGRAM
if (els.editDossierInstagram) {
    els.editDossierInstagram.addEventListener('input', (e) => {
      // Deixa o usuário digitar livremente
    });
}


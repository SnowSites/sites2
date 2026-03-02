import { els } from "./dom.js";

/** Formata número para moeda BRL sem casas decimais */
const formatCurrency = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "R$ 0";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

/** Capitalização com exceções (CPF/CNPJ/OUTROS/NKT) */
const capitalizeText = (text) => {
  if (!text) return "";
  const upperText = String(text).toUpperCase();

  if (upperText === "CPF" || upperText === "OUTROS" || upperText === "CNPJ" || upperText === "NKT") {
    return upperText;
  }
  if (text === "dinheiro sujo") return "Dinheiro Sujo";

  return String(text)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getQty = (element) => Math.max(0, parseInt(element?.value, 10) || 0);

// ===== Telefone (máscara) =====
const PREFIX = "(055) ";
const phoneMask = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("055")) digits = digits.substring(3);
  digits = digits.substring(0, 6);

  const formatted = digits.length > 3 ? `${digits.substring(0, 3)}-${digits.substring(3)}` : digits;
  return PREFIX + formatted;
};

// ===== Relógio =====
const atualizarRelogio = () => {
  if (!els.dataVenda) return;
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  els.dataVenda.value = `${dia}/${mes}/${ano} ${horas}:${minutos}`;
};

// ===== Status online (formatador) =====
const formatInactivityTime = (inactivityMs) => {
  const seconds = Math.floor(inactivityMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 5) return "Agora";
  if (seconds < 60) return `${seconds} Segundos`;
  if (minutes < 60) return `${minutes} Minuto${minutes > 1 ? "s" : ""}`;

  const remainingMinutes = minutes % 60;
  if (hours < 2) return `1 Hora e ${remainingMinutes} Minutos`;
  return `${hours} Horas e ${remainingMinutes} Minutos`;
};

// ===== Clipboard =====
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text ?? ""));
    return true;
  } catch {
    // fallback simples
    const ta = document.createElement("textarea");
    ta.value = String(text ?? "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
};

/** Inicializa listeners globais (telefone, relógio e capitalização) */
export const initUtils = () => {
  // máscara de telefone
  const camposTelefone = [els.telefone, els.editDossierNumero, els.addDossierNumero].filter(Boolean);
  camposTelefone.forEach((campo) => {
    campo.addEventListener("input", (e) => {
      e.target.value = e.target.value.length < PREFIX.length ? PREFIX : phoneMask(e.target.value);
    });
    campo.addEventListener("focus", (e) => {
      if (!e.target.value || e.target.value.length < PREFIX.length) e.target.value = PREFIX;
    });
  });

  // relógio
  atualizarRelogio();
  setInterval(atualizarRelogio, 30000);

  // Capitalização automática
  const camposParaCapitalizar = [
    els.nomeCliente,
    els.organizacao,
    els.negociadoras,
    els.vendaValorObs,
    els.carroVeiculo,
    els.addDossierNome,
    els.addDossierOrganizacao,
    els.addDossierCargo,
    els.editDossierNome,
    els.editDossierCargo,
    els.orgNome,
    els.addModalCarroNome,
    els.editModalCarroNome,
  ].filter(Boolean);

  camposParaCapitalizar.forEach((campo) => {
    campo.addEventListener("input", (e) => {
      const { selectionStart, selectionEnd } = e.target;
      e.target.value = capitalizeText(e.target.value);
      e.target.setSelectionRange(selectionStart, selectionEnd);
    });
  });

  // Instagram: livre
  if (els.editDossierInstagram) {
    els.editDossierInstagram.addEventListener("input", () => {});
  }
};

export {
  formatCurrency,
  capitalizeText,
  getQty,
  phoneMask,
  atualizarRelogio,
  formatInactivityTime,
  copyToClipboard,
};

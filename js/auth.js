import {
  auth,
  db,
  ref,
  set,
  get,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  onValue,
  query,
  orderByChild,
  equalTo
} from "./firebase.js";
import { els } from "./dom.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";
import { toggleView, displaySalesHistory } from "./vendas.js";
import { updateUserActivity, monitorOnlineStatus } from "./online.js";
import { updateLogoAndThemeButton } from "./theme.js";

const handleAuthAction = (isLogin, creds) => {
    const email = creds.username.trim() + "@ha.com";
    const password = creds.password;
    const displayName = creds.username.trim();

    if ((isLogin && (!email || password.length < 6)) || (!isLogin && (!displayName || password.length < 6))) {
        showToast("Verifique os campos. A senha precisa ter no mínimo 6 caracteres.", "error");
        return;
    }

    if (isLogin) {
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                const code = error.code;
                const msg = code === 'auth/invalid-credential' ? "Usuário ou senha incorretos." : `Erro: ${code}`;
                showToast(msg, "error");
            });
    } else {
        createUserWithEmailAndPassword(auth, email, password)
            .then(userCredential => {
                const user = userCredential.user;
                return updateProfile(user, { displayName: displayName })
                    .then(() => {
                        const userRef = ref(db, `usuarios/${user.uid}`);
                        const newUserProfile = { 
                            displayName: displayName,
                            email: user.email,
                            tag: 'Visitante'
                        };
                        return set(userRef, newUserProfile); 
                    });
            })
            .catch((error) => {
                const code = error.code;
                const msg = code === 'auth/email-already-in-use' ? "Nome de usuário já existe." : `Erro: ${code}`;
                showToast(msg, "error");
            });
    }
};


const authAction = (mode) => {
  const username = (els.username?.value || "").trim();
  const password = els.password?.value || "";

  if (mode === "reset") {
    if (!username) {
      showToast("Digite seu nome de usuário para recuperar a senha.", "error");
      return;
    }
    const email = username + "@ha.com";
    sendPasswordResetEmail(auth, email)
      .then(() => showToast("Email de recuperação enviado (verifique sua caixa e spam).", "success", 5000))
      .catch((error) => {
        const msg = error.code === "auth/user-not-found" ? "Usuário não encontrado." : `Erro: ${error.code}`;
        showToast(msg, "error");
      });
    return;
  }

  const isLogin = mode === "login";
  handleAuthAction(isLogin, { username, password });
};
els.loginBtn.onclick = () => authAction(true);
els.registerUserBtn.onclick = () => authAction(false);
els.logoutBtn.onclick = () => signOut(auth);
els.password.addEventListener('keydown', (e) => { if(e.key === 'Enter') authAction(true); });

els.forgotPasswordLink.onclick = async () => {
    const username = prompt("Digite seu nome de usuário para solicitar a redefinição de senha:");
    if (!username) return;

    const usersRef = ref(db, 'usuarios');
    const snapshot = await get(usersRef);
    let userEmail = null;
    if(snapshot.exists()) {
        snapshot.forEach(child => {
            const userData = child.val();
            if(userData.displayName.toLowerCase() === username.toLowerCase().trim()) {
                userEmail = userData.email;
            }
        });
    }

    if (userEmail) {
        sendPasswordResetEmail(auth, userEmail)
            .then(() => {
                alert("Um e-mail de redefinição de senha foi enviado para o endereço associado a este usuário.");
                showToast("E-mail de redefinição enviado!", "success");
            })
            .catch(err => showToast(`Erro: ${err.message}`, "error"));
    } else {
        showToast("Nome de usuário não encontrado.", "error");
    }
};


const configurarInterfacePorTag = (tag) => {
  const tagUpper = tag ? tag.toUpperCase() : 'VISITANTE';
  
  const userStatusEl = els.userStatus;
  if (state.currentUser && userStatusEl) {
      
      if (state.currentUser.displayName.toLowerCase() === 'snow') {
          userStatusEl.style.display = 'none';
      } else {
          userStatusEl.textContent = `${state.currentUser.displayName} (${tag})`;
          userStatusEl.className = 'user-status-display';
          if (tagUpper === 'ADMIN') {
              userStatusEl.classList.add('tag-admin');
          } else if (tagUpper === 'HELLS') {
              userStatusEl.classList.add('tag-hells');
          } else {
              userStatusEl.classList.add('tag-visitante');
          }
          userStatusEl.style.display = 'block';
      }
  }

  if (tagUpper === 'ADMIN') {
    els.clearHistoryBtn.style.display = 'inline-block';
    els.adminPanelBtn.style.display = 'inline-block';
  } else {
    els.clearHistoryBtn.style.display = 'none';
    els.adminPanelBtn.style.display = 'none';
  }
  
  if (tagUpper === 'ADMIN' || tagUpper === 'HELLS') {
      els.investigacaoBtn.style.display = 'block';
  } else {
      els.investigacaoBtn.style.display = 'none';
  }
  
  if (tagUpper !== 'ADMIN') {
      els.adminPanel.style.display = 'none';
  }
};



/**
 * Observa o estado de autenticação e monta a UI/Listeners.
 * Replica a lógica do script original, porém usando state/exports.
 */
export const initAuthState = () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.currentUser = user;

      // rastreio online
      updateUserActivity();
      monitorOnlineStatus();

      const userRef = ref(db, `usuarios/${user.uid}`);

      onValue(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            state.currentUserData = snapshot.val();
          } else {
            const newUserProfile = {
              displayName: user.displayName,
              email: user.email,
              tag: "Visitante",
            };
            set(userRef, newUserProfile);
            state.currentUserData = newUserProfile;
          }

          configurarInterfacePorTag(state.currentUserData.tag);

          // listener de vendas (recria conforme permissão)
          if (state.vendasListener) state.vendasListener();

          const userTagUpper = String(state.currentUserData.tag || "").toUpperCase();
          const vendasRef =
            userTagUpper === "ADMIN" || userTagUpper === "HELLS"
              ? ref(db, "vendas")
              : query(ref(db, "vendas"), orderByChild("registradoPorId"), equalTo(user.uid));

          state.vendasListener = onValue(
            vendasRef,
            (vendasSnapshot) => {
              state.vendas = [];
              vendasSnapshot.forEach((child) => {
                state.vendas.push({ id: child.key, ...child.val() });
              });
              if (els.historyCard && els.historyCard.style.display !== "none") {
                displaySalesHistory(state.vendas);
              }
            },
            (error) => {
              console.error("Erro ao carregar vendas: ", error);
              if (error.code !== "PERMISSION_DENIED") {
                showToast("Erro de permissão ao carregar histórico.", "error");
              }
            }
          );
        },
        (error) => {
          console.error("Erro ao ler dados do usuário:", error);
          showToast("Erro fatal ao ler permissões do usuário.", "error");
          configurarInterfacePorTag("Visitante");
        }
      );

      if (els.authScreen) els.authScreen.style.display = "none";
      toggleView("main");
    } else {
      // logout
      state.currentUser = null;
      state.currentUserData = null;
      state.vendaOriginalCliente = null;
      state.vendaOriginalOrganizacao = null;

      if (state.vendasListener) state.vendasListener();
      state.vendasListener = null;
      state.vendas = [];

      if (els.authScreen) els.authScreen.style.display = "block";
      if (els.mainCard) els.mainCard.style.display = "none";
      if (els.historyCard) els.historyCard.style.display = "none";
      if (els.adminPanel) els.adminPanel.style.display = "none";
      if (els.dossierCard) els.dossierCard.style.display = "none";
      if (els.userStatus) els.userStatus.style.display = "none";
      if (els.investigacaoBtn) els.investigacaoBtn.style.display = "none";
    }

    // atualiza logos/botão tema (caso algo ainda não tenha sido inicializado)
    const savedTheme = localStorage.getItem("theme") || "light";
    updateLogoAndThemeButton(savedTheme === "dark");
  });
};


export const initAuthHandlers = () => {
  if (els.loginBtn) els.loginBtn.onclick = () => authAction("login");
  if (els.registerUserBtn) els.registerUserBtn.onclick = () => authAction("register");
  if (els.logoutBtn) els.logoutBtn.onclick = () => signOut(auth);
  if (els.forgotPasswordLink)
    els.forgotPasswordLink.onclick = (e) => {
      e.preventDefault();
      authAction("reset");
    };
};
};
export { handleAuthAction, authAction, configurarInterfacePorTag };

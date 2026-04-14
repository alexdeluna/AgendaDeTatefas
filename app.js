const STORAGE_KEY = "agenda_tarefas_pwa_v1";
const THEME_KEY = "agenda_tarefas_tema_v1";

const state = {
  tarefas: [],
  urgenciaSelecionada: "leve"
};

document.addEventListener("DOMContentLoaded", () => {
  carregarDados();
  aplicarTemaSalvo();
  sugerirDataAtual();
  bindEvents();
  renderAll();
  registrarSW();
});

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.addEventListener("click", () => {
      const screenId = el.getAttribute("data-screen");
      showScreen(screenId);
    });
  });

  document.getElementById("btnTema").addEventListener("click", alternarTema);

  document.querySelectorAll(".btn-urgencia").forEach((btn) => {
    btn.addEventListener("click", () => selecionarUrgencia(btn.dataset.urgencia));
  });

  document.getElementById("btnAdicionar").addEventListener("click", adicionarTarefa);
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  const alvo = document.getElementById(screenId);
  if (alvo) alvo.classList.add("active");
}

function selecionarUrgencia(valor) {
  state.urgenciaSelecionada = valor;

  document.querySelectorAll(".btn-urgencia").forEach((btn) => {
    btn.classList.toggle("ativo", btn.dataset.urgencia === valor);
  });
}

function sugerirDataAtual() {
  const input = document.getElementById("prazoTarefa");
  if (!input || input.value) return;

  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  input.value = agora.toISOString().slice(0, 16);
}

function adicionarTarefa() {
  const nome = document.getElementById("nomeTarefa").value.trim();
  const prazo = document.getElementById("prazoTarefa").value;

  if (!nome) {
    alert("Informe o nome da tarefa.");
    return;
  }

  if (!prazo) {
    alert("Informe o prazo de conclusão.");
    return;
  }

  const tarefa = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    nome,
    prazo,
    urgencia: state.urgenciaSelecionada,
    status: "pendente",
    createdAt: Date.now(),
    concluidaEm: null,
    editando: false,
    editUrgencia: null
  };

  state.tarefas.push(tarefa);
  salvarDados();
  limparFormulario();
  renderAll();
  showScreen("screen-consultar");
}

function limparFormulario() {
  document.getElementById("nomeTarefa").value = "";
  sugerirDataAtual();
  selecionarUrgencia("leve");
}

function carregarDados() {
  const bruto = localStorage.getItem(STORAGE_KEY);
  if (!bruto) {
    state.tarefas = [];
    return;
  }

  try {
    const dados = JSON.parse(bruto);
    state.tarefas = Array.isArray(dados) ? dados : [];
  } catch {
    state.tarefas = [];
  }
}

function salvarDados() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tarefas));
}

function alternarTema() {
  const escuro = document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, escuro ? "dark" : "light");
}

function aplicarTemaSalvo() {
  const tema = localStorage.getItem(THEME_KEY);
  document.body.classList.toggle("dark", tema === "dark");
}

function registrarSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./sw.js");
      } catch (erro) {
        console.error("Erro ao registrar service worker:", erro);
      }
    });
  }
}

function renderAll() {
  atualizarAlertaHoje();
  renderConsultar();
  renderConcluidas();
  renderHistorico();
}

function atualizarAlertaHoje() {
  const el = document.getElementById("alertaHoje");
  if (!el) return;

  const hoje = inicioDoDia(new Date()).getTime();
  const amanha = hoje + 86400000;

  const total = state.tarefas.filter((t) => {
    if (t.status !== "pendente") return false;
    const prazoMs = new Date(t.prazo).getTime();
    return prazoMs >= hoje && prazoMs < amanha;
  }).length;

  el.textContent = `Você tem ${total} tarefa${total === 1 ? "" : "s"} para vencer hoje.`;
}

function getTarefasPendentesOrdenadas() {
  return state.tarefas
    .filter((t) => t.status === "pendente")
    .sort(ordenarTarefas);
}

function getTarefasConcluidasRecentes() {
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return state.tarefas
    .filter((t) => t.status === "concluida" && t.concluidaEm && t.concluidaEm >= limite)
    .sort((a, b) => b.concluidaEm - a.concluidaEm);
}

function getTarefasHistorico() {
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return state.tarefas
    .filter((t) => t.status === "concluida" && t.concluidaEm && t.concluidaEm < limite)
    .sort((a, b) => b.concluidaEm - a.concluidaEm);
}

function ordenarTarefas(a, b) {
  const prazoA = new Date(a.prazo).getTime();
  const prazoB = new Date(b.prazo).getTime();

  if (prazoA !== prazoB) return prazoA - prazoB;

  const urgA = pesoUrgencia(a.urgencia);
  const urgB = pesoUrgencia(b.urgencia);

  if (urgA !== urgB) return urgB - urgA;

  return a.createdAt - b.createdAt;
}

function pesoUrgencia(urgencia) {
  if (urgencia === "alto") return 3;
  if (urgencia === "medio") return 2;
  return 1;
}

function renderConsultar() {
  const lista = document.getElementById("listaConsultar");
  const tarefas = getTarefasPendentesOrdenadas();

  if (!tarefas.length) {
    lista.innerHTML = `<div class="card vazio">Nenhuma tarefa pendente.</div>`;
    return;
  }

  lista.innerHTML = tarefas.map((t) => montarCardTarefa(t, "consultar")).join("");
  ativarEventosCards("consultar");
}

function renderConcluidas() {
  const lista = document.getElementById("listaConcluidas");
  const tarefas = getTarefasConcluidasRecentes();

  if (!tarefas.length) {
    lista.innerHTML = `<div class="card vazio">Nenhuma tarefa concluída nesta semana.</div>`;
    return;
  }

  lista.innerHTML = tarefas.map((t) => montarCardTarefa(t, "concluidas")).join("");
  ativarEventosCards("concluidas");
}

function renderHistorico() {
  const lista = document.getElementById("listaHistorico");
  const tarefas = getTarefasHistorico();

  if (!tarefas.length) {
    lista.innerHTML = `<div class="card vazio">Nenhuma tarefa antiga no histórico.</div>`;
    return;
  }

  lista.innerHTML = tarefas.map((t) => montarCardTarefa(t, "historico")).join("");
  ativarEventosCards("historico");
}

function montarCardTarefa(tarefa, origem) {
  const prazoFormatado = formatarDataHora(tarefa.prazo);
  const concluidaEm = tarefa.concluidaEm ? formatarDataHora(tarefa.concluidaEm) : "";
  const statusPrazo = tarefa.status === "concluida" ? obterStatusPrazo(tarefa) : "";
  const statusClasse = statusPrazo === "Concluída no prazo" ? "status-ok" : "status-atraso";

  return `
    <div class="task-card card">
      <div class="task-topo">
        <h3 class="task-titulo">${escapeHtml(tarefa.nome)}</h3>
        <span class="tag ${tarefa.urgencia}">${textoUrgencia(tarefa.urgencia)}</span>
      </div>

      <div class="task-info">
        <div><strong>Prazo:</strong> ${prazoFormatado}</div>
        ${
          tarefa.status === "concluida"
            ? `<div><strong>Concluída em:</strong> ${concluidaEm}</div>`
            : `<div><strong>Status:</strong> Pendente</div>`
        }
      </div>

      ${
        tarefa.status === "concluida"
          ? `<div class="status-prazo ${statusClasse}">${statusPrazo}</div>`
          : ""
      }

      ${
        tarefa.editando
          ? montarBoxEdicao(tarefa)
          : ""
      }

      ${
        !tarefa.editando
          ? montarAcoesNormais(tarefa, origem)
          : montarAcoesEdicao(tarefa.id)
      }
    </div>
  `;
}

function montarAcoesNormais(tarefa, origem) {
  if (origem === "consultar") {
    return `
      <div class="task-acoes-3">
        <button class="btn btn-sucesso acao-concluir" data-id="${tarefa.id}" type="button">Concluir</button>
        <button class="btn btn-alerta acao-editar" data-id="${tarefa.id}" type="button">Editar</button>
        <button class="btn btn-perigo acao-excluir" data-id="${tarefa.id}" type="button">Excluir</button>
      </div>
    `;
  }

  return `
    <div class="task-acoes">
      <button class="btn btn-alerta acao-editar" data-id="${tarefa.id}" type="button">Editar</button>
      <button class="btn btn-perigo acao-excluir" data-id="${tarefa.id}" type="button">Excluir</button>
    </div>
  `;
}

function montarAcoesEdicao(id) {
  return `
    <div class="task-acoes">
      <button class="btn btn-primario acao-salvar" data-id="${id}" type="button">Salvar</button>
      <button class="btn btn-neutro acao-cancelar" data-id="${id}" type="button">Cancelar</button>
    </div>
  `;
}

function montarBoxEdicao(tarefa) {
  const urg = tarefa.editUrgencia || tarefa.urgencia;

  return `
    <div class="edit-box">
      <input class="edit-nome" data-id="${tarefa.id}" type="text" value="${escapeAttr(tarefa.nome)}" maxlength="120" />
      <input class="edit-prazo" data-id="${tarefa.id}" type="datetime-local" value="${formatarParaInput(tarefa.prazo)}" />

      <div class="edit-urgencias">
        <button class="mini-urg leve ${urg === "leve" ? "ativo" : ""}" data-id="${tarefa.id}" data-urg="leve" type="button">Leve</button>
        <button class="mini-urg medio ${urg === "medio" ? "ativo" : ""}" data-id="${tarefa.id}" data-urg="medio" type="button">Médio</button>
        <button class="mini-urg alta ${urg === "alto" ? "ativo" : ""}" data-id="${tarefa.id}" data-urg="alto" type="button">Alto</button>
      </div>
    </div>
  `;
}

function ativarEventosCards() {
  document.querySelectorAll(".acao-concluir").forEach((btn) => {
    btn.addEventListener("click", () => concluirTarefa(btn.dataset.id));
  });

  document.querySelectorAll(".acao-excluir").forEach((btn) => {
    btn.addEventListener("click", () => excluirTarefa(btn.dataset.id));
  });

  document.querySelectorAll(".acao-editar").forEach((btn) => {
    btn.addEventListener("click", () => editarTarefa(btn.dataset.id));
  });

  document.querySelectorAll(".acao-cancelar").forEach((btn) => {
    btn.addEventListener("click", () => cancelarEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".acao-salvar").forEach((btn) => {
    btn.addEventListener("click", () => salvarEdicao(btn.dataset.id));
  });

  document.querySelectorAll(".mini-urg").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const urg = btn.dataset.urg;
      const tarefa = state.tarefas.find((t) => t.id === id);
      if (!tarefa) return;
      tarefa.editUrgencia = urg;
      renderAll();
    });
  });
}

function concluirTarefa(id) {
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;

  tarefa.status = "concluida";
  tarefa.concluidaEm = Date.now();
  tarefa.editando = false;
  tarefa.editUrgencia = null;

  salvarDados();
  renderAll();
}

function excluirTarefa(id) {
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;

  const ok = confirm(`Deseja excluir a tarefa "${tarefa.nome}"?`);
  if (!ok) return;

  state.tarefas = state.tarefas.filter((t) => t.id !== id);
  salvarDados();
  renderAll();
}

function editarTarefa(id) {
  state.tarefas.forEach((t) => {
    t.editando = t.id === id;
    if (t.id === id) {
      t.editUrgencia = t.urgencia;
    }
  });

  renderAll();
}

function cancelarEdicao(id) {
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;

  tarefa.editando = false;
  tarefa.editUrgencia = null;
  renderAll();
}

function salvarEdicao(id) {
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;

  const nomeInput = document.querySelector(`.edit-nome[data-id="${id}"]`);
  const prazoInput = document.querySelector(`.edit-prazo[data-id="${id}"]`);

  if (!nomeInput || !prazoInput) return;

  const novoNome = nomeInput.value.trim();
  const novoPrazo = prazoInput.value;

  if (!novoNome) {
    alert("Informe o nome da tarefa.");
    return;
  }

  if (!novoPrazo) {
    alert("Informe o prazo da tarefa.");
    return;
  }

  tarefa.nome = novoNome;
  tarefa.prazo = novoPrazo;
  tarefa.urgencia = tarefa.editUrgencia || tarefa.urgencia;
  tarefa.editando = false;
  tarefa.editUrgencia = null;

  salvarDados();
  renderAll();
}

function obterStatusPrazo(tarefa) {
  if (!tarefa.concluidaEm) return "";
  const prazo = new Date(tarefa.prazo).getTime();
  return tarefa.concluidaEm <= prazo ? "Concluída no prazo" : "Concluída com atraso";
}

function textoUrgencia(urgencia) {
  if (urgencia === "alto") return "Alto";
  if (urgencia === "medio") return "Médio";
  return "Leve";
}

function formatarDataHora(data) {
  const d = new Date(data);
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatarParaInput(data) {
  const d = new Date(data);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function escapeHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(texto) {
  return escapeHtml(texto);
}

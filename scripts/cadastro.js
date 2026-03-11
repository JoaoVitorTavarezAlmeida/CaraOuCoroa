const idInput = document.getElementById('jogadorId');
const nomeInput = document.getElementById('nomeJogador');
const cursoSelect = document.getElementById('cursoJogador');
const turnoSelect = document.getElementById('turnoJogador');
const mensagem = document.getElementById('mensagemCadastro');
const corpo = document.getElementById('corpoJogadores');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const tituloFormulario = document.getElementById('tituloFormulario');

let cacheJogadores = [];

function criarOpcao(valor, texto) {
  const option = document.createElement('option');
  option.value = valor;
  option.textContent = texto;
  return option;
}

function preencherSelect(select, itens, placeholder) {
  select.textContent = '';
  select.appendChild(criarOpcao('', placeholder));
  itens.forEach((item) => select.appendChild(criarOpcao(item, item)));
}

function mostrarMensagem(texto, tipo = 'sucesso') {
  mensagem.textContent = texto;
  mensagem.className = tipo === 'erro' ? 'mensagem-erro' : 'mensagem-sucesso';
}

function limparFormulario() {
  idInput.value = '';
  nomeInput.value = '';
  cursoSelect.value = '';
  turnoSelect.value = '';
  tituloFormulario.textContent = 'Novo jogador';
  btnSalvar.textContent = 'Salvar jogador';
  btnCancelar.style.display = 'none';
}

function editarJogador(id) {
  const jogador = cacheJogadores.find(item => item.id === id);
  if (!jogador) return;

  idInput.value = jogador.id;
  nomeInput.value = jogador.nome;
  cursoSelect.value = jogador.curso;
  turnoSelect.value = jogador.turno;
  tituloFormulario.textContent = `Editando: ${jogador.nome}`;
  btnSalvar.textContent = 'Atualizar jogador';
  btnCancelar.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirJogador(id) {
  const jogador = cacheJogadores.find(item => item.id === id);
  if (!jogador) return;
  const confirmou = confirm(`Deseja realmente excluir ${jogador.nome}?`);
  if (!confirmou) return;

  const resposta = await fetch('/excluir-jogador', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(data.erro || 'Erro ao excluir jogador.', 'erro');
    return;
  }

  mostrarMensagem(data.mensagem || 'Jogador excluído com sucesso.');
  if (String(idInput.value) === String(id)) limparFormulario();
  await carregarJogadores();
}

function montarBotaoAcao(texto, classe, onClick) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = classe;
  botao.textContent = texto;
  botao.addEventListener('click', onClick);
  return botao;
}

function renderJogadores(jogadores) {
  cacheJogadores = jogadores;
  corpo.textContent = '';

  jogadores.forEach((jogador) => {
    const linha = document.createElement('tr');

    const colunas = [jogador.id, jogador.nome, jogador.curso, jogador.turno];
    colunas.forEach((valor) => {
      const td = document.createElement('td');
      td.textContent = String(valor);
      linha.appendChild(td);
    });

    const tdAcoes = document.createElement('td');
    const acoes = document.createElement('div');
    acoes.className = 'acoes-tabela';
    acoes.appendChild(montarBotaoAcao('Editar', 'acao-editar', () => editarJogador(Number(jogador.id))));
    acoes.appendChild(montarBotaoAcao('Excluir', 'acao-excluir', () => excluirJogador(Number(jogador.id))));
    tdAcoes.appendChild(acoes);
    linha.appendChild(tdAcoes);

    corpo.appendChild(linha);
  });
}

async function carregarJogadores() {
  const resposta = await fetch('/jogadores');
  const data = await resposta.json();
  preencherSelect(cursoSelect, data.cursos || [], 'Selecione o curso');
  preencherSelect(turnoSelect, data.turnos || [], 'Selecione o turno');
  renderJogadores(data.jogadores || []);
}

async function salvarJogador() {
  const id = idInput.value.trim();
  const nome = nomeInput.value.trim();
  const curso = cursoSelect.value;
  const turno = turnoSelect.value;

  const rota = id ? '/editar-jogador' : '/cadastrar-jogador';
  const corpoRequisicao = id ? { id: Number(id), nome, curso, turno } : { nome, curso, turno };

  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoRequisicao)
  });

  const data = await resposta.json();
  if (!resposta.ok) {
    mostrarMensagem(data.erro || 'Erro ao salvar jogador.', 'erro');
    return;
  }

  mostrarMensagem(id ? `Jogador ${data.jogador.nome} atualizado com sucesso.` : `Jogador ${data.jogador.nome} cadastrado com sucesso.`);
  limparFormulario();
  await carregarJogadores();
}

btnSalvar.addEventListener('click', salvarJogador);
btnCancelar.addEventListener('click', limparFormulario);
btnCancelar.style.display = 'none';

carregarJogadores().catch((erro) => {
  console.error(erro);
  mostrarMensagem('Erro ao carregar cadastro.', 'erro');
});

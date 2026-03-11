const filtroJogador = document.getElementById('filtroJogador');
const filtroCurso = document.getElementById('filtroCurso');
const filtroTurno = document.getElementById('filtroTurno');
const corpoHistorico = document.getElementById('corpoHistorico');
const mensagemHistorico = document.getElementById('mensagemHistorico');

function criarOpcao(valor, texto) {
  const option = document.createElement('option');
  option.value = String(valor);
  option.textContent = texto;
  return option;
}

function preencherSelect(select, itens, placeholder, valueKey = null, textKey = null) {
  select.textContent = '';
  select.appendChild(criarOpcao('', placeholder));
  itens.forEach((item) => {
    const value = valueKey ? item[valueKey] : item;
    const text = textKey ? item[textKey] : item;
    select.appendChild(criarOpcao(value, text));
  });
}

function montarQuery() {
  const params = new URLSearchParams();
  if (filtroJogador.value) params.set('jogador_id', filtroJogador.value);
  if (filtroCurso.value) params.set('curso', filtroCurso.value);
  if (filtroTurno.value) params.set('turno', filtroTurno.value);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '-';
  const data = new Date(`${dataIso}Z`);
  if (Number.isNaN(data.getTime())) return dataIso;
  return data.toLocaleString('pt-BR');
}

function criarCelula(texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  return td;
}

async function carregarHistorico() {
  const resposta = await fetch('/historico' + montarQuery());
  const data = await resposta.json();
  const jogos = data.jogos || [];

  if (!filtroJogador.dataset.loaded) {
    preencherSelect(filtroJogador, data.filtros?.jogadores || [], 'Todos os jogadores', 'id', 'nome');
    preencherSelect(filtroCurso, data.filtros?.cursos || [], 'Todos os cursos');
    preencherSelect(filtroTurno, data.filtros?.turnos || [], 'Todos os turnos');
    filtroJogador.dataset.loaded = 'true';
  }

  corpoHistorico.textContent = '';

  if (!jogos.length) {
    mensagemHistorico.textContent = 'Nenhum jogo encontrado para os filtros selecionados.';
    return;
  }

  mensagemHistorico.textContent = `Total de partidas encontradas: ${jogos.length}`;

  jogos.forEach((jogo) => {
    const linha = document.createElement('tr');
    linha.appendChild(criarCelula(String(jogo.id)));
    linha.appendChild(criarCelula(formatarDataHora(jogo.criado_em)));
    linha.appendChild(criarCelula(jogo.jogador1));
    linha.appendChild(criarCelula(jogo.escolha1));
    linha.appendChild(criarCelula(`${jogo.curso1} / ${jogo.turno1}`));
    linha.appendChild(criarCelula(jogo.jogador2));
    linha.appendChild(criarCelula(jogo.escolha2));
    linha.appendChild(criarCelula(`${jogo.curso2} / ${jogo.turno2}`));
    linha.appendChild(criarCelula(jogo.resultado));
    linha.appendChild(criarCelula(jogo.vencedor));
    corpoHistorico.appendChild(linha);
  });
}

document.getElementById('btnFiltrar').addEventListener('click', carregarHistorico);
document.getElementById('btnLimpar').addEventListener('click', () => {
  filtroJogador.value = '';
  filtroCurso.value = '';
  filtroTurno.value = '';
  carregarHistorico();
});

carregarHistorico().catch((erro) => {
  console.error('Erro ao carregar histórico:', erro);
  mensagemHistorico.textContent = 'Erro ao carregar o histórico.';
});

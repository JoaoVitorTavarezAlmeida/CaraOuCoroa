let graficoMoeda;
let graficoVitorias;

function setText(id, valor) {
  document.getElementById(id).textContent = valor;
}

function renderTabela(id, linhas, campo) {
  const corpo = document.getElementById(id);
  corpo.textContent = '';

  if (!linhas.length) {
    const linha = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Nenhum dado disponível.';
    linha.appendChild(td);
    corpo.appendChild(linha);
    return;
  }

  linhas.forEach((item) => {
    const linha = document.createElement('tr');
    [item.nome, item.curso, item.turno, item[campo]].forEach((valor) => {
      const td = document.createElement('td');
      td.textContent = String(valor);
      linha.appendChild(td);
    });
    corpo.appendChild(linha);
  });
}

function renderGraficoMoeda(data) {
  const ctx = document.getElementById('graficoMoeda');
  if (graficoMoeda) graficoMoeda.destroy();

  graficoMoeda = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cara', 'Coroa'],
      datasets: [{
        data: [data.total_cara || 0, data.total_coroa || 0],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#ffffff' }
        }
      }
    }
  });
}

function renderGraficoVitorias(ranking) {
  const ctx = document.getElementById('graficoVitorias');
  if (graficoVitorias) graficoVitorias.destroy();

  graficoVitorias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ranking.map((item) => item.nome),
      datasets: [{
        label: 'Vitórias',
        data: ranking.map((item) => item.vitorias),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#ffffff' },
          grid: { color: 'rgba(255,255,255,0.08)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#ffffff', precision: 0 },
          grid: { color: 'rgba(255,255,255,0.08)' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#ffffff' }
        }
      }
    }
  });
}

function carregarEstatisticas() {
  fetch('/estatisticas')
    .then(res => res.json())
    .then((data) => {
      setText('totalJogos', data.total_jogos || 0);
      setText('totalCara', data.total_cara || 0);
      setText('totalCoroa', data.total_coroa || 0);
      setText('percentualCara', `${data.percentual_cara || 0}%`);
      setText('percentualCoroa', `${data.percentual_coroa || 0}%`);
      setText('quemMaisJogou', data.jogador_mais_ativo ? `${data.jogador_mais_ativo.nome} (${data.jogador_mais_ativo.partidas})` : '-');
      setText('turnoMaisJogou', data.turno_mais_ativo ? `${data.turno_mais_ativo.turno} (${data.turno_mais_ativo.total})` : '-');
      setText('cursoMaisJogou', data.curso_mais_ativo ? `${data.curso_mais_ativo.curso} (${data.curso_mais_ativo.total})` : '-');
      setText('campeaoDoDia', data.campeao_do_dia ? `${data.campeao_do_dia.nome} (${data.campeao_do_dia.vitorias})` : '-');

      renderTabela('rankingJogadores', data.ranking_atividade || [], 'partidas');
      renderTabela('rankingVitorias', data.ranking_vitorias || [], 'vitorias');
      renderGraficoMoeda(data);
      renderGraficoVitorias(data.ranking_vitorias || []);
    })
    .catch((erro) => {
      console.error('Erro ao carregar estatísticas:', erro);
    });
}

carregarEstatisticas();

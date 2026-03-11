import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, renderer, coin;
let animando = false;
let jogadores = [];

const container = document.getElementById("moeda3d");
const textoResultado = document.getElementById("textoResultado");
const textoRodapeResultado = document.getElementById("textoRodapeResultado");
const btnJogar = document.getElementById("btnJogar");
const selectJogador1 = document.getElementById("jogador1");
const selectJogador2 = document.getElementById("jogador2");
const infoJogador1 = document.getElementById("infoJogador1");
const infoJogador2 = document.getElementById("infoJogador2");

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 4);
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth || 260, container.clientHeight || 260);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const light1 = new THREE.DirectionalLight(0xffffff, 2);
light1.position.set(3, 3, 4);
scene.add(light1);
const light2 = new THREE.DirectionalLight(0xffffff, 1);
light2.position.set(-3, 2, 2);
scene.add(light2);

new GLTFLoader().load(
  "/models/moeda_cartoon_detalhada.glb",
  (gltf) => {
    coin = gltf.scene;
    coin.scale.set(1.6, 1.6, 1.6);
    scene.add(coin);
  },
  undefined,
  (erro) => {
    console.error("Erro ao carregar moeda 3D:", erro);
    textoResultado.textContent = "Erro ao carregar a moeda 3D.";
  }
);

window.addEventListener("resize", () => {
  const largura = container.clientWidth || 260;
  const altura = container.clientHeight || 260;
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  renderer.setSize(largura, altura);
});

function loop() {
  requestAnimationFrame(loop);
  renderer.render(scene, camera);
}
loop();

function criarOpcao(valor, texto) {
  const option = document.createElement('option');
  option.value = String(valor);
  option.textContent = texto;
  return option;
}

function preencherSelectJogadores(select) {
  select.textContent = '';
  select.appendChild(criarOpcao('', 'Selecione um jogador'));
  jogadores.forEach((jogador) => {
    select.appendChild(criarOpcao(jogador.id, jogador.nome));
  });
}

function animarMoeda(resultadoFinal) {
  if (!coin) return Promise.resolve();
  animando = true;
  const duracao = 2000;
  const inicio = performance.now();
  const rotacaoInicialX = coin.rotation.x;
  const rotacaoInicialY = coin.rotation.y;
  const voltas = Math.PI * 8;
  const rotacaoFinalX = resultadoFinal === "cara" ? 0 : Math.PI;

  return new Promise((resolve) => {
    function passo(agora) {
      const t = Math.min((agora - inicio) / duracao, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      coin.rotation.x = rotacaoInicialX + (rotacaoFinalX - rotacaoInicialX + voltas) * ease;
      coin.rotation.y = rotacaoInicialY * (1 - ease);
      coin.position.y = Math.sin(t * Math.PI) * 0.5;

      if (t < 1) {
        requestAnimationFrame(passo);
      } else {
        coin.position.y = 0;
        coin.rotation.x = rotacaoFinalX;
        coin.rotation.y = 0;
        animando = false;
        resolve();
      }
    }
    requestAnimationFrame(passo);
  });
}

function atualizarInfoJogador(numero) {
  const select = numero === 1 ? selectJogador1 : selectJogador2;
  const alvo = numero === 1 ? infoJogador1 : infoJogador2;
  const jogador = jogadores.find(j => String(j.id) === select.value);
  alvo.textContent = jogador ? `${jogador.curso} • ${jogador.turno}` : "Selecione um jogador.";
}

function preencherSelects() {
  preencherSelectJogadores(selectJogador1);
  preencherSelectJogadores(selectJogador2);
  atualizarInfoJogador(1);
  atualizarInfoJogador(2);
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '';
  const data = new Date(`${dataIso}Z`);
  if (Number.isNaN(data.getTime())) return dataIso;
  return data.toLocaleString('pt-BR');
}

async function carregarResumo() {
  const [resJogadores, resEstatisticas] = await Promise.all([
    fetch('/jogadores'),
    fetch('/estatisticas')
  ]);
  const dadosJogadores = await resJogadores.json();
  const dadosEstatisticas = await resEstatisticas.json();

  document.getElementById('resumoJogadores').textContent = String((dadosJogadores.jogadores || []).length);
  document.getElementById('resumoPartidas').textContent = String(dadosEstatisticas.total_jogos || 0);
  document.getElementById('resumoCampeao').textContent = dadosEstatisticas.campeao_do_dia
    ? `${dadosEstatisticas.campeao_do_dia.nome} (${dadosEstatisticas.campeao_do_dia.vitorias})`
    : '--';
  document.getElementById('resumoAtivo').textContent = dadosEstatisticas.jogador_mais_ativo
    ? `${dadosEstatisticas.jogador_mais_ativo.nome} (${dadosEstatisticas.jogador_mais_ativo.partidas})`
    : '--';
}

async function carregarJogadores() {
  const resposta = await fetch('/jogadores');
  const data = await resposta.json();
  jogadores = data.jogadores || [];
  preencherSelects();

  if (jogadores.length < 2) {
    textoResultado.textContent = 'Cadastre pelo menos 2 jogadores na aba Cadastro.';
    textoRodapeResultado.textContent = '';
    btnJogar.disabled = true;
  } else {
    btnJogar.disabled = false;
    textoResultado.textContent = '';
  }
}

async function jogar() {
  if (animando) return;

  const jogador1Id = Number(selectJogador1.value);
  const jogador2Id = Number(selectJogador2.value);
  const escolha1 = document.getElementById("escolha1").value;
  const escolha2 = document.getElementById("escolha2").value;

  if (!jogador1Id || !jogador2Id) {
    alert("Selecione os dois jogadores.");
    return;
  }
  if (jogador1Id === jogador2Id) {
    alert("Escolha jogadores diferentes.");
    return;
  }
  if (escolha1 === escolha2) {
    alert("Os jogadores precisam escolher lados diferentes.");
    return;
  }

  const jogador1 = jogadores.find(j => j.id === jogador1Id);
  const jogador2 = jogadores.find(j => j.id === jogador2Id);
  const moeda = Math.random() < 0.5 ? "cara" : "coroa";
  const vencedorId = escolha1 === moeda ? jogador1Id : jogador2Id;
  const vencedor = vencedorId === jogador1Id ? jogador1.nome : jogador2.nome;

  btnJogar.disabled = true;
  textoResultado.textContent = 'Jogando...';
  textoRodapeResultado.textContent = 'A moeda está decidindo o vencedor.';

  await animarMoeda(moeda);

  const resposta = await fetch("/jogar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jogador1_id: jogador1Id,
      escolha1,
      jogador2_id: jogador2Id,
      escolha2,
      resultado: moeda,
      vencedor_id: vencedorId
    })
  });

  const data = await resposta.json();
  btnJogar.disabled = jogadores.length < 2;

  if (!resposta.ok) {
    textoResultado.textContent = data.erro || 'Erro ao salvar partida.';
    textoRodapeResultado.textContent = '';
    return;
  }

  const agora = formatarDataHora(new Date().toISOString());
  textoResultado.textContent = `Resultado: ${moeda.toUpperCase()} • Vencedor: ${vencedor}`;
  textoRodapeResultado.textContent = `Partida registrada em ${agora}.`;
  carregarResumo().catch(console.error);
}

selectJogador1.addEventListener('change', () => atualizarInfoJogador(1));
selectJogador2.addEventListener('change', () => atualizarInfoJogador(2));
btnJogar.addEventListener("click", jogar);

Promise.all([carregarJogadores(), carregarResumo()]).catch((erro) => {
  console.error(erro);
  textoResultado.textContent = 'Erro ao carregar dados iniciais.';
});

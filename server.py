from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import sqlite3
import os
import mimetypes
from urllib.parse import urlparse, parse_qs

HOST = "localhost"
PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

CURSOS = [
    "Análise e Desenvolvimento de Sistemas",
    "Ciência da Computação",
    "Sistemas de Informação",
    "Engenharia de Software",
    "Redes de Computadores",
]
TURNOS = ["Manhã", "Tarde", "Noite"]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_conn() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS jogadores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                curso TEXT NOT NULL,
                turno TEXT NOT NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS jogos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jogador1_id INTEGER NOT NULL,
                escolha1 TEXT NOT NULL,
                jogador2_id INTEGER NOT NULL,
                escolha2 TEXT NOT NULL,
                resultado TEXT NOT NULL,
                vencedor_id INTEGER NOT NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (jogador1_id) REFERENCES jogadores(id),
                FOREIGN KEY (jogador2_id) REFERENCES jogadores(id),
                FOREIGN KEY (vencedor_id) REFERENCES jogadores(id)
            )
            """
        )

        colunas = [linha[1] for linha in cursor.execute("PRAGMA table_info(jogos)").fetchall()]
        if "jogador1" in colunas:
            jogos_antigos = cursor.execute(
                "SELECT id, jogador1, escolha1, jogador2, escolha2, resultado, vencedor FROM jogos"
            ).fetchall()

            cursor.execute("ALTER TABLE jogos RENAME TO jogos_legado")
            cursor.execute(
                """
                CREATE TABLE jogos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    jogador1_id INTEGER NOT NULL,
                    escolha1 TEXT NOT NULL,
                    jogador2_id INTEGER NOT NULL,
                    escolha2 TEXT NOT NULL,
                    resultado TEXT NOT NULL,
                    vencedor_id INTEGER NOT NULL,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (jogador1_id) REFERENCES jogadores(id),
                    FOREIGN KEY (jogador2_id) REFERENCES jogadores(id),
                    FOREIGN KEY (vencedor_id) REFERENCES jogadores(id)
                )
                """
            )

            def garantir_jogador(nome):
                existente = cursor.execute("SELECT id FROM jogadores WHERE nome = ?", (nome,)).fetchone()
                if existente:
                    return existente["id"]
                cursor.execute(
                    "INSERT INTO jogadores (nome, curso, turno) VALUES (?, ?, ?)",
                    (nome, "Cadastro legado", "Não informado"),
                )
                return cursor.lastrowid

            for jogo in jogos_antigos:
                j1_id = garantir_jogador(jogo[1])
                j2_id = garantir_jogador(jogo[3])
                vencedor_id = garantir_jogador(jogo[6])
                cursor.execute(
                    """
                    INSERT INTO jogos (id, jogador1_id, escolha1, jogador2_id, escolha2, resultado, vencedor_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (jogo[0], j1_id, jogo[2], j2_id, jogo[4], jogo[5], vencedor_id),
                )
            cursor.execute("DROP TABLE jogos_legado")


class Server(BaseHTTPRequestHandler):
    server_version = "CaraOuCoroa/2.0"

    def _cabecalhos_padrao(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")

    def _enviar_json(self, dados, status=200):
        self.send_response(status)
        self._cabecalhos_padrao()
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(dados, ensure_ascii=False).encode("utf-8"))

    def _enviar_arquivo(self, caminho_relativo):
        caminho = os.path.abspath(os.path.join(BASE_DIR, caminho_relativo.lstrip("/")))

        if not caminho.startswith(BASE_DIR):
            self.send_response(403)
            self._cabecalhos_padrao()
            self.end_headers()
            self.wfile.write(b"Acesso negado")
            return

        if not os.path.exists(caminho) or not os.path.isfile(caminho):
            self.send_response(404)
            self._cabecalhos_padrao()
            self.end_headers()
            self.wfile.write(b"Arquivo nao encontrado")
            return

        tipo, _ = mimetypes.guess_type(caminho)
        if tipo is None:
            tipo = "application/octet-stream"

        self.send_response(200)
        self._cabecalhos_padrao()
        self.send_header("Content-type", tipo)
        self.end_headers()

        with open(caminho, "rb") as arquivo:
            self.wfile.write(arquivo.read())

    def _ler_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 1024 * 1024:
            raise ValueError("Corpo da requisição é grande demais.")
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8")) if body else {}

    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        rota = parsed.path
        params = parse_qs(parsed.query)

        if rota == "/":
            self._enviar_arquivo("index.html")
        elif rota == "/jogadores":
            with get_conn() as conn:
                jogadores = [
                    dict(linha)
                    for linha in conn.execute(
                        "SELECT id, nome, curso, turno, criado_em FROM jogadores ORDER BY nome ASC"
                    ).fetchall()
                ]
            self._enviar_json({"jogadores": jogadores, "cursos": CURSOS, "turnos": TURNOS})
        elif rota == "/historico":
            sql = """
                SELECT
                    j.id,
                    p1.id AS jogador1_id,
                    p1.nome AS jogador1,
                    p1.curso AS curso1,
                    p1.turno AS turno1,
                    j.escolha1,
                    p2.id AS jogador2_id,
                    p2.nome AS jogador2,
                    p2.curso AS curso2,
                    p2.turno AS turno2,
                    j.escolha2,
                    j.resultado,
                    v.id AS vencedor_id,
                    v.nome AS vencedor,
                    j.criado_em
                FROM jogos j
                JOIN jogadores p1 ON p1.id = j.jogador1_id
                JOIN jogadores p2 ON p2.id = j.jogador2_id
                JOIN jogadores v ON v.id = j.vencedor_id
            """
            filtros = []
            valores = []

            jogador_id = params.get("jogador_id", [""])[0].strip()
            curso = params.get("curso", [""])[0].strip()
            turno = params.get("turno", [""])[0].strip()

            if jogador_id:
                filtros.append("(p1.id = ? OR p2.id = ?)")
                valores.extend([jogador_id, jogador_id])
            if curso:
                filtros.append("(p1.curso = ? OR p2.curso = ?)")
                valores.extend([curso, curso])
            if turno:
                filtros.append("(p1.turno = ? OR p2.turno = ?)")
                valores.extend([turno, turno])

            if filtros:
                sql += " WHERE " + " AND ".join(filtros)
            sql += " ORDER BY j.id DESC"

            with get_conn() as conn:
                jogos = [dict(linha) for linha in conn.execute(sql, tuple(valores)).fetchall()]
                jogadores = [
                    dict(linha)
                    for linha in conn.execute("SELECT id, nome FROM jogadores ORDER BY nome ASC").fetchall()
                ]
            self._enviar_json(
                {"jogos": jogos, "filtros": {"jogadores": jogadores, "cursos": CURSOS, "turnos": TURNOS}}
            )
        elif rota == "/estatisticas":
            with get_conn() as conn:
                total_jogos = conn.execute("SELECT COUNT(*) AS total FROM jogos").fetchone()["total"]
                cara = conn.execute("SELECT COUNT(*) AS total FROM jogos WHERE resultado = 'cara'").fetchone()["total"]
                coroa = conn.execute("SELECT COUNT(*) AS total FROM jogos WHERE resultado = 'coroa'").fetchone()["total"]

                jogador_mais_ativo = conn.execute(
                    """
                    SELECT p.nome, COUNT(*) AS partidas
                    FROM jogos j
                    JOIN jogadores p ON p.id = j.jogador1_id OR p.id = j.jogador2_id
                    GROUP BY p.id
                    ORDER BY partidas DESC, p.nome ASC
                    LIMIT 1
                    """
                ).fetchone()

                turno_mais_ativo = conn.execute(
                    """
                    SELECT p.turno AS turno, COUNT(*) AS total
                    FROM jogos j
                    JOIN jogadores p ON p.id IN (j.jogador1_id, j.jogador2_id)
                    GROUP BY p.turno
                    ORDER BY total DESC, p.turno ASC
                    LIMIT 1
                    """
                ).fetchone()

                curso_mais_ativo = conn.execute(
                    """
                    SELECT p.curso AS curso, COUNT(*) AS total
                    FROM jogos j
                    JOIN jogadores p ON p.id IN (j.jogador1_id, j.jogador2_id)
                    GROUP BY p.curso
                    ORDER BY total DESC, p.curso ASC
                    LIMIT 1
                    """
                ).fetchone()

                ranking_atividade = [
                    dict(linha)
                    for linha in conn.execute(
                        """
                        SELECT p.nome, p.curso, p.turno, COUNT(*) AS partidas
                        FROM jogos j
                        JOIN jogadores p ON p.id = j.jogador1_id OR p.id = j.jogador2_id
                        GROUP BY p.id
                        ORDER BY partidas DESC, p.nome ASC
                        LIMIT 10
                        """
                    ).fetchall()
                ]

                ranking_vitorias = [
                    dict(linha)
                    for linha in conn.execute(
                        """
                        SELECT p.nome, p.curso, p.turno, COUNT(*) AS vitorias
                        FROM jogos j
                        JOIN jogadores p ON p.id = j.vencedor_id
                        GROUP BY p.id
                        ORDER BY vitorias DESC, p.nome ASC
                        LIMIT 10
                        """
                    ).fetchall()
                ]

                campeao_do_dia = conn.execute(
                    """
                    SELECT p.nome, COUNT(*) AS vitorias
                    FROM jogos j
                    JOIN jogadores p ON p.id = j.vencedor_id
                    WHERE DATE(j.criado_em, 'localtime') = DATE('now', 'localtime')
                    GROUP BY p.id
                    ORDER BY vitorias DESC, p.nome ASC
                    LIMIT 1
                    """
                ).fetchone()

            percentual_cara = round((cara / total_jogos) * 100, 2) if total_jogos else 0
            percentual_coroa = round((coroa / total_jogos) * 100, 2) if total_jogos else 0

            self._enviar_json(
                {
                    "total_jogos": total_jogos,
                    "total_cara": cara,
                    "total_coroa": coroa,
                    "percentual_cara": percentual_cara,
                    "percentual_coroa": percentual_coroa,
                    "jogador_mais_ativo": dict(jogador_mais_ativo) if jogador_mais_ativo else None,
                    "turno_mais_ativo": dict(turno_mais_ativo) if turno_mais_ativo else None,
                    "curso_mais_ativo": dict(curso_mais_ativo) if curso_mais_ativo else None,
                    "campeao_do_dia": dict(campeao_do_dia) if campeao_do_dia else None,
                    "ranking_atividade": ranking_atividade,
                    "ranking_vitorias": ranking_vitorias,
                }
            )
        else:
            self._enviar_arquivo(rota)

    def do_POST(self):
        rota = urlparse(self.path).path

        try:
            data = self._ler_json()
        except json.JSONDecodeError:
            return self._enviar_json({"erro": "JSON inválido."}, 400)
        except ValueError as erro:
            return self._enviar_json({"erro": str(erro)}, 413)

        if rota == "/cadastrar-jogador":
            nome = data.get("nome", "").strip()
            curso = data.get("curso", "").strip()
            turno = data.get("turno", "").strip()

            if not nome or not curso or not turno:
                return self._enviar_json({"erro": "Preencha nome, curso e turno."}, 400)
            if curso not in CURSOS:
                return self._enviar_json({"erro": "Curso inválido."}, 400)
            if turno not in TURNOS:
                return self._enviar_json({"erro": "Turno inválido."}, 400)

            try:
                with get_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "INSERT INTO jogadores (nome, curso, turno) VALUES (?, ?, ?)",
                        (nome, curso, turno),
                    )
                    jogador = conn.execute(
                        "SELECT id, nome, curso, turno, criado_em FROM jogadores WHERE id = ?",
                        (cursor.lastrowid,),
                    ).fetchone()
                self._enviar_json({"status": "ok", "jogador": dict(jogador)}, 201)
            except sqlite3.IntegrityError:
                self._enviar_json({"erro": "Já existe um jogador cadastrado com esse nome."}, 409)

        elif rota == "/editar-jogador":
            jogador_id = data.get("id")
            nome = data.get("nome", "").strip()
            curso = data.get("curso", "").strip()
            turno = data.get("turno", "").strip()

            if not jogador_id or not nome or not curso or not turno:
                return self._enviar_json({"erro": "Preencha id, nome, curso e turno."}, 400)
            if curso not in CURSOS:
                return self._enviar_json({"erro": "Curso inválido."}, 400)
            if turno not in TURNOS:
                return self._enviar_json({"erro": "Turno inválido."}, 400)

            try:
                jogador_id = int(jogador_id)
            except (TypeError, ValueError):
                return self._enviar_json({"erro": "ID do jogador inválido."}, 400)

            try:
                with get_conn() as conn:
                    cursor = conn.cursor()
                    existente = cursor.execute("SELECT id FROM jogadores WHERE id = ?", (jogador_id,)).fetchone()
                    if not existente:
                        return self._enviar_json({"erro": "Jogador não encontrado."}, 404)

                    cursor.execute(
                        "UPDATE jogadores SET nome = ?, curso = ?, turno = ? WHERE id = ?",
                        (nome, curso, turno, jogador_id),
                    )
                    jogador = conn.execute(
                        "SELECT id, nome, curso, turno, criado_em FROM jogadores WHERE id = ?",
                        (jogador_id,),
                    ).fetchone()
                self._enviar_json({"status": "ok", "jogador": dict(jogador)})
            except sqlite3.IntegrityError:
                self._enviar_json({"erro": "Já existe um jogador cadastrado com esse nome."}, 409)

        elif rota == "/excluir-jogador":
            jogador_id = data.get("id")
            if not jogador_id:
                return self._enviar_json({"erro": "Informe o id do jogador."}, 400)

            try:
                jogador_id = int(jogador_id)
            except (TypeError, ValueError):
                return self._enviar_json({"erro": "ID do jogador inválido."}, 400)

            with get_conn() as conn:
                cursor = conn.cursor()
                jogador = cursor.execute("SELECT nome FROM jogadores WHERE id = ?", (jogador_id,)).fetchone()
                if not jogador:
                    return self._enviar_json({"erro": "Jogador não encontrado."}, 404)

                jogos_relacionados = cursor.execute(
                    "SELECT COUNT(*) AS total FROM jogos WHERE jogador1_id = ? OR jogador2_id = ? OR vencedor_id = ?",
                    (jogador_id, jogador_id, jogador_id),
                ).fetchone()["total"]

                if jogos_relacionados > 0:
                    return self._enviar_json(
                        {"erro": "Não é possível excluir este jogador porque ele já possui partidas registradas."},
                        409,
                    )

                cursor.execute("DELETE FROM jogadores WHERE id = ?", (jogador_id,))
            self._enviar_json({"status": "ok", "mensagem": f"Jogador {jogador['nome']} excluído com sucesso."})

        elif rota == "/jogar":
            try:
                jogador1_id = int(data.get("jogador1_id"))
                jogador2_id = int(data.get("jogador2_id"))
                vencedor_id = int(data.get("vencedor_id"))
            except (TypeError, ValueError):
                return self._enviar_json({"erro": "IDs dos jogadores inválidos."}, 400)

            escolha1 = data.get("escolha1")
            escolha2 = data.get("escolha2")
            resultado = data.get("resultado")

            if not jogador1_id or not jogador2_id:
                return self._enviar_json({"erro": "Selecione dois jogadores."}, 400)
            if jogador1_id == jogador2_id:
                return self._enviar_json({"erro": "Os jogadores devem ser diferentes."}, 400)
            if escolha1 == escolha2:
                return self._enviar_json({"erro": "Os jogadores precisam escolher lados diferentes."}, 400)
            if resultado not in ("cara", "coroa"):
                return self._enviar_json({"erro": "Resultado inválido."}, 400)
            if vencedor_id not in (jogador1_id, jogador2_id):
                return self._enviar_json({"erro": "Vencedor inválido."}, 400)

            with get_conn() as conn:
                jogadores = conn.execute(
                    "SELECT id FROM jogadores WHERE id IN (?, ?)",
                    (jogador1_id, jogador2_id),
                ).fetchall()

                if len(jogadores) < 2:
                    return self._enviar_json({"erro": "Jogador não encontrado."}, 404)

                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO jogos (jogador1_id, escolha1, jogador2_id, escolha2, resultado, vencedor_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (jogador1_id, escolha1, jogador2_id, escolha2, resultado, vencedor_id),
                )
            self._enviar_json({"status": "salvo com sucesso"})
        else:
            self._enviar_json({"erro": "Rota não encontrada."}, 404)


if __name__ == "__main__":
    init_db()
    server = HTTPServer((HOST, PORT), Server)
    print(f"Servidor rodando em http://{HOST}:{PORT}")
    server.serve_forever()

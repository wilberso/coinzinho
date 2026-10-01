// =====================================
// SERVIDOR WEB DO COINZINHO
// Mesmo estilo do painel do leilão: http nativo do Node, sem Express.
// Serve o app (app.html + arquivos do PWA) e a API em /api/*.
//
// Autenticação: o app guarda um token (recebido ao criar a família ou
// entrar num perfil) e manda em todo pedido: "Authorization: Bearer XXX".
// O servidor descobre pelo token QUEM está usando — o app nunca diz
// "eu sou o pai", então um filho não consegue se passar por responsável.
// =====================================
const http = require("http");
const path = require("path");
const fs = require("fs");
const regras = require("./regras");
const estado = require("./estado");
const legal = require("./legal");
const config = require("./config");

// Arquivos públicos do app (o resto da pasta NUNCA é servido).
const ARQUIVOS_ESTATICOS = {
  "/": { arquivo: "app.html", tipo: "text/html; charset=utf-8" },
  "/manifest.json": { arquivo: "manifest.json", tipo: "application/manifest+json" },
  "/sw.js": { arquivo: "sw.js", tipo: "text/javascript; charset=utf-8" },
  "/icone.svg": { arquivo: "icone.svg", tipo: "image/svg+xml" },
  "/icone-192.png": { arquivo: "icone-192.png", tipo: "image/png" },
  "/icone-512.png": { arquivo: "icone-512.png", tipo: "image/png" },
  "/icone-maskable-512.png": { arquivo: "icone-maskable-512.png", tipo: "image/png" },
};

// =====================================
// PÁGINA /conectar (SÓ NO PC)
// Mostra o endereço HTTPS do túnel e um QR code pra abrir nos celulares.
// Pedidos que chegam pelo túnel trazem cabeçalhos "cf-*" da Cloudflare;
// esses são recusados, então só quem está no próprio PC vê essa página.
// =====================================
function ehDoProprioPC(req) {
  const ip = req.socket.remoteAddress || "";
  const veioPeloTunel = !!(req.headers["cf-connecting-ip"] || req.headers["cf-ray"]);
  return !veioPeloTunel && (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1");
}

function paginaConectar() {
  const url = estado.urlPublica;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar celulares — Coinzinho</title>
${url ? "" : '<meta http-equiv="refresh" content="2">'}
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #fff7f2; color: #2b1d16; margin: 0; padding: 32px 16px; text-align: center; }
  .card { background: #fff; border-radius: 24px; padding: 28px; max-width: 460px; margin: 0 auto; box-shadow: 0 6px 24px rgba(120,60,20,.1); }
  #qr { display: inline-block; padding: 14px; background: #fff; border-radius: 16px; margin: 16px 0; }
  .url { font-family: monospace; background: #ffe6da; color: #c2410c; padding: 10px; border-radius: 12px; word-break: break-all; font-size: 15px; }
  ol { text-align: left; line-height: 1.7; }
</style></head><body><div class="card">
<h1>📱 Conectar os celulares</h1>
${url ? `
  <p>Aponte a câmera do Android pro QR code:</p>
  <div id="qr"></div>
  <div class="url">${url}</div>
  <ol>
    <li>Abra o link no <b>Chrome</b> do celular.</li>
    <li>Toque em <b>⋮ → Instalar app</b> (ou no aviso "Adicionar Coinzinho").</li>
    <li>Pronto: o Coinzinho aparece na gaveta de apps.</li>
  </ol>
  <p style="color:#8a776d;font-size:14px">Deixe a janela preta do servidor aberta. Se fechar e abrir de novo, o endereço muda.</p>
  <script>new QRCode(document.getElementById("qr"), { text: ${JSON.stringify(url)}, width: 240, height: 240 });</script>
` : `<p>⏳ Abrindo o túnel HTTPS... (essa página atualiza sozinha)</p>
  <p style="color:#8a776d">Se demorar mais de 1 minuto, veja a janela preta do servidor.</p>`}
</div></body></html>`;
}

// =====================================
// LIMITE DE TENTATIVAS POR IP
// Evita robôs adivinhando códigos de família/PIN ou criando famílias
// em massa. Os IPs ficam só na memória, por poucos minutos (é o que diz
// a Política de Privacidade — não grave IP em arquivo nem em log).
// =====================================
const LIMITES = {
  criarFamilia: { max: 5, janelaMin: 60 },
  entrar: { max: 20, janelaMin: 10 },
  perfis: { max: 30, janelaMin: 10 },
  geral: { max: 600, janelaMin: 1 },
};
const contadores = new Map(); // "grupo|ip" -> { n, desde }

function ipDe(req) {
  if (config.CONFIAR_PROXY) {
    const real = req.headers["x-real-ip"];
    if (real) return String(real).trim();
    const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress || "?";
}

function estourouLimite(grupo, ip) {
  const regra = LIMITES[grupo];
  const chave = `${grupo}|${ip}`;
  const agora = Date.now();
  const c = contadores.get(chave);
  if (!c || agora - c.desde > regra.janelaMin * 60 * 1000) {
    contadores.set(chave, { n: 1, desde: agora });
    return false;
  }
  c.n += 1;
  return c.n > regra.max;
}

// Limpa contadores vencidos a cada 5 minutos (não deixa IP acumulado).
setInterval(() => {
  const agora = Date.now();
  for (const [chave, c] of contadores) {
    const grupo = chave.split("|")[0];
    if (agora - c.desde > LIMITES[grupo].janelaMin * 60 * 1000) contadores.delete(chave);
  }
}, 5 * 60 * 1000).unref();

// =====================================
// CABEÇALHOS DE SEGURANÇA (valem pra toda resposta)
// =====================================
function cabecalhosSeguranca(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (config.CONFIAR_PROXY) res.setHeader("Strict-Transport-Security", "max-age=31536000");
}

function enviarJSON(res, status, dadosResposta) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(dadosResposta));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = "";
    req.on("data", (chunk) => {
      corpo += chunk;
      if (corpo.length > 100 * 1024) {
        reject(new Error("Corpo da requisição muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(corpo ? JSON.parse(corpo) : {});
      } catch (err) {
        reject(new Error("JSON inválido no corpo da requisição"));
      }
    });
    req.on("error", reject);
  });
}

function tokenDa(req) {
  const auth = req.headers["authorization"] || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

// =====================================
// ROTAS
// publica: true = não exige login. Cada rota recebe
// { sessao, corpo, params, query, token } e devolve { ok, ... }.
// =====================================
const ROTAS = [
  // -------- ACESSO --------
  { metodo: "GET", caminho: "/api/saude", publica: true, acao: () => ({ ok: true, app: "Coinzinho" }) },
  { metodo: "GET", caminho: "/api/sobre", publica: true, acao: () => ({ ok: true, desenvolvedor: config.DESENVOLVEDOR, versaoTermos: config.VERSAO_TERMOS }) },
  { metodo: "POST", caminho: "/api/familias", publica: true, limite: "criarFamilia", acao: ({ corpo }) => regras.criarFamilia(corpo) },
  { metodo: "GET", caminho: "/api/familias/:codigo", publica: true, limite: "perfis", acao: ({ params }) => regras.perfisDaFamilia(params.codigo) },
  { metodo: "POST", caminho: "/api/entrar", publica: true, limite: "entrar", acao: ({ corpo }) => regras.entrar(corpo) },
  { metodo: "POST", caminho: "/api/sair", acao: ({ token }) => regras.encerrarSessao(token) },

  // -------- TELA PRINCIPAL E HISTÓRICO --------
  { metodo: "GET", caminho: "/api/painel", acao: ({ sessao }) => regras.painel(sessao.familia, sessao.eu) },
  { metodo: "GET", caminho: "/api/historico", acao: ({ sessao, query }) => regras.historico(sessao.familia, sessao.eu, query) },

  // -------- PERFIS --------
  { metodo: "POST", caminho: "/api/membros", acao: ({ sessao, corpo }) => regras.adicionarMembro(sessao.eu, corpo) },
  { metodo: "POST", caminho: "/api/membros/:id/remover", acao: ({ sessao, params, corpo }) => regras.removerMembro(sessao.eu, params.id, corpo) },

  // -------- TERMOS E DIREITOS DO TITULAR (LGPD) --------
  { metodo: "POST", caminho: "/api/aceitar", acao: ({ sessao, corpo }) => regras.aceitarTermos(sessao.eu, corpo) },
  { metodo: "GET", caminho: "/api/exportar", acao: ({ sessao }) => regras.exportarDados(sessao.familia, sessao.eu) },
  { metodo: "POST", caminho: "/api/familia/excluir", acao: ({ sessao, corpo }) => regras.excluirFamilia(sessao.familia, sessao.eu, corpo) },

  // -------- TAREFAS --------
  { metodo: "POST", caminho: "/api/tarefas", acao: ({ sessao, corpo }) => regras.criarTarefa(sessao.eu, corpo) },
  { metodo: "POST", caminho: "/api/tarefas/:id/concluir", acao: ({ sessao, params }) => regras.concluirTarefa(sessao.eu, params.id) },
  { metodo: "POST", caminho: "/api/tarefas/:id/remover", acao: ({ sessao, params }) => regras.removerTarefa(sessao.eu, params.id) },

  // -------- PEDIDOS --------
  { metodo: "POST", caminho: "/api/pedidos", acao: ({ sessao, corpo }) => regras.criarPedido(sessao.eu, corpo) },
  {
    metodo: "POST",
    caminho: "/api/pedidos/:id/resolver",
    acao: ({ sessao, params, corpo }) => regras.resolverPedido(sessao.eu, params.id, corpo.status),
  },

  // -------- PRESENTE / COBRANÇA / MULTA --------
  { metodo: "POST", caminho: "/api/movimentos", acao: ({ sessao, corpo }) => regras.movimentar(sessao.eu, corpo) },

  // -------- MESADAS --------
  { metodo: "POST", caminho: "/api/mesadas", acao: ({ sessao, corpo }) => regras.criarMesada(sessao.eu, corpo) },
  { metodo: "POST", caminho: "/api/mesadas/:id/remover", acao: ({ sessao, params }) => regras.removerMesada(sessao.eu, params.id) },

  // -------- RECOMPENSAS --------
  { metodo: "POST", caminho: "/api/recompensas", acao: ({ sessao, corpo }) => regras.criarRecompensa(sessao.eu, corpo) },
  {
    metodo: "POST",
    caminho: "/api/recompensas/:id/remover",
    acao: ({ sessao, params }) => regras.removerRecompensa(sessao.eu, params.id),
  },
];

// Transforma "/api/tarefas/:id/concluir" numa regex que captura o :id.
for (const rota of ROTAS) {
  const nomes = [];
  const padrao = rota.caminho.replace(/:(\w+)/g, (_, nome) => {
    nomes.push(nome);
    return "([^/]+)";
  });
  rota.regex = new RegExp(`^${padrao}$`);
  rota.nomesParams = nomes;
}

function acharRota(metodo, pathname) {
  for (const rota of ROTAS) {
    if (rota.metodo !== metodo) continue;
    const m = pathname.match(rota.regex);
    if (!m) continue;
    const params = {};
    rota.nomesParams.forEach((nome, i) => (params[nome] = decodeURIComponent(m[i + 1])));
    return { rota, params };
  }
  return null;
}

function iniciar() {
  const servidor = http.createServer(async (req, res) => {
    let endereco;
    try {
      endereco = new URL(req.url, "http://localhost");
    } catch (err) {
      enviarJSON(res, 400, { ok: false, erro: "URL inválida" });
      return;
    }
    const pathname = endereco.pathname;
    cabecalhosSeguranca(res);
    const ip = ipDe(req);

    if (estourouLimite("geral", ip)) {
      enviarJSON(res, 429, { ok: false, erro: "Muitas requisições. Espere um pouco." });
      return;
    }

    try {
      // -------- TERMOS E PRIVACIDADE --------
      if (req.method === "GET" && (pathname === "/termos" || pathname === "/privacidade")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(pathname === "/termos" ? legal.termos() : legal.privacidade());
        return;
      }

      // -------- ARQUIVOS DO APP --------
      if (req.method === "GET" && ARQUIVOS_ESTATICOS[pathname]) {
        const { arquivo, tipo } = ARQUIVOS_ESTATICOS[pathname];
        const conteudo = fs.readFileSync(path.join(__dirname, arquivo));
        res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-cache" });
        res.end(conteudo);
        return;
      }

      // -------- CONECTAR CELULARES (só no PC) --------
      if (req.method === "GET" && pathname === "/conectar") {
        if (!ehDoProprioPC(req)) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Não encontrado");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(paginaConectar());
        return;
      }

      // -------- API --------
      if (pathname.startsWith("/api/")) {
        const achada = acharRota(req.method, pathname);
        if (!achada) {
          enviarJSON(res, 404, { ok: false, erro: "Rota não encontrada" });
          return;
        }

        if (achada.rota.limite && estourouLimite(achada.rota.limite, ip)) {
          enviarJSON(res, 429, { ok: false, erro: "Muitas tentativas. Espere alguns minutos e tente de novo." });
          return;
        }

        const token = tokenDa(req);
        const sessao = regras.sessaoPorToken(token);
        if (!achada.rota.publica && !sessao) {
          enviarJSON(res, 401, { ok: false, erro: "Sessão expirada. Entre de novo." });
          return;
        }

        // Responsável sem aceite da versão atual dos termos só pode aceitar,
        // sair, baixar ou excluir os dados — o resto fica bloqueado.
        const LIVRES_SEM_ACEITE = ["/api/aceitar", "/api/sair", "/api/familia/excluir"];
        if (
          sessao &&
          req.method === "POST" &&
          sessao.eu.papel === "responsavel" &&
          (!sessao.eu.aceite || sessao.eu.aceite.versao !== config.VERSAO_TERMOS) &&
          !LIVRES_SEM_ACEITE.includes(pathname)
        ) {
          enviarJSON(res, 403, { ok: false, erro: "Aceite os Termos de Uso e a Política de Privacidade pra continuar." });
          return;
        }

        const corpo = req.method === "POST" ? await lerCorpo(req) : {};
        const query = Object.fromEntries(endereco.searchParams.entries());
        const resultado = achada.rota.acao({ sessao, corpo, params: achada.params, query, token });
        enviarJSON(res, resultado.ok ? 200 : 400, resultado);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado");
    } catch (err) {
      console.error("❌ Erro no servidor:", err);
      enviarJSON(res, 500, { ok: false, erro: err.message });
    }
  });

  servidor.listen(config.PORTA, config.ENDERECO, () => {
    console.log(`🪙  Coinzinho rodando em http://localhost:${config.PORTA}`);
  });

  return servidor;
}

module.exports = { iniciar };

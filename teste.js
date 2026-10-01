// =====================================
// TESTE DE PONTA A PONTA DA API
// Sobe o servidor numa pasta de dados temporária, percorre os fluxos
// principais (pai, filho, pedidos, mesada, multas) e confere os saldos.
// Rode com: node teste.js
// =====================================
const os = require("os");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const pastaTeste = fs.mkdtempSync(path.join(os.tmpdir(), "coinzinho-teste-"));
process.env.PASTA_DADOS = pastaTeste;
process.env.PORT = "3199";
process.env.HOST = "127.0.0.1";

const config = require("./config");
const dados = require("./dados");
const web = require("./web");

const BASE = `http://127.0.0.1:${config.PORTA}`;

async function chamar(metodo, caminho, corpo, token) {
  const resp = await fetch(BASE + caminho, {
    method: metodo,
    headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: resp.status, ...(await resp.json()) };
}

let passou = 0;
function ok(cond, descricao) {
  assert.ok(cond, descricao);
  passou++;
  console.log(`  ✅ ${descricao}`);
}

(async () => {
  dados.carregarTudo();
  const servidor = web.iniciar();
  await new Promise((r) => setTimeout(r, 200));

  try {
    // ---- Família e perfis ----
    ok((await chamar("POST", "/api/familias", { nomeFamilia: "Silva", nomeResponsavel: "Wil", rotulo: "Pai", pin: "1234" })).status === 400, "sem aceite dos termos não cria família");
    const fam = await chamar("POST", "/api/familias", { nomeFamilia: "Silva", nomeResponsavel: "Wil", rotulo: "Pai", pin: "1234", aceite: true });
    ok(fam.ok && fam.token && fam.codigo.length === 6, "cria família e devolve token + código");
    const tPai = fam.token;

    ok((await chamar("POST", "/api/familias", { nomeFamilia: "X", nomeResponsavel: "Y", rotulo: "Pai", pin: "1", aceite: true })).status === 400, "valida dados da família");

    const f1 = await chamar("POST", "/api/membros", { nome: "Ana", papel: "filho" }, tPai);
    const f2 = await chamar("POST", "/api/membros", { nome: "Leo", papel: "filho", pin: "4321" }, tPai);
    ok(f1.ok && f2.ok, "pai cadastra dois filhos (o segundo com PIN)");
    const mae = await chamar("POST", "/api/membros", { nome: "Bia", papel: "responsavel", rotulo: "Mãe", pin: "9999" }, tPai);
    ok(mae.ok && mae.membro.temPin, "pai cadastra a mãe com PIN");

    const perfis = await chamar("GET", `/api/familias/${fam.codigo.toLowerCase()}`);
    ok(perfis.ok && perfis.membros.length === 4 && !("pinHash" in perfis.membros[0]) && !("saldo" in perfis.membros[0]), "lista perfis pelo código sem vazar PIN nem saldo");

    ok((await chamar("POST", "/api/entrar", { codigo: fam.codigo, membroId: mae.membro.id, pin: "0000" })).status === 400, "PIN errado é recusado");
    const eMae = await chamar("POST", "/api/entrar", { codigo: fam.codigo, membroId: mae.membro.id, pin: "9999" });
    ok(eMae.ok, "mãe entra com PIN certo");
    const pMae = await chamar("GET", "/api/painel", null, eMae.token);
    ok(pMae.precisaAceitar === true, "mãe cadastrada por outro precisa aceitar no 1º acesso");
    ok((await chamar("POST", "/api/recompensas", { titulo: "Teste", custo: 5 }, eMae.token)).status === 403, "sem aceite, responsável não consegue alterar nada");
    await chamar("POST", "/api/aceitar", { aceite: true }, eMae.token);
    ok((await chamar("GET", "/api/painel", null, eMae.token)).precisaAceitar === false, "depois de aceitar, não pede mais");
    const eAna = await chamar("POST", "/api/entrar", { codigo: fam.codigo, membroId: f1.membro.id });
    ok(eAna.ok, "filha sem PIN entra direto");
    const tAna = eAna.token;
    ok((await chamar("POST", "/api/entrar", { codigo: fam.codigo, membroId: f2.membro.id })).status === 400, "filho com PIN precisa do PIN");

    ok((await chamar("POST", "/api/membros", { nome: "Hacker", papel: "responsavel", rotulo: "Pai", pin: "1111" }, tAna)).status === 400, "filho não cadastra perfis");
    ok((await chamar("GET", "/api/painel")).status === 401, "sem token não acessa o painel");

    // ---- Tarefas ----
    const tar = await chamar("POST", "/api/tarefas", { membroId: f1.membro.id, titulo: "Arrumar a cama", coins: 10, repeticao: "diaria" }, tPai);
    ok(tar.ok, "pai cria tarefa diária");
    const unica = await chamar("POST", "/api/tarefas", { membroId: f1.membro.id, titulo: "Lavar o carro", coins: 50, repeticao: "unica" }, tPai);
    const c1 = await chamar("POST", `/api/tarefas/${tar.tarefa.id}/concluir`, null, tAna);
    ok(c1.ok && c1.saldo === 10, "filha conclui tarefa e ganha 10");
    ok((await chamar("POST", `/api/tarefas/${tar.tarefa.id}/concluir`, null, tAna)).status === 400, "tarefa diária só uma vez por dia");
    await chamar("POST", `/api/tarefas/${unica.tarefa.id}/concluir`, null, tAna);
    ok((await chamar("POST", `/api/tarefas/${unica.tarefa.id}/concluir`, null, tAna)).status === 400, "tarefa única só uma vez");

    // ---- Movimentos ----
    ok((await chamar("POST", "/api/movimentos", { membroId: f1.membro.id, tipo: "cobranca", valor: 999 }, tPai)).status === 400, "cobrança maior que o saldo é recusada");
    const mov = await chamar("POST", "/api/movimentos", { membroId: f1.membro.id, tipo: "multa", valor: 5, motivo: "Videogame" }, tPai);
    ok(mov.ok && mov.saldo === 55, "multa desconta (60 - 5 = 55)");
    const pres = await chamar("POST", "/api/movimentos", { membroId: f1.membro.id, tipo: "presente", valor: 20 }, tPai);
    ok(pres.ok && pres.saldo === 75, "presente credita (55 + 20 = 75)");
    ok((await chamar("POST", "/api/movimentos", { membroId: f1.membro.id, tipo: "presente", valor: 20 }, tAna)).status === 400, "filha não se dá presente");

    // ---- Pedidos e recompensas ----
    const pc = await chamar("POST", "/api/pedidos", { responsavelId: mae.membro.id, valor: 15, motivo: "Sorvete", tipo: "coins" }, tAna);
    ok(pc.ok, "filha pede 15 coins pra mãe");
    const rec = await chamar("POST", "/api/recompensas", { titulo: "1h de videogame", custo: 30 }, tPai);
    const caro = await chamar("POST", "/api/recompensas", { titulo: "Bicicleta", custo: 5000 }, tPai);
    ok((await chamar("POST", "/api/pedidos", { responsavelId: mae.membro.id, tipo: "recompensa", recompensaId: caro.recompensa.id }, tAna)).status === 400, "não pede recompensa sem saldo");
    const pr = await chamar("POST", "/api/pedidos", { responsavelId: mae.membro.id, tipo: "recompensa", recompensaId: rec.recompensa.id }, tAna);
    ok(pr.ok && pr.pedido.valor === 30, "filha pede resgate de recompensa (30)");
    ok((await chamar("POST", `/api/pedidos/${pc.pedido.id}/resolver`, { status: "aprovado" }, tAna)).status === 400, "filha não aprova o próprio pedido");
    await chamar("POST", `/api/pedidos/${pc.pedido.id}/resolver`, { status: "aprovado" }, eMae.token);
    await chamar("POST", `/api/pedidos/${pr.pedido.id}/resolver`, { status: "aprovado" }, eMae.token);
    ok((await chamar("POST", `/api/pedidos/${pr.pedido.id}/resolver`, { status: "aprovado" }, eMae.token)).status === 400, "pedido não é resolvido duas vezes");

    // ---- Mesada ----
    const mes = await chamar("POST", "/api/mesadas", { membroId: f1.membro.id, valor: 7, frequencia: "diaria" }, tPai);
    ok(mes.ok, "pai agenda mesada diária");
    // Simula "ontem": volta a data da última mesada e abre o painel.
    dados.lista("mesadas")[0].ultimaData = "2000-01-01";
    const painelAna = await chamar("GET", "/api/painel", null, tAna);
    ok(painelAna.eu.saldo === 75 + 15 - 30 + 7, `mesada cai ao abrir o app (saldo final ${painelAna.eu.saldo})`);
    const painelAna2 = await chamar("GET", "/api/painel", null, tAna);
    ok(painelAna2.eu.saldo === painelAna.eu.saldo, "mesada não cai duas vezes no mesmo dia");
    ok(painelAna.tarefas.every((t) => t.membroId === f1.membro.id) && painelAna.mesadas.length === 1, "filha só vê o que é dela");

    // ---- Histórico ----
    const hist = await chamar("GET", `/api/historico?membroId=${f1.membro.id}&fluxo=multas`, null, tPai);
    ok(hist.ok && hist.transacoes.length === 1 && hist.transacoes[0].motivo === "Videogame", "histórico filtra multas");
    const soma = (await chamar("GET", "/api/historico", null, tAna)).transacoes.reduce((s, t) => s + t.valor, 0);
    ok(soma === painelAna.eu.saldo, "soma do extrato bate com o saldo");

    // ---- Termos, exportação e exclusão (LGPD) ----
    ok((await chamar("GET", "/api/painel", null, tPai)).precisaAceitar === false, "quem criou a família já aceitou os termos");
    const termos = await fetch(BASE + "/termos").then((r) => r.text());
    const priv = await fetch(BASE + "/privacidade").then((r) => r.text());
    ok(termos.includes(config.DESENVOLVEDOR.nome) && priv.includes(config.DESENVOLVEDOR.email), "termos e privacidade mostram desenvolvedor e contato");
    const exp = await chamar("GET", "/api/exportar", null, tPai);
    ok(exp.ok && exp.exportacao.transacoes.length > 0 && !JSON.stringify(exp).includes("pinHash"), "exporta dados da família sem o hash do PIN");
    ok((await chamar("GET", "/api/exportar", null, tAna)).status === 400, "filho não exporta dados");
    ok((await chamar("POST", `/api/membros/${f2.membro.id}/remover`, { pin: "0000" }, tPai)).status === 400, "remover perfil exige PIN certo");
    ok((await chamar("POST", `/api/membros/${f2.membro.id}/remover`, { pin: "1234" }, tPai)).ok, "pai remove perfil do filho com PIN");
    ok((await chamar("GET", `/api/familias/${fam.codigo}`)).membros.length === 3, "perfil removido some da família");

    // ---- Sair ----
    await chamar("POST", "/api/sair", null, tAna);
    ok((await chamar("GET", "/api/painel", null, tAna)).status === 401, "depois de sair o token não vale mais");

    ok(fs.existsSync(path.join(pastaTeste, "transacoes.json")), "dados gravados em arquivos JSON");
    ok(dados.backupDoDia("2026-01-01") && fs.existsSync(path.join(pastaTeste, "backups", "2026-01-01", "membros.json")), "backup diário copia os JSON");

    // ---- Excluir família inteira ----
    ok((await chamar("POST", "/api/familia/excluir", { pin: "1234", confirmacao: "errado" }, tPai)).status === 400, "excluir família exige digitar o código");
    ok((await chamar("POST", "/api/familia/excluir", { pin: "1234", confirmacao: fam.codigo }, tPai)).ok, "pai exclui a família");
    const sobrou = ["familias", "membros", "tarefas", "transacoes", "pedidos", "mesadas", "recompensas", "sessoes"].reduce((n, c) => n + dados.lista(c).length, 0);
    ok(sobrou === 0, "nenhum dado da família sobra depois da exclusão");
    ok((await chamar("GET", "/api/painel", null, tPai)).status === 401, "sessões da família excluída deixam de valer");

    // ---- Limite de tentativas por IP ----
    let bloqueou = false;
    for (let i = 0; i < 40 && !bloqueou; i++) bloqueou = (await chamar("GET", "/api/familias/ZZZZZZ")).status === 429;
    ok(bloqueou, "muitas buscas de código seguidas são bloqueadas (429)");
    console.log(`\n🎉 ${passou} verificações passaram.`);
  } catch (err) {
    console.error("\n❌ FALHOU:", err.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
    fs.rmSync(pastaTeste, { recursive: true, force: true });
  }
})();

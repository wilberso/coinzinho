// =====================================
// REGRAS DO COINZINHO
// Toda a lógica de negócio fica aqui: família, perfis, tarefas, pedidos,
// mesada, multas e recompensas. O web.js só recebe a requisição, chama a
// função certa e devolve o resultado.
//
// Padrão de retorno (igual ao leilão): { ok: true, ... } quando deu certo,
// ou { ok: false, erro: "mensagem pro usuário" } quando não deu.
// =====================================
const crypto = require("crypto");
const config = require("./config");
const dados = require("./dados");

const CORES_AVATAR = ["#FF6B35", "#FF9800", "#0288D1", "#2E7D32", "#7C4DFF", "#E91E63", "#00897B", "#F4511E"];

// Sem 0/O, 1/I/L — evita confusão na hora de digitar o código da família.
const LETRAS_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const LIMITE_VALOR = 100000;

// =====================================
// UTILITÁRIOS
// =====================================
function novoId() {
  return crypto.randomUUID();
}

function agoraISO() {
  return new Date().toISOString();
}

// "Hoje" no fuso da família (YYYY-MM-DD). Usado pra tarefa diária e mesada.
function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.FUSO }).format(new Date());
}

function erro(mensagem) {
  return { ok: false, erro: mensagem };
}

function texto(valor, min, max) {
  const t = String(valor || "").trim();
  if (t.length < min || t.length > max) return null;
  return t;
}

function valorInteiro(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > LIMITE_VALOR) return null;
  return n;
}

function corValida(cor) {
  return CORES_AVATAR.includes(cor) ? cor : CORES_AVATAR[Math.floor(Math.random() * CORES_AVATAR.length)];
}

// =====================================
// PIN DOS PAIS
// O PIN nunca é salvo em texto puro: guardamos só um hash (scrypt) com
// "sal" aleatório. Mesmo quem abrir o membros.json não descobre o PIN.
// =====================================
function pinValido(pin) {
  return /^\d{4,6}$/.test(String(pin || ""));
}

function gerarHashPin(pin) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pin), sal, 32).toString("hex");
  return `${sal}:${hash}`;
}

function conferirPin(pin, guardado) {
  if (!guardado) return false;
  const [sal, hash] = guardado.split(":");
  const tentativa = crypto.scryptSync(String(pin || ""), sal, 32);
  const esperado = Buffer.from(hash, "hex");
  return tentativa.length === esperado.length && crypto.timingSafeEqual(tentativa, esperado);
}

// Tentativas erradas ficam só na memória (reiniciar zera — tudo bem).
const tentativasPin = new Map();

function pinBloqueado(membroId) {
  const t = tentativasPin.get(membroId);
  return !!t && t.bloqueadoAte && t.bloqueadoAte > Date.now();
}

function registrarErroPin(membroId) {
  const t = tentativasPin.get(membroId) || { erros: 0, bloqueadoAte: 0 };
  t.erros += 1;
  if (t.erros >= config.MAX_TENTATIVAS_PIN) {
    t.erros = 0;
    t.bloqueadoAte = Date.now() + config.MINUTOS_BLOQUEIO_PIN * 60 * 1000;
  }
  tentativasPin.set(membroId, t);
}

// =====================================
// BUSCAS
// =====================================
function familiaPorCodigo(codigo) {
  const c = String(codigo || "").toUpperCase().trim();
  return dados.lista("familias").find((f) => f.codigo === c) || null;
}

function membro(familiaId, membroId) {
  return dados.lista("membros").find((m) => m.id === membroId && m.familiaId === familiaId) || null;
}

function membrosDa(familiaId) {
  return dados
    .lista("membros")
    .filter((m) => m.familiaId === familiaId)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

// O que pode sair do servidor sobre um membro (nunca o hash do PIN).
function membroPublico(m) {
  return {
    id: m.id,
    nome: m.nome,
    papel: m.papel,
    rotulo: m.rotulo || null,
    cor: m.cor,
    saldo: m.saldo,
    temPin: !!m.pinHash,
  };
}

function nomePorId(familiaId) {
  const mapa = {};
  for (const m of membrosDa(familiaId)) mapa[m.id] = m.nome;
  return mapa;
}

// =====================================
// SESSÕES (LOGIN NO CELULAR)
// Diferente do painel do leilão (token só na memória), aqui a sessão fica
// salva em sessoes.json: a família não precisa entrar de novo toda vez
// que o servidor reiniciar.
// =====================================
function criarSessao(m) {
  const token = crypto.randomBytes(24).toString("hex");
  dados.lista("sessoes").push({ token, membroId: m.id, familiaId: m.familiaId, criadoEm: agoraISO() });
  dados.salvar("sessoes");
  return token;
}

function sessaoPorToken(token) {
  if (!token) return null;
  const s = dados.lista("sessoes").find((x) => x.token === token);
  if (!s) return null;
  const validade = new Date(s.criadoEm).getTime() + config.DIAS_SESSAO * 24 * 60 * 60 * 1000;
  if (Date.now() > validade) return null;
  const m = membro(s.familiaId, s.membroId);
  if (!m) return null;
  const familia = dados.lista("familias").find((f) => f.id === s.familiaId);
  return familia ? { familia, eu: m } : null;
}

// Remove sessões vencidas (chamado 1x por dia pelo servidor.js).
function limparSessoesVencidas() {
  const limite = Date.now() - config.DIAS_SESSAO * 24 * 60 * 60 * 1000;
  return dados.removerOnde("sessoes", (s) => new Date(s.criadoEm).getTime() < limite);
}

function encerrarSessao(token) {
  const sessoes = dados.lista("sessoes");
  const i = sessoes.findIndex((x) => x.token === token);
  if (i >= 0) {
    sessoes.splice(i, 1);
    dados.salvar("sessoes");
  }
  return { ok: true };
}

// =====================================
// TRANSAÇÕES (EXTRATO)
// Todo movimento de coins passa por aqui: grava no extrato e atualiza o
// saldo do filho. "valor" é positivo (entrada) ou negativo (saída).
// =====================================
function registrarTransacao(filho, tipo, valor, motivo, autor) {
  const tx = {
    id: novoId(),
    familiaId: filho.familiaId,
    membroId: filho.id,
    tipo, // tarefa | pedido | mesada | presente | cobranca | multa | resgate
    valor,
    motivo: motivo || "",
    autorId: autor ? autor.id : null,
    autorNome: autor ? autor.nome : null,
    criadoEm: agoraISO(),
  };
  dados.lista("transacoes").push(tx);
  filho.saldo += valor;
  dados.salvar("transacoes");
  dados.salvar("membros");
  return tx;
}

// =====================================
// MESADA AUTOMÁTICA
// Não tem "cron": sempre que alguém abre o app (e a cada hora, pelo
// servidor.js) verificamos se alguma mesada venceu e creditamos.
// O campo "ultimaData" garante que nunca credita duas vezes no mesmo período.
// =====================================
function rodarMesadasVencidas(familiaId) {
  const dia = hoje();
  let mudou = false;
  for (const mesada of dados.lista("mesadas")) {
    if (!mesada.ativa) continue;
    if (familiaId && mesada.familiaId !== familiaId) continue;

    let vencida = false;
    if (mesada.frequencia === "diaria") {
      vencida = mesada.ultimaData !== dia;
    } else {
      const dd = String(Math.min(mesada.diaDoMes || 1, 28)).padStart(2, "0");
      const dataAlvo = `${dia.slice(0, 8)}${dd}`;
      vencida = dia >= dataAlvo && (!mesada.ultimaData || mesada.ultimaData < dataAlvo);
    }
    if (!vencida) continue;

    const filho = membro(mesada.familiaId, mesada.membroId);
    if (!filho) continue;
    const motivo = mesada.frequencia === "diaria" ? "Mesada diária" : `Mesada mensal (dia ${mesada.diaDoMes})`;
    registrarTransacao(filho, "mesada", mesada.valor, motivo, null);
    mesada.ultimaData = dia;
    mudou = true;
  }
  if (mudou) dados.salvar("mesadas");
}

// =====================================
// FAMÍLIA E PERFIS
// =====================================
function gerarCodigo() {
  let codigo;
  do {
    codigo = Array.from({ length: 6 }, () => LETRAS_CODIGO[crypto.randomInt(LETRAS_CODIGO.length)]).join("");
  } while (familiaPorCodigo(codigo));
  return codigo;
}

function registroDeAceite() {
  return { versao: config.VERSAO_TERMOS, em: agoraISO() };
}

function criarFamilia({ nomeFamilia, nomeResponsavel, rotulo, pin, cor, aceite }) {
  // Consentimento do responsável legal (LGPD art. 14): sem aceite, sem cadastro.
  if (aceite !== true) return erro("Para criar a família, aceite os Termos de Uso e a Política de Privacidade.");
  const nomeF = texto(nomeFamilia, 2, 40);
  const nomeR = texto(nomeResponsavel, 2, 30);
  if (!nomeF) return erro("Dê um nome pra família (2 a 40 letras).");
  if (!nomeR) return erro("Informe seu nome (2 a 30 letras).");
  if (!["Pai", "Mãe"].includes(rotulo)) return erro("Escolha Pai ou Mãe.");
  if (!pinValido(pin)) return erro("O PIN precisa ter de 4 a 6 números.");

  const familia = { id: novoId(), nome: nomeF, codigo: gerarCodigo(), criadoEm: agoraISO() };
  dados.lista("familias").push(familia);
  dados.salvar("familias");

  const responsavel = {
    id: novoId(),
    familiaId: familia.id,
    nome: nomeR,
    papel: "responsavel",
    rotulo,
    cor: corValida(cor),
    saldo: 0,
    pinHash: gerarHashPin(pin),
    aceite: registroDeAceite(),
    criadoEm: agoraISO(),
  };
  dados.lista("membros").push(responsavel);
  dados.salvar("membros");

  return { ok: true, token: criarSessao(responsavel), codigo: familia.codigo };
}

// Tela "Entrar": com o código, mostra os perfis pra escolher.
function perfisDaFamilia(codigo) {
  const familia = familiaPorCodigo(codigo);
  if (!familia) return erro("Família não encontrada. Confira o código.");
  return {
    ok: true,
    familia: { nome: familia.nome, codigo: familia.codigo },
    membros: membrosDa(familia.id).map((m) => {
      const p = membroPublico(m);
      delete p.saldo;
      return p;
    }),
  };
}

function entrar({ codigo, membroId, pin }) {
  const familia = familiaPorCodigo(codigo);
  if (!familia) return erro("Família não encontrada. Confira o código.");
  const m = membro(familia.id, membroId);
  if (!m) return erro("Perfil não encontrado.");

  if (m.pinHash) {
    if (pinBloqueado(m.id)) return erro(`Muitas tentativas. Espere ${config.MINUTOS_BLOQUEIO_PIN} minutos.`);
    if (!conferirPin(pin, m.pinHash)) {
      registrarErroPin(m.id);
      return erro("PIN incorreto.");
    }
    tentativasPin.delete(m.id);
  }
  return { ok: true, token: criarSessao(m) };
}

// Só pais cadastram filhos ou outro responsável (no original qualquer um
// com o código conseguia se cadastrar — aqui não).
function adicionarMembro(eu, { nome, papel, rotulo, cor, pin }) {
  if (eu.papel !== "responsavel") return erro("Só pai ou mãe cadastram perfis.");
  const n = texto(nome, 2, 30);
  if (!n) return erro("Informe o nome (2 a 30 letras).");
  if (!["filho", "responsavel"].includes(papel)) return erro("Tipo de perfil inválido.");

  const novo = {
    id: novoId(),
    familiaId: eu.familiaId,
    nome: n,
    papel,
    rotulo: null,
    cor: corValida(cor),
    saldo: 0,
    pinHash: null,
    criadoEm: agoraISO(),
  };

  if (papel === "responsavel") {
    if (!["Pai", "Mãe"].includes(rotulo)) return erro("Escolha Pai ou Mãe.");
    if (!pinValido(pin)) return erro("O PIN do responsável precisa ter de 4 a 6 números.");
    novo.rotulo = rotulo;
    novo.pinHash = gerarHashPin(pin);
  } else if (pin) {
    // PIN de filho é opcional (ex.: pra um irmão não entrar no perfil do outro).
    if (!pinValido(pin)) return erro("O PIN precisa ter de 4 a 6 números.");
    novo.pinHash = gerarHashPin(pin);
  }

  dados.lista("membros").push(novo);
  dados.salvar("membros");
  return { ok: true, membro: membroPublico(novo) };
}

// =====================================
// PAINEL (TELA PRINCIPAL)
// Pai/mãe vê a família inteira; filho vê só o que é dele.
// =====================================
function painel(familia, eu) {
  rodarMesadasVencidas(familia.id);
  const nomes = nomePorId(familia.id);
  const souFilho = eu.papel === "filho";
  const daFamilia = (x) => x.familiaId === familia.id && (!souFilho || x.membroId === eu.id);
  const maisNovoPrimeiro = (a, b) => b.criadoEm.localeCompare(a.criadoEm);
  const comNomes = (x) => ({ ...x, membroNome: nomes[x.membroId] || "?", responsavelNome: nomes[x.responsavelId] });

  const membros = membrosDa(familia.id).map(membroPublico);
  const pedidos = dados.lista("pedidos").filter(daFamilia).sort(maisNovoPrimeiro).map(comNomes);

  return {
    ok: true,
    hoje: hoje(),
    // Responsável que ainda não aceitou (ou aceitou uma versão antiga)
    // precisa aceitar antes de continuar usando.
    precisaAceitar: eu.papel === "responsavel" && (!eu.aceite || eu.aceite.versao !== config.VERSAO_TERMOS),
    versaoTermos: config.VERSAO_TERMOS,
    familia: { nome: familia.nome, codigo: familia.codigo },
    eu: membroPublico(eu),
    membros,
    filhos: membros.filter((m) => m.papel === "filho"),
    tarefas: dados.lista("tarefas").filter((t) => t.ativa && daFamilia(t)).sort(maisNovoPrimeiro),
    pedidosPendentes: pedidos.filter((p) => p.status === "pendente"),
    pedidosResolvidos: pedidos.filter((p) => p.status !== "pendente").slice(0, 10),
    mesadas: dados.lista("mesadas").filter((m) => m.ativa && daFamilia(m)).sort(maisNovoPrimeiro).map(comNomes),
    recompensas: dados
      .lista("recompensas")
      .filter((r) => r.ativa && r.familiaId === familia.id)
      .sort((a, b) => a.custo - b.custo),
    ultimasTransacoes: dados.lista("transacoes").filter(daFamilia).sort(maisNovoPrimeiro).slice(0, 20).map(comNomes),
  };
}

// Histórico filtrável: por filho e por fluxo (entradas, saídas, multas).
function historico(familia, eu, { membroId, fluxo }) {
  const nomes = nomePorId(familia.id);
  let lista = dados.lista("transacoes").filter((t) => t.familiaId === familia.id);
  if (eu.papel === "filho") lista = lista.filter((t) => t.membroId === eu.id);
  else if (membroId && membroId !== "todos") lista = lista.filter((t) => t.membroId === membroId);

  if (fluxo === "entradas") lista = lista.filter((t) => t.valor > 0);
  else if (fluxo === "saidas") lista = lista.filter((t) => t.valor < 0);
  else if (fluxo === "multas") lista = lista.filter((t) => t.tipo === "multa");

  return {
    ok: true,
    transacoes: lista
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 200)
      .map((t) => ({ ...t, membroNome: nomes[t.membroId] || "?" })),
  };
}

// =====================================
// VALIDAÇÕES COMUNS
// =====================================
function exigirResponsavel(eu) {
  return eu.papel === "responsavel" ? null : erro("Só pai ou mãe podem fazer isso.");
}

function filhoDaFamilia(eu, membroId) {
  const filho = membro(eu.familiaId, membroId);
  if (!filho || filho.papel !== "filho") return null;
  return filho;
}

function itemDaFamilia(colecao, eu, id) {
  return dados.lista(colecao).find((x) => x.id === id && x.familiaId === eu.familiaId) || null;
}

// =====================================
// TAREFAS
// "unica": vale uma vez. "diaria": pode ser concluída uma vez por dia.
// =====================================
function criarTarefa(eu, { membroId, titulo, coins, repeticao }) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const filho = filhoDaFamilia(eu, membroId);
  if (!filho) return erro("Escolha um filho.");
  const t = texto(titulo, 2, 60);
  if (!t) return erro("Dê um nome pra tarefa (2 a 60 letras).");
  const v = valorInteiro(coins);
  if (!v) return erro("Informe quantos coins a tarefa vale.");
  if (!["unica", "diaria"].includes(repeticao)) return erro("Repetição inválida.");

  const tarefa = {
    id: novoId(),
    familiaId: eu.familiaId,
    membroId: filho.id,
    titulo: t,
    coins: v,
    repeticao,
    ativa: true,
    concluida: false,
    ultimaConclusao: null,
    criadoEm: agoraISO(),
  };
  dados.lista("tarefas").push(tarefa);
  dados.salvar("tarefas");
  return { ok: true, tarefa };
}

function concluirTarefa(eu, tarefaId) {
  const tarefa = itemDaFamilia("tarefas", eu, tarefaId);
  if (!tarefa || !tarefa.ativa) return erro("Tarefa não encontrada.");
  if (eu.papel === "filho" && tarefa.membroId !== eu.id) return erro("Essa tarefa não é sua.");
  const dia = hoje();
  if (tarefa.repeticao === "diaria" && tarefa.ultimaConclusao === dia) return erro("Você já concluiu essa tarefa hoje.");
  if (tarefa.repeticao === "unica" && tarefa.concluida) return erro("Essa tarefa já foi concluída.");

  const filho = membro(eu.familiaId, tarefa.membroId);
  registrarTransacao(filho, "tarefa", tarefa.coins, `Tarefa: ${tarefa.titulo}`, eu.papel === "responsavel" ? eu : null);
  tarefa.ultimaConclusao = dia;
  if (tarefa.repeticao === "unica") tarefa.concluida = true;
  dados.salvar("tarefas");
  return { ok: true, coins: tarefa.coins, saldo: filho.saldo };
}

function removerItem(colecao, campoAtivo, eu, id, mensagemNaoAchou) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const item = itemDaFamilia(colecao, eu, id);
  if (!item) return erro(mensagemNaoAchou);
  item[campoAtivo] = false;
  dados.salvar(colecao);
  return { ok: true };
}

// =====================================
// PEDIDOS DO FILHO
// "coins": filho pede X coins (se aprovado, ganha).
// "recompensa": filho quer resgatar um item da loja (se aprovado, paga).
// =====================================
function criarPedido(eu, { responsavelId, valor, motivo, tipo, recompensaId }) {
  if (eu.papel !== "filho") return erro("Só filhos fazem pedidos.");
  const responsavel = membro(eu.familiaId, responsavelId);
  if (!responsavel || responsavel.papel !== "responsavel") return erro("Escolha pra quem é o pedido.");

  let v;
  let m = String(motivo || "").trim().slice(0, 120);
  if (tipo === "recompensa") {
    const r = itemDaFamilia("recompensas", eu, recompensaId);
    if (!r || !r.ativa) return erro("Recompensa não encontrada.");
    if (eu.saldo < r.custo) return erro(`Faltam ${r.custo - eu.saldo} coins pra essa recompensa.`);
    v = r.custo;
    m = `Resgate: ${r.titulo}`;
  } else if (tipo === "coins") {
    v = valorInteiro(valor);
    if (!v) return erro("Informe quantos coins você quer.");
  } else {
    return erro("Tipo de pedido inválido.");
  }

  const pedido = {
    id: novoId(),
    familiaId: eu.familiaId,
    membroId: eu.id,
    responsavelId: responsavel.id,
    tipo,
    recompensaId: tipo === "recompensa" ? recompensaId : null,
    valor: v,
    motivo: m,
    status: "pendente",
    resolvidoPor: null,
    resolvidoPorNome: null,
    criadoEm: agoraISO(),
    resolvidoEm: null,
  };
  dados.lista("pedidos").push(pedido);
  dados.salvar("pedidos");
  return { ok: true, pedido };
}

function resolverPedido(eu, pedidoId, status) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  if (!["aprovado", "recusado"].includes(status)) return erro("Status inválido.");
  const pedido = itemDaFamilia("pedidos", eu, pedidoId);
  if (!pedido) return erro("Pedido não encontrado.");
  if (pedido.status !== "pendente") return erro("Esse pedido já foi resolvido.");

  const filho = membro(eu.familiaId, pedido.membroId);
  if (!filho) return erro("Filho não encontrado.");

  if (status === "aprovado") {
    if (pedido.tipo === "recompensa") {
      if (filho.saldo < pedido.valor) return erro("Saldo insuficiente pra esse resgate.");
      registrarTransacao(filho, "resgate", -pedido.valor, pedido.motivo, eu);
    } else {
      registrarTransacao(filho, "pedido", pedido.valor, pedido.motivo || "Pedido aprovado", eu);
    }
  }
  pedido.status = status;
  pedido.resolvidoPor = eu.id;
  pedido.resolvidoPorNome = eu.nome;
  pedido.resolvidoEm = agoraISO();
  dados.salvar("pedidos");
  return { ok: true, pedido };
}

// =====================================
// MOVIMENTOS DOS PAIS: PRESENTE, COBRANÇA E MULTA
// Cobrança não deixa o saldo ficar negativo. Multa pode (é castigo:
// o filho fica "devendo" e vai pagando com as próximas tarefas).
// =====================================
const MOTIVO_PADRAO = { presente: "Presente dos pais", cobranca: "Cobrança dos pais", multa: "Multa" };

function movimentar(eu, { membroId, tipo, valor, motivo }) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const filho = filhoDaFamilia(eu, membroId);
  if (!filho) return erro("Escolha um filho.");
  if (!MOTIVO_PADRAO[tipo]) return erro("Tipo de movimento inválido.");
  const v = valorInteiro(valor);
  if (!v) return erro("Informe o valor em coins.");
  if (tipo === "cobranca" && filho.saldo < v) return erro(`${filho.nome} só tem ${filho.saldo} coins.`);

  const m = String(motivo || "").trim().slice(0, 120) || MOTIVO_PADRAO[tipo];
  const tx = registrarTransacao(filho, tipo, tipo === "presente" ? v : -v, m, eu);
  return { ok: true, transacao: tx, saldo: filho.saldo };
}

// =====================================
// MESADAS AGENDADAS
// =====================================
function criarMesada(eu, { membroId, valor, frequencia, diaDoMes }) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const filho = filhoDaFamilia(eu, membroId);
  if (!filho) return erro("Escolha um filho.");
  const v = valorInteiro(valor);
  if (!v) return erro("Informe o valor da mesada.");
  if (!["diaria", "mensal"].includes(frequencia)) return erro("Frequência inválida.");
  let dia = null;
  if (frequencia === "mensal") {
    dia = Number(diaDoMes);
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) return erro("Escolha um dia do mês entre 1 e 28.");
  }

  const mesada = {
    id: novoId(),
    familiaId: eu.familiaId,
    membroId: filho.id,
    valor: v,
    frequencia,
    diaDoMes: dia,
    ativa: true,
    // Começa "já paga hoje" pra não creditar na hora em que é criada
    // (se quiser dar algo agora, use Presentear).
    ultimaData: frequencia === "diaria" ? hoje() : null,
    criadoEm: agoraISO(),
  };
  if (frequencia === "mensal") {
    const dd = String(dia).padStart(2, "0");
    const alvoDesteMes = `${hoje().slice(0, 8)}${dd}`;
    if (hoje() >= alvoDesteMes) mesada.ultimaData = alvoDesteMes;
  }
  dados.lista("mesadas").push(mesada);
  dados.salvar("mesadas");
  return { ok: true, mesada };
}

// =====================================
// RECOMPENSAS (LOJA)
// =====================================
function criarRecompensa(eu, { titulo, custo }) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const t = texto(titulo, 2, 60);
  if (!t) return erro("Dê um nome pra recompensa (2 a 60 letras).");
  const c = valorInteiro(custo);
  if (!c) return erro("Informe o custo em coins.");
  const recompensa = { id: novoId(), familiaId: eu.familiaId, titulo: t, custo: c, ativa: true, criadoEm: agoraISO() };
  dados.lista("recompensas").push(recompensa);
  dados.salvar("recompensas");
  return { ok: true, recompensa };
}

// =====================================
// ACEITE DOS TERMOS (responsável cadastrado por outro, ou termos novos)
// =====================================
function aceitarTermos(eu, { aceite }) {
  if (eu.papel !== "responsavel") return erro("Só pai ou mãe aceitam os termos.");
  if (aceite !== true) return erro("Marque a caixa de aceite pra continuar.");
  eu.aceite = registroDeAceite();
  dados.salvar("membros");
  return { ok: true };
}

// =====================================
// DIREITOS DO TITULAR (LGPD art. 18)
// Pai/mãe podem baixar todos os dados da família e excluir tudo
// (ou só o perfil de um filho). Exclusão é definitiva.
// =====================================
const COLECOES_DA_FAMILIA = ["tarefas", "transacoes", "pedidos", "mesadas", "recompensas"];

function exportarDados(familia, eu) {
  const bloqueio = exigirResponsavel(eu);
  if (bloqueio) return bloqueio;
  const daFamilia = (x) => x.familiaId === familia.id;
  const exportacao = {
    geradoEm: agoraISO(),
    aviso: "Cópia de todos os dados da sua família guardados no Coinzinho.",
    familia: { nome: familia.nome, codigo: familia.codigo, criadoEm: familia.criadoEm },
    membros: membrosDa(familia.id).map((m) => ({ ...membroPublico(m), criadoEm: m.criadoEm, aceite: m.aceite || null })),
  };
  for (const colecao of COLECOES_DA_FAMILIA) exportacao[colecao] = dados.lista(colecao).filter(daFamilia);
  return { ok: true, exportacao };
}

function exigirPinDe(eu, pin) {
  if (!eu.pinHash) return null;
  if (pinBloqueado(eu.id)) return erro(`Muitas tentativas. Espere ${config.MINUTOS_BLOQUEIO_PIN} minutos.`);
  if (!conferirPin(pin, eu.pinHash)) {
    registrarErroPin(eu.id);
    return erro("PIN incorreto.");
  }
  return null;
}

function excluirFamilia(familia, eu, { pin, confirmacao }) {
  const bloqueio = exigirResponsavel(eu) || exigirPinDe(eu, pin);
  if (bloqueio) return bloqueio;
  if (String(confirmacao || "").trim().toUpperCase() !== familia.codigo) {
    return erro("Digite o código da família pra confirmar a exclusão.");
  }
  const daFamilia = (x) => x.familiaId === familia.id;
  for (const colecao of [...COLECOES_DA_FAMILIA, "sessoes", "membros"]) dados.removerOnde(colecao, daFamilia);
  dados.removerOnde("familias", (f) => f.id === familia.id);
  console.log(`🗑️  Família excluída a pedido do responsável (${new Date().toISOString()})`);
  return { ok: true };
}

function removerMembro(eu, membroId, { pin }) {
  const bloqueio = exigirResponsavel(eu) || exigirPinDe(eu, pin);
  if (bloqueio) return bloqueio;
  const alvo = membro(eu.familiaId, membroId);
  if (!alvo) return erro("Perfil não encontrado.");
  if (alvo.id === eu.id) return erro("Você não pode remover o próprio perfil. Para sair de tudo, exclua a família.");
  const doMembro = (x) => x.familiaId === eu.familiaId && x.membroId === alvo.id;
  for (const colecao of ["tarefas", "transacoes", "pedidos", "mesadas", "sessoes"]) dados.removerOnde(colecao, doMembro);
  // Pedidos que eram endereçados a um responsável removido continuam
  // existindo (são do filho), mas sem destino: viram "recusados".
  for (const p of dados.lista("pedidos")) {
    if (p.familiaId === eu.familiaId && p.responsavelId === alvo.id && p.status === "pendente") {
      p.status = "recusado";
      p.resolvidoPorNome = "perfil removido";
      p.resolvidoEm = agoraISO();
    }
  }
  dados.salvar("pedidos");
  dados.removerOnde("membros", (m) => m.id === alvo.id);
  return { ok: true };
}

module.exports = {
  CORES_AVATAR,
  aceitarTermos,
  exportarDados,
  excluirFamilia,
  removerMembro,
  hoje,
  sessaoPorToken,
  encerrarSessao,
  limparSessoesVencidas,
  rodarMesadasVencidas,
  criarFamilia,
  perfisDaFamilia,
  entrar,
  adicionarMembro,
  painel,
  historico,
  criarTarefa,
  concluirTarefa,
  removerTarefa: (eu, id) => removerItem("tarefas", "ativa", eu, id, "Tarefa não encontrada."),
  criarPedido,
  resolverPedido,
  movimentar,
  criarMesada,
  removerMesada: (eu, id) => removerItem("mesadas", "ativa", eu, id, "Mesada não encontrada."),
  criarRecompensa,
  removerRecompensa: (eu, id) => removerItem("recompensas", "ativa", eu, id, "Recompensa não encontrada."),
};

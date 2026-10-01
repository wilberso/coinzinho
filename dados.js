// =====================================
// DADOS (ARQUIVOS JSON)
// Mesmo esquema do leilão (lotes.json, interessados.json): cada "tabela"
// é um arquivo JSON dentro da pasta dados/. Tudo é carregado na memória
// quando o servidor sobe e regravado no disco a cada alteração.
//
// A gravação é feita num arquivo temporário e depois renomeada: se o PC
// desligar no meio, o arquivo antigo continua inteiro (não corrompe).
// =====================================
const fs = require("fs");
const path = require("path");
const config = require("./config");

const COLECOES = [
  "familias",
  "membros",
  "tarefas",
  "transacoes",
  "pedidos",
  "mesadas",
  "recompensas",
  "sessoes",
];

const memoria = {};

function arquivoDa(colecao) {
  return path.join(config.PASTA_DADOS, `${colecao}.json`);
}

function carregarTudo() {
  fs.mkdirSync(config.PASTA_DADOS, { recursive: true });
  for (const colecao of COLECOES) {
    try {
      memoria[colecao] = JSON.parse(fs.readFileSync(arquivoDa(colecao), "utf8"));
    } catch (err) {
      memoria[colecao] = [];
    }
  }
}

// Devolve a lista (em memória) de uma coleção. Alterou? Chame salvar().
function lista(colecao) {
  if (!memoria[colecao]) throw new Error(`Coleção desconhecida: ${colecao}`);
  return memoria[colecao];
}

function salvar(colecao) {
  const destino = arquivoDa(colecao);
  const temporario = `${destino}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(memoria[colecao], null, 2));
  fs.renameSync(temporario, destino);
}

// Remove de uma coleção todos os itens que passam no filtro (e grava).
// Usado na exclusão de dados (direito do titular na LGPD).
function removerOnde(colecao, filtro) {
  const atual = lista(colecao);
  const restantes = atual.filter((item) => !filtro(item));
  const removidos = atual.length - restantes.length;
  if (removidos > 0) {
    memoria[colecao] = restantes;
    salvar(colecao);
  }
  return removidos;
}

// =====================================
// BACKUP DIÁRIO
// Copia todos os JSON pra dados/backups/AAAA-MM-DD/ e apaga os antigos.
// Protege contra erro de gravação ou exclusão acidental.
// =====================================
function backupDoDia(dia) {
  const pastaBackups = path.join(config.PASTA_DADOS, "backups");
  const destino = path.join(pastaBackups, dia);
  if (fs.existsSync(destino)) return false;
  fs.mkdirSync(destino, { recursive: true });
  for (const colecao of COLECOES) {
    if (fs.existsSync(arquivoDa(colecao))) fs.copyFileSync(arquivoDa(colecao), path.join(destino, `${colecao}.json`));
  }
  const dias = fs.readdirSync(pastaBackups).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  for (const antigo of dias.slice(0, Math.max(0, dias.length - config.DIAS_BACKUP))) {
    fs.rmSync(path.join(pastaBackups, antigo), { recursive: true, force: true });
  }
  return true;
}

module.exports = { carregarTudo, lista, salvar, removerOnde, backupDoDia };

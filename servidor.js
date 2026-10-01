// =====================================
// COINZINHO — PONTO DE ENTRADA
// Rode com: node servidor.js   (ou: npm start)
// =====================================
const os = require("os");
const config = require("./config");
const dados = require("./dados");
const regras = require("./regras");
const web = require("./web");

// =====================================
// CARREGA OS DADOS (pasta dados/)
// =====================================
dados.carregarTudo();
console.log(`📂 Dados em: ${config.PASTA_DADOS}`);

// =====================================
// MESADA AUTOMÁTICA
// Além de verificar quando alguém abre o app, verifica ao subir e a cada
// hora — assim a mesada cai mesmo se ninguém abrir o app no dia.
// =====================================
regras.rodarMesadasVencidas();
setInterval(() => {
  try {
    regras.rodarMesadasVencidas();
  } catch (err) {
    console.error("❌ Erro ao creditar mesadas:", err.message);
  }
}, 60 * 60 * 1000);

// =====================================
// SOBE O SERVIDOR WEB
// =====================================
web.iniciar();

// =====================================
// MANUTENÇÃO DIÁRIA: BACKUP + LIMPEZA DE SESSÕES VENCIDAS
// =====================================
function manutencao() {
  try {
    if (dados.backupDoDia(regras.hoje())) console.log(`💾 Backup do dia salvo em ${config.PASTA_DADOS}/backups`);
    const removidas = regras.limparSessoesVencidas();
    if (removidas) console.log(`🧹 ${removidas} sessões vencidas removidas`);
  } catch (err) {
    console.error("❌ Erro na manutenção diária:", err.message);
  }
}
manutencao();
setInterval(manutencao, 60 * 60 * 1000); // checa de hora em hora; só faz 1 backup por dia

// Mostra o endereço pra abrir nos celulares (mesmo Wi-Fi).
if (config.ENDERECO === "0.0.0.0") {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const rede of lista || []) {
      if (rede.family === "IPv4" && !rede.internal) {
        console.log(`📱 Nos celulares (mesmo Wi-Fi): http://${rede.address}:${config.PORTA}`);
      }
    }
  }
}

// =====================================
// PROTEÇÃO CONTRA ERROS NÃO TRATADOS
// (mesma ideia do robô do leilão: loga e segue rodando)
// =====================================
process.on("unhandledRejection", (err) => console.error("❌ Erro não tratado:", err));
process.on("uncaughtException", (err) => console.error("❌ Exceção não tratada:", err));

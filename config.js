// =====================================
// CONFIGURAÇÃO DO COINZINHO
// =====================================
// Tudo que muda de um computador/servidor pro outro fica aqui.
// Variáveis de ambiente (PORT, HOST, ...) têm prioridade — é assim que
// a maioria das hospedagens na nuvem (Render, Railway, VPS) passa a porta.

module.exports = {
  // =====================================
  // QUEM É O RESPONSÁVEL PELO APP
  // Aparece no rodapé, nos Termos de Uso e na Política de Privacidade.
  // Pela LGPD, o "controlador" dos dados precisa estar identificado e
  // ter um canal de contato.
  // =====================================
  DESENVOLVEDOR: {
    nome: process.env.DEV_NOME || "Wilber Santos",
    email: process.env.DEV_EMAIL || "wilber.santos@gmail.com",
    cidade: process.env.DEV_CIDADE || "", // ex.: "São Paulo/SP" (opcional)
  },

  // Data/versão dos Termos e da Política. Se mudar o texto, troque a
  // versão: os pais vão precisar aceitar de novo ao abrir o app.
  VERSAO_TERMOS: "2026-10-01",


  // Porta do servidor: http://SEU_IP:PORTA
  PORTA: Number(process.env.PORT) || 3100,

  // "0.0.0.0" = aceita conexões de outros aparelhos da rede (os celulares
  // da família no mesmo Wi-Fi). Diferente do painel do leilão, aqui isso é
  // necessário: pais e filhos usam celulares diferentes.
  // Pra testar só no próprio PC, troque por "127.0.0.1".
  ENDERECO: process.env.HOST || "0.0.0.0",

  // Fuso usado pra decidir "que dia é hoje" (tarefa diária, mesada).
  FUSO: process.env.FUSO || "America/Sao_Paulo",

  // Pasta onde ficam os arquivos JSON com os dados das famílias.
  // Na nuvem, aponte pra um disco persistente (ex.: /data/coinzinho).
  PASTA_DADOS: process.env.PASTA_DADOS || require("path").join(__dirname, "dados"),

  // true quando roda atrás de um proxy (Railway, Render, Caddy): aí o IP
  // real do usuário vem no cabeçalho X-Real-IP / X-Forwarded-For.
  CONFIAR_PROXY: process.env.TRUST_PROXY === "1",

  // Quantos dias uma sessão (login no celular) continua válida.
  DIAS_SESSAO: 90,

  // Limite de tentativas erradas de PIN por perfil antes de bloquear por
  // alguns minutos (evita filho "chutando" o PIN do pai).
  MAX_TENTATIVAS_PIN: 5,
  MINUTOS_BLOQUEIO_PIN: 10,

  // Quantos backups diários (cópia da pasta dados/) manter.
  DIAS_BACKUP: 14,
};

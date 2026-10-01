# Histórico de versões — Coinzinho

## v1.0 — 01/10/2026 (primeira versão pública)

No ar em https://coinzinho.up.railway.app

**App (PWA instalável no Android e iPhone)**
- Criar família (responsável com PIN) e entrar em outros celulares pelo código de 6 letras
- Pai/mãe: filhos e 2º responsável, tarefas (diárias ou únicas), presentear, cobrar, multar,
  mesada automática (diária/mensal), loja de recompensas, aprovação de pedidos, histórico com filtros
- Filho: carteira, concluir tarefas, pedir coins, resgatar recompensas, histórico

**Legal e segurança**
- Termos de Uso e Política de Privacidade (LGPD / ECA Digital), com desenvolvedor e contato
- Consentimento do responsável ao criar a família; novo aceite quando os termos mudam
- Baixar dados e excluir família/perfil pelo app
- PIN guardado como hash, bloqueio por tentativas, limite por IP, HTTPS, backup diário

**Técnico**
- Node.js puro, sem dependências; dados em JSON num disco permanente do Railway
- Deploy automático a cada alteração no GitHub (wilberso/coinzinho)

---

## Próximas versões (planejamento)

### v1.1 — Contato com as famílias
Hoje o app não guarda nenhum contato das famílias, então não há como avisar nem cobrar ninguém.
- E-mail do responsável (com consentimento, atualizando a Política de Privacidade)
- Pedir o e-mail também pras famílias que já existem, ao abrirem o app
- Recuperar o PIN por e-mail
- Avisos importantes por e-mail (mudança de termos, manutenção)

### v1.2 — Base pra crescer
- Trocar os arquivos JSON por SQLite (embutido no Node 22, continua sem dependências)
- Backup fora do Railway
- Painel administrativo (quantas famílias, uso)

### v2.0 — Cobrança
- Definir o modelo: grátis com limites + plano pago, ou período de teste + assinatura
- Pagamento (Pix recorrente / cartão) por um intermediador (ex.: Mercado Pago, Stripe, Asaas)
- Avisar com antecedência quem já usa o app e manter um período de transição
- Emissão de nota fiscal (vai exigir MEI ou CNPJ)

### Depois
- Publicar na Google Play (teste fechado com 12 testadores por 14 dias)
- Metas de poupança, editar tarefas e recompensas, tarefa com aprovação dos pais

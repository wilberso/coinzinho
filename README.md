# 🪙 Coinzinho Simples

App da família para **tarefas, mesada, multas e recompensas em coins**.
Reescrito a partir da ideia do Coinzinho (Emergent) no mesmo padrão do `leilaoSimples`:

- **Node.js puro** (CommonJS, `http` nativo) — **zero dependências**, nada de `npm install`
- **Dados em arquivos JSON** na pasta `dados/`
- **`config.js`** único com tudo que muda entre máquinas
- **App = um único `app.html`** com JS puro, instalável no celular (PWA)

## Arquivos

| Arquivo | O que faz |
|---|---|
| `servidor.js` | Ponto de entrada: carrega dados, agenda a mesada, sobe o servidor |
| `config.js` | Porta, endereço, fuso, pasta de dados, regras de PIN |
| `web.js` | Servidor HTTP: serve o app e as rotas `/api/*` |
| `regras.js` | Toda a lógica de negócio (família, tarefas, pedidos, mesada, multas, loja) |
| `dados.js` | Lê/grava os JSON (gravação segura, não corrompe se o PC desligar) |
| `app.html` | O app inteiro (telas de pai/mãe e de filho) |
| `manifest.json`, `sw.js`, `icone*.png/svg` | O que faz o app "instalar" no celular |
| `celular.js`, `estado.js` | Modo celular: servidor + túnel HTTPS + página `/conectar` com QR |
| `iniciar-celular.bat` | Dois cliques no Windows: baixa o cloudflared e roda o `celular.js` |
| `teste.js` | Teste de ponta a ponta da API (32 verificações) |

## 📱 Instalar nos celulares Android (jeito rápido)

1. Dê **dois cliques em `iniciar-celular.bat`**.
   Na primeira vez ele baixa o `cloudflared` (~60 MB, túnel HTTPS grátis da Cloudflare).
2. Abre sozinha no PC a página **`http://localhost:3100/conectar`** com um **QR code**.
3. Em cada Android: aponte a câmera pro QR → abre no **Chrome** → **⋮ → Instalar app**.
4. O Coinzinho aparece na gaveta de apps, em tela cheia, como app normal.

- Funciona no Wi-Fi e no 4G, **enquanto a janela preta estiver aberta** no PC.
- O endereço `https://xxxx.trycloudflare.com` **muda toda vez** que você reinicia o `.bat`.
  Se reiniciar, abra o novo QR e instale de novo (os dados ficam no PC, nada se perde).
  Pra ter endereço fixo: ngrok (domínio grátis fixo) ou subir pra nuvem (seção abaixo).
- A página `/conectar` só abre no próprio PC — quem vem pelo túnel não vê.

## Rodar no seu PC (só rede de casa)

Precisa só do **Node.js 18+** (https://nodejs.org).

```bash
cd C:\coinzinho\coinzinhoSimples
node servidor.js
```

O console mostra algo como:

```
🪙  Coinzinho rodando em http://localhost:3100
📱 Nos celulares (mesmo Wi-Fi): http://192.168.0.15:3100
```

- No PC: abra `http://localhost:3100`
- Nos celulares (mesmo Wi-Fi): abra o endereço 📱 no Chrome/Safari
- Na primeira vez o **Firewall do Windows** pergunta se libera o Node — marque **Redes privadas** e permita.

Pra conferir que está tudo certo: `node teste.js`

### "Instalar" no celular

No Chrome (Android) ou Safari (iPhone): menu → **Adicionar à tela inicial**.
Na rede de casa (http) vira um atalho com ícone. A instalação completa de PWA
(tela cheia, funciona offline) exige **HTTPS** — isso vem de graça quando subir pra nuvem.

## Como funciona

**Pai/Mãe** (entra com PIN):
- Cadastra filhos e o outro responsável
- Cria tarefas (todo dia ou uma vez) com valor em coins
- Presentear, cobrar (não deixa ficar negativo) e multar (pode ficar negativo)
- Agenda mesada diária ou mensal (cai sozinha)
- Monta a loja de recompensas
- Aprova/recusa pedidos e vê o histórico com filtros

**Filho** (entra direto, ou com PIN opcional):
- Conclui tarefas e ganha coins na hora
- Pede coins pros pais
- Pede resgate de recompensas da loja
- Vê saldo, pedidos e histórico — só os dele

**Entrar em outro celular:** abra o app → "Já tenho um código" → digite o código de 6 letras (aba Família) → toque no perfil.

### Segurança (melhorias em relação ao original da Emergent)

- O servidor identifica quem é quem pelo **token da sessão** — o app nunca "diz" que é o pai, então um filho não consegue aprovar o próprio pedido ou se dar coins.
- **PIN dos pais** guardado só como hash (scrypt), com bloqueio após 5 tentativas erradas.
- Só pai/mãe cadastram perfis (no original, qualquer um com o código podia).

## Dados e backup

Tudo fica em `dados/*.json` (`familias`, `membros`, `tarefas`, `transacoes`, `pedidos`, `mesadas`, `recompensas`, `sessoes`).
**Backup = copiar a pasta `dados/`.** Ela está no `.gitignore` pra não ir pro Git.

## Subir pra nuvem (depois)

Já está pronto: lê `PORT`, `HOST` e `PASTA_DADOS` das variáveis de ambiente.

- **VPS (recomendado)**: copie a pasta, rode com `pm2 start servidor.js --name coinzinho`
  e coloque o **Caddy** na frente pra ter HTTPS automático (`coinzinho.seudominio.com { reverse_proxy localhost:3100 }`).
- **Render / Railway**: comando de start `node servidor.js` e um **disco persistente**
  montado em, por exemplo, `/data`, com `PASTA_DADOS=/data`. Sem disco persistente os dados somem a cada deploy.

## Próximos passos (ideias do backlog original)

- Metas de poupança do filho (barra de progresso)
- Editar tarefas/recompensas existentes
- Tarefa que precisa de aprovação dos pais antes de creditar
- Notificações quando chega pedido

## ⚖️ Legal (LGPD / ECA Digital)

- `/termos` e `/privacidade`: gerados pelo `legal.js` com o nome e contato do `config.js`.
- Criar família exige aceite (maior de 18, responsável legal, consentimento pros dados das crianças — LGPD art. 14).
- Responsável cadastrado por outro, ou mudança de `VERSAO_TERMOS`, exige aceite antes de qualquer alteração.
- Aba Família → **Privacidade e dados**: baixar todos os dados (JSON) e excluir a família; ✕ remove um perfil.
- Limite de tentativas por IP (só em memória), cabeçalhos de segurança e backup diário em `dados/backups/`.

## 🚀 Publicar

Passo a passo completo em **[PUBLICAR.md](PUBLICAR.md)** (GitHub → Railway, ~20 min).

# 🚀 Publicar o Coinzinho na internet (Railway)

Resultado: o app fica num endereço fixo com HTTPS, tipo **`https://coinzinho.up.railway.app`**,
funcionando 24h sem o seu PC ligado. Qualquer pessoa no Brasil abre o link no Chrome do
Android e toca em **Instalar app**.

**Custo:** o Railway dá um crédito único de teste e depois cobra o plano Hobby
(US$ 5/mês, já inclui uso de um app desse tamanho e 5 GB de disco).

**Tempo:** uns 20 minutos, sem instalar nada no PC.

---

## Antes de começar (2 min)

Abra o `config.js` e confira o bloco `DESENVOLVEDOR`:

- **nome:** coloque seu **nome completo** (é o que aparece nos Termos e na Política de Privacidade).
- **cidade:** opcional (ex.: `"Campinas/SP"`).
- **email:** o contato público de suporte e privacidade.

> Dá pra mudar esses três depois pelo painel do Railway (variáveis `DEV_NOME`, `DEV_EMAIL`, `DEV_CIDADE`),
> sem mexer no código.

---

## Passo 1 — Colocar o código no GitHub (5 min)

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Clique em **+ → New repository**.
   - Nome: `coinzinho`
   - Marque **Private**
   - Clique em **Create repository**.
3. Na página do repositório vazio, clique no link **uploading an existing file**.
4. Abra a pasta `C:\coinzinho\coinzinhoSimples` no Windows, selecione **todos os arquivos**,
   **MENOS**:
   - a pasta **`dados`** (são os dados do seu teste local)
   - o arquivo **`cloudflared.exe`** (se existir)
5. Arraste pra página do GitHub e clique em **Commit changes**.

## Passo 2 — Criar o app no Railway (5 min)

1. Entre em **railway.com** → **Login** → **Login with GitHub**.
2. **New Project → Deploy from GitHub repo** → escolha `coinzinho`.
   (Se pedir, autorize o Railway a ver o repositório.)
3. Ele começa a publicar sozinho. Espere ficar **verde (Active)**.

## Passo 3 — Disco pra guardar os dados (2 min) ⚠️ não pule

Sem isso, **os dados das famílias somem** a cada atualização.

1. No projeto, clique com o botão direito no quadrado do serviço `coinzinho` → **Attach volume**.
2. **Mount path:** `/data`

## Passo 4 — Variáveis (2 min)

No serviço → aba **Variables** → **New Variable**, uma por uma:

| Nome | Valor |
|---|---|
| `PASTA_DADOS` | `/data` |
| `TRUST_PROXY` | `1` |

(Opcional: `DEV_NOME`, `DEV_EMAIL`, `DEV_CIDADE` se quiser trocar sem mexer no código.)

O Railway reinicia o app sozinho depois de salvar.

## Passo 5 — Endereço público (1 min)

1. Serviço → **Settings → Networking → Generate Domain**.
2. Clique no lápis e troque o nome pra algo fácil, ex.: **`coinzinho`** → fica `https://coinzinho.up.railway.app`
   (se já estiver em uso, tente `coinzinho-app`, `meucoinzinho`...).

## Passo 6 — Conferir (2 min)

Abra no navegador (troque pelo seu endereço):

- `https://SEU-ENDERECO/api/saude` → deve mostrar `{"ok":true,"app":"Coinzinho"}`
- `https://SEU-ENDERECO/termos` e `/privacidade` → devem mostrar **seu nome e e-mail**
- `https://SEU-ENDERECO/` no celular → **⋮ → Instalar app**

Pronto: é só divulgar o link. 🎉

---

## Atualizar o app depois

Mudou algum arquivo? No GitHub, abra o repositório → **Add file → Upload files** → arraste só os
arquivos alterados → **Commit changes**. O Railway publica a nova versão sozinho em ~1 minuto.
Os dados das famílias ficam no disco (`/data`) e **não se perdem**.

Se mudar o `app.html`, aumente a versão no `sw.js` (`coinzinho-v3` → `coinzinho-v4`) pra os
celulares pegarem a versão nova.

Se mudar o texto dos Termos/Privacidade, troque `VERSAO_TERMOS` no `config.js` (ex.: `"2026-11-15"`):
os pais vão precisar aceitar de novo.

## Backup

O app faz sozinho uma cópia por dia em `/data/backups/` (guarda 14 dias). Isso protege contra
erro de gravação, mas fica no mesmo disco. Backup fora do Railway entra na Fase 2.

## Checklist antes de divulgar

- [ ] Nome completo e e-mail certos em `/termos` e `/privacidade`
- [ ] Testou criar família, cadastrar filho, entrar no 2º celular, concluir tarefa, aprovar pedido
- [ ] Testou **Baixar meus dados** e **Excluir família** (numa família de teste)
- [ ] (Recomendado) Pediu pra um advogado de direito digital revisar Termos e Privacidade

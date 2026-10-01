// =====================================
// PÁGINAS LEGAIS: TERMOS DE USO E POLÍTICA DE PRIVACIDADE
// O texto é montado com os dados do config.js (nome e contato do
// desenvolvedor, versão), pra ficar tudo num lugar só.
//
// Mudou alguma regra do texto? Troque config.VERSAO_TERMOS: os pais
// vão ver o aviso pra aceitar de novo na próxima vez que abrirem o app.
//
// IMPORTANTE: este texto foi escrito pra refletir exatamente o que o app
// faz hoje. Não substitui a revisão de um advogado.
// =====================================
const config = require("./config");

function esc(texto) {
  return String(texto || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function dataPorExtenso(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${dia} de ${meses[mes - 1]} de ${ano}`;
}

function identificacao() {
  const d = config.DESENVOLVEDOR;
  return `<strong>${esc(d.nome)}</strong>, pessoa física${d.cidade ? `, ${esc(d.cidade)}` : ""}, contato:
    <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`;
}

function pagina(titulo, corpo) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FF6B35">
<link rel="icon" href="/icone.svg" type="image/svg+xml">
<title>${titulo} — Coinzinho</title>
<style>
  :root { color-scheme: light dark; --bg:#fff7f2; --card:#fff; --text:#2b1d16; --muted:#8a776d; --accent:#e4521d; --border:#f1e3da; }
  @media (prefers-color-scheme: dark) { :root { --bg:#17120f; --card:#231c18; --text:#f6eee9; --muted:#b3a197; --border:#3a2f29; --accent:#ff8a4c; } }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.6; }
  main { max-width:720px; margin:0 auto; padding:24px 16px 48px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:20px; padding:20px 22px; }
  h1 { font-size:1.6rem; margin:8px 0 4px; } h2 { font-size:1.1rem; margin:28px 0 6px; }
  a { color:var(--accent); } .sub { color:var(--muted); margin:0 0 16px; font-size:.92rem; }
  li { margin:4px 0; } .voltar { display:inline-block; margin-bottom:8px; text-decoration:none; font-weight:600; }
  table { border-collapse:collapse; width:100%; font-size:.92rem; } td, th { border:1px solid var(--border); padding:8px; text-align:left; vertical-align:top; }
</style></head>
<body><main>
<a class="voltar" href="/">← Voltar ao Coinzinho</a>
<div class="card">${corpo}</div>
</main></body></html>`;
}

// =====================================
// TERMOS DE USO
// =====================================
function termos() {
  const versao = dataPorExtenso(config.VERSAO_TERMOS);
  return pagina("Termos de Uso", `
<h1>Termos de Uso</h1>
<p class="sub">Versão de ${versao}</p>

<h2>1. Quem oferece o Coinzinho</h2>
<p>O Coinzinho é desenvolvido e mantido por ${identificacao()}.</p>

<h2>2. O que é o serviço</h2>
<p>O Coinzinho é uma ferramenta gratuita para famílias organizarem tarefas, mesada e recompensas usando uma
moeda fictícia (“coins”). <strong>Coins não são dinheiro</strong>, não têm valor monetário, não podem ser
comprados, vendidos, sacados ou trocados por dinheiro dentro do app. Qualquer combinado entre pais e filhos
(como trocar coins por um passeio) é decisão exclusiva da família.</p>

<h2>3. Quem pode criar uma conta</h2>
<ul>
  <li>A família só pode ser criada por uma pessoa <strong>maior de 18 anos</strong>, que seja <strong>pai, mãe ou responsável legal</strong> pelas crianças e adolescentes que cadastrar.</li>
  <li>Crianças e adolescentes usam o Coinzinho apenas dentro de uma família criada e supervisionada por um responsável.</li>
  <li>Outro responsável só pode ser adicionado por um responsável já cadastrado, e precisa aceitar estes Termos no primeiro acesso.</li>
</ul>

<h2>4. Responsabilidades de quem usa</h2>
<ul>
  <li>Guardar o <strong>PIN</strong> em segredo e não compartilhá-lo com as crianças.</li>
  <li>Guardar o <strong>código da família</strong>: quem tiver o código pode ver os nomes dos perfis e entrar nos perfis sem PIN.
      Por isso, recomendamos colocar PIN também nos perfis dos filhos se o código puder chegar a outras pessoas.</li>
  <li>Cadastrar apenas o necessário: o app só pede um nome (pode ser apelido). Não coloque nomes completos, documentos ou outros dados nos campos de texto.</li>
  <li>Usar o app de forma lícita, sem tentar invadir, sobrecarregar ou acessar dados de outras famílias.</li>
</ul>

<h2>5. Disponibilidade</h2>
<p>O Coinzinho é oferecido gratuitamente, “no estado em que se encontra”. Fazemos o possível para mantê-lo
funcionando e com backups, mas podem ocorrer interrupções, erros ou perda de dados. O serviço pode ser alterado
ou encerrado; se for encerrado, avisaremos com antecedência razoável sempre que possível, para que as famílias
possam baixar seus dados.</p>

<h2>6. Encerramento da conta</h2>
<p>O responsável pode excluir a família e todos os dados a qualquer momento, pelo próprio app (aba Família →
Privacidade e dados). Podemos suspender famílias que violem estes Termos.</p>

<h2>7. Privacidade</h2>
<p>O tratamento de dados pessoais está descrito na <a href="/privacidade">Política de Privacidade</a>, que faz parte destes Termos.</p>

<h2>8. Mudanças nos Termos</h2>
<p>Se estes Termos mudarem, a nova versão será publicada nesta página e os responsáveis precisarão aceitá-la
no próximo acesso ao app.</p>

<h2>9. Lei e foro</h2>
<p>Aplica-se a lei brasileira. Fica eleito o foro do domicílio do consumidor, nos termos do Código de Defesa do Consumidor.</p>

<h2>10. Contato</h2>
<p>Dúvidas, sugestões ou problemas: <a href="mailto:${esc(config.DESENVOLVEDOR.email)}">${esc(config.DESENVOLVEDOR.email)}</a>.</p>
`);
}

// =====================================
// POLÍTICA DE PRIVACIDADE
// =====================================
function privacidade() {
  const versao = dataPorExtenso(config.VERSAO_TERMOS);
  const email = esc(config.DESENVOLVEDOR.email);
  return pagina("Política de Privacidade", `
<h1>Política de Privacidade</h1>
<p class="sub">Versão de ${versao}</p>

<p>Esta política explica, em linguagem simples, quais dados o Coinzinho guarda, por quê e quais são os seus
direitos, conforme a Lei Geral de Proteção de Dados (LGPD – Lei 13.709/2018) e o Estatuto Digital da Criança e
do Adolescente (Lei 15.211/2025).</p>

<h2>1. Controlador e contato</h2>
<p>O responsável pelo tratamento dos dados (controlador) é ${identificacao()}.
Esse e-mail é também o <strong>canal para exercer seus direitos</strong> e falar sobre privacidade.</p>

<h2>2. Quais dados guardamos</h2>
<table>
  <tr><th>Dado</th><th>De quem</th><th>Para quê</th></tr>
  <tr><td>Nome da família</td><td>Família</td><td>Identificar a família no app</td></tr>
  <tr><td>Nome ou apelido e cor do avatar</td><td>Pais e filhos</td><td>Mostrar os perfis</td></tr>
  <tr><td>Indicação “Pai” ou “Mãe”</td><td>Responsáveis</td><td>Mostrar quem aprovou cada pedido</td></tr>
  <tr><td>PIN (guardado só de forma cifrada – hash)</td><td>Responsáveis e, se quiserem, filhos</td><td>Proteger o acesso aos perfis</td></tr>
  <tr><td>Tarefas, saldo de coins, extrato, pedidos, mesadas e recompensas</td><td>Família</td><td>Funcionamento do app</td></tr>
  <tr><td>Data, hora e versão do aceite destes documentos</td><td>Responsáveis</td><td>Comprovar o consentimento</td></tr>
  <tr><td>Endereço IP (só na memória, por poucos minutos, sem gravar)</td><td>Quem acessa</td><td>Bloquear abusos (ex.: tentativas de adivinhar PIN)</td></tr>
</table>
<p><strong>Não pedimos</strong> e-mail, telefone, CPF, data de nascimento, endereço, fotos ou localização.
<strong>Não usamos</strong> anúncios, rastreadores, cookies de terceiros, ferramentas de análise de comportamento
nem criamos perfis para fins comerciais. No aparelho, o app guarda apenas um código de sessão para você não precisar entrar toda vez.</p>

<h2>3. Dados de crianças e adolescentes</h2>
<p>Os perfis dos filhos só podem ser criados por um pai, mãe ou responsável legal, que dá o
<strong>consentimento específico e em destaque</strong> exigido pelo art. 14 da LGPD ao criar a família.
Os dados das crianças são usados <strong>somente</strong> para o funcionamento do app, no melhor interesse delas,
e ficam sob supervisão dos responsáveis, que veem tudo o que acontece no perfil dos filhos.</p>

<h2>4. Bases legais</h2>
<ul>
  <li><strong>Consentimento</strong> do responsável (art. 7º, I, e art. 14, §1º, da LGPD) para os dados da família e das crianças.</li>
  <li><strong>Legítimo interesse</strong> (art. 7º, IX) apenas para segurança, como o bloqueio temporário de tentativas abusivas.</li>
</ul>

<h2>5. Com quem compartilhamos</h2>
<p>Não vendemos nem compartilhamos dados com ninguém para fins comerciais. Os dados ficam guardados num
provedor de hospedagem em nuvem contratado para rodar o app, que apenas armazena e processa os dados em nosso
nome (operador). Esse provedor pode estar localizado fora do Brasil; nesse caso, a transferência ocorre para
cumprir este serviço que você solicitou, com o seu consentimento (art. 33 da LGPD).
Podemos fornecer dados a autoridades quando a lei exigir.</p>

<h2>6. Por quanto tempo</h2>
<p>Enquanto a família existir. Quando o responsável exclui a família (ou um perfil), os dados são apagados na hora
do sistema principal e saem também das cópias de segurança em até <strong>${config.DIAS_BACKUP} dias</strong>,
que é o tempo que guardamos backups.</p>

<h2>7. Segurança</h2>
<p>Conexão sempre criptografada (HTTPS), PIN guardado só como hash, bloqueio após tentativas erradas de PIN,
limite de tentativas por acesso e backups diários. Se acontecer algum incidente de segurança relevante,
avisaremos as famílias pelo próprio app e comunicaremos a ANPD, como manda a lei.</p>

<h2>8. Seus direitos (art. 18 da LGPD)</h2>
<p>O responsável pode, a qualquer momento:</p>
<ul>
  <li><strong>Ver e baixar</strong> todos os dados da família: aba Família → Privacidade e dados → “Baixar meus dados”.</li>
  <li><strong>Corrigir</strong> dados: fale com a gente pelo e-mail abaixo.</li>
  <li><strong>Excluir</strong> o perfil de um filho ou a família inteira, com todos os dados: aba Família → Privacidade e dados.</li>
  <li><strong>Revogar o consentimento</strong>: é feito excluindo a família (sem os dados o app não funciona).</li>
  <li>Pedir informações sobre o tratamento e reclamar à <strong>ANPD</strong> (Autoridade Nacional de Proteção de Dados).</li>
</ul>
<p>Para qualquer pedido: <a href="mailto:${email}">${email}</a>. Respondemos em até 15 dias.</p>

<h2>9. Mudanças nesta política</h2>
<p>Se esta política mudar, a nova versão será publicada aqui e os responsáveis precisarão aceitá-la no próximo acesso.</p>
`);
}

module.exports = { termos, privacidade };

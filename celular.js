// =====================================
// MODO CELULAR: SERVIDOR + TÚNEL HTTPS
// Sobe o Coinzinho e abre um túnel HTTPS grátis da Cloudflare
// (cloudflared). Com HTTPS, o Chrome do Android oferece "Instalar app" e
// o Coinzinho vira um app de verdade (ícone na gaveta, tela cheia).
// Também funciona fora de casa (4G), enquanto o PC estiver ligado.
//
// Rode com: node celular.js   (ou dê dois cliques em iniciar-celular.bat)
// =====================================
const fs = require("fs");
const path = require("path");
const { spawn, exec } = require("child_process");
const config = require("./config");
const estado = require("./estado");

require("./servidor"); // sobe o servidor normalmente

// =====================================
// ACHA O cloudflared
// =====================================
const exeLocal = path.join(__dirname, process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
const comando = fs.existsSync(exeLocal) ? exeLocal : "cloudflared";

// =====================================
// ABRE O TÚNEL E PEGA O ENDEREÇO https://xxxx.trycloudflare.com
// =====================================
const REGEX_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

function abrirNoNavegador(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function iniciarTunel() {
  console.log("🌐 Abrindo túnel HTTPS (Cloudflare)...");
  const tunel = spawn(comando, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${config.PORTA}`], {
    windowsHide: true,
  });

  const lerSaida = (pedaco) => {
    const achou = String(pedaco).match(REGEX_URL);
    if (achou && !estado.urlPublica) {
      estado.urlPublica = achou[0];
      console.log("");
      console.log("✅ Túnel pronto!");
      console.log(`📱 Endereço pros celulares: ${estado.urlPublica}`);
      console.log(`🔳 QR code: http://localhost:${config.PORTA}/conectar`);
      console.log("   (deixe esta janela aberta enquanto usa o app)");
      console.log("");
    }
  };
  tunel.stdout.on("data", lerSaida);
  tunel.stderr.on("data", lerSaida);

  tunel.on("error", (err) => {
    console.error("❌ Não consegui rodar o cloudflared:", err.message);
    console.error("   Use o iniciar-celular.bat (ele baixa o cloudflared) ou instale: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/");
  });

  tunel.on("exit", (codigo) => {
    estado.urlPublica = null;
    console.warn(`⚠️  O túnel fechou (código ${codigo}). Tentando de novo em 5 segundos...`);
    setTimeout(iniciarTunel, 5000);
  });

  // Fecha o túnel junto quando o servidor for encerrado (Ctrl+C).
  const encerrar = () => {
    tunel.removeAllListeners("exit");
    tunel.kill();
    process.exit(0);
  };
  process.once("SIGINT", encerrar);
  process.once("SIGTERM", encerrar);
}

iniciarTunel();
setTimeout(() => abrirNoNavegador(`http://localhost:${config.PORTA}/conectar`), 1500);

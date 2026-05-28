// src/linkedin.js
// Acessa o perfil público do LinkedIn (best-effort). O LinkedIn bloqueia
// scraping de forma agressiva, então qualquer falha resulta em ok=false e o
// fluxo continua sem esse dado. Nunca lança nem bloqueia a triagem.

const axios = require('axios');

async function obterLinkedin(url) {
  if (!url || !/linkedin\.com\/in\//i.test(url)) {
    return { ok: false, motivo: 'URL de LinkedIn ausente ou inválida', texto: null };
  }
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 3,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      validateStatus: s => s >= 200 && s < 400,
    });
    const html = typeof res.data === 'string' ? res.data : '';
    const titulo = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const texto = `${titulo}\n${desc}`.trim();
    if (!texto || /sign in|fazer login|entrar|log in|authwall|join linkedin/i.test(texto)) {
      return { ok: false, motivo: 'Perfil não acessível (parede de login)', texto: null };
    }
    return { ok: true, motivo: null, texto };
  } catch (e) {
    return { ok: false, motivo: `Perfil não acessível: ${e.message}`, texto: null };
  }
}

module.exports = { obterLinkedin };

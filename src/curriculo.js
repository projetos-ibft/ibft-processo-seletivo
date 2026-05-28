// src/curriculo.js
// Baixa o currículo anexado à tarefa e extrai o texto. Suporta PDF (pdf-parse v2)
// e DOCX (mammoth). Retorna { ok, texto, motivo, nomeArquivo } — nunca lança;
// triagem.js trata ok=false como "Currículo não lido".

const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const asana = require('./asana');

function pickCurriculo(attachments) {
  const docs = (attachments || []).filter(a => /\.(pdf|docx?)$/i.test(a.name || ''));
  if (docs.length === 0) return null;
  return docs.find(a => /cv|curr[íi]culo|resume/i.test(a.name)) || docs[0];
}

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extrairCurriculo(taskGid) {
  let attachments;
  try {
    attachments = await asana.getTaskAttachments(taskGid);
  } catch (e) {
    return { ok: false, motivo: `Falha ao listar anexos: ${e.message}`, texto: null, nomeArquivo: null };
  }

  const cv = pickCurriculo(attachments);
  if (!cv) {
    return { ok: false, motivo: 'Nenhum anexo PDF ou DOCX encontrado', texto: null, nomeArquivo: null };
  }

  let downloadUrl = cv.download_url;
  if (!downloadUrl) {
    try {
      const full = await asana.getAttachment(cv.gid);
      downloadUrl = full.download_url;
    } catch (e) {
      return { ok: false, motivo: `Falha ao obter anexo: ${e.message}`, texto: null, nomeArquivo: cv.name };
    }
  }
  if (!downloadUrl) {
    return { ok: false, motivo: 'Anexo sem URL de download', texto: null, nomeArquivo: cv.name };
  }

  let buffer;
  try {
    buffer = await asana.downloadAttachment(downloadUrl);
  } catch (e) {
    return { ok: false, motivo: `Falha no download: ${e.message}`, texto: null, nomeArquivo: cv.name };
  }

  try {
    let texto;
    if (/\.pdf$/i.test(cv.name)) {
      texto = await extractTextFromPdf(buffer);
    } else if (/\.docx?$/i.test(cv.name)) {
      texto = await extractTextFromDocx(buffer);
    } else {
      return { ok: false, motivo: 'Formato não suportado', texto: null, nomeArquivo: cv.name };
    }
    texto = (texto || '').trim();
    if (texto.length < 20) {
      return { ok: false, motivo: 'Texto extraído vazio ou muito curto', texto: null, nomeArquivo: cv.name };
    }
    return { ok: true, motivo: null, texto, nomeArquivo: cv.name };
  } catch (e) {
    return { ok: false, motivo: `Falha ao extrair texto: ${e.message}`, texto: null, nomeArquivo: cv.name };
  }
}

module.exports = { extrairCurriculo, pickCurriculo };

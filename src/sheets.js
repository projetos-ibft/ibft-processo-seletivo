// src/sheets.js
// Todas as chamadas à API do Google Sheets. Usa Service Account para
// autenticação. Expõe funções utilitárias de leitura, append e update.

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const PROJECT_ROOT = path.resolve(__dirname, '..');

let sheetsClient = null;

function resolveKeyPath() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não definido no .env');
  const abs = path.isAbsolute(raw) ? raw : path.resolve(PROJECT_ROOT, raw);
  if (!fs.existsSync(abs)) {
    throw new Error(`Service account JSON não encontrado em ${abs}`);
  }
  return abs;
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_ID não definido no .env');
  return id;
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: resolveKeyPath(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function getSheetMetadata() {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: getSheetId(),
  });
  return {
    title: data.properties.title,
    tabs: data.sheets.map(s => s.properties.title),
  };
}

async function readRange(range) {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range,
  });
  return data.values ?? [];
}

async function appendRow(range, values) {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  return data;
}

async function updateRow(range, values) {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  return data;
}

// Escreve uma matriz 2D em um range.
async function updateValues(range, values2D) {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: values2D },
  });
  return data;
}

// Escreve vários ranges de uma vez. updates: [{ range, values: [[...]] }]
async function batchUpdate(updates) {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
  return data;
}

module.exports = {
  getSheetMetadata,
  readRange,
  appendRow,
  updateRow,
  updateValues,
  batchUpdate,
};

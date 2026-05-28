// src/asana.js
// Todas as chamadas à API do Asana. Centraliza autenticação, base URL e
// paginação de listagens longas.

const axios = require('axios');

const BASE_URL = 'https://app.asana.com/api/1.0';

let client = null;

function getClient() {
  if (client) return client;
  const token = process.env.ASANA_TOKEN;
  if (!token) throw new Error('ASANA_TOKEN não definido no .env');
  client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return client;
}

async function getMe() {
  const { data } = await getClient().get('/users/me');
  return data.data;
}

async function getProject(projectGid) {
  const { data } = await getClient().get(`/projects/${projectGid}`);
  return data.data;
}

async function getProjectSections(projectGid) {
  const { data } = await getClient().get(`/projects/${projectGid}/sections`);
  return data.data;
}

async function getTask(taskGid, optFields = null) {
  const params = optFields ? { opt_fields: optFields } : {};
  const { data } = await getClient().get(`/tasks/${taskGid}`, { params });
  return data.data;
}

async function getTaskAttachments(taskGid) {
  const { data } = await getClient().get(`/tasks/${taskGid}/attachments`, {
    params: { opt_fields: 'name,download_url,permanent_url,resource_type' },
  });
  return data.data;
}

async function getAttachment(attachmentGid) {
  const { data } = await getClient().get(`/attachments/${attachmentGid}`, {
    params: { opt_fields: 'name,download_url,permanent_url' },
  });
  return data.data;
}

async function downloadAttachment(downloadUrl) {
  const res = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  return Buffer.from(res.data);
}

async function postComment(taskGid, text) {
  const { data } = await getClient().post(`/tasks/${taskGid}/stories`, {
    data: { text },
  });
  return data.data;
}

async function moveTaskToSection(taskGid, sectionGid) {
  const { data } = await getClient().post(`/sections/${sectionGid}/addTask`, {
    data: { task: taskGid },
  });
  return data.data;
}

async function updateCustomFieldEnum(taskGid, fieldGid, enumOptionGid) {
  const { data } = await getClient().put(`/tasks/${taskGid}`, {
    data: { custom_fields: { [fieldGid]: enumOptionGid } },
  });
  return data.data;
}

async function getProjectTasks(projectGid, optFields = null) {
  const tasks = [];
  let offset = null;
  do {
    const params = { project: projectGid, limit: 100 };
    if (optFields) params.opt_fields = optFields;
    if (offset) params.offset = offset;
    const { data } = await getClient().get('/tasks', { params });
    tasks.push(...data.data);
    offset = data.next_page?.offset ?? null;
  } while (offset);
  return tasks;
}

async function createWebhook(resourceGid, targetUrl) {
  const { data } = await getClient().post('/webhooks', {
    data: { resource: resourceGid, target: targetUrl },
  });
  return data.data;
}

async function getWebhooks(workspaceGid) {
  const { data } = await getClient().get('/webhooks', {
    params: { workspace: workspaceGid, limit: 100 },
  });
  return data.data;
}

async function deleteWebhook(webhookGid) {
  await getClient().delete(`/webhooks/${webhookGid}`);
}

module.exports = {
  getMe,
  getProject,
  getProjectSections,
  getTask,
  getTaskAttachments,
  getAttachment,
  downloadAttachment,
  postComment,
  moveTaskToSection,
  updateCustomFieldEnum,
  getProjectTasks,
  createWebhook,
  getWebhooks,
  deleteWebhook,
};

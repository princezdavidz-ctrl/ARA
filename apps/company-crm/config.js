// Use the local API for local development; the dedicated staging CRM uses the staging API.
const requestedLocalApiPort = new URLSearchParams(window.location.search).get('araApiPort') || '3000';
const localApiPort = /^\d{1,5}$/.test(requestedLocalApiPort) && Number(requestedLocalApiPort) <= 65535 ? requestedLocalApiPort : '3000';
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isStagingCrm = window.location.hostname === 'ara-company-crm-staging.onrender.com' || window.location.hostname === 'ara-crm-phase2-preview.onrender.com';
const defaultApi = isLocalHost ? 'http://localhost:' + localApiPort : (isStagingCrm ? 'https://ara-api-staging.onrender.com' : 'https://ara-api-c525.onrender.com');
window.ARA_API_BASE_URL = window.ARA_API_BASE_URL || defaultApi;

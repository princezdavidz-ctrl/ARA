// Use the local API for local development; deployed environments use the configured API URL.
const requestedLocalApiPort = new URLSearchParams(window.location.search).get('araApiPort') || '3000';
const localApiPort = /^\d{1,5}$/.test(requestedLocalApiPort) && Number(requestedLocalApiPort) <= 65535 ? requestedLocalApiPort : '3000';
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isStagingAdmin = window.location.hostname === 'ara-super-admin-staging.onrender.com';
const defaultApi = isLocalHost ? 'http://localhost:' + localApiPort : (isStagingAdmin ? 'https://ara-api-staging.onrender.com' : 'https://ara-api-c525.onrender.com');
window.ARA_API_BASE_URL = window.ARA_API_BASE_URL || defaultApi;

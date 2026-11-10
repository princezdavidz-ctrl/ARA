// Use the local API for local development; deployed environments use the configured API URL.
const requestedLocalApiPort = new URLSearchParams(window.location.search).get('araApiPort') || '3000';
const localApiPort = /^\d{1,5}$/.test(requestedLocalApiPort) && Number(requestedLocalApiPort) <= 65535 ? requestedLocalApiPort : '3000';
window.ARA_API_BASE_URL = window.ARA_API_BASE_URL || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? `http://localhost:${localApiPort}` : 'https://ara-api-c525.onrender.com');

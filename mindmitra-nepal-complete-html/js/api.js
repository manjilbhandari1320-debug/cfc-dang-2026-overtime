(() => {
  async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  window.mindMitraApi = {
    get: path => request(path),
    post: (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path, body = {}) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: (path, body = {}) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: path => request(path, { method: 'DELETE' })
  };
})();

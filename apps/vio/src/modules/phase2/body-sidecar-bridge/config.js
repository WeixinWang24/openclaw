export function getBodySidecarConfig(env = process.env) {
  return {
    baseUrl: String(env.VIO_BODY_SIDECAR_BASE || 'http://127.0.0.1:8788'),
    token: String(env.VIO_BODY_SIDECAR_TOKEN || 'vio-local-sidecar'),
  };
}

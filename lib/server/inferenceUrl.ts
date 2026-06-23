const LOCAL_INFERENCE_URL = 'http://127.0.0.1:8000'

export function getInferenceUrl(): string {
  const configured = process.env.INFERENCE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INFERENCE_URL must be set in production, e.g. https://YOUR_DEPLOYED_BACKEND_URL'
    )
  }

  return LOCAL_INFERENCE_URL
}

// Runs before every test file. The unit tests must never reach a real service, even when real settings are
// present in the environment, as they are during a Vercel build. The live evaluations (AI_LIVE=1,
// LENS_EVAL=1) are the exception: they exist to call the real model.
if (!process.env.AI_LIVE && !process.env.LENS_EVAL) {
  for (const key of [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_MODEL',
    'OPENAI_BACKUP_API_KEY',
    'OPENAI_BACKUP_MODEL',
    'OPENAI_BACKUP_REASONING_EFFORT',
    'GCP_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_CLOUD_PROJECT',
    'GOOGLE_CLOUD_LOCATION',
    'VERTEX_MODEL',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT',
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_API_VERSION',
    'AZURE_OPENAI_REASONING_EFFORT',
    'AI_REASONING_EFFORT',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'ORIGIN_SECRET',
  ]) {
    delete process.env[key]
  }
}

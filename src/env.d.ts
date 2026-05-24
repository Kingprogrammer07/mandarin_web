/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_INIT_DATA_URL: string
  readonly VITE_API_LOGIN_URL: string
  readonly VITE_API_REGISTER_URL: string
  // Self-hosted Plausible analytics (optional — empty disables tracking).
  readonly VITE_PLAUSIBLE_DOMAIN?: string
  readonly VITE_PLAUSIBLE_SRC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

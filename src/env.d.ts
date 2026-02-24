/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_INIT_DATA_URL: string
  readonly VITE_API_LOGIN_URL: string
  readonly VITE_API_REGISTER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

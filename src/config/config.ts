function requiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`❌ Missing environment variable: ${name}`)
  }
  return value
}

export const API_BASE_URL = requiredEnv('VITE_API_BASE_URL')

export const API_INIT_DATA_URL =
  API_BASE_URL + requiredEnv('VITE_API_INIT_DATA_URL')

export const API_LOGIN_URL =
  API_BASE_URL + requiredEnv('VITE_API_LOGIN_URL')

export const API_REGISTER_URL =
  API_BASE_URL + requiredEnv('VITE_API_REGISTER_URL')

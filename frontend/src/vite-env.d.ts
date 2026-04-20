/// <reference types="vite/client" />

// VITE_ 접두사 환경변수의 TypeScript 자동완성과 타입 체크를 위한 선언
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

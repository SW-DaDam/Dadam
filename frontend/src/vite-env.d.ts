/// <reference types="vite/client" />

// VITE_ 접두사 환경변수의 TypeScript 자동완성과 타입 체크를 위한 선언
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Web Speech API 크로스 브라우저 타입 보강
// Chrome은 webkitSpeechRecognition, 표준은 SpeechRecognition
// lib: ["DOM"]에 SpeechRecognition이 포함되어 있으나 types: ["vite/client"] 제한으로
// 명시적 인터페이스 선언이 필요함
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

interface Window {
  SpeechRecognition: typeof SpeechRecognition
  webkitSpeechRecognition: typeof SpeechRecognition
}

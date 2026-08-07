/// <reference types="vite/client" />

declare module '*.md?raw' {
  const contenido: string
  export default contenido
}

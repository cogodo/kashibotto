/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string
    readonly PROD: boolean
    readonly DEV: boolean
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

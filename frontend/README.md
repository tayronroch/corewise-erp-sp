# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Como testar a renovação do token JWT


🧪 Como Testar o Sistema de Refresh Token:

  1. Comandos Disponíveis no Console do Navegador:

  Após fazer login, abra o Console do Navegador (F12) e execute:

  Ver informações do token atual:

  TokenManager.getTokenInfo()
  Mostra: tempo até expiração, se está próximo de expirar, etc.

  Testar refresh manual:

  TokenManager.testRefresh()
  Faz: refresh manual e mostra antes/depois

  Simular token próximo da expiração:

  TokenManager.forceExpiringSoon()
  Simula: situação onde token está próximo de expirar

  Verificar status do timer:

  TokenManager.debugTimerStatus()
  Mostra: se o timer automático está ativo

  2. Sequência de Teste Sugerida:

  1. Login normalmente no sistema
  2. Abrir Console (F12 → Console)
  3. Executar:
  // 1. Ver info do token
  TokenManager.getTokenInfo()

  // 2. Testar refresh manual
  TokenManager.testRefresh()

  // 3. Ver novo token após refresh
  TokenManager.getTokenInfo()

  // 4. Verificar timer automático
  TokenManager.debugTimerStatus()
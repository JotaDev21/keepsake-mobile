# Keepsake Mobile

App de memórias para guardar fotos, cartas, registros de humor e atividades. Os registros locais usam SQLite. O pareamento entre dois aparelhos e os recursos de IA têm configuração própria.

## Funcionalidades

- Cofre de fotos, linha do tempo e cartas.
- Diário de humor e lista de atividades.
- Pareamento por convite para compartilhar os registros compatíveis entre dois aparelhos.

A sincronização opcional usa Supabase. Ao acionar um recurso de IA, o app pode enviar o rascunho de uma carta ou registros recentes de humor à Anthropic por uma função do Supabase.

## Desenvolvimento

O app usa Expo, React Native e TypeScript. Configure o ambiente Android de acordo com o guia antes de criar uma build de desenvolvimento.

    npm ci
    npm run android
    npm run typecheck
    npm run test:activities

Use npm start para iniciar o Metro quando a build de desenvolvimento já estiver instalada.

- [Configuração do Android](docs/SETUP-ANDROID.md)
- [Sincronização entre aparelhos](docs/SETUP-SUPABASE.md)
- [Configuração e privacidade dos recursos de IA](docs/SETUP-IA.md)
- [Licença MIT](LICENSE)

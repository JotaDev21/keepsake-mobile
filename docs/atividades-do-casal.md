# Memory EV 1.2 — desejos, bilhetes e desenho

Implementação original inspirada pela pesquisa com REA em Couple2 e Widgetable. Não utiliza código, conteúdo ou imagens dos concorrentes.

## O que entrou

**Ainda vamos viver:** desejos de até 200 caracteres, interesse individual de cada pessoa, data combinada opcional, conclusão e uma foto compartilhada da lembrança. A foto pode ser importada para o cofre privado de cada aparelho, sem duplicar a mesma lembrança.

**Bilhetes:** texto, foto e desenho podem compor o mesmo bilhete. Respostas ficam na conversa. A leitura só é confirmada quando quem recebe toca em “Dizer que li seu bilhete”. Abrir um widget ou receber uma notificação não confirma leitura.

**Você desenha, eu descubro:** desenho com o dedo, desfazer e limpar, palpite assíncrono, revelação por quem criou a rodada e importação do desenho para o cofre. A resposta secreta permanece local até a revelação; não é enviada escondida no desenho. Se o aparelho de origem for perdido, quem desenhou precisa informar novamente a resposta para revelar.

As três entradas estão na Home. As rotas também aceitam links de notificações.

## Dados, conexão e privacidade

- Migração SQLite 9 adiciona tabelas, sem alterar os registros existentes.
- Rascunhos e respostas secretas ficam locais. Apenas ações explícitas de compartilhamento entram na fila de envio.
- A fila persiste antes da tentativa de rede e mantém o casal e o perfil de origem. Trocar o vínculo não envia os registros pendentes ao casal novo.
- UUIDs e gravações validadas no servidor tornam as tentativas repetidas idempotentes. Erros permanentes permanecem visíveis e podem ser tentados novamente.
- O servidor autoriza leitura pelo casal atual e valida autoria, relações entre eventos, tamanho dos textos e desenhos e propriedade das fotos.
- Fotos usam um bucket privado, com URLs temporárias e cópias locais para imagens já abertas.
- “Enviado” significa confirmado pelo servidor. Não há alegação de entrega física ao outro aparelho.
- Notificações são opcionais e de melhor esforço, com texto genérico, um aviso por tentativa de evento e intervalo para evitar muitos avisos seguidos. Não provam entrega ou leitura.

## Widget Android

O widget **memory ev · bilhete** abre os bilhetes ou a atividade correspondente. A prévia do conteúdo exige consentimento no próprio aparelho e fica desligada inicialmente. Ela pode aparecer fora do bloqueio do app; esse comportamento é explicado antes de permitir a prévia.

O widget consulta apenas o último bilhete do outro perfil. Atualiza com o app aberto e em intervalos solicitados de 30 minutos; Android pode adiar o trabalho em segundo plano. Com a prévia permitida, fotos e desenhos aparecem no widget; fotos são baixadas para o cache privado durante a atualização. Falhas de rede mantêm a última cópia disponível. Não há promessa de atualização instantânea com o app encerrado.

Nova instalação nativa é necessária: Skia e o provedor de widgets não existem no APK anterior. Pacote e chave de assinatura permanecem os mesmos, com versão 1.2.0/código 3.

## Validação

```sh
npm run typecheck
npm run lint
node --experimental-strip-types --test scripts/activities-model.test.mjs
node --test scripts/activities-sql.test.mjs
node --test scripts/activities-sqlite.test.mjs
```

Os testes de SQL usam PGlite para executar a migração e tentar operações com papéis autenticados distintos: acesso entre casais, colisão de IDs, revelação por outro autor, segredo junto ao desenho, palpites após encerramento, confirmação de leitura pelo remetente e gravação de foto com outro proprietário.

O teste SQLite abre uma base na versão 8 com foto, humor e carta existentes, aplica a migração 9 e confere a preservação dos registros e o isolamento da fila por perfil e casal. Os testes podem ser executados juntos com `npm run test:activities` em Node 24.

O SQL novo foi aplicado no projeto configurado do app, com histórico de migração e publicação Realtime. Um teste de gravação autenticada no servidor foi executado dentro de uma transação revertida, sem deixar conteúdo de teste no casal. A função de avisos foi publicada e a rejeição de chamadas sem autenticação foi conferida.

O usuário dispõe de um aparelho. A troca real com dois aparelhos, push no destinatário e o comportamento do widget durante suspensão prolongada precisam de validação conjunta posterior. Esta limitação não equivale aos testes de acesso no banco, que foram executados.

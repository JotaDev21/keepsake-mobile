# Memory EV — ideias funcionais a partir de Couple2 e Widgetable

Pesquisa de 13 de outubro de 2026. As propostas abaixo registram a pesquisa; a implementação inicial está documentada em [atividades do casal](atividades-do-casal.md).
O objetivo é escolher interações que façam sentido para Jota e Evy depois do redesign, com dados locais e compartilhamento intencional.

## O que foi confirmado e como ler este relatório

- **Declaração oficial:** descrição ou histórico de versões publicado pelo desenvolvedor. Confirma que o recurso é anunciado, não que toda regra funciona como descrita.
- **Indício no APK:** componente declarado no manifesto do aplicativo instalado. Confirma presença estrutural, não disponibilidade, execução ou regra de negócio.
- **Regra local derivada do código:** leitura de um método decompilado pela REA, com seleção e arquivo exatos. Permite explicar o caminho local; não demonstra entrega de rede nem execução com duas contas.
- **Proposta nossa:** fluxo original para Memory EV, a definir e implementar com código e identidade visual próprios.
- Os pacotes instalados no celular foram extraídos com REA; os metadados locais e manifestos foram examinados.
- Não há segundo aparelho para validar duas contas. A navegação também travou; nenhuma interação entre parceiros foi validada nesta investigação.
- Nenhum código, imagem, som ou outro asset dos concorrentes foi reutilizado no Memory EV. Preços, garantias de privacidade e comportamento offline dos concorrentes não foram inferidos.

## Aplicativos e versões analisadas

| Alvo | Publisher oficial | Pacote Android | Versão local / código | SDK mínimo / alvo |
|---|---|---|---|---|
| Couple2 — Space for Couples | SINGAPORE YOULOFT TECHNOLOGY PTE. LTD. | `com.youloft.couple` | `1.5.3` / `1050030` | `23` / `36` |
| Widgetable — Besties & Couples | Happeny Technology Pte. Ltd. | `com.widgetable.theme.android` | `4.2.000` / `40200003` | `32` / `36` |

Publisher e identidade: [Couple2 no Google Play](https://play.google.com/store/apps/details?id=com.youloft.couple&hl=en) e [Widgetable no Google Play](https://play.google.com/store/apps/details?id=com.widgetable.theme.android&hl=en).
Versões e SDKs acima vêm dos arquivos `android-*.json` da evidência REA, não da versão iOS.
Na [App Store do Widgetable](https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226), o nome do desenvolvedor aparece como Widgetable,Inc.; o vendedor é HAPPENY TECHNOLOGY PTE. LTD.
O identificador iOS de Couple2 é `6673890505`; o de Widgetable é `1641107226`.
O homônimo En-pareja2, da Imedia, não é o Couple2 da Youloft e não entrou na análise.
Não foi confirmado download direto de APK nos sites oficiais; os arquivos analisados foram extraídos dos aplicativos instalados no celular.
A verificação criptográfica de assinatura não foi realizada pelo resultado de metadados (`signature_verification: not_performed`).

## Recursos públicos e indícios locais

Os nomes curtos abaixo são sufixos de componentes do manifesto; não são prova de que a tela tenha sido aberta.
Couple2 usa componentes sob `com.youloft.icloser`; Widgetable usa `com.widgetable.theme.android`.

| App / recurso | Declaração oficial | Indício no manifesto local | O que ainda não sabemos |
|---|---|---|---|
| Couple2: casa e pet | Móveis, temas, cuidado conjunto. | `PetMainActivity`, `PlayWithPetNewActivity`, `PetGoOutActivity`. | Progressão, consumo e conflitos. |
| Couple2: desejos | Conclusão de checklist gera memória/postal. | `LoveListHomeNewActivity`, `LoveListDetailActivity`. | Fotos, edição e confirmação conjunta. |
| Couple2: datas | Lembretes e contagem regressiva. | `AnniversaryDetailActivity`, `AnniversaryEditNewActivity`. | Recorrência e entrega. |
| Couple2: diário | Rotina, pensamentos e humor compartilhados. | `DiaryDetailActivity`, `ChooseMoodActivity`. | Escala e privacidade por registro. |

Declarações dessas quatro linhas: [descrição oficial Android de Couple2](https://play.google.com/store/apps/details?id=com.youloft.couple&hl=en).

| App / recurso | Declaração oficial | Indício no manifesto local | O que ainda não sabemos |
|---|---|---|---|
| Couple2: desenhar/adivinhar | Histórico anuncia jogo para dois e Q&A. | `DrawGuessCanvasActivity`, `DrawGuessChooseTopicActivity`, `DrawGuessAnswerActivity`. | Rodadas, acertos e revelação. |
| Couple2: bilhetes/gesto | Histórico anuncia desenho/texto no envio à tela e Finger Kiss. | `WidgetCustomActivity`, `Widget2V2`, `Widget4V4`. | Toque simultâneo e háptica. |

Declarações dessas duas linhas: [histórico oficial iOS de Couple2](https://apps.apple.com/us/app/couple2-space-for-couples/id6673890505). Não assumir equivalência entre plataformas.

| App / recurso | Declaração oficial | Indício no manifesto local | O que ainda não sabemos |
|---|---|---|---|
| Widgetable: pet a dois | Alimentar, brincar e acompanhar crescimento. | Manifesto centrado em `MainActivity`; não isola uma tela de pet. | Economia e regras de cuidado. |
| Widgetable: Pin It! | Fotos, emojis, desenhos e texto na tela do outro. | `MomentWidgetConfigureActivity`, `SmallMomentWidgetProvider`. | Entrega, histórico e expiração. |
| Widgetable: humor | Mood Bubble e Mood Jar. | Providers genéricos de widget; não provam a mecânica de humor. | Escala e duração. |
| Widgetable: sono | Widget e permissão de leitura do sono. | `SleepReceiver`. | Origem e frequência dos dados. |
| Widgetable: saudade/status | Contagem de saudade e atualizações de status. | `SmallWidgetProvider`, `MediumWidgetProvider`, `LargeWidgetProvider`. | Contagem offline e atualização. |
| Widgetable: resumo/hábitos | Metas diárias e widget agregado de estado. | `DateChangeReceiver`, `WidgetCountdownService`. | Metas conjuntas e personalização. |

Primeiras cinco declarações: [descrição Android de Widgetable](https://play.google.com/store/apps/details?id=com.widgetable.theme.android&hl=en).
Metas diárias, widget agregado e cuidado simultâneo aparecem no [histórico oficial iOS de Widgetable](https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226); não foram executados aqui.

Ambos anunciam distância/localização; Couple2 descreve consentimento independente e possibilidade de parar o compartilhamento na [descrição iOS](https://apps.apple.com/us/app/couple2-space-for-couples/id6673890505).
Esse anúncio não demonstra precisão, frequência de atualização ou consumo de bateria. Localização contínua não é necessária para as propostas abaixo.

## O que o Memory EV já oferece

Leitura do código, sem uma nova auditoria de campo: [`useSyncStore`](../src/stores/useSyncStore.ts) contém pareamento, mídia compartilhada, datas, pergunta diária, sinais rápidos, respostas e fila de alterações pendentes.
[`useGardenStore`](../src/stores/useGardenStore.ts) combina dias de visita do casal; [`useCareStore`](../src/stores/useCareStore.ts) guarda sinais de cuidado com opção de compartilhamento e pendências locais.
[`useMediaStore`](../src/stores/useMediaStore.ts) já gerencia mídia; as rotas de memória e linha do tempo oferecem uma base para coleções.
O [roadmap anterior](proximos-passos-memory-ev.md) já propõe desejos, encontro guiado, duas vozes e widget. Este relatório detalha essas pontes e acrescenta jogo e gesto sincronizado.
A existência dessas bases não significa que novos tipos de conteúdo já sejam suportados pela fila ou pelo servidor.

## Oito propostas originais, em ordem de interesse

Prioridade A: primeira leva após o redesign; B: evolução seguinte; C: protótipo depois de validar os fluxos principais.
A ordem dentro de A considera valor; a construção do widget pode acontecer depois da lista de desejos por exigir trabalho nativo.

### 1. Bilhete que mora na tela — A

Texto curto, foto escolhida ou desenho para aparecer no widget do parceiro. O remetente escolhe enviar; um rascunho nunca sai do aparelho sozinho.
**Fluxo mínimo:** escrever → prévia → escolher visibilidade → enviar → parceiro recebe → toque abre o bilhete e permite responder.
**Estados:** rascunho, aguardando envio, enviado, recebido pelo aparelho, aberto, falhou. Recebido só aparece com confirmação do aparelho; enviado não significa lido.
**Offline:** salvar rascunho e envio pendente; reenviar com ID estável para evitar duplicação. Widget mantém último bilhete confirmado e informa a idade da atualização.
**Acabamento:** mudar o tamanho ou a configuração do widget deve preservar o último conteúdo confirmado, evitando um quadro vazio enquanto chega a atualização.
**Privacidade:** conteúdo pessoal oculto por padrão nas superfícies visíveis; cada pessoa escolhe o que o widget pode exibir.
**Falta confirmar:** tamanhos, limites de imagem/desenho, atualização Android com app fechado, bateria e comportamento nos aparelhos dos dois.
**Aproveita:** mídia, identidade do parceiro e sincronização; precisa de novo tipo de bilhete, confirmação e integração nativa do widget.

### 2. Coisas que ainda vamos viver → memória — A

Uma lista curta de experiências: receita, filme, passeio, viagem. Ideias próprias podem ter tempo disponível e orçamento opcional.
**Fluxo mínimo:** sugerir → outro marca interesse → combinar data → viver → concluir → anexar memória com autoria e data.
**Estados:** ideia, queremos os dois, combinado, vivido, memória em preparação, guardado. Cada manifestação de interesse pertence à sua pessoa.
**Offline:** criar e editar localmente, com pendência visível; conclusão possui ID próprio e ligação única com a memória, sem gerar dois capítulos por tentativas repetidas.
**Conflitos:** cada pessoa conserva seu voto; mudanças simultâneas de data pedem revisão em vez de apagar silenciosamente uma escolha.
**Falta confirmar:** quais campos importam para vocês, quando uma conclusão requer confirmação do outro e se o desejo pode voltar à lista.
**Aproveita:** datas e memórias; precisa de desejos, interesses e estados de plano. Dispensa mapas pagos.

### 3. Você desenha, eu descubro — A

Jogo assíncrono com temas originais e pessoais: comida, objeto, passeio, uma lembrança. Cada rodada é curta e pode virar uma memória divertida.
**Fluxo mínimo:** escolher tema → desenhar → enviar → parceiro tenta adivinhar → autor confirma ou revela → trocar os papéis.
**Estados:** desenho local, pendente, aguardando palpite, palpite enviado, revelado, encerrado. A resposta fica oculta até a revelação autorizada.
Na primeira versão, a resposta correta permanece no aparelho do autor até a revelação; ela não acompanha o desenho enviado ao parceiro.
**Offline:** manter traços e palpite locais, sem perder progresso ao fechar; filas por rodada impedem envio da revelação antes do desenho.
**Ritmo:** sem obrigação de ambos estarem online, cronômetro obrigatório ou ranking do casal. Salvar como memória é uma ação separada.
**Falta confirmar:** número de tentativas, temas próprios, ferramentas de desenho e acessibilidade. Preferir confirmação humana a avaliação por IA.
**Aproveita:** mídia e pareamento; precisa de rodada, editor e controle de quem pode ver cada parte. Não reutilizar temas/assets do concorrente.

### 4. Nosso jardim, nosso companheiro — B

Evoluir primeiro o girassol já existente: pequenos gestos compartilhados mudam o jardim, com histórico de quem cuidou e quando.
Um pet opcional pode vir depois, com nome e personalidade próprios, caso combine com vocês.
Ficar alguns dias fora não mata o pet nem gera cobrança. O cuidado pode ser retomado com leveza.
Primeira entrega: um gesto diário por pessoa, reação visual e deduplicação de ações offline; decidir aparência e progressão antes de expandir.

### 5. Calendário com convites de verdade — B

Datas comemorativas já existem; acrescentar encontros propostos com aceitar, sugerir horário, adiar e cancelar.
Primeira entrega: título, dia/hora, local em texto e resposta de cada pessoa. Lembretes só após o combinado.
Offline: proposta e resposta pendentes; versões de horário distintas ficam em revisão. Não confundir convite enviado com encontro aceito.
Ao terminar, oferecer ligação com uma memória e manter o histórico do plano.

### 6. Uma coleção, dois olhares — B

Reunir fotos, áudio e relato em uma experiência, com um espaço de autoria de Jota e outro de Evy.
Primeira entrega: título da coleção, mídia selecionada e contribuição individual. Uma edição nunca sobrescreve a voz do outro.
Offline: contribuição própria persistida; mídia pode ficar aguardando envio enquanto o texto permanece salvo.
Escolher explicitamente o que entra; não puxar cartas fechadas, notas privadas ou gratidão para a coleção.

### 7. Cuidado que vira uma ação — B

Um sinal pode levar a uma escolha concreta: companhia, um áudio, descanso ou conversa mais tarde.
O parceiro responde com uma presença ou horário, aproveitando os sinais rápidos que já existem no app.
Primeira entrega: preferências escritas pela pessoa, pedido e resposta; nenhum diagnóstico automático ou cobrança de retorno.
Não alterar escala/formato de humor nem formato das cartas sem combinar com o usuário. O cuidado funciona como recurso independente.

### 8. Abraço sincronizado — C

Um gesto opcional: abrir uma sala curta, esperar o parceiro e pressionar ao mesmo tempo para uma resposta visual e háptica suave.
Primeira entrega: convite, presença, pronto, conexão perdida e encerrado. Não apresentar simultaneidade quando houver só um aparelho conectado.
Offline: oferecer bilhete de abraço pendente, com identidade própria; o abraço ao vivo só funciona conectado.
Falta validar atraso de rede, acessibilidade e uso real com dois aparelhos. Aproveita sinais rápidos, mas exige uma sessão temporária nova.

## Matriz de cobertura

| Área | Estado desta pesquisa | Próximo passo |
|---|---|---|
| Identidade e versão Android dos dois alvos | Coberto | Metadados locais registrados. |
| Funcionalidades anunciadas nas fontes oficiais | Coberto | Usar como referência, não garantia. |
| Componentes relevantes no manifesto | Coberto | Indícios registrados, sem equivaler a execução. |
| Classes selecionadas | Coberto dentro da seleção | Lista de experiências, editor de desenhos e configuração de widget; não equivale a inventário completo. |
| Regras internas de métodos | Parcial | Consultas dirigidas; registrar separadamente as falhas do analisador. |
| Navegação e comportamento dentro dos apps | Parcial | Navegação travou; não concluir fluxos não observados. |
| Duas contas, entrega e interação em conjunto | Pendente | Segundo aparelho ou ambiente autorizado de teste. |
| Offline, reconexão, widgets e bateria dos concorrentes | Pendente | Não há regra de campo validada. |
| Relação com recursos atuais do Memory EV | Parcial | Leitura de stores/rotas, sem teste dos dois celulares. |
| Plano funcional das oito propostas | Coberto | Escolher primeira leva e detalhar a implementação. |
| Implementação e validação das propostas | Pendente | Nenhuma feature foi aplicada nesta pesquisa. |

## Classes selecionadas e limites dos métodos

As três consultas abaixo retornaram inventários de métodos e campos com identidade vinculada ao APK:

| Seleção | Observação estática confirmada | Limite |
|---|---|---|
| Couple2, `LoveListHomeNewActivity` | Declara métodos para obter planos, ordenar, abrir item e confirmar exclusão. | Nomes e assinaturas não provam filtros, regras de conclusão ou resposta do servidor. |
| Couple2, `DesktopPaintingActivity` | Existe uma Activity do editor de desenhos com inicialização de tela e retorno. | Não confirma ferramentas, envio ou formatos de arquivo. |
| Widgetable, `MomentWidgetConfigureActivity` | Declara identidade de widget, configuração de conteúdo e métodos de persistência/atualização. | Não confirma frequência de atualização ou entrega ao parceiro. |

### Regras locais que a REA conseguiu ler

- **Widgetable — preservar conteúdo ao reconfigurar:** no método `persistAndRefresh`, quando os estados antigo e novo são de conteúdo e o tipo permanece compatível, o código reaproveita dados anteriores. Para tipos específicos, associa posições pelo identificador da pessoa e mantém cartão, gesto, avatares do gesto e contador de não lidos. A adaptação para Memory EV é conservar o bilhete/foto confirmado enquanto se atualiza a configuração. Isto é uma conclusão sobre o método local, não garantia de funcionamento offline ou entrega. Evidência `ev_73889faa11a20df373a3be91bbf508d7f0280f0bbdc27f54deb084c1c3f1ed55`; corpo completo, sem fallback.
- **Couple2 — um desejo tem detalhe próprio:** o método `onItemClick` seleciona o item da lista e abre `LoveListDetailActivity`, levando os dados do item e o contexto de data. Isso confirma a navegação local lista → detalhe. A conversão em postal continua sendo declaração oficial; o método lido não demonstra a conversão. Evidência `ev_95b59daa43781eec3b3a881fad179e39d65a16d7f6de4458676965ba8dcdd00d`; corpo completo, sem fallback.
- **Couple2 — carregamento com indicador opcional:** o método `getPlanList` pode mostrar carregamento e inicia trabalho assíncrono associado ao ciclo de vida da tela. O corpo delegado não foi rastreado; este método não permite afirmar cache, endpoint, política de repetição ou funcionamento offline. Evidência `ev_a0de1c5264175f591a1a9cbec377b6bbcc32d8850f4b50e6d72deee68b31ccfc`; corpo completo, sem fallback.

O inventário geral de classes falhou por classes duplicadas/contagem divergente. Quatro consultas simultâneas de métodos excederam o limite de 120 segundos e reportaram encerramento incompleto; não foram usadas para afirmar regras. Após elas, não havia processo Java ativo na verificação local. A tentativa pontual com 1536 MiB falhou por falta de memória durante a leitura do APK. Os diagnósticos foram preservados; isso limita a ferramenta, não demonstra um erro no app analisado.
Consultas sequenciais com 4096 MiB conseguiram ler os três métodos descritos acima. Os APKs analisados permanecem intactos.

## Apêndice — rastreabilidade REA

Evidências em `dist/rea-couples/evidence/`; metadados no envelope `data.normalized_result`, identidade em `data.subject`.
Extração Couple2: `pull-com.youloft.couple.json`, cobertura `complete`, quatro APKs (base + três splits), zero falhas reportadas.
Extração Widgetable: `pull-com.widgetable.theme.android.json`, cobertura `complete`, três APKs (base + dois splits), zero falhas reportadas.
Essa cobertura descreve a cópia dos pacotes instalados, não testes funcionais ou cobertura de todos os métodos.

| Evidência | ID |
|---|---|
| Metadados Couple2 | `ev_9e7dfd471de959777326e461828da94b3a0a835df0032113b11e3285bd8f6446` |
| Extração Couple2 | `ev_0302f9cefdeecbba908690fa37616cc8a5012a11352c755acccbd4d16e12db67` |
| Metadados Widgetable | `ev_09da1476b8bc8b9495bffd1d023a0d28bd50bf5e5d54211084fb5479777973db` |
| Extração Widgetable | `ev_575ca19a7877574e70437a2ad9d6701fa562eb9f180c481cb5bcee76968d45f4` |
| Classe de desejos Couple2 | `ev_a432076a073ed1f11f93b2f22019774e6fa47f52f2273e473350847bd787eccf` |
| Classe de desenho Couple2 | `ev_7aa5f78ff34ff0e3e7b55085171a6f26c4e464c6013ed9268be7bd271d522b76` |
| Classe de widget Widgetable | `ev_267dabab842eeb5be5d4e4b8218f71e01cb36fe6a9539e8d0de963b0aae38489` |
| Regra local de reconfiguração Widgetable | `ev_73889faa11a20df373a3be91bbf508d7f0280f0bbdc27f54deb084c1c3f1ed55` |
| Abertura de detalhe de desejo Couple2 | `ev_95b59daa43781eec3b3a881fad179e39d65a16d7f6de4458676965ba8dcdd00d` |
| Preparação de carregamento de planos Couple2 | `ev_a0de1c5264175f591a1a9cbec377b6bbcc32d8850f4b50e6d72deee68b31ccfc` |

SHA256 das bases: Couple2 `bd30c067419649f4cf376cb9441e08ed3bc763829de16f2b19bdcf57a81f7476`; Widgetable `fc8f0fc7a836c4e4c9a9edf1c096b1ba0b7eee42d086b2135faa3c6b5bc6e2a1`.
SHA256 dos splits e tamanhos completos constam nos arquivos de extração; hashes identificam os arquivos analisados, sem atestar publisher ou segurança.

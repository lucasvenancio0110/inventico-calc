# Serviço de imagens e planejamento Inventico

Requer Node.js 24 ou posterior. O frontend pode continuar no GitHub Pages; o serviço roda separadamente. Nunca inclua a chave OpenAI em variáveis `VITE_*` ou no navegador.

Crie `.env` na raiz do repositório, com:

```dotenv
OPENAI_API_KEY=sua_chave_local
OPENAI_IMAGE_MODEL=gpt-image-2
# Defina um modelo com visão e Structured Outputs disponível na sua conta:
OPENAI_VISION_MODEL=
# Credencial própria do serviço, com pelo menos 16 caracteres aleatórios:
INVENTICO_SERVICE_TOKEN=
INVENTICO_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
INVENTICO_AI_PORT=8787
INVENTICO_MAX_CALLS=10
INVENTICO_BUDGET_PERIOD=initial
```

Execute `npm run ai:serve`. O serviço escuta apenas em `127.0.0.1`. No app, abra “Serviço de IA: imagens e planejamento”, informe `http://127.0.0.1:8787` e a credencial do serviço, verifique a configuração e autorize o envio das imagens. A credencial do serviço fica somente em memória no navegador. Não use a chave OpenAI nesse campo.

O contador global em `.inventico-ai-budget.json` reserva uma chamada antes de cada operação, incluindo falhas e cancelamentos. Reiniciar o serviço preserva o contador. Para iniciar outro orçamento, altere conscientemente `INVENTICO_BUDGET_PERIOD`. O limite é de quantidade de chamadas, não de dinheiro: configure também limites de gasto na conta do provedor. Rode apenas uma instância deste serviço por arquivo de orçamento. Uma operação por vez; não há repetição automática de chamadas pagas.

`/health` informa configuração, `/concept` gera uma imagem PNG a partir da logo e, opcionalmente, da proposta aprovada, e `/analyze` retorna um plano estruturado para revisão. Imagens locais são normalizadas para PNG sem metadados antes do envio. O serviço limita corpo, dimensões e frequência e exige autenticação para chamadas ao provedor. O timeout é de três minutos.

Para um frontend remoto, hospede o serviço atrás de HTTPS e autenticação apropriada, com quota por usuário. Configure as origens permitidas. A versão local não constitui um backend multiusuário e não deve ser exposta diretamente à internet. A página HTTPS publicada pode bloquear chamadas HTTP locais: teste localmente ou use um endpoint HTTPS hospedado.

O fluxo usa a logo para os contornos e a imagem aprovada para o plano de montagem. Não faz reconstrução geral de objetos 3D a partir de fotografia. Relevos, base e apoio são parametrizados. A decoração NFC do mockup não é automaticamente convertida em relevo; a opção física disponível cria um rebaixo circular sob a base para etiqueta adesiva, com diâmetro e profundidade informados.

Os testes do serviço usam respostas simuladas. Sem uma chave configurada, nenhuma geração real pela API é executada ou alegada como validada.

Documentação oficial: [geração de imagens](https://developers.openai.com/api/docs/guides/image-generation), [edição com referências](https://developers.openai.com/api/reference/resources/images/methods/edit), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

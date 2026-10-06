# Inventico no Cloudflare

Worker `inventico`: frontend estático e API `/api/health`, `/api/concept`, `/api/analyze` na mesma origem HTTPS. A geometria e os projetos continuam locais no navegador. Dados salvos no GitHub Pages não migram automaticamente: exporte e importe os backups financeiros e 3D.

O modo simples permite colar imagens com Ctrl+V nas áreas Logo e Referência, ou selecionar arquivos. **Criar meu 3D** extrai os contornos automaticamente e, quando há referência e a conexão de IA está pronta/autorizada, aplica o plano sugerido e gera a prévia. **Confirmar este 3D** libera o STL daquela revisão. Editar qualquer informação exige nova confirmação. **Ajustar detalhes** abre o fluxo técnico e a geração opcional de propostas visuais. O modelo continua paramétrico: a referência não fornece uma reconstrução geral de fotografia.

## Deploy

```powershell
$env:VITE_AI_ENDPOINT='https://inventico.lucassantanals0110.workers.dev/api'
npm run build
npx wrangler deploy
```

`wrangler.jsonc` fixa a conta e o nome deste projeto. Não contém credenciais. Defina `OPENAI_API_KEY` e `INVENTICO_SERVICE_TOKEN` como **Secrets** no Worker, nunca como variáveis VITE. Configure um modelo com visão e Structured Outputs em `OPENAI_VISION_MODEL`. Não reutilize chaves de outros projetos sem autorização. A credencial do serviço é pessoal; entre com ela no campo do app (permanece em memória). A API rejeita operações sem configuração e autenticação.

O Durable Object SQLite `AI_BUDGET` mantém o contador global e uma reserva exclusiva com validade de quatro minutos. O servidor tem timeout de três minutos. O limite inicial é dez chamadas, incluindo falhas após reserva. Só altere `INVENTICO_BUDGET_PERIOD` após revisar o orçamento. Esse limite conta chamadas, não dólares. Operações pagas usam a API OpenAI; hospedar o backend não fornece créditos de geração.

Não há assinatura de novo plano, domínio comprado ou mudança de outros Workers nesta implantação. Logs de observabilidade estão desativados. As imagens são enviadas ao provedor apenas quando o usuário autoriza e solicita geração/análise.

Documentação: https://developers.cloudflare.com/workers/static-assets/ e https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/.

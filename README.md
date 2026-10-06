# Inventico Calc

Aplicação local de custo, precificação e rentabilidade para impressão 3D. React + TypeScript + Vite, Tailwind CSS, Lucide, Recharts e Vitest. Não exige login, backend, conta, GitHub ou serviços externos durante o uso.

## Iniciar no Windows

Abra um novo terminal para carregar o Node.js e o npm preparados para este projeto. Na pasta do projeto:

```powershell
npm install
npm run dev
```

Abra http://localhost:5173. A porta é fixa: se estiver ocupada, o Vite avisa em vez de mudar a origem dos seus dados locais. Pare o servidor com Ctrl+C.

Você também pode dar duplo clique em `Iniciar.cmd`. Ele usa a instalação local de Node.js preparada neste PC se o npm ainda não estiver no PATH do terminal.

A instalação inicial das dependências usa o registro npm. Depois de instaladas, a aplicação funciona localmente, sem conexões a serviços externos. Não abra o index.html diretamente: use o servidor Vite.

## Comandos

```powershell
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

O build fica em `dist/`. Os testes rodam uma vez e encerram.

## Fluxo principal

1. Complete o onboarding curto ou mantenha os exemplos editáveis.
2. Informe peso e tempo do lote inteiro, quantidade e preço por unidade.
3. Resultados são atualizados automaticamente. Deixe o preço vazio para usar o recomendado.
4. No modo avançado, adicione perdas, atividades humanas, desenvolvimento, embalagem, componentes e frete.
5. Configure filamentos, impressoras, energia, manutenção, custos fixos, impostos, canais, marketing e margens.
6. Salve a simulação com nome, categoria e observação. Abra, edite, duplique ou exclua no catálogo.
7. A análise apresenta preços alternativos, desconto, atacado, capacidade, payback e equilíbrio mensal.

## Estrutura

```text
src/
  App.tsx                 navegação e coordenação do estado
  defaults.ts             branding e exemplos iniciais editáveis
  types.ts                contratos TypeScript
  components/             campos, resultados, modo avançado e foco de modais
  pages/                  configurações, produtos e análise
  engine/
    finance.ts            funções puras, validação e resultado financeiro
    scenarios.ts          preços, descontos e escala de atacado
    *.test.ts             testes automatizados
  storage/
    repository.ts         localStorage, importação e exportação
  styles.css              identidade visual e componentes
  responsive.css          regras para desktop, tablet e celular
```

Branding pode ser alterado em `src/defaults.ts`, no objeto `branding`. Ajuste também o título do `index.html`.

## Convenções financeiras

- Peso útil, tempo e atividades por lote são totais do job. O preço informado é unitário.
- Itens e atividades podem ser por unidade ou por lote. Taxas fixas de canal/pagamento, aquisição e frete são por pedido/lote.
- Perdas adicionam gramas ao peso útil: não inclua novamente perdas já presentes no peso principal. Percentual de perda usa o peso útil como base.
- Filamento/g = (rolo + frete + adicionais) / peso do rolo.
- Horas decimais = horas + minutos / 60. 11h18 é 11,3 h.
- Energia = (W totais / 1000) × horas × R$/kWh.
- Depreciação = (investimento total − residual) / vida útil × horas. Horas já usadas são informativas; o cálculo usa a vida econômica total e não trunca a depreciação de uma simulação.
- Manutenção simples = reserva R$/h × horas. No modo detalhado, a soma das reservas por peça substitui a simples. Para uma peça, informe custo de reposição / intervalo em horas como reserva unitária R$/h.
- Mão de obra = minutos humanos / 60 × valor da hora. Tempo de máquina é independente.
- Desenvolvimento/un. = horas × valor/h / unidades previstas. Evite contar a mesma modelagem em atividades e desenvolvimento.
- Reserva para falhas = custos repetíveis × p / (1 − p). Assume tentativas independentes de reimpressão completa; inclui material, perdas, energia, depreciação e manutenção. Não repete embalagem, componentes nem mão de obra. Para retrabalho humano, adicione uma atividade.
- Rateio fixo = despesas mensais / volume configurado × unidades, pedidos ou horas do lote. O DAS entra nas despesas mensais no modo MEI; não cadastre o mesmo valor novamente.
- Frete líquido = frete real − cobrado + subsídio padrão do canal. Excedente cobrado funciona como crédito.
- Produção inclui material, perdas, energia, depreciação, manutenção, mão de obra, desenvolvimento, itens, falhas e rateio.
- Base de venda = produção + taxas fixas + frete líquido + marketing fixo.
- Custo real = base + faturamento × soma de taxas percentuais.
- Equilíbrio/un. = (base / quantidade) / (1 − taxas).
- Preço para margem = (base / quantidade) / (1 − taxas − margem). Denominador inviável é apresentado como “—”.
- Lucro = faturamento − custo real. Margem = lucro / faturamento. Com faturamento zero a convenção interna é margem zero; o status considera o lucro negativo.
- Markup = faturamento / custo real; markup % = (markup − 1) × 100.
- ROI nesta ferramenta = lucro / custo real × 100. Não é o ROI contábil de toda a empresa.
- Lucro/h = lucro do lote / horas de máquina. Receita/h e custo/h usam a mesma base.
- Contribuição/un. = (lucro + rateio de custos fixos) / quantidade.
- Equilíbrio mensal = custos fixos / contribuição unitária, arredondado para cima.
- Payback = investimento da impressora / lucro unitário, arredondado para cima. É conservador, após depreciação, e não representa fluxo de caixa.
- Capacidade = horas produtivas / horas do lote × peças do lote. Projeções usam lotes equivalentes contínuos, sem demanda garantida ou paradas. Lucro mensal = contribuição projetada − despesas fixas mensais, uma vez.
- Atacado escala peso, tempo e itens/atividades por lote proporcionalmente às unidades. Itens por unidade continuam por unidade. Taxas fixas, frete e aquisição permanecem por pedido. Não pressupõe ganho de eficiência, múltiplas máquinas ou economia logística.
- Todos os percentuais comerciais incidem no valor dos produtos. Se seu canal cobra taxa sobre frete, ajuste a taxa adicional. Taxas e regimes são dados da simulação, sem legislação ou tarifas permanentes.

A matemática usa números JavaScript sem arredondamento intermediário. `Intl.NumberFormat('pt-BR')` arredonda a apresentação. Entradas aceitam vírgula e ponto decimal, além de formato brasileiro com milhares. `null` representa métricas indisponíveis; divisão por zero não é exibida como Infinity ou NaN. Valores extremos fora de limites operacionais são rejeitados.

## Rentabilidade

Regras ficam em `classify()` no engine; margens e retornos/hora são editáveis em Configurações:

- Excelente: margem premium + retorno/h excelente.
- Muito bom: margem alvo + retorno/h muito bom.
- Bom: margem mínima + retorno/h bom.
- Prejuízo: lucro negativo.
- Ruim: margem nula ou retorno inferior a R$ 1/h.
- Atenção: lucro positivo abaixo dos demais critérios.

## Dados, backup e histórico

A chave `inventico-calc:v1` fica no localStorage do navegador usado, na origem `http://localhost:5173`. Outro navegador, perfil, endereço ou porta usa armazenamento distinto.

A simulação e configurações válidas são salvas automaticamente. Durante uma entrada inválida, o último estado válido fica preservado. Produtos incluem entrada, configurações, resultado e data; o ranking compara os históricos salvos. Ao abrir um produto, suas configurações históricas são carregadas como configurações atuais e um aviso informa isso.

Exporte JSON em Configurações. A prévia permite copiar o JSON e salvá-lo manualmente caso o navegador integrado não permita downloads. Importar valida versão, estrutura, dados e modos, recalcula produtos e exige confirmação antes de substituir os dados. Restaurar configurações exige confirmação e preserva produtos com seus históricos. Limpar os dados do navegador apaga o localStorage: mantenha backups.

## Testes e validação

Os testes cobrem o exemplo Wave (R$ 30,6981 em material, R$ 2,034 em energia, R$ 10 em mão de obra), tempo decimal, perdas, lote, depreciação, manutenção, desenvolvimento, taxas, impostos, frete, margem versus markup, equilíbrio, lucro/h, ROI, payback, capacidade, rateio, entradas inválidas e backups. Testes de cenários cobrem desconto e atacado.

A revisão visual inclui desktop 1440 px e celulares de 375, 390 e 430 px. Tabelas viram cartões no celular para evitar rolagem horizontal.

## Próximas evoluções

A melhoria de maior impacto é calibrar os custos e o retorno mínimo por hora com os dados reais da operação. Depois: perfis de produção por produto, custos de retrabalho humano em falhas, manutenção por custo/intervalo, comparação de cenários históricos com taxas atuais e projeções que considerem paradas e lotes inteiros. Imagens, PWA, estoque, pedidos, nuvem e integrações permanecem para etapas futuras.


## Versão publicada para celular

App: https://lucasvenancio0110.github.io/inventico-calc/

Repositório: https://github.com/lucasvenancio0110/inventico-calc

O workflow `.github/workflows/pages.yml` valida lint, TypeScript, testes e build. Pull requests apenas validam; commits na `main` publicam automaticamente no GitHub Pages. A publicação usa o caminho `/inventico-calc/`, preservando o localhost na raiz.

No celular, os dados continuam no localStorage do navegador. Dados do PC, localhost e site publicado não são sincronizados. Para transferir, exporte o backup JSON no PC e importe no celular. Backups, arquivos de ambiente e prévias locais não entram no repositório.

Em Settings → Pages, a origem de publicação deve ser GitHub Actions. O serviço publica somente os arquivos de `dist/`; dados do localStorage não são enviados.

# Loterias Lab: Lotofácil, Mega-Sena, Quina e Dia de Sorte

App que baixa **todo o histórico oficial** de cada jogo da Caixa com Playwright, guarda num **grafo Neo4j com embeddings vetoriais** e, com estatística e probabilidade, **sugere os números e quantas dezenas comprar** para o valor que você quer gastar. Cada jogo tem sua aba, com regras, cores, volante e fonte de resultados próprios. Quem decide se joga é você.

> **Aviso importante: não há garantia de ganho.** Os sorteios são uniformes e sem memória, e nenhuma análise de resultados passados muda a chance de um jogo ser sorteado. O app mostra isso com um teste qui-quadrado e um backtest. O que muda a probabilidade de cada faixa de prêmio é **quanto você aposta e como distribui as apostas**, e é isso que o Planejador calcula com exatidão. O valor esperado é sempre negativo: jogue só o que pode perder. Uso educativo, para maiores de 18 anos (ver [seção 10](#10-aviso-legal-créditos-e-apoio)).

| Jogo | Volante | Aposta simples | Dezenas por aposta | Faixas premiadas | Chance do prêmio máximo | Chance da faixa "quase máxima" |
|---|---|---|---|---|---|---|
| Lotofácil | 15 de 25 | R$ 3,50 | 15–20 | 11 a 15 | 1 em 3.268.760 | 14+: 1 em 21.647 |
| Mega-Sena | 6 de 60 | R$ 6,00 | 6–20 | 4 a 6 | 1 em 50.063.860 | 5+: 1 em 154.043 |
| Quina | 5 de 80 | R$ 3,00 | 5–15 | 2 a 5 | 1 em 24.040.016 | 4+: 1 em 63.936 |
| Dia de Sorte | 7 de 31 | R$ 2,50 | 7–15 | 4 a 7 (+ Mês da Sorte) | 1 em 2.629.575 | 6+: 1 em 15.560 |

Os preços são configuráveis no `.env`. O Mês da Sorte do Dia de Sorte (1 em 12) fica fora das contas e das sugestões.

---

## Sumário
1. [Stack e arquitetura](#1-stack-e-arquitetura)
2. [Como rodar (passo a passo)](#2-como-rodar-passo-a-passo)
3. [Como usar o app](#3-como-usar-o-app)
4. [Como funciona por dentro](#4-como-funciona-por-dentro)
5. [API](#5-api)
6. [Testes](#6-testes)
7. [Estrutura de pastas](#7-estrutura-de-pastas)
8. [Configuração](#8-configuração)
9. [Problemas comuns](#9-problemas-comuns)
10. [Aviso legal, créditos e apoio](#10-aviso-legal-créditos-e-apoio)

---

## 1. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Banco | **Neo4j 5.26** (Docker), com grafo e **índice vetorial** nativo |
| Coleta | **Playwright** (Chromium headless) + API pública do portal de loterias da Caixa |
| Backend | **Node.js 22 + NestJS 11** (TypeScript strict), validação com `class-validator` e `zod`, Swagger |
| Frontend | **React 19 + Vite**, TanStack Query, Recharts |
| Testes | Jest + Supertest (backend), Vitest + Testing Library (frontend) |

```
┌──────────────┐  /api (proxy)  ┌──────────────────────────────┐   Bolt   ┌──────────────┐
│ React (5173) │ ─────────────▶ │ NestJS (3100)                │ ───────▶ │ Neo4j (7687) │
└──────────────┘                │  draws    → sync / Playwright│          │ grafo +      │
                                │  analysis → estatística,     │          │ índice       │
                                │             estratégia,      │          │ vetorial     │
                                │             planner, backtest│          └──────────────┘
                                └──────────────┬───────────────┘
                                               │ Chromium headless
                                               ▼
                                 portal de loterias da Caixa (JSON por concurso)
```

O núcleo (estatística, embeddings, estratégia, probabilidades, backtest) fica em **funções puras** sem dependência de Nest ou banco: é fácil de testar e reproduzir (PRNG com semente).

## 2. Como rodar (passo a passo)

Pré-requisitos: **Node 20+**, **Docker**.

```bash
# 1) Subir o Neo4j
cd lotofacil
docker compose up -d                 # Browser em http://localhost:7474 (neo4j / lotofacil123)

# 2) Backend
cd backend
cp .env.example .env                 # ajuste se quiser
npm install
npx playwright install chromium      # navegador usado na coleta
npm run sync                         # baixa os 4 jogos (~10 min na 1ª vez; ou: npm run sync -- megasena)
npm run start:dev                    # API em http://localhost:3100/api · Swagger em /docs

# 3) Frontend (outro terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

A sincronização é **incremental**: as próximas execuções só baixam os concursos novos. Você também pode sincronizar pelo botão **"Atualizar resultados"** no app, que atualiza o jogo da aba aberta.

Na primeira visita, o app mostra os **termos de uso**, que precisam ser aceitos (18+ e ciência de que não há garantia de ganho).

## 3. Como usar o app

No topo ficam as **abas de jogo** (Lotofácil, Mega-Sena, Quina, Dia de Sorte): cada uma troca as cores, o volante, as regras e os dados de todas as abas abaixo, e o app lembra o último jogo aberto. Logo abaixo ficam um **aviso fixo** ("não há garantia de ganho") e o banner da Bia. Os exemplos desta seção usam a Lotofácil; nos outros jogos os números (dezenas, faixas, preços) mudam conforme as regras de cada um.

### Aba "Sugerir jogo" (Planejador): a principal
No topo, o painel **"Entenda suas chances de verdade"** explica de forma direta:
- que todo jogo de 15 dezenas tem a mesma chance;
- o que aumenta a chance (apostar mais, espalhar os jogos, bolão) e o que não aumenta (dezenas quentes ou atrasadas, padrões, IA);
- uma escada de valores, de R$ 3,50 a R$ 3.500, com a chance real de 14+ e de 15 pontos em barras de 0 a 100%. Clicar numa linha já gera o plano para aquele valor.

Depois:
1. Informe **quanto quer gastar** (ou clique num valor pronto).
2. Clique em **Sugerir jogo**.
3. O app mostra:
   - a **sugestão** (ex.: "16 jogos diferentes de 15 dezenas"), com custo e a probabilidade exata de pelo menos um 14+. Ela é a opção de **maior probabilidade matemática** dentro do valor, com o lembrete de que o resultado mais provável continua sendo não ganhar;
   - **todas as opções** que cabem no orçamento (1 aposta de 15, de 16, de 17 dezenas… ou vários jogos simples), cada uma **já com os números**, desenhados num volante no estilo do bilhete;
   - o quadro **"O que pode acontecer, em palavras simples"**: você paga R$ X e, se jogar assim, "não ganha nada em N de cada 100 vezes", "ganha um prêmio pequeno de R$ 7 a R$ 35…", "faz 14 pontos 1 vez a cada…", além de quanto volta na média. Os detalhes técnicos ficam em "Ver detalhes";
   - a **probabilidade real de 0 a 100%** de cada faixa premiada, em barras na escala linear;
   - **quanto pode retornar em dinheiro**: valor pago, prêmio máximo possível, retorno médio esperado, resultado médio (R$ e %) e uma tabela de "se acertar X, recebe R$ Y";
   - a tabela de probabilidades exatas por quantidade de dezenas;
   - em cada opção, os botões **"💾 Salvar aposta"** e **"🎯 Conferir com o último resultado"**. O segundo busca o resultado na hora no portal da Caixa e mostra quanto a sugestão teria ganho.
4. Você escolhe a opção que preferir.

**Por que às vezes ele sugere vários jogos em vez de uma aposta grande?** Com R$ 56 você compra 1 aposta de 16 dezenas *ou* 16 jogos de 15. A aposta de 16 contém 16 combinações que se sobrepõem muito; 16 jogos espalhados cobrem mais o volante. Resultado: **1 em 2.982** contra **1 em 1.353** de chance de pelo menos um 14+. Em troca, quando a aposta grande acerta, ela paga vários prêmios de uma vez. O mesmo vale nos outros jogos (ex.: na Mega-Sena, 7 jogos de 6 dezenas contra 1 aposta de 7, ambos por R$ 42).

| Dezenas | Custo (R$ 3,50/jogo) | Chance de 14+ | Chance de 15 |
|---|---|---|---|
| 15 | R$ 3,50 | 1 em 21.647 | 1 em 3.268.760 |
| 16 | R$ 56,00 | 1 em 2.982 | 1 em 204.298 |
| 17 | R$ 476,00 | 1 em 586 | 1 em 24.035 |
| 18 | R$ 2.856,00 | 1 em 147 | 1 em 4.006 |
| 19 | R$ 13.566,00 | 1 em 44 | 1 em 843 |
| 20 | R$ 54.264,00 | 1 em 16 | 1 em 211 |

**Exemplo (Lotofácil, R$ 56):**

| | 1 jogo de 15 | 1 aposta de 16 | 16 jogos de 15 (espalhados) |
|---|---|---|---|
| Algum prêmio (11+) | 10,6% | 22,2% | ~91% |
| 14 ou 15 | 0,0046% | 0,034% | 0,074% |
| 15 pontos | 0,000031% | 0,00049% | 0,00049% |
| Retorno médio | R$ 1,59 | R$ 25,42 | R$ 25,42 |
| Resultado médio | −54% | −54% | −54% |

Repare que **o resultado médio é o mesmo (−54%) em qualquer opção**: cada combinação vale o mesmo em média. Distribuir a aposta muda a *probabilidade* de cada faixa, não o valor esperado. Os 16 jogos chegam a ~91% de algum 11+ porque o app escolhe jogos com **o mínimo de dezenas em comum**; 16 jogos aleatórios ficariam em ~84%.

### Aba "Apostas salvas"
Guarda neste navegador as apostas salvas no Planejador, separadas por jogo. Em cada uma dá para **conferir com o último resultado** ou **nos últimos 1 a 10 resultados**, com o total gasto, os prêmios e o saldo.

### Aba "Conferir apostas"
Cole suas apostas (uma por linha) e confira contra o último concurso ou um concurso escolhido: acertos, prêmio por aposta, dezenas que ninguém marcou e quantas das "favoritas" de cada sinal da IA saíram, comparadas com o esperado por puro acaso (d²/N). A conferência **não altera os pesos**: ajustar pesos pelos últimos resultados só persegue ruído.

### Aba "Estatísticas"
Frequência histórica, frequência recente e atraso de cada dezena (com a linha do esperado pelo acaso), distribuições de soma, ímpares, primos, moldura e repetidas do concurso anterior, e o **teste qui-quadrado de uniformidade**.

### Aba "Backtest"
Simula o passado sem "olhar o futuro": para cada um dos últimos N concursos, o motor só vê os anteriores, sugere um jogo e confere com o resultado real, usando **os prêmios reais pagos naquele concurso**. Compara com a distribuição exata de um jogo aleatório e mostra o IC 95%, os premiados, os 14+ e o retorno financeiro.
Resultado típico (Lotofácil, 100 concursos, 15 dezenas): média **8,96 acertos vs 9,00 do acaso**, sem diferença estatística, e retorno de cerca de −66%. É a prova honesta do aviso lá de cima.

### Aba "Histórico"
Lista de concursos. Ao clicar em um, o app consulta o **índice vetorial do Neo4j** e mostra os concursos mais parecidos e o que saiu logo depois de cada um.

## 4. Como funciona por dentro

### 4.1 Coleta (Playwright)
`ScraperService` abre um Chromium headless no portal da Caixa (obtendo cookies e sessão como um navegador real) e usa o `APIRequestContext` do mesmo contexto para buscar o JSON de cada concurso:
- pool de concorrência configurável (`SCRAPE_CONCURRENCY`) e **retry com backoff exponencial**;
- persistência **em lotes de 250**, para que uma falha não perca o que já foi baixado;
- a sincronização de um jogo nunca roda duas vezes ao mesmo tempo (o botão responde 409 se já estiver rodando);
- o parser (`caixa.parser.ts`) valida as dezenas, converte a data e extrai a ordem do sorteio e o rateio das faixas do jogo (Lotofácil 11–15, Mega-Sena 4–6, Quina 2–5, Dia de Sorte 4–7; o Mês da Sorte é descartado);
- cada jogo usa sua API (`/portaldeloterias/api/{lotofacil|megasena|quina|diadesorte}`); `npm run sync` baixa os 4 em sequência, e `npm run sync -- diadesorte` só um.

### 4.2 Modelo no Neo4j
Cada jogo tem seus próprios rótulos, então os dados não se misturam e a Lotofácil manteve os nomes originais (sem migração):

| Jogo | Concurso | Dezena | Conferência | Índice vetorial (dimensões) |
|---|---|---|---|---|
| Lotofácil | `Draw` | `Number` | `Bet` | `draw_embedding_index` (31) |
| Mega-Sena | `MegaDraw` | `MegaNumber` | `MegaBet` | `megadraw_embedding_index` (66) |
| Quina | `QuinaDraw` | `QuinaNumber` | `QuinaBet` | `quinadraw_embedding_index` (86) |
| Dia de Sorte | `SorteDraw` | `SorteNumber` | `SorteBet` | `sortedraw_embedding_index` (37) |

```
(:Draw {concurso, date, numbers, drawOrder, prizes, embedding[N+6]})
(:Draw)-[:DREW {position}]->(:Number {value, frequency, embedding[8]})
(:Draw)-[:NEXT]->(:Draw)
(:Number)-[:CO_OCCURS {count, ppmi}]->(:Number)
(:Bet {numbers, hits, prize, checkedAt})-[:CHECKED_AGAINST]->(:Draw)
```
Cada jogo tem constraints de unicidade no concurso e no valor da dezena, além do seu índice vetorial (cosseno). Os nomes e rótulos ficam em `LotteryGame.graph` (`backend/src/common/lottery.ts`).

Exemplos no Neo4j Browser:
```cypher
// pares que mais saem juntos
MATCH (a:Number)-[r:CO_OCCURS]->(b:Number) RETURN a.value, b.value, r.count ORDER BY r.count DESC LIMIT 10;
// concursos mais parecidos com o último
MATCH (d:Draw) WITH d ORDER BY d.concurso DESC LIMIT 1
CALL db.index.vector.queryNodes('draw_embedding_index', 6, d.embedding) YIELD node, score
RETURN node.concurso, node.numbers, score;
```

### 4.3 Embeddings (sem API externa)
- **Concurso → vetor de N + 6 dimensões** (31 na Lotofácil, 66 na Mega-Sena): N posições one-hot centradas (o cosseno vira uma correlação entre sorteios) + 6 features de perfil (soma, ímpares, primos, moldura, Fibonacci, maior sequência), normalizadas pela média e pelo desvio esperados num sorteio aleatório de cada jogo. Ficam no índice vetorial do Neo4j.
- **Dezena → vetor de 8 dimensões**: a matriz de coocorrência N×N vira **PPMI** (Positive Pointwise Mutual Information), fatorada por decomposição espectral (power iteration com deflação), a mesma ideia de word2vec/GloVe. Serve para medir a **coesão** de um jogo.

### 4.4 Motor de sugestão (`strategy.engine.ts`)
1. **Score por dezena**: um ensemble de sinais padronizados em z-score:
   - `long`: frequência no histórico todo;
   - `recent`: frequência nos últimos concursos (quentes). A janela é escalada para ~15 aparições esperadas por dezena: 25 concursos na Lotofácil, 150 na Mega-Sena, 240 na Quina e 66 no Dia de Sorte;
   - `momentum`: frequência com decaimento exponencial (meia-vida também escalada: 20, 120, 190 e 53 concursos);
   - `delay`: atraso atual dividido pelo intervalo médio (atrasadas);
   - `analog`: k-NN por embedding. Acha os 30 concursos mais parecidos com o último e conta o que saiu **logo depois** deles.
2. **Geração**: 20 mil jogos candidatos por amostragem ponderada sem reposição (Efraimidis–Spirakis) com softmax dos scores.
3. **Filtro de perfil** (só jogos do tamanho do sorteio, ex.: 15 na Lotofácil, 6 na Mega): soma, ímpares, primos, moldura e repetidas do último concurso precisam ficar entre os percentis 10 e 90 do histórico.
4. **Ranking**: score médio das dezenas + peso × coesão (embeddings PPMI).
5. **Diversidade**: seleção gulosa de máxima dispersão: cada novo jogo é o que menos se sobrepõe aos já escolhidos (o score só desempata). Com vários jogos, sobreposição baixa é o que aumenta a chance de pelo menos um premiado (ex.: 16 jogos → ~91% de ter algum 11+, contra ~84% de jogos aleatórios).

Os pesos são fixos (`DEFAULT_WEIGHTS`) e podem ser sobrescritos por requisição (`weights`); a conferência não os altera. Com os pesos padrão ou zerados, a chance de algum prêmio dá a mesma: **a vantagem real está na dispersão dos jogos, não nos sinais**. Tudo é **determinístico** por semente (o padrão é o número do último concurso).

### 4.5 Planejador (`bet-planner.ts`) e probabilidades (`probability.ts`)
- As probabilidades por quantidade de dezenas vêm da **hipergeométrica exata**, e o custo é C(n, d) × preço, com d = dezenas sorteadas.
- A comparação entre planos usa a faixa **"quase máxima"**: 14+ na Lotofácil, 5+ na Mega-Sena, 4+ na Quina e 6+ no Dia de Sorte.
- Para vários jogos, P(pelo menos um na faixa) é calculada pelos **limites de Bonferroni**, com a interseção exata de cada par por enumeração das 4 regiões do volante. Fato útil: na Lotofácil, dois jogos só fazem 14+ juntos se compartilharem **13 ou mais dezenas**; abaixo disso, os eventos são disjuntos e a chance total é exatamente a soma. A seleção por dispersão mantém a sobreposição bem abaixo disso.
- A sugestão é a opção de maior probabilidade da faixa quase máxima dentro do orçamento.
- **Probabilidades de 0 a 100% (`planOdds`)**, por faixa premiada: para aposta única, a hipergeométrica exata. Para vários jogos:
  - prêmio máximo exato, porque jogos distintos são eventos disjuntos;
  - faixas raras por Bonferroni, exato com sobreposição baixa;
  - faixas comuns por Monte Carlo, com 100 mil sorteios simulados e bitmasks.

### 4.6 Retorno financeiro (`returns.ts`)
- **Prêmios**: faixas de valor fixo (11–13 na Lotofácil, 4–5 no Dia de Sorte) usam o valor vigente. As de rateio usam a **média real das últimas 50 vezes em que a faixa teve ganhador**, buscando no histórico todo, porque a sena da Mega pode passar meses acumulando.
- **Pagamento por faixa**: numa aposta de n dezenas com h acertos, somam-se todos os jogos simples premiados, C(h,k)·C(n−h,d−k) para cada faixa k.
- **Valor esperado**: Σ P(h acertos) × pagamento(h). Para vários jogos, por linearidade, é igual a k × o valor esperado de um jogo.
- **Resultado médio**: valor esperado − custo, em R$ e em %.

### 4.7 Backtest (`backtest.engine.ts`)
É walk-forward, com prêmio real por concurso. Para apostas de n dezenas com h acertos, o número de jogos simples premiados com k pontos é C(h,k)·C(n−h,d−k). O "acaso" de referência é a hipergeométrica exata do jogo (média n·d/N).

### 4.8 Visual
O frontend segue o padrão visual dos volantes do Loterias Online: na Lotofácil, roxo **#930089**, cabeçalho roxo de ponta a ponta, abas em formato de pílula, fundo cinza-claro, cartões brancos e **dezenas em círculos** (vazadas quando livres e preenchidas de roxo quando marcadas). Fonte Nunito Sans. Por ser um app pessoal e não oficial, não usa a logo nem a identidade visual da Caixa. Cada jogo tem sua cor (Mega-Sena verde **#209869**, Quina azul **#260085**, Dia de Sorte dourado **#b8741a**, definidas em `index.css` por `data-game`) e seu volante (5×5, 10×6, 10×8 e 7 colunas).

### 4.9 Apoio: Bia
O app é gratuito com o apoio da **[Bia](https://souabia.com)**, secretária de IA que atende o WhatsApp de negócios 24h (agenda, confirma e lembra clientes no Google Calendar). O banner fica em `frontend/src/components/BiaBanner.tsx` (link com UTM `utm_source=loterias-lab`); a imagem está em `frontend/public/bia-hero.png`.

### 4.10 Abrindo o Neo4j no navegador
1. Com o container rodando (`docker compose ps`), acesse **http://localhost:7474**.
2. Em *Connect URL*, use `neo4j://localhost:7687` (ou `bolt://localhost:7687`).
3. Usuário `neo4j`, senha `lotofacil123` (ou o que estiver em `NEO4J_PASSWORD`).
4. Rode, por exemplo, `MATCH (d:Draw)-[r:DREW]->(n:Number) WHERE d.concurso = 3795 RETURN d, r, n` para ver o grafo do último concurso, ou as consultas da seção 4.2. Nos outros jogos, troque os rótulos (ex.: `MegaDraw`, `MegaNumber`).

## 5. API

Base: `http://localhost:3100/api/{jogo}`, com `{jogo}` = `lotofacil`, `megasena`, `quina` ou `diadesorte` (exceto `/health`). A documentação interativa fica em **http://localhost:3100/docs**.

Um `{jogo}` desconhecido responde **404**. A quantidade de dezenas aceita em `betSize` e `bets` depende do jogo, e fora do intervalo a resposta é **400**.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status da API e do Neo4j |
| POST | `/sync` | Inicia a sincronização incremental em background (202) |
| GET | `/sync/status` | Progresso da sincronização |
| GET | `/draws?page=&pageSize=` | Concursos, do mais recente para o mais antigo |
| GET | `/draws/latest` | Último concurso |
| GET | `/draws/:concurso` | Um concurso |
| GET | `/draws/:concurso/similar?k=` | Busca vetorial no Neo4j + concurso seguinte |
| GET | `/pairs?limit=&orderBy=count\|ppmi` | Pares mais frequentes (grafo) |
| GET | `/stats/summary` | Estatísticas completas |
| GET | `/probabilities` | Tabela exata por quantidade de dezenas |
| POST | `/plan` `{budget}` | **Quantas dezenas comprar + os números**, com probabilidades 0–100% (`odds`) e retorno em R$ (`returns`) |
| POST | `/suggestions` `{betSize, games, seed?, weights?}` | Jogos sugeridos |
| POST | `/backtest` `{betSize, testSize, budget?, weights?}` | Backtest walk-forward; com `budget` testa o plano recomendado (ex.: 56 → 16 bilhetes) |
| POST | `/check` `{bets: number[][], concurso?}` | Confere 1..N apostas, prêmio, onde cada sinal errou (não altera os pesos) |
| POST | `/check/recent` `{bets, count}` | Confere as apostas nos últimos 1–50 concursos oficiais |
| GET | `/model` | Pesos do ensemble em uso (padrão) |

```bash
curl -X POST localhost:3100/api/lotofacil/plan -H 'content-type: application/json' -d '{"budget":56}'
```

## 6. Testes

```bash
cd backend
npm test            # 73 testes unitários (estatística, embeddings, estratégia, probabilidades, planner, retorno financeiro, backtest, conferência, parser, config, concorrência), incluindo Mega-Sena, Quina e Dia de Sorte
npm run test:e2e    # 8 testes e2e da API (Nest completo, com Neo4j e scraper simulados; inclui rotas da Mega-Sena e jogo desconhecido)
npm run test:cov    # cobertura

cd ../frontend
npm test            # 12 testes: volante por jogo, guia de chances, resumo em palavras simples, parser de apostas, aceite dos termos e fluxo do planejador
npm run typecheck && npm run build
```

Os testes usam um histórico sintético uniforme e reprodutível (`src/test-utils/fixtures.ts`) e verificam valores exatos conhecidos: C(25,15) = 3.268.760, P(14+) = 151/3.268.760, sena 1 em 50.063.860, quina+ = 325 combinações, Dia de Sorte 1 em 2.629.575, os custos por quantidade de dezenas, a regra da sobreposição, os prêmios de apostas grandes e a dispersão dos jogos sugeridos.

## 7. Estrutura de pastas

```
lotofacil/
├── docker-compose.yml           # Neo4j
├── backend/src/
│   ├── common/                  # regras de cada jogo (lottery.ts: GAMES), GamePipe, PRNG, bitmasks, retry/concorrência
│   ├── config/                  # env validado com zod (preço por jogo)
│   ├── neo4j/                   # driver, schema e índice vetorial por jogo
│   ├── scraper/                 # Playwright + parser da Caixa (API de cada jogo)
│   ├── draws/                   # repositório do grafo, sync por jogo, endpoints de concursos
│   ├── statistics/              # frequência, atraso, perfis, qui-quadrado
│   ├── embeddings/              # embeddings de concursos e de dezenas (PPMI + espectral), k-NN
│   ├── strategy/                # motor de sugestão (dispersão), probabilidades, planejador, retorno financeiro
│   ├── backtest/                # walk-forward
│   ├── check/                   # conferência de apostas e desempenho dos sinais
│   ├── analysis/                # endpoints de análise + worker threads
│   ├── cli/sync.ts              # npm run sync [-- jogo]
│   └── main.ts
├── backend/test/                # e2e
└── frontend/
    ├── public/bia-hero.png      # imagem do banner de apoio
    └── src/
        ├── api/                 # client tipado (/api/{jogo}) + tipos
        ├── components/          # volante, guia de chances, palavras simples, medidor 0–100%, retorno, banner da Bia, termos/avisos
        ├── pages/               # Planejador, Apostas salvas, Conferir, Estatísticas, Backtest, Histórico
        └── lib/                 # regras dos jogos (games.ts), probabilidades, apostas salvas, créditos, formatação pt-BR
```

## 8. Configuração

`backend/.env`:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 3100 | Porta da API |
| `CORS_ORIGIN` | http://localhost:5173 | Origem do frontend |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | bolt://localhost:7687 / neo4j / lotofacil123 | Conexão |
| `SCRAPE_FROM_CONCURSO` | 1 | Primeiro concurso a importar, **em todos os jogos** (a numeração difere entre eles; deixe 1) |
| `SCRAPE_CONCURRENCY` | 4 | Requisições simultâneas na coleta |
| `BET_PRICE` | 3.5 | Preço da aposta simples da Lotofácil (R$) |
| `MEGASENA_BET_PRICE` | 6 | Preço da aposta simples da Mega-Sena (R$) |
| `QUINA_BET_PRICE` | 3 | Preço da aposta simples da Quina (R$) |
| `DIADESORTE_BET_PRICE` | 2.5 | Preço da aposta simples do Dia de Sorte (R$) |
| `SYNC_ON_STARTUP` | false | Sincroniza os 4 jogos (um por vez) ao subir a API |

Se mudar a senha do Neo4j, defina `NEO4J_PASSWORD` também no ambiente do `docker compose`. A senha só é aplicada na criação do volume.

## 9. Problemas comuns

- **"Poucos concursos da {jogo} no banco"**: rode `npm run sync -- {jogo}` ou clique em "Atualizar resultados" na aba do jogo.
- **Quero ver os termos de novo**: limpe os dados do site no navegador ou suba `TERMS_VERSION` em `LegalNotice.tsx`.
- **Mudou o preço de um jogo**: ajuste a variável no `.env` do backend e o `defaultBetPrice` em `frontend/src/lib/games.ts` (usado antes da API responder).
- **Falha ao conectar no Neo4j**: confira com `docker compose ps` se o container está `healthy`.
- **Erro de navegador na sincronização**: rode `npx playwright install chromium` dentro de `backend/`.
- **Alguns concursos falharam**: rode a sincronização de novo. Ela só busca o que falta.
- **Zerar o banco**: `docker compose down -v && docker compose up -d`.

## 10. Aviso legal, créditos e apoio

**Este app não garante vitória.** Ele sugere apostas com base em estatística e probabilidade, mas os sorteios são aleatórios e nenhuma análise muda a chance de um jogo ser sorteado. O uso é educativo e informativo, e a decisão de apostar é sempre de quem usa.

No frontend, o aviso aparece em três lugares:
- um **pop-up de termos de uso na primeira visita**. Ele só fecha quando a pessoa marca "tenho 18 anos ou mais" e "li e aceito". O aceite fica salvo no navegador com a versão dos termos (`TERMS_VERSION` em `LegalNotice.tsx`); se o texto mudar e a versão subir, o pop-up aparece de novo;
- uma **faixa fixa no topo** de todas as abas ("Não há garantia de ganho…", +18);
- o **"Aviso legal e termos de uso"** no rodapé (`frontend/src/components/LegalNotice.tsx`), que diz:
  - não há garantia de resultado e o conteúdo não é recomendação financeira;
  - o app não tem vínculo com a Caixa, não vende apostas, e as marcas são da Caixa;
  - os dados devem ser conferidos no site oficial;
  - é proibido para menores de 18 anos;
  - jogue com responsabilidade (Jogadores Anônimos e CVV 188);
  - privacidade: sem cadastro, as apostas ficam só no navegador;
  - o app é oferecido "como está", sem garantias.

> Esses textos são um ponto de partida e não substituem orientação jurídica. Antes de publicar, vale a revisão de um advogado.

**Desenvolvedor:** [Carlos Eduardo Ferreiro Corrêa](https://www.linkedin.com/in/eng-carlos-eduardo-ferreiro-corr%C3%AAa-9606963a/). O crédito aparece no rodapé e é definido em `frontend/src/lib/credits.ts`.

**Apoio:** o app é gratuito com o apoio da [Bia](https://souabia.com), secretária de IA no WhatsApp (ver 4.9).


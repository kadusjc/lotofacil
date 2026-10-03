# Lotofácil Lab

App local que baixa **todo o histórico oficial da Lotofácil** (desde o concurso 1, em 2003) com Playwright, guarda num **grafo Neo4j com embeddings vetoriais** e, a partir de estatística + similaridade, **sugere os números e quantas dezenas comprar** para o valor que você quer gastar. Quem decide se joga é você.

> **Aviso importante.** A Lotofácil é um sorteio uniforme e sem memória: toda combinação de 15 dezenas tem exatamente **1 chance em 3.268.760** de sair, e a chance de fazer **14 ou 15 pontos com um jogo simples é 1 em 21.647**. Nenhuma análise de resultados passados aumenta essa chance. O app faz a melhor análise possível *e* prova isso com um teste chi-quadrado e um backtest. O que realmente muda a sua chance é **quanto você aposta e como distribui as apostas**, e é isso que o Planejador calcula com exatidão. O valor esperado é sempre negativo: jogue só o que pode perder.

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
npm run sync                         # baixa todos os concursos para o Neo4j (~2 min na 1ª vez)
npm run start:dev                    # API em http://localhost:3100/api · Swagger em /docs

# 3) Frontend (outro terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

A sincronização é **incremental**: as próximas execuções só baixam os concursos novos. Você também pode sincronizar pelo botão **"Atualizar resultados"** no app.

## 3. Como usar o app

### Aba "Sugerir jogo" (Planejador): a principal
No topo, o painel **"Como aumentar sua chance de ganhar"** explica de forma direta:
- que todo jogo de 15 dezenas tem a mesma chance;
- o que aumenta a chance (apostar mais, espalhar os jogos, bolão) e o que não aumenta (dezenas quentes ou atrasadas, padrões, IA);
- uma escada de valores, de R$ 3,50 a R$ 3.500, com a chance real de 14+ e de 15 pontos em barras de 0 a 100%. Clicar numa linha já gera o plano para aquele valor.

Depois:
1. Informe **quanto quer gastar** (ou clique num valor pronto).
2. Clique em **Sugerir jogo**.
3. O app mostra:
   - a **recomendação**, com o aviso de que ela é a forma de **maior chance possível** para aquele valor (para aumentar, só aumentando o valor), (ex.: "16 jogos diferentes de 15 dezenas"), com custo e a chance exata de pelo menos um 14+;
   - **todas as opções** que cabem no orçamento (1 aposta de 15, de 16, de 17 dezenas… ou vários jogos simples), cada uma **já com os números**, desenhados num volante no estilo do bilhete;
   - a **probabilidade real de 0 a 100%** de cada faixa (algum prêmio 11+, 13+, 14+ e 15 pontos), em barras na escala linear;
   - **quanto pode retornar em dinheiro**: valor pago, prêmio máximo possível, retorno médio esperado, resultado médio (R$ e %) e uma tabela de "se acertar X, recebe R$ Y";
   - a tabela de probabilidades exatas de 15 a 20 dezenas.
4. Você escolhe a opção que preferir.

**Por que às vezes ele recomenda vários jogos em vez de uma aposta grande?** Com R$ 56 você compra 1 aposta de 16 dezenas *ou* 16 jogos de 15. A aposta de 16 contém 16 combinações que se sobrepõem muito; 16 jogos espalhados cobrem mais o volante. Resultado: **1 em 2.982** contra **1 em 1.353** de chance de pelo menos um 14+. Em troca, quando a aposta grande acerta, ela paga vários prêmios de uma vez.

| Dezenas | Custo (R$ 3,50/jogo) | Chance de 14+ | Chance de 15 |
|---|---|---|---|
| 15 | R$ 3,50 | 1 em 21.647 | 1 em 3.268.760 |
| 16 | R$ 56,00 | 1 em 2.982 | 1 em 204.298 |
| 17 | R$ 476,00 | 1 em 586 | 1 em 24.035 |
| 18 | R$ 2.856,00 | 1 em 147 | 1 em 4.006 |
| 19 | R$ 13.566,00 | 1 em 44 | 1 em 843 |
| 20 | R$ 54.264,00 | 1 em 16 | 1 em 211 |

**Exemplo real (R$ 56, concurso 3795):**

| | 1 jogo de 15 | 1 aposta de 16 | 16 jogos de 15 (recomendado) |
|---|---|---|---|
| Algum prêmio (11+) | 10,6% | 22,2% | 65,8% |
| 14 ou 15 | 0,0046% | 0,034% | 0,074% |
| 15 pontos | 0,000031% | 0,00049% | 0,00049% |
| Prêmio máximo | ~R$ 2,0 mi | ~R$ 2,04 mi | ~R$ 2,0 mi |
| Retorno médio | R$ 1,59 | R$ 25,42 | R$ 25,42 |
| Resultado médio | −54% | −54% | −54% |

Repare que **o resultado médio é o mesmo (−54%) em qualquer opção**: cada combinação de 15 dezenas vale o mesmo em média. Distribuir a aposta muda a *chance* de cada faixa, não o valor esperado.

### Aba "Estatísticas"
Frequência histórica, frequência recente e atraso de cada dezena (com a linha do esperado pelo acaso), distribuições de soma, ímpares, primos, moldura e repetidas do concurso anterior, e o **teste qui-quadrado de uniformidade**.

### Aba "Backtest"
Simula o passado sem "olhar o futuro": para cada um dos últimos N concursos, o motor só vê os anteriores, sugere um jogo e confere com o resultado real, usando **os prêmios reais pagos naquele concurso**. Compara com a distribuição exata de um jogo aleatório e mostra o IC 95%, os premiados, os 14+ e o retorno financeiro.
Resultado típico (100 concursos, 15 dezenas): média **8,96 acertos vs 9,00 do acaso**, sem diferença estatística, e retorno de cerca de −66%. É a prova honesta do aviso lá de cima.

### Aba "Histórico"
Lista de concursos. Ao clicar em um, o app consulta o **índice vetorial do Neo4j** e mostra os concursos mais parecidos e o que saiu logo depois de cada um.

## 4. Como funciona por dentro

### 4.1 Coleta (Playwright)
`ScraperService` abre um Chromium headless no portal da Caixa (obtendo cookies e sessão como um navegador real) e usa o `APIRequestContext` do mesmo contexto para buscar o JSON de cada concurso:
- pool de concorrência configurável (`SCRAPE_CONCURRENCY`) e **retry com backoff exponencial**;
- persistência **em lotes de 250**, para que uma falha não perca o que já foi baixado;
- o parser (`caixa.parser.ts`) valida as dezenas, converte a data e extrai a ordem do sorteio e o rateio (11 a 15 acertos).

### 4.2 Modelo no Neo4j
```
(:Draw {concurso, date, numbers, drawOrder, prizes, embedding[31]})
(:Draw)-[:DREW {position}]->(:Number {value, frequency, embedding[8]})
(:Draw)-[:NEXT]->(:Draw)
(:Number)-[:CO_OCCURS {count, ppmi}]->(:Number)
```
Constraints de unicidade em `Draw.concurso` e `Number.value`, e um **índice vetorial** `draw_embedding_index` (cosseno, 31 dimensões).

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
- **Concurso → vetor de 31 dimensões**: 25 posições one-hot centradas (o cosseno vira uma correlação entre sorteios) + 6 features de perfil normalizadas (soma, ímpares, primos, moldura, Fibonacci, maior sequência). Ficam no índice vetorial do Neo4j.
- **Dezena → vetor de 8 dimensões**: a matriz de coocorrência 25×25 vira **PPMI** (Positive Pointwise Mutual Information), fatorada por decomposição espectral (power iteration com deflação), a mesma ideia de word2vec/GloVe. Serve para medir a **coesão** de um jogo.

### 4.4 Motor de sugestão (`strategy.engine.ts`)
1. **Score por dezena**: um ensemble de sinais padronizados em z-score:
   - `long`: frequência no histórico todo;
   - `recent`: frequência nos últimos 25 concursos (quentes);
   - `momentum`: frequência com decaimento exponencial (meia-vida de 20 concursos);
   - `delay`: atraso atual dividido pelo intervalo médio (atrasadas);
   - `analog`: k-NN por embedding. Acha os 30 concursos mais parecidos com o último e conta o que saiu **logo depois** deles.
2. **Geração**: 20 mil jogos candidatos por amostragem ponderada sem reposição (Efraimidis–Spirakis) com softmax dos scores.
3. **Filtro de perfil** (jogos de 15): soma, ímpares, primos, moldura e repetidas do último concurso precisam ficar entre os percentis 10 e 90 do histórico.
4. **Ranking**: score médio das dezenas + peso × coesão (embeddings PPMI).
5. **Diversidade**: seleção gulosa com sobreposição máxima entre jogos (11 por padrão no planejador).

Os pesos podem ser ajustados via API (`weights`). Tudo é **determinístico** por semente (o padrão é o número do último concurso).

### 4.5 Planejador (`bet-planner.ts`) e probabilidades (`probability.ts`)
- As probabilidades por quantidade de dezenas vêm da **hipergeométrica exata**, e o custo é C(n,15) × preço.
- Para vários jogos, P(pelo menos um 14+) é calculada pelos **limites de Bonferroni**, com a interseção exata de cada par por enumeração das 4 regiões do volante. Fato útil: dois jogos só fazem 14+ juntos se compartilharem **13 ou mais dezenas**. Com sobreposição ≤ 12, os eventos são disjuntos e a chance total é exatamente a soma, por isso o planejador usa sobreposição máxima de 11.
- A recomendação é a opção de maior chance de 14+ dentro do orçamento.
- **Probabilidades de 0 a 100% (`planOdds`)**: para aposta única, a hipergeométrica exata; para vários jogos, 14+ por Bonferroni (exato), 15 exato (jogos distintos são eventos disjuntos) e 11+/13+ por Monte Carlo (100 mil sorteios simulados, com bitmasks).

### 4.6 Retorno financeiro (`returns.ts`)
- **Prêmios**: os de 11, 12 e 13 acertos são fixos, com o valor vigente do último concurso (hoje R$ 7, R$ 14 e R$ 35). Os de 14 e 15 usam a **média real dos últimos 50 concursos** que tiveram ganhador na faixa.
- **Pagamento por faixa**: numa aposta de n dezenas com h acertos, somam-se todas as combinações de 15 premiadas, C(h,k)·C(n−h,15−k) para cada faixa k.
- **Valor esperado**: Σ P(h acertos) × pagamento(h). Para vários jogos, por linearidade, é igual a k × o valor esperado de um jogo.
- **Resultado médio**: valor esperado − custo, em R$ e em %.

### 4.7 Backtest (`backtest.engine.ts`)
É walk-forward, com prêmio real por concurso. Para apostas de n dezenas com h acertos, o número de combinações premiadas de k pontos é C(h,k)·C(n−h,15−k).

### 4.8 Visual
O frontend segue o padrão visual do volante da Lotofácil no Loterias Online: roxo **#930089**, cabeçalho roxo de ponta a ponta, abas em formato de pílula, fundo cinza-claro, cartões brancos e **dezenas em círculos** (vazadas quando livres e preenchidas de roxo quando marcadas). Fonte Nunito Sans. Por ser um app pessoal e não oficial, não usa a logo nem a identidade visual da Caixa.

### 4.9 Abrindo o Neo4j no navegador
1. Com o container rodando (`docker compose ps`), acesse **http://localhost:7474**.
2. Em *Connect URL*, use `neo4j://localhost:7687` (ou `bolt://localhost:7687`).
3. Usuário `neo4j`, senha `lotofacil123` (ou o que estiver em `NEO4J_PASSWORD`).
4. Rode, por exemplo, `MATCH (d:Draw)-[r:DREW]->(n:Number) WHERE d.concurso = 3795 RETURN d, r, n` para ver o grafo do último concurso, ou as consultas da seção 4.2.

## 5. API

Base: `http://localhost:3100/api`. A documentação interativa fica em **http://localhost:3100/docs**.

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
| GET | `/probabilities` | Tabela exata de 15 a 20 dezenas |
| POST | `/plan` `{budget}` | **Quantas dezenas comprar + os números**, com probabilidades 0–100% (`odds`) e retorno em R$ (`returns`) |
| POST | `/suggestions` `{betSize, games, seed?, weights?}` | Jogos sugeridos |
| POST | `/backtest` `{betSize, testSize, weights?}` | Backtest |

```bash
curl -X POST localhost:3100/api/plan -H 'content-type: application/json' -d '{"budget":56}'
```

## 6. Testes

```bash
cd backend
npm test            # 48 testes unitários (estatística, embeddings, estratégia, probabilidades, planner, retorno financeiro, backtest, parser, config, concorrência)
npm run test:e2e    # 6 testes e2e da API (Nest completo, com Neo4j e scraper simulados)
npm run test:cov    # cobertura

cd ../frontend
npm test            # componentes, guia de chances, formatação e fluxo do planejador
npm run typecheck && npm run build
```

Os testes usam um histórico sintético uniforme e reprodutível (`src/test-utils/fixtures.ts`) e verificam valores exatos conhecidos: C(25,15) = 3.268.760, P(14+) = 151/3.268.760, os custos de 15 a 20 dezenas, a regra da sobreposição ≥ 13, os prêmios de apostas grandes e assim por diante.

## 7. Estrutura de pastas

```
lotofacil/
├── docker-compose.yml           # Neo4j
├── backend/src/
│   ├── common/                  # regras do jogo, PRNG, retry/concorrência
│   ├── config/                  # env validado com zod
│   ├── neo4j/                   # driver, schema, índice vetorial
│   ├── scraper/                 # Playwright + parser da Caixa
│   ├── draws/                   # repositório do grafo, sync, endpoints de concursos
│   ├── statistics/              # frequência, atraso, perfis, chi-quadrado
│   ├── embeddings/              # embeddings de concursos e de dezenas (PPMI + espectral), k-NN
│   ├── strategy/                # motor de sugestão, probabilidades, planejador, retorno financeiro
│   ├── backtest/                # walk-forward
│   ├── analysis/                # endpoints de análise
│   ├── cli/sync.ts              # npm run sync
│   └── main.ts
├── backend/test/                # e2e
└── frontend/src/
    ├── api/                     # client tipado + tipos
    ├── components/              # volante (bilhete), guia de chances, medidor 0–100%, painel de retorno, feedback
    ├── pages/                   # Planejador, Estatísticas, Backtest, Histórico
    └── lib/                     # formatação pt-BR
```

## 8. Configuração

`backend/.env`:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 3100 | Porta da API |
| `CORS_ORIGIN` | http://localhost:5173 | Origem do frontend |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | bolt://localhost:7687 / neo4j / lotofacil123 | Conexão |
| `SCRAPE_FROM_CONCURSO` | 1 | Primeiro concurso a importar (ex.: `1300` ≈ últimos 10 anos) |
| `SCRAPE_CONCURRENCY` | 4 | Requisições simultâneas na coleta |
| `BET_PRICE` | 3.5 | Preço da aposta simples (R$) |
| `SYNC_ON_STARTUP` | false | Sincroniza ao subir a API |

Se mudar a senha do Neo4j, defina `NEO4J_PASSWORD` também no ambiente do `docker compose`. A senha só é aplicada na criação do volume.

## 9. Problemas comuns

- **"Poucos concursos no banco"**: rode `npm run sync` ou clique em "Atualizar resultados".
- **Falha ao conectar no Neo4j**: confira com `docker compose ps` se o container está `healthy`.
- **Erro de navegador na sincronização**: rode `npx playwright install chromium` dentro de `backend/`.
- **Alguns concursos falharam**: rode a sincronização de novo. Ela só busca o que falta.
- **Zerar o banco**: `docker compose down -v && docker compose up -d`.

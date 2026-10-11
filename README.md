# 📦 Aponta CD — Hidráulica Tropeiro

Sistema web de **rastreamento de atividades operacionais** para o Centro de Distribuição da Hidráulica Tropeiro. Registra tempo de execução de tarefas, faltas de produto, erros de separação, gerencia agendamentos de recebimento, controla a fila de conferência e dá ao admin **controle total** sobre qualquer dado do sistema.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Técnica](#-stack-técnica)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Banco de Dados](#-banco-de-dados)
- [Autenticação](#-autenticação)
- [Rotas e Navegação](#-rotas-e-navegação)
- [Atalhos de Teclado](#-atalhos-de-teclado)
- [Poderes do Admin](#-poderes-do-admin)
- [Deploy](#-deploy)
- [Desenvolvimento](#-desenvolvimento)

---

## 🎯 Visão Geral

O **Aponta CD** resolve o problema de **medição de produtividade e rastreabilidade** no CD. Cada operador registra suas atividades em quiosques (tablets/computadores no chão de fábrica) usando um código pessoal de 3 dígitos. O sistema mede automaticamente:

- **Tempo de execução** de cada atividade
- **Encaixes** (pedidos urgentes do comercial)
- **Transferências** entre lojas (AP/ZN)
- **Recebimentos** de fornecedores
- **Faltas de produto** identificadas durante a separação
- **Erros de separação** (quem errou, quem apontou, qual tipo)
- **Fila de conferência** — todo pedido separado entra numa mesa de conferência

Os gestores acessam painéis com métricas, rankings, exportações (CSV/Excel/PDF) e uma **visão executiva** com alertas automáticos. Uma TV no CD exibe em tempo real as atividades em andamento + gamificação semanal + status da mesa. E o **Admin Master** dá poder total sobre qualquer dado — editar, apagar, mexer na mesa, forçar finalização de sessões, etc.

---

## ⚡ Funcionalidades

### 🖥️ Operação (livre pra qualquer logado)

| Tela | Descrição |
|------|-----------|
| **Registrar atividade** | Operador loga com código, escolhe a atividade, informa pedido/cliente/veículo/fornecedor, cronometra e finaliza. Se for separação, o pedido cai automaticamente na **Mesa de conferência** |
| **Registrar erro** | Fluxo guiado: pedido ou transferência → quem errou → tipo de erro → observação |
| **Agendamentos** | Agenda recebimento de fornecedores com sincronização no Google Calendar |
| **Mesa de conferência** | Fila de pedidos aguardando conferência. Conferentes cadastrados assumem, finalizam ou reportam problemas |
| **Consulta de faltas** | Lista todas as faltas reportadas com filtros e gráficos |
| **Consulta líder da equipe** | Busca por nome/código/equipe mostrando vínculo líder↔vendedor |

### 📊 Gestão (admin via PIN)

| Tela | Descrição |
|------|-----------|
| **Visão executiva** | KPIs comparativos, alertas automáticos, rankings, metas |
| **Painel de métricas** | Dashboard completo com filtros, gráficos, exportações (CSV/Excel/PDF), métricas da mesa de conferência e botões rápidos de admin |
| **Lançamento retroativo** | Digitar registros antigos direto no histórico |
| **Admin Master** | ⭐ **Central de controle total** — editar, apagar, mexer em qualquer dado (veja seção dedicada) |
| **Gestão e cadastros** | CRUD de operadores, atividades, veículos, tipos de erro, PIN, threshold |
| **Equipe de vendas** | CRUD de líderes e vendedores, promover/rebaixar |
| **Histórico de alterações** | Auditoria granular de tudo que foi criado/editado/removido |

### 📺 Modo TV (`/tv`)

Painel público para TV/monitor no CD:

- Atividades em andamento em tempo real
- Alerta de operador "sumido" (sessões abertas > 2h)
- Mesa de conferência com tempo de espera
- Ranking do dia + conferentes do dia
- Destaques da semana (rápido, volume, consistente)
- Alerta sonoro quando atividade passa do tempo
- **Modo claro/escuro** com botão no canto
- **Esconder nomes** para privacidade
- **Só atrasadas** — esconde atividades dentro do tempo
- **Tela cheia** com botão de sair
- **Auto-refresh** a cada 1h

### 🧩 Extras

- **Command Palette** (`Ctrl+K`) — Busca global
- **Perfil do operador** — Métricas individuais, rankings, comparação com o time
- **Realtime** — Todas as telas se atualizam automaticamente
- **Navegação por teclado** — Setas como TAB, Esc fecha modais, Enter confirma

---

## 🛠️ Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + Vite |
| **Estilo** | CSS puro com design system (light/dark mode) |
| **Backend** | Supabase (Postgres + Auth + Realtime) |
| **Gráficos** | Recharts |
| **Exportações** | CSV nativo + Excel (XLSX) + PDF (window.print) |
| **Ícones** | SVG inline |
| **Deploy sugerido** | Cloudflare Pages / Netlify / Vercel |

**Sem biblioteca de roteamento** — navegação por estado (`tab`) no `App.jsx`, com rota especial `/tv` via `window.location.pathname`.

---

## 📂 Estrutura do Projeto

---

## Atualização de outubro/2026: o que mudou e como ativar

### 1. Banco de dados (Supabase): rodar uma vez
Abra o **SQL Editor** e rode `supabase/migrations/2026-10-10_hardening.sql`.
Ele é seguro de repetir. Enquanto não for rodado, o app continua funcionando no modo antigo.

O que ele faz:
- **PIN de admin com hash**: o PIN sai de `admin_config` (texto puro) e passa a ficar numa tabela
  fechada (`admin_secrets`), conferido pelas funções `verify_admin_pin` / `set_admin_pin`.
  Depois de rodar, **o PIN atual continua o mesmo**, mas ninguém mais consegue lê-lo pela API.
- **`client_errors`**: o app grava erros do navegador (tablets, TV) nessa tabela. Consulte em
  *Table Editor > client_errors*.
- **Índices** em `entries` (consultas por período ficam rápidas).
- **Agregações**: view `v_operator_daily_stats` e função `get_operator_ranking(de, ate)`
  (já existe `fetchOperatorRanking` em `src/lib/api.js`; ainda não está ligada a nenhuma tela).

### 2. Cloudflare Pages: variáveis do servidor
O endpoint `/api/schedule-event` agora exige usuário logado e só aceita o próprio site.
Em *Settings > Variables and Secrets* confira/crie:

| Variável | Para quê |
|---|---|
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`, `GOOGLE_CALENDAR_ID` | Google Calendar (já existiam) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | **novas**: mesmas do `.env`, para validar o login |
| `ALLOWED_ORIGIN` | opcional: outros domínios autorizados (separados por vírgula) |

> Sem `SUPABASE_URL`/`SUPABASE_ANON_KEY` o agendamento responde erro 500 (de propósito: não abre mão da segurança).

### 3. Instalar dependências novas
```bash
npm install     # atualiza o package-lock.json (xlsx vem do CDN oficial da SheetJS)
npm run check   # lint + testes + build
```
Depois de commitar o `package-lock.json`, troque `npm install` por `npm ci` em `.github/workflows/ci.yml`.

### 4. Como o app se comporta agora
- **Sem internet no Kiosk**: iniciar e finalizar atividade ficam guardados no aparelho
  (inclusive faltas e fila de conferência) e são enviados sozinhos quando a conexão volta.
  A faixa no topo mostra o que está pendente.
- **Desfazer**: depois de finalizar, há ~6 s para tocar em *Desfazer*.
- **Atualização do app**: quando sai versão nova aparece "Atualizar agora"; ela não troca sozinha no meio de um apontamento.
- **Histórico**: o app carrega os últimos 120 dias (`ENTRIES_WINDOW_DAYS` em `src/lib/api.js`);
  relatórios e telas que buscam por conta própria continuam vendo tudo.
- **Instalável (PWA)**: no tablet, *Adicionar à tela inicial*.

### 5. Desenvolvimento
| Comando | O que faz |
|---|---|
| `npm run dev` | servidor local |
| `npm test` | testes (Vitest) das regras em `src/lib` e da fila offline |
| `npm run lint` | ESLint (erros reais quebram, avisos não) |
| `npm run format` | Prettier |
| `npm run check` | lint + testes + build (o mesmo que roda no GitHub) |


---

## Estilos (CSS): onde editar
Os estilos ficam em **`src/styles/`**, em arquivos numerados que o `src/main.jsx` carrega em ordem
(`01-base`, `02-layout`, `03-components`, `04-kiosk`, `05-schedules`, `06-screens`, `07-utilities`,
`08-stock-map`, `09-routine-checklist`, `10-responsive`, `11-status-a11y`).
**Não existe mais `src/styles.css`.** Se um ajuste de CSS "não aparece", confira se foi feito
nesses arquivos e se o arquivo está importado no `main.jsx`.
Regras de celular (menu gaveta, ≤720px) estão em `10-responsive.css`; ajustes de acessibilidade e
da gaveta (visibilidade, foco) em `11-status-a11y.css`.

## Cache
`public/_headers` deve manter `/assets/*` como `immutable` (os arquivos têm hash no nome) e
`no-cache` só em `/index.html`, `/sw.js` e `/manifest.webmanifest`. Deixar `/assets/*` como
`no-cache` faz o tablet rebaixar o app inteiro a cada abertura.

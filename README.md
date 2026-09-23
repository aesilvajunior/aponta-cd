# Aponta CD · Hidráulica Tropeiro

Sistema web de apontamento de atividades, produtividade e gestão operacional do Centro de Distribuição (CD) da **Hidráulica Tropeiro**. Substitui os controles em papel usados nos setores de **Separação**, **Conferência** e **Recebimento**, oferecendo registro em tempo real, métricas de produtividade e ferramentas de gestão para líderes e coordenação.

> Projeto interno, desenvolvido e mantido por Adeildo (Junior) Silva Junior — Líder de Logística.

---

## Índice

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Screenshots](#screenshots)
- [Stack utilizada](#stack-utilizada)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Rodando localmente](#rodando-localmente)
- [Banco de dados (Supabase)](#banco-de-dados-supabase)
- [Deploy (Cloudflare Pages)](#deploy-cloudflare-pages)
- [Integração com Google Calendar](#integração-com-google-calendar)
- [Segurança](#segurança)
- [Roadmap / próximos passos](#roadmap--próximos-passos)

---

## Visão geral

O **Aponta CD** é um painel web (kiosk + área administrativa) usado no dia a dia do CD para:

- Registrar o início/fim de cada atividade executada pelos operadores, com timestamp automático;
- Registrar erros de separação (sobra, falta, item não encontrado no pedido, etc.);
- Agendar recebimentos de fornecedores, com sincronização automática no Google Agenda;
- Consultar faltas de material e o status de resolução de cada uma;
- Acompanhar produtividade por operador, por turno (Manhã/Tarde) e por atividade, com ranking, comparativos e detecção de outliers;
- Dar visibilidade executiva (visão consolidada) para a liderança, incluindo um **Modo TV** para exibição em telão no CD.

O sistema roda 100% no navegador (SPA em React), com backend em **Supabase** (Postgres + Realtime + Row Level Security) e uma função serverless na **Cloudflare Pages** para a integração com o Google Calendar.

## Funcionalidades

### Operação (uso diário, kiosk)
- **Registrar atividade** — operador digita o código, escolhe a atividade e bate ponto de início/fim; suporta campos extras (pedido, cliente, tipo de transferência, veículo/placa) conforme a atividade.
- **Registrar erro** — kiosk dedicado para a mesa de separação registrar: Sobra de Material, Não Tem no Pedido, Falta de Material e Outros.
- **Agendamentos** — agenda de recebimentos de fornecedores, com criação automática de evento no Google Agenda.
- **Consulta de faltas** — consulta livre (para qualquer usuário logado) do status das faltas de material registradas.
- **Consulta líder da equipe** — consulta livre por vendedor/equipe de vendas.

### Gestão (protegido por PIN)
- **Visão executiva** — visão consolidada de indicadores para a liderança.
- **Painel de métricas** — dashboards com gráficos (Recharts), ranking de produtividade, comparação de turnos, detecção de outliers, histórico com exportação em CSV, perfil individual por operador.
- **Lançamento retroativo** — inclusão manual de registros esquecidos/perdidos.
- **Gestão e cadastros** — cadastro de operadores, atividades, tipos de erro, veículos, PIN administrativo e limite de alerta de tempo.
- **Equipe de vendas** — cadastro/gestão do time comercial usado na consulta de líder.
- **Histórico de alterações (auditoria)** — log de mudanças feitas no sistema.
- **Modo TV** — painel de exibição em tela cheia (`/tv`) para telão no CD.

### Extras de produto
- Paleta de comandos (`Ctrl/Cmd + K`) para navegação rápida, busca de operador e aplicação de filtros.
- Tema claro/escuro.
- Menu lateral retrátil.
- Autenticação de usuários (login) via Supabase Auth.
- Atualização em tempo real (Supabase Realtime) — qualquer alteração em outra estação reflete na hora, sem precisar recarregar a página.

## Screenshots

> As imagens abaixo são referenciadas por caminho relativo em `docs/screenshots/`. Foi enviado o código-fonte do projeto para gerar este README, mas não há aqui um navegador/ambiente gráfico disponível para abrir o app e capturar telas reais (o app também depende dos dados reais do seu Supabase). Basta tirar os prints direto do app rodando (local ou já publicado) e salvar com estes mesmos nomes dentro de `docs/screenshots/` — eles aparecerão automaticamente aqui assim que o arquivo for pra o GitHub.

| Tela | Arquivo esperado |
|---|---|
| Kiosk — Registrar atividade | `docs/screenshots/kiosk.png` |
| Kiosk — Registrar erro | `docs/screenshots/error-kiosk.png` |
| Painel de métricas (admin) | `docs/screenshots/panel.png` |
| Visão executiva | `docs/screenshots/executive.png` |
| Modo TV | `docs/screenshots/tv-board.png` |
| Agendamentos | `docs/screenshots/schedules.png` |

```md
![Registrar atividade](docs/screenshots/kiosk.png)
![Registrar erro](docs/screenshots/error-kiosk.png)
![Painel de métricas](docs/screenshots/panel.png)
![Visão executiva](docs/screenshots/executive.png)
![Modo TV](docs/screenshots/tv-board.png)
![Agendamentos](docs/screenshots/schedules.png)
```

## Stack utilizada

- **Frontend:** React 18 + Vite
- **Gráficos:** Recharts
- **Planilhas:** SheetJS (`xlsx`) — exportação/leitura de Excel
- **Backend / banco:** Supabase (Postgres, Auth, Row Level Security, Realtime)
- **Hospedagem:** Cloudflare Pages (SPA + Pages Functions)
- **Integração externa:** Google Calendar API (via service account, chamada só do servidor)

## Estrutura do projeto

```
aponta-cd/
├── functions/
│   └── api/
│       └── schedule-event.js     # Cloudflare Pages Function — cria/edita/remove evento no Google Agenda
├── public/
│   ├── _headers                  # regras de cache do Cloudflare Pages
│   └── _redirects                # SPA fallback (tudo cai em index.html)
├── src/
│   ├── components/               # telas e componentes (Kiosk, Panel, ExecutiveView, TvBoard, etc.)
│   ├── constants/                # valores padrão (operadores, atividades, tipos de erro)
│   ├── context/                  # AuthContext, ThemeContext
│   ├── lib/                      # acesso a dados (api.js), métricas, formatação, auth
│   ├── utils/                    # csv, excel, sons
│   ├── App.jsx
│   ├── main.jsx
│   ├── supabaseClient.js
│   └── styles.css
├── supabase/
│   └── schema.sql                # schema base do banco (ver observação abaixo)
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── .gitignore
```

## Configuração do ambiente

1. Copie o arquivo de exemplo e preencha com as credenciais do seu projeto Supabase:

   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...sua-chave-anon-aqui
   ```

   > Use a chave **anon/public** do Supabase (a longa, no formato `eyJ...`), nunca a `service_role`. O arquivo `.env` já está no `.gitignore` e não deve ser commitado.

2. Se for usar o agendamento com sincronização no Google Agenda, configure também as variáveis do lado do servidor — veja [Integração com Google Calendar](#integração-com-google-calendar).

## Rodando localmente

Pré-requisitos: Node.js 18+ e npm.

```bash
npm install
npm run dev
```

A aplicação sobe em `http://localhost:5173`.

Outros comandos úteis:

```bash
npm run build     # gera o build de produção em /dist
npm run preview   # serve o build de produção localmente
```

## Banco de dados (Supabase)

O arquivo [`supabase/schema.sql`](supabase/schema.sql) contém a criação das tabelas principais: `operators`, `activities`, `active_sessions`, `entries`, `admin_config`, `separation_errors`, `error_types`, além das políticas de Row Level Security e da publicação usada pelo Realtime.

> **Atenção:** funcionalidades adicionadas depois (veículos, faltas/`entry_shortages`, agendamentos e equipe de vendas) usam tabelas que não estão neste arquivo — provavelmente foram criadas direto pelo editor SQL do Supabase. Antes de recriar o banco do zero em outro projeto Supabase, exporte o schema completo atual (Supabase Studio → Database → *Database backups* ou `supabase db dump`) para não perder essas tabelas.

Para subir o schema base num projeto novo:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e rode o conteúdo de `supabase/schema.sql`.
3. Copie a **Project URL** e a **anon key** (Settings → API) para o seu `.env`.
4. Ative a autenticação por e-mail/senha (ou o provedor desejado) em Authentication → Providers.

## Deploy (Cloudflare Pages)

O projeto já está preparado para Cloudflare Pages (`public/_redirects` faz o fallback de SPA, e `functions/api/` vira automaticamente uma rota serverless).

1. Conecte o repositório do GitHub ao Cloudflare Pages.
2. Build command: `npm run build` — diretório de saída: `dist`.
3. Em **Settings → Environment variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (se for usar agendamentos)
   - `GOOGLE_CALENDAR_ID` (se for usar agendamentos)
4. Faça o deploy. A cada push no branch principal, o Cloudflare Pages publica uma nova versão automaticamente.

## Integração com Google Calendar

A função [`functions/api/schedule-event.js`](functions/api/schedule-event.js) cria/edita/remove eventos no Google Agenda quando um recebimento é agendado. Ela usa uma **conta de serviço (service account)** do Google, e as credenciais **precisam** vir de variáveis de ambiente do Cloudflare Pages — nunca do código-fonte:

- `GOOGLE_SERVICE_ACCOUNT_JSON` — o conteúdo do JSON da service account (baixado no Google Cloud Console → IAM & Admin → Service Accounts → Keys), em uma linha só.
- `GOOGLE_CALENDAR_ID` — o ID do calendário do Google onde os eventos serão criados (compartilhado com o e-mail da service account, com permissão de edição).

## Segurança

- **`.env` nunca deve ser commitado** — já está no `.gitignore`. Cada ambiente (local, Cloudflare) tem suas próprias variáveis.
- **Chaves e segredos sempre em variáveis de ambiente**, nunca embutidos direto no código-fonte (isso vale especialmente para service accounts, tokens e chaves privadas).
- O PIN administrativo protege apenas as telas de gestão dentro do app — ele não substitui o controle de acesso real, que é feito pelo login (Supabase Auth) e pelas políticas de Row Level Security no banco.
- Revise periodicamente quem tem acesso ao repositório e ao projeto Supabase/Cloudflare, principalmente se o repositório for público.

## Roadmap / próximos passos

- Consolidar num único `schema.sql` todas as tabelas hoje criadas manualmente no Supabase (veículos, faltas, agendamentos, equipe de vendas).
- Adicionar screenshots reais nesta seção (ver [Screenshots](#screenshots)).
- Avaliar testes automatizados para as regras de métricas/produtividade (`src/lib/metrics.js`).

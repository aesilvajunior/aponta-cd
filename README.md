# 📦 Aponta CD

Sistema web (PWA) de **rastreamento operacional e inteligência de estoque** para Centros de Distribuição. Eleva a operação do CD do simples apontamento para **inteligência operacional em tempo real**: cronometragem de atividades offline-first, fila de conferência, mapa interativo 2D/3D com curva ABC e slotting, inventário cíclico automático por gatilho, alertas proativos de SLA, roteirização serpentina de coleta e importação inteligente de planilhas ERP.

---

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Inteligência Operacional](#-inteligência-operacional)
- [Stack Técnica](#-stack-técnica)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Configuração Local](#-configuração-local)
- [Docker e Deploy](#-docker-e-deploy)
- [Banco de Dados e Migrações](#-banco-de-dados-e-migrações)
- [Segurança](#-segurança)
- [Scripts e Testes](#-scripts-e-testes)
- [Documentação Adicional](#-documentação-adicional)

---

## ⚡ Funcionalidades

### 🖥️ Operação (Chão de Fábrica)
- **Kiosk de Atividades (`Kiosk`)**: apontamento por código de 3 dígitos ou leitura de crachá QR/USB, suporte a pausas com motivo, modo dupla, encaixes, transferências, recebimentos e registro de faltas — com **fila offline automática** e botão **Desfazer**.
- **Apontar Erros (`ErrorKiosk`)**: fluxo guiado de erros de separação (também funciona offline).
- **Mesa de Conferência (`ConferenceTable`)**: fila em tempo real com tempo de espera, conferentes cadastrados e reporte de problemas.
- **Agenda de Recebimento (`ScheduleManager`)**: agendamento de fornecedores integrado ao Google Calendar (`/api/schedule-event`).
- **Checklist do CD & Rotina do Líder (`CdChecklist`, `DailyRoutine`, `InconsistencyList`)**: acompanhamento diário, checklist físico e registro de inconsistências.
- **Rotação de Tarefas (`RotationManager`)**: escala de organização e limpeza do CD.
- **Coleta de Endereços (`StockScan`)**: leitura de etiquetas de endereço e produtos por leitor USB/Bluetooth ou câmera (ZXing), com catálogo local e fila offline.

### 📊 Gestão & Análise (Admin via PIN)
- **Visão Executiva & Indicadores (`ExecutiveView`, `Panel`)**: KPIs, gráficos, comparação de turnos, cobertura de rodízio e exportações seguras em CSV, Excel (`.xlsx`) e PDF.
- **Mapa do Estoque 2D e 3D (`StockMap`, `StockMap3D`)**: edição drag-and-drop de ruas/corredores, busca com destaque e visualização 3D (Three.js + suporte opcional a modelo Blender `.glb`).
- **Carga de Trabalho & Pausas (`Workload`, `PauseReasons`)**: mapa de calor dia × hora, previsão de 7 dias, ranking justo por mediana da atividade, ocupação e motivos de pausa.
- **Faltas & Fornecedores (`ShortagePanel`, `SupplierShortages`)**: análise de ruptura por produto, cliente e fornecedor.
- **Central de Controle (`AdminMaster`)**, **Detecção de Fraude (`FraudPanel`)**, **Metas (`GoalsManager`, `TeamGoals`, `GoalsDashboard`)**, **Conquistas (`Achievements`)**, **Crachás & Etiquetas QR (`BadgePrinter`, `AddressLabels`)**, **Equipamentos (`EquipmentManager`)**, **Export Agendado (`ReportsScheduler`)**, **Alertas Telegram (`AlertSettings`)**, **Saúde do Sistema (`SystemHealth`)** e **Auditoria (`AuditLog`)**.

### 📺 Painel TV (`/tv`)
Painel público em tempo real para monitores no CD: atividades ativas, alertas de atraso/sessão aberta, status da mesa de conferência, ranking diário, gamificação semanal, modo claro/escuro e privacidade de nomes.

---

## 🧠 Inteligência Operacional

| Funcionalidade | Módulos Integrados | Benefício na Operação |
|---|---|---|
| **Mapa de Calor e Sugestão de Slotting** | `slotting.js` + `StockMap` + `StockMap3D` | Classifica itens/prateleiras em **Curva A/B/C**, mede a distância até a expedição/conferência e sugere realocações de itens Curva A distantes, reduzindo deslocamento a pé. |
| **Inventário Cíclico Automático por Gatilho** | `cyclicInventory.js` + `ShortagePanel` + `ConferenceTable` + `InconsistencyList` + `StockScan` | Ao registrar falta, divergência na conferência ou inconsistência, gera automaticamente tarefa deduplicada de **contagem cega** para o endereço (oculta o saldo do sistema até finalizar). |
| **Alertas Proativos de Gargalo (SLA)** | `slaMonitor.js` + `Workload` + `PauseReasons` + `PushSetup` | Monitora pausas acima do limite por motivo, fila de conferência travada/acumulada e queda de produtividade do turno abaixo da meta, notificando o líder com push e central de alertas. |
| **Roteirização de Escaneamento / Picking** | `mapScanPlan.js` + `StockScan` | Ordena paradas em **serpentina (S-shape)** por andar → corredor → posição (ida crescente / volta decrescente) → lado → nível, eliminando vai-e-volta no mesmo corredor. |
| **Perfis de Importação CSV / Excel** | `importProfiles.js` + `excel.js` + `CsvImport` | Lê `.csv`, `.xlsx` e `.xls` (com detecção de cabeçalho ERP e múltiplas abas), salva modelos de colunas para importação em **1 clique** e gera **resumo automático de divergências** antes de gravar. |

---

## 🛠️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + Vite 5 (PWA com Service Worker) |
| **Visualização 2D / 3D / Gráficos** | Konva (`react-konva`), Three.js, Recharts |
| **Leitura / Exportação de Dados** | SheetJS (`xlsx`), PapaParse, `qrcode`, `@zxing/browser` |
| **Backend & Realtime** | Supabase (PostgreSQL + RLS + Auth + Realtime + Edge Functions) |
| **Serverless Auxiliar** | Cloudflare Pages Functions (`/api/schedule-event` → Google Calendar) |
| **Qualidade** | Vitest + JSDOM, ESLint 9, Prettier, Playwright (E2E) |
| **Containerização** | Docker multi-stage (`node:20-alpine` → `nginxinc/nginx-unprivileged:1.27-alpine`) |

---

## 📂 Estrutura do Projeto

```text
aponta-cd/
├── Dockerfile                    # Build multi-stage com Nginx não-root (porta 8080)
├── docker-compose.yml            # Execução local/produção com hardening de container
├── nginx.conf                    # SPA fallback, gzip, cache imutável e headers CSP
├── public/
│   ├── _headers                  # Cabeçalhos de segurança e cache (Cloudflare Pages)
│   ├── _redirects                # Fallback SPA para Cloudflare Pages
│   ├── manifest.webmanifest      # Manifesto PWA
│   └── sw.js                     # Service Worker (cache controlado + notificações)
├── functions/api/
│   └── schedule-event.js         # Integração autenticada com Google Calendar
├── src/
│   ├── App.jsx                   # Roteamento por abas e estado global
│   ├── components/               # Telas (Kiosk, Panel, StockMap, StockMap3D, StockScan, CsvImport, etc.)
│   ├── hooks/                    # useAppData, useRealtimeSync, useKeyboardNav, useMediaQuery
│   ├── lib/                      # Regras puras (slotting, cyclicInventory, slaMonitor, mapScanPlan, importProfiles, api, offlineSync...)
│   ├── styles/                   # CSS modular numerado (01-base.css a 11-status-a11y.css)
│   └── utils/                    # Exportação/leitura CSV e Excel com proteção contra Formula Injection
├── supabase/
│   ├── schema.sql                # Schema inicial
│   ├── migrations/               # Migrações incrementais idempotentes
│   └── functions/                # Edge Functions (Telegram, WhatsApp, alertas, relatórios, escala)
└── docs/                         # Manuais operacionais, segurança, migrações e guias 3D/coleta
```

---

## 🚀 Configuração Local

### Pré-requisitos
- Node.js **20+**
- Projeto configurado no [Supabase](https://supabase.com)

### Passos
1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Crie o arquivo `.env` a partir do modelo:**
   ```bash
   cp .env.example .env
   ```
   Preencha com as credenciais públicas do projeto Supabase:
   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   VITE_APP_ENV=
   ```
3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:5173` (e `http://localhost:5173/tv` para o Painel TV).

---

## 🐳 Docker e Deploy

### Rodar com Docker Compose (recomendado)
Garanta que o arquivo `.env` contém `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`:
```bash
docker compose up --build -d
```
A aplicação ficará disponível em `http://localhost:8080` (com endpoint de saúde em `/healthz`).

### Build manual da imagem Docker
```bash
docker build \
  --build-arg VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co" \
  --build-arg VITE_SUPABASE_ANON_KEY="SUA_CHAVE_ANON" \
  --build-arg VITE_APP_ENV="production" \
  -t aponta-cd:latest .

docker run -d --name aponta-cd -p 8080:8080 --read-only \
  --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  --security-opt no-new-privileges:true \
  aponta-cd:latest
```

### Deploy no Cloudflare Pages
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Variáveis de ambiente (Settings → Variables and Secrets):**
  - Frontend (build): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`
  - Function `/api/schedule-event`: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`, `GOOGLE_CALENDAR_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGIN` (opcional)

---

## 🗄️ Banco de Dados e Migrações

Rode os scripts SQL no **SQL Editor do Supabase** (ou via CLI / MCP) na seguinte ordem:

1. `supabase/schema.sql` — tabelas base (apenas em banco novo)
2. `supabase/migrations/2026-10-10_hardening.sql` — hash bcrypt do PIN (`admin_secrets`), `client_errors`, índices e views com `security_invoker`
3. `supabase/migrations/2026-10-11_features.sql` — `session_pauses` e `system_status`
4. `supabase/migrations/2026-10-12_map_scan.sql` — `product_barcodes`, `stock_map_scans` e colunas de coleta
5. `supabase/migrations/2026-10-13_operational_intelligence.sql` — `cyclic_count_tasks` (inventário cíclico) e colunas de SLA
6. `supabase/migrations/2026-10-14_security_hardening.sql` — ativa RLS em todas as tabelas expostas, revoga `SECURITY DEFINER` legadas de `anon` e fixa `search_path`
7. *(Opcional)* `supabase/migrations/2026-10-11_roles_rls.sql` — elevação real de permissões no banco por sessão de PIN
8. *(Opcional)* `supabase/migrations/2026-10-11_retention.sql` — política de retenção de histórico

---

## 🔒 Segurança

O projeto implementa defesa em profundidade em todas as camadas:

- **Banco de Dados (RLS + RPCs)**:
  - PIN do administrador armazenado em `admin_secrets` com hash `bcrypt`, bloqueio após 5 tentativas falhas e atraso anti força-bruta.
  - RLS habilitado em todas as tabelas do schema `public` (incluindo `stock_map_areas`, `stock_map_items`, `conference_queue`, `fraud_alerts`, `operator_goals`, `scheduled_reports`, `kiosk_preferences`).
  - Revogação de `EXECUTE` para `anon` em funções `SECURITY DEFINER` e `SET search_path = public` em todas as funções.
  - Recomendado ativar **Leaked Password Protection** no painel do Supabase (*Authentication → Password Security*).
- **Edge Functions & API (`/api/schedule-event`)**:
  - `send-telegram`, `send-whatsapp` e `weekly-scale-suggestion` exigem JWT válido do Supabase Auth e bloqueiam abuso como *open relay* validando destinatários autorizados.
  - Funções agendadas (`check-alerts`, `notify-late-routine`, `run-scheduled-reports`) exigem `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` ou header `x-cron-secret: <CRON_SECRET>` com comparação em tempo constante.
  - `/api/schedule-event` valida sessão Supabase, origem CORS e formato estrito de `google_event_id` (prevenindo path traversal na API do Google).
- **Frontend, Exports e Cabeçalhos HTTP**:
  - Proteção contra **CSV Formula Injection** (`=`, `+`, `-`, `@`) em todas as exportações CSV e relatórios agendados.
  - Escape HTML completo (`&`, `<`, `>`, `"`, `'`) em relatórios imprimíveis, e-mails e mensagens Telegram HTML.
  - Cabeçalhos `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy` e `Permissions-Policy: camera=(self)` configurados em `public/_headers` e `nginx.conf`.
  - Sanitização de URL (sem query string/hash) no registro de erros (`errorReporter.js`) e validação same-origin em cliques de notificação no Service Worker (`sw.js`).

> Consulte também [docs/SEGURANCA.md](docs/SEGURANCA.md) para o checklist de rotação de chaves e permissões por PIN.

---

## 🧪 Scripts e Testes

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | Compila a versão de produção em `dist/` |
| `npm run preview` | Pré-visualiza o build localmente |
| `npm test` | Executa a suíte de testes unitários (Vitest) |
| `npm run lint` | Executa análise estática com ESLint |
| `npm run format` | Formata `src/**/*.{js,jsx}` com Prettier |
| `npm run check` | Executa `lint` + `test` + `build` |
| `npm run test:e2e` | Executa testes end-to-end com Playwright |

---

## 📚 Documentação Adicional

- [docs/SEGURANCA.md](docs/SEGURANCA.md) — Guia de segurança, revogação de chaves e RLS por PIN
- [docs/MIGRACOES.md](docs/MIGRACOES.md) — Ordem de migrações SQL, retenção e backup
- [docs/AMBIENTES.md](docs/AMBIENTES.md) — Configuração de ambiente de testes/preview
- [docs/MANUAL-OPERACAO.md](docs/MANUAL-OPERACAO.md) — Operação offline, recuperação de TV e tablets
- [docs/COLETA-CODIGO-BARRAS.md](docs/COLETA-CODIGO-BARRAS.md) — Uso de leitores USB/Bluetooth e câmera
- [docs/MAPA-3D-BLENDER.md](docs/MAPA-3D-BLENDER.md) — Integração de modelo `.glb` do galpão
- [docs/RELATORIOS-AGENDADOS.md](docs/RELATORIOS-AGENDADOS.md) — Ativação de relatórios automáticos por e-mail

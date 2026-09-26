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

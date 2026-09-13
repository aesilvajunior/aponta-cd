# Aponta CD — Hidráulica Tropeiro

Sistema de apontamento de atividades e métricas de produtividade para o centro de distribuição.

- **Registrar**: quiosque aberto para qualquer operador digitar seu código, iniciar e finalizar atividades.
- **Painel**: métricas completas (tempo médio por atividade, produtividade por operador, comparação de turnos, ranking, outliers) — protegido por PIN, só o administrador vê.
- **Equipe**: gerenciar operadores, atualizar a lista de atividades todo mês (rodízio) e trocar o PIN.

---

## 1. Criar o banco de dados gratuito (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita (dá pra usar login do GitHub ou Google).
2. Clique em **New Project**. Escolha um nome (ex: `aponta-cd`), uma senha de banco (guarde, mas não vai precisar dela no dia a dia) e a região mais próxima (`South America (São Paulo)`).
3. Aguarde ~2 minutos até o projeto ficar pronto.
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**.
   - Isso cria todas as tabelas, já com a equipe atual e as atividades padrão cadastradas, e configura o PIN inicial `2026`.
6. Vá em **Project Settings** (ícone de engrenagem) → **API**.
   - Copie o **Project URL** → vai virar `VITE_SUPABASE_URL`.
   - Copie a chave **anon public** (a longa, começando com `eyJ...`) → vai virar `VITE_SUPABASE_ANON_KEY`.

O plano gratuito do Supabase inclui banco Postgres, até 500 MB de dados e atualizações em tempo real — mais que suficiente para esse sistema.

---

## 2. Configurar o projeto localmente

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
# 1. Entrar na pasta do projeto
cd aponta-cd

# 2. Instalar as dependências
npm install

# 3. Criar o arquivo de variáveis de ambiente
cp .env.example .env
```

Abra o `.env` criado e cole os valores que você copiou do Supabase:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...sua-chave-aqui
```

---

## 3. Colocar o logo real da empresa

Substitua o arquivo `src/assets/logo.svg` (atualmente um placeholder "HT") pelo logo oficial da Hidráulica Tropeiro. Pode ser `.png`, `.svg` ou `.jpg` — só ajuste a extensão nos dois lugares que importam o logo:

- `index.html` (ícone da aba do navegador)
- `src/components/Sidebar.jsx` e `src/App.jsx` (linha `import logo from "../assets/logo.svg"`)

---

## 4. Rodar o site

```bash
npm run dev
```

Isso abre o site em `http://localhost:5173`. Qualquer computador ou celular **na mesma rede Wi-Fi** consegue acessar trocando `localhost` pelo IP da máquina que está rodando (ex: `http://192.168.0.10:5173`) — bom para testar no chão de fábrica antes de publicar de vez.

---

## 5. Publicar o site de graça (para acesso permanente)

Recomendo **Netlify** (mesmo serviço já usado no site de erros):

1. Rode `npm run build` — isso gera a pasta `dist/` com o site pronto.
2. Crie uma conta gratuita em [netlify.com](https://netlify.com).
3. Arraste a pasta `dist/` para a área de deploy do Netlify (ou conecte um repositório GitHub para deploy automático a cada atualização).
4. Em **Site settings → Environment variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do seu `.env` (necessário se você configurar deploy automático via GitHub, que reconstrói o projeto no servidor).
5. Pronto — você recebe um link tipo `aponta-cd.netlify.app`, acessível de qualquer lugar.

---

## Sobre a segurança dos dados

O PIN protege a **interface** (quem consegue ver o Painel e mexer na Equipe pelo site). Ele não criptografa o banco. Como o projeto usa a chave pública (`anon`) do Supabase para simplificar o uso no dia a dia, evite divulgar o link do site publicamente na internet — trate como uma ferramenta interna, compartilhada só com a equipe do CD.

---

## Estrutura do projeto

```
aponta-cd/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── supabase/
│   └── schema.sql          ← rode isso no SQL Editor do Supabase
└── src/
    ├── main.jsx
    ├── App.jsx              ← orquestra tudo
    ├── supabaseClient.js    ← conexão com o banco
    ├── styles.css
    ├── assets/
    │   └── logo.svg         ← troque pelo logo real
    ├── lib/
    │   ├── format.js        ← formatação de datas/duração
    │   └── metrics.js       ← cálculo de médias, outliers, ranking
    └── components/
        ├── Sidebar.jsx
        ├── Kiosk.jsx        ← tela de registrar (aberta)
        ├── AdminGate.jsx    ← tela de PIN
        ├── Panel.jsx        ← métricas (admin)
        └── TeamManager.jsx  ← equipe e atividades (admin)
```

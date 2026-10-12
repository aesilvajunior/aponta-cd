# Ambiente de teste (para não testar em produção)

Objetivo: testar mudanças (como o menu mobile ou as permissões do banco) sem derrubar o kiosk em
horário de trabalho.

## 1. Banco de teste (10 min)
1. Em supabase.com, **New project** (plano gratuito serve), chame de `aponta-cd-teste`.
2. No SQL Editor, rode, nesta ordem: `supabase/schema.sql` e depois cada arquivo de
   `supabase/migrations/` em ordem de data.
   - O `schema.sql` não tem todas as tabelas do sistema real. Para copiar o banco real:
     `npx supabase login`, `npx supabase link --project-ref SEU_REF_REAL`, `npm run db:pull`
     (gera as migrações do banco real em `supabase/migrations/`). Depois aplique no teste com
     `npx supabase link --project-ref REF_DO_TESTE` e `npx supabase db push`.
3. Em Authentication > Users, crie um usuário de teste.

## 2. Site de teste no Cloudflare Pages (5 min)
O Cloudflare já cria um **preview** para cada branch e pull request.
1. Settings > Environment variables > aba **Preview**:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: do projeto de **teste**
   - `VITE_APP_ENV` = `teste` (aparece uma faixa laranja "AMBIENTE DE TESTE" no app)
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY` (para o agendamento do Calendar), e uma
     `GOOGLE_CALENDAR_ID` de uma agenda de teste.
2. Trabalhe numa branch (`git checkout -b menu-mobile`), envie (`git push`) e abra o link de preview.

## 3. Fluxo recomendado
`branch > preview com banco de teste > conferir > pull request > o CI (lint, testes, build) passa > merge na main`.

Em produção deixe `VITE_APP_ENV` vazio.

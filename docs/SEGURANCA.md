# Segurança: o que fazer e em que ordem

## 1. Chave do Google que vazou (URGENTE, 15 min)
A chave privada da conta de serviço do Google Calendar já esteve no histórico do Git. Tirar o
arquivo do código **não** apaga o que já foi enviado ao GitHub.

1. **Revogar a chave** (só você consegue, é na sua conta Google):
   Google Cloud Console > IAM e administrador > Contas de serviço > a conta do Aponta CD >
   aba **Chaves** > apague a chave antiga > **Adicionar chave** > JSON.
2. No **Cloudflare Pages** (Settings > Variables and Secrets), atualize `GOOGLE_SA_EMAIL` e
   `GOOGLE_SA_KEY` com a chave nova. Cole a chave com `\n` literais (uma linha só).
3. Refaça o deploy e teste um agendamento.
4. **Limpar o histórico do Git** (opcional, mas recomendado se o repositório é público ou tem
   colaboradores). Em uma cópia nova do repositório:
   ```bash
   pip install git-filter-repo
   git clone --mirror https://github.com/aesilvajunior/aponta-cd.git
   cd aponta-cd.git
   git filter-repo --path functions/api/schedule-event.js --invert-paths --force
   # ATENÇÃO: isso remove o arquivo de TODO o histórico. Depois recoloque a versão atual
   # (sem chave) num commit novo, a partir de uma cópia de trabalho.
   git push --force --all && git push --force --tags
   ```
   Quem já clonou precisa clonar de novo. Se preferir não reescrever o histórico, **tornar o
   repositório privado** já reduz o risco; a revogação do passo 1 é o que realmente resolve.

## 2. Permissões no banco (opcional, recomendado)
Hoje o PIN esconde as telas, mas qualquer pessoa logada consegue gravar direto na API.
`supabase/migrations/2026-10-11_roles_rls.sql` corrige isso: o PIN, conferido no servidor,
abre uma **sessão de admin de 12 h** ligada ao usuário logado, e só durante ela as tabelas de
configuração aceitam alteração.

Quem fica protegido: `operators`, `activities`, `error_types`, `vehicles`, `admin_config`,
`alert_settings`, `scheduled_reports` (só admin altera); `entries` (todos inserem, só admin
altera/apaga); `separation_errors` e `entry_shortages` (só admin apaga); `audit_log`
(só admin apaga).

**Antes de aplicar em produção**, aplique no ambiente de teste (veja `AMBIENTES.md`) e confira:
1. Kiosk: iniciar, pausar, retomar e finalizar atividade funcionam **sem** digitar o PIN.
2. Conferência, agenda, rotina, checklist funcionam sem PIN.
3. Telas de admin: depois de digitar o PIN, editar operador/atividade funciona.
4. Esperar a sessão expirar (ou rodar `select lock_admin()`) e ver que a edição é recusada.

Se algo que **não é de admin** parar de funcionar, rode `2026-10-11_roles_rls_rollback.sql`
(volta ao comportamento anterior) e me diga qual tela falhou.

O app avisa e trava sozinho a área de admin: 30 min sem uso ou sessão vencida no servidor.

## 3. Boas práticas que já estão ligadas
- PIN guardado com hash (bcrypt) em tabela que a API não enxerga; nunca volta para o navegador.
- Tentativas de PIN erradas demoram 0,7 s (freia força bruta).
- `/api/schedule-event` exige login e só aceita o próprio site (veja README: variáveis do Cloudflare).
- Cabeçalhos de segurança em `public/_headers`.

## 4. Ainda não resolvido
- A conta do kiosk é compartilhada: a Auditoria não consegue dizer **qual pessoa** fez uma ação
  de operador. Para isso seria preciso uma conta por pessoa (login por crachá + Supabase Auth).
- A chave `anon` do Supabase é pública por natureza; a proteção é o RLS. Tabelas que não estão
  na lista da seção 2 continuam abertas a qualquer usuário logado.

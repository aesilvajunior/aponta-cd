# Migrações do banco (ordem e controle)

O arquivo `supabase/schema.sql` é só a base inicial; o banco real tem mais tabelas. A partir de
agora, **toda mudança de banco vira um arquivo em `supabase/migrations/`**, com data no nome.

## Arquivos atuais (aplicar nesta ordem)
| Arquivo | O que faz | Obrigatório? |
|---|---|---|
| `2026-10-10_hardening.sql` | PIN com hash, `client_errors`, índices, agregações | Recomendado |
| `2026-10-11_features.sql` | Pausas com motivo, batimento da TV, alerta de erros | Para as telas novas |
| `2026-10-11_roles_rls.sql` | Permissões reais por PIN (veja `SEGURANCA.md`) | Opcional, teste antes |
| `2026-10-11_retention.sql` | Função de arquivar lançamentos antigos | Opcional |
| `2026-10-11_roles_rls_rollback.sql` | Desfaz o `roles_rls` | Só se precisar |

## Foto do banco real
Para o repositório refletir o banco de verdade (e para criar o ambiente de teste igual):
```bash
npx supabase login
npx supabase link --project-ref SEU_REF
npm run db:pull        # gera uma migração com o estado atual
```
Faça isso uma vez e commite. Depois, mudanças novas: `npm run db:diff` mostra o que mudou.

## Retenção (arquivar o antigo)
`select archive_old_entries(24);` move lançamentos com mais de 24 meses para `entries_archive`.
O mínimo permitido é 6 meses. Para rodar sozinho todo mês, veja o bloco de `pg_cron` no final do arquivo.

## Backup
No Supabase: Database > Backups (planos pagos têm backup diário automático).
No plano gratuito, exporte de tempos em tempos: `npx supabase db dump -f backup.sql`.

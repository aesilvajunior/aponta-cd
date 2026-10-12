# Relatórios agendados por e-mail

A tela **Sistema > Export agendado** só guardava a agenda; nada enviava de fato. Agora existe a
função `supabase/functions/run-scheduled-reports`, que envia o relatório em CSV (abre no Excel)
no dia e na hora configurados, uma vez por dia.

## Ativar (uma vez, ~15 min)
1. **E-mail de envio:** crie conta grátis em resend.com, verifique seu domínio e gere uma
   *API key*. (Sem domínio próprio, o Resend só envia para o seu próprio e-mail, bom para testar.)
2. **Segredos** (Supabase > Edge Functions > Secrets):
   - `RESEND_API_KEY` = a chave do Resend
   - `REPORTS_FROM_EMAIL` = `Aponta CD <relatorios@seudominio.com.br>`
3. **Publicar a função:**
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_REF
   npx supabase functions deploy run-scheduled-reports
   ```
4. **Agendar de hora em hora** (SQL Editor; precisa das extensões `pg_cron` e `pg_net`,
   em Database > Extensions):
   ```sql
   select cron.schedule('relatorios-agendados', '0 * * * *', $$
     select net.http_post(
       url := 'https://SEU_REF.supabase.co/functions/v1/run-scheduled-reports',
       headers := jsonb_build_object('Authorization', 'Bearer SUA_CHAVE_ANON')
     );
   $$);
   ```
5. **Testar na hora:** crie um relatório diário e rode a função manualmente (Supabase >
   Edge Functions > run-scheduled-reports > Test). Só envia se a hora configurada for a atual
   (horário de Brasília), então para testar escolha a hora de agora.

## Regras
- Diário = o dia anterior inteiro · Semanal = os 7 dias anteriores · Mensal = os 30 dias anteriores
  (sempre terminando ontem, no horário de Brasília).
- Não repete no mesmo dia. Se o envio falhar, tenta de novo na hora seguinte.
- Tipos: apontamentos, faltas, erros de separação, conferência e resumo por operador ("metas").
- Os e-mails vão do endereço `REPORTS_FROM_EMAIL`; confira a caixa de spam na primeira vez.

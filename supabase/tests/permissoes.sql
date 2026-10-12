-- Teste de permissões (PIN, bloqueio, RLS, retenção). Validado em PostgreSQL 16 local com
-- stubs do Supabase (roles anon/authenticated e auth.uid()). Rode SOMENTE num banco de TESTE:
-- ele insere/apaga dados e troca o PIN. Pressupõe o PIN inicial 2026 do schema.sql.
\set ON_ERROR_STOP off
\pset tuples_only on
\echo '=== 1) anon (sem login) NAO pode usar as funcoes de PIN/sessao'
set role anon;
select 'anon verify_admin_pin: ' || verify_admin_pin('2026')::text;
select 'anon is_admin_session: ' || is_admin_session()::text;
select 'anon lock_admin'; select lock_admin();
reset role;

\echo '=== 2) logado: PIN errado, bloqueio apos 5 erros, depois nem o certo entra (5 min)'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'tentativa 1 errada -> ' || verify_admin_pin('1111')::text;
select 'tentativa 2 errada -> ' || verify_admin_pin('1111')::text;
select 'tentativa 3 errada -> ' || verify_admin_pin('1111')::text;
select 'tentativa 4 errada -> ' || verify_admin_pin('1111')::text;
select 'tentativa 5 errada -> ' || verify_admin_pin('1111')::text;
select 'PIN CERTO apos bloqueio -> ' || verify_admin_pin('2026')::text;
reset role;
delete from admin_pin_attempts;   -- (como admin do banco) libera para os proximos testes
delete from admin_sessions;

\echo '=== 3) sem sessao de admin: kiosk insere lancamento, mas nao altera/apaga/configura'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into entries (operator_code, operator_name, activity, start_time, end_time, duration_seconds, shift)
  values ('101','Ana','Separacao', now()-interval '5 min', now(), 300, 'Manha');
select 'insert entries ok';
update entries set note='x' where operator_code='101';
select 'linhas com note apos update SEM admin: ' || count(*)::text from entries where note='x';
delete from entries where operator_code='101';
select 'linhas apos delete SEM admin: ' || count(*)::text from entries;
insert into operators (code, name) values ('999','Fulano');
select 'operators insert SEM admin acima deve ter dado ERRO';
select 'anon/auth le operators: ' || count(*)::text from operators;

\echo '=== 4) PIN certo abre sessao de admin de 12h -> agora pode alterar/apagar/configurar'
select 'PIN certo -> ' || verify_admin_pin('2026')::text;
select 'is_admin_session: ' || is_admin_session()::text;
update entries set note='x' where operator_code='101';
select 'linhas com note apos update COM admin: ' || count(*)::text from entries where note='x';
insert into operators (code, name) values ('999','Fulano');
select 'operators agora: ' || count(*)::text from operators;
delete from entries where operator_code='101';
select 'linhas apos delete COM admin: ' || count(*)::text from entries;

\echo '=== 5) travar admin encerra a sessao'
select lock_admin();
select 'is_admin_session apos lock: ' || is_admin_session()::text;
delete from operators where code='999';
select 'operator 999 ainda existe (delete bloqueado): ' || count(*)::text from operators where code='999';
reset role;

\echo '=== 6) anon le dados da TV mas nao escreve'
set role anon;
select 'anon le entries: ok (' || count(*)::text || ')' from entries;
select 'anon le operators: ' || count(*)::text from operators;
insert into entries (operator_code, operator_name, activity, start_time, end_time, duration_seconds, shift) values ('1','x','y',now(),now(),1,'M');
reset role;

\echo '=== 7) troca de PIN: errado recusa, certo troca e o antigo deixa de valer'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'troca com PIN atual errado -> ' || set_admin_pin('0000','4321')::text;
select 'troca com PIN atual certo  -> ' || set_admin_pin('2026','4321')::text;
select 'PIN novo vale -> ' || verify_admin_pin('4321')::text;
select 'PIN antigo vale -> ' || verify_admin_pin('2026')::text;
select 'PIN invalido (3 digitos)'; select set_admin_pin('4321','123');
reset role;

\echo '=== 8) retencao: arquiva so o antigo e respeita o minimo de 6 meses'
insert into entries (operator_code, operator_name, activity, start_time, end_time, duration_seconds, shift)
 values ('7','Velho','x', now()-interval '30 months', now()-interval '30 months', 1,'M'),
        ('8','Novo','x', now()-interval '1 month', now()-interval '1 month', 1,'M');
select 'arquivados: ' || archive_old_entries(24)::text;
select 'restam em entries: ' || count(*)::text from entries;
select 'em entries_archive: ' || count(*)::text from entries_archive;
select archive_old_entries(3);

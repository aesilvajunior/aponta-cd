# Manual de operação (1 página)

## O operador esqueceu de finalizar
Abra o app em **Sistema > Central de controle** (precisa do PIN) e finalize a sessão dele, ou
use **Lançamento manual** para registrar o tempo certo. O alerta "Sessão esquecida" avisa no WhatsApp.

## A internet caiu no CD
O Kiosk continua funcionando: iniciar, pausar, retomar e finalizar ficam guardados no tablet e
são enviados sozinhos quando a internet volta. Aparece uma faixa "Sem conexão" no topo.
- **Não limpe os dados do navegador** enquanto houver pendências.
- Veja o que está pendente em **Sistema > Saúde do sistema** (botão "Enviar agora").
- Se algum item "falhou", use "Tentar os que falharam"; se persistir, avise o administrador.

## A TV congelou ou ficou preta
1. Atualize a página (F5). A TV recarrega sozinha a cada poucos minutos e ao reconectar.
2. Em **Saúde do sistema** veja "Painel da TV: último sinal". Mais de 15 min sem sinal = TV desligada ou sem internet.

## Tablet novo ou trocado
1. Abra o endereço do app e entre com a conta do kiosk.
2. Toque no nome da estação (canto do Kiosk) e dê um nome (ex.: "Separação 1").
3. No Chrome: menu > **Adicionar à tela inicial** (vira app instalado).

## Crachás
**Pessoas > Crachás** gera os QR codes. No Kiosk, "Escanear crachá" (Chrome/Edge) ou leitor USB
de código de barras. Pelo teclado continua valendo o código de 3 dígitos.

## Esqueci o PIN de admin
Só quem tem acesso ao Supabase consegue redefinir (de propósito). No SQL Editor:
```sql
insert into admin_secrets (id, pin_hash) values (1, extensions.crypt('NOVO_PIN', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;
```
(troque `NOVO_PIN` por 4 a 8 dígitos).

## Aviso de "nova versão"
Aparece uma faixa "Nova versão do Aponta CD disponível". Toque em **Atualizar agora** quando não
estiver no meio de um apontamento.

# Coleta por código de barras: bipar os produtos e jogar no mapa

## Como funciona (3 passos)
1. **Etiquetas de endereço:** em *Pessoas > Etiquetas de endereço*, escolha a rua, informe quantas posições e níveis ela tem e imprima. Cole nas estantes. (Opcional: sem etiqueta, o operador escolhe o endereço numa lista.)
2. **Coletar endereços:** em *Operação > Coletar endereços*. Bipe a etiqueta do endereço e depois bipe cada produto. A cada bip aparece a confirmação (som, vibração e mensagem) e o produto já entra no mapa 2D e no 3D.
3. **Produto novo:** se o código de barras nunca foi visto, o sistema pergunta o nome uma única vez. Das próximas vezes ele já reconhece.

## Modos
- **Registrar endereço** (padrão): cada produto entra uma vez no endereço. Bipar de novo não duplica nem mexe na quantidade. Serve para descobrir *onde está cada coisa*.
- **Contar (+1 por bip):** cada bip soma uma unidade. Serve para inventário.

Cada item guarda **quem bipou e quando** (aparece "✓ bipado em dd/mm" no mapa), então dá para achar os endereços que não são conferidos há tempo.

## Como bipar
| Forma | Quando usar |
|---|---|
| **Leitor USB ou Bluetooth** (modo teclado/HID) | Mais rápido e confiável. É só deixar o cursor no campo de leitura. Configure o leitor para enviar **Enter** no final (a maioria já faz) |
| **Câmera do celular/tablet** | Sem equipamento extra. Toque em "Usar câmera". Há botão de lanterna para corredores escuros |
| **Digitar o código** | Quando o código está rasgado ou não lê |

A câmera usa o leitor do próprio navegador (Chrome/Edge no Android) e, onde ele não existe (iPhone/Safari), um leitor de reserva que é baixado só nesse caso. **Para uso diário, um leitor Bluetooth barato (~R$ 100 a 200) rende bem mais que a câmera.**

## Confiabilidade
- **Leitura duvidosa é recusada:** se o código tem tamanho de EAN/UPC mas o dígito verificador não confere, o sistema pede para bipar de novo (evita gravar lixo da câmera).
- **Sem internet:** os bips ficam guardados no aparelho e são enviados sozinhos (faixa "Sem conexão" no topo). Reenviar nunca soma duas vezes.
- **Desfazer:** cada bip da sessão tem botão "Desfazer".
- **Produto sem código de barras** (comum em itens soltos/granel): use "Digitar código" com o código interno, ou cole uma etiqueta com código do seu sistema.

## Ativar no banco
Rode `supabase/migrations/2026-10-12_map_scan.sql` no SQL Editor (seguro repetir). Cria o catálogo de códigos de barras, o registro de cada bip e as colunas novas dos itens do mapa (`barcode`, `level`, `counted_at`, `counted_by`, `source`). Sem isso a tela avisa e os produtos novos entram só com o código de barras.

## Primeiro teste (15 min)
1. Imprima as etiquetas de **uma** rua com 2 posições e 2 níveis.
2. Com um celular, bipe a etiqueta e 5 produtos. Confira no Mapa 2D e no Mapa 3D.
3. Bipe um produto repetido (não deve duplicar) e use "Desfazer".
4. Desligue o Wi-Fi do celular, bipe 3 produtos, religue e veja a faixa de pendências sumir.

## Limitações conhecidas
- O que foi bipado fica em **estoque do mapa**, não é saldo do ERP: a quantidade só é confiável se vocês usarem o modo Contar.
- Um mesmo produto em dois endereços vira dois itens (um por endereço), de propósito.
- Códigos de caixa-master (ITF-14) e de unidade (EAN-13) do mesmo produto são cadastrados como códigos diferentes; informe o mesmo código interno nos dois para ligá-los.

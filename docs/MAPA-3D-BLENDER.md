# Mapa 3D e Blender

## O que já existe (sem Blender)
A tela **Mapa 3D** (menu *Operação*) gera o galpão sozinha a partir do mapa 2D:
- cada rua/estante vira uma estante com vários **níveis**;
- cada produto bipado vira uma **caixa** na posição certa (lado par/ímpar, posição, nível), colorida por categoria;
- escritório, recebimento, conferência e demais áreas viram blocos coloridos;
- os andares ficam empilhados (térreo, 1º, 2º...) e dá para filtrar por andar;
- **busca**: digite código, nome ou código de barras: os encontrados acendem em amarelo e a câmera voa até eles;
- tocar numa estante ou produto mostra os detalhes e atalhos ("Coletar aqui", "Ver no 2D").

Funciona no celular (arrastar gira, pinça aproxima).

## Para quê serve o Blender
O Blender entra para fazer o **cenário**: paredes, piso, portas das docas, colunas, escada, mezanino. Os dados (estantes e produtos) continuam vindo do banco, então o 3D nunca fica desatualizado. Não modele os produtos no Blender.

## Passo a passo
1. **Medidas:** no Mapa 3D, em "Modelo do Blender e medidas do galpão", informe a largura e a profundidade reais do galpão (em metros), a altura entre andares e o número de níveis das estantes. O mapa 2D é um desenho em %; essas medidas dizem ao 3D quanto vale cada % em metros. (Só o administrador salva.)
2. **Exportar as áreas:** botão "Exportar áreas para o Blender (JSON)".
3. **Importar no Blender:** abra `docs/blender/importar_areas.py` na aba Scripting, ajuste `JSON_PATH` e rode. Ele cria uma caixa para cada rua/área e um piso por andar, já na escala e na posição certas.
4. **Modelar** o cenário por cima. Mantenha o galpão centrado na origem (é como o JSON vem).
5. **Antes de exportar**, apague ou esconda as caixas das estantes (o site desenha as estantes).
6. **Exportar:** File > Export > glTF 2.0 (.glb), com *+Y Up* e *Apply Modifiers* ligados. Salve em `public/models/cd-shell.glb` e publique o site.
7. Se o modelo ficar deslocado ou girado em relação às estantes, ajuste *escala*, *deslocar X/Z* e *girar* na mesma tela e salve.

## Dicas para o modelo ficar leve no tablet
- Poucos polígonos: paredes e piso simples bastam. Meta: arquivo **abaixo de 5 MB**.
- Texturas pequenas (1024 px) ou só cores lisas; evite luzes e sombras assadas pesadas.
- Compressão Draco no exportador reduz bastante o tamanho.
- Unidade do Blender em **metros**, escala 1,0, e aplique transformações (Ctrl+A) antes de exportar.

## Limites desta primeira versão
- As estantes são desenhadas de forma simples (postes e tábuas). Um modelo de estante caprichado no Blender pode ser incluído depois como peça repetida.
- Se o nível do produto não foi informado na coleta, ele aparece no primeiro nível.
- O 3D foi escrito e testado nas contas de posição (layout), mas ainda precisa ser conferido visualmente num navegador de verdade; ajuste as medidas até encaixar com o galpão real.

"""
Aponta CD: cria no Blender caixas-guia a partir das áreas do mapa.

COMO USAR
1. No Aponta CD, abra "Mapa 3D" e clique em "Exportar áreas para o Blender (JSON)".
2. No Blender: aba Scripting > Open > escolha este arquivo.
3. Mude JSON_PATH abaixo para o caminho do arquivo baixado e clique em Run Script.
4. Modele em cima das caixas (paredes, docas, estantes de verdade). NÃO renomeie as caixas
   que representam estantes se quiser ligá-las depois aos dados; o nome é o código da rua.
5. Exporte: File > Export > glTF 2.0 (.glb) com "Y Up" ligado e "Apply Modifiers" ligado,
   e salve como  public/models/cd-shell.glb  no projeto.

As estantes e os produtos continuam sendo desenhados pelo site a partir dos dados do mapa,
então no modelo do Blender faça só o "cenário" (paredes, piso, docas, portas, colunas) e
apague ou esconda as caixas das estantes antes de exportar, para não aparecerem duplicadas.

Eixos: o JSON já vem no padrão do glTF (x direita, y altura, z frente). Dentro do Blender
(que usa Z para cima) isso vira: X = x, Y = -z, Z = y. O exportador glTF desfaz a conversão.
"""
import json
import bpy

JSON_PATH = r"C:\Users\SEU_USUARIO\Downloads\areas-para-blender.json"

# altura (m) de cada tipo de área, igual à usada no site
ALTURAS = {"escritorio": 2.8, "infra": 1.2, "corredor": 0.04, "recebimento": 0.08, "conferencia": 0.08, "outro": 0.08}
CORES = {
    "prateleira": (0.29, 0.48, 0.65, 1), "conferencia": (0.06, 0.72, 0.51, 1), "recebimento": (0.96, 0.62, 0.04, 1),
    "escritorio": (0.42, 0.45, 0.50, 1), "infra": (0.55, 0.36, 0.96, 1), "corredor": (0.0, 0.83, 1.0, 1), "outro": (0.12, 0.23, 0.37, 1),
}


def material_para(tipo):
    nome = f"tipo_{tipo}"
    mat = bpy.data.materials.get(nome)
    if mat is None:
        mat = bpy.data.materials.new(nome)
        mat.diffuse_color = CORES.get(tipo, CORES["outro"])
    return mat


def colecao(nome):
    col = bpy.data.collections.get(nome)
    if col is None:
        col = bpy.data.collections.new(nome)
        bpy.context.scene.collection.children.link(col)
    return col


def caixa(nome, cx, cy, cz, sx, sy, sz, col, tipo):
    """Cria uma caixa com centro (cx, cy, cz) e tamanho (sx, sy, sz), em metros (eixos do Blender)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = nome
    obj.scale = (sx, sy, sz)
    obj.data.materials.append(material_para(tipo))
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


with open(JSON_PATH, encoding="utf-8") as f:
    dados = json.load(f)

galpao = dados["galpao"]
niveis = galpao["niveis"]
altura_nivel = min(1.2, (galpao["alturaAndarM"] - 0.6) / niveis)

col_pisos = colecao("CD_Pisos")
col_areas = colecao("CD_Areas")

andares = sorted({a["andar"] for a in dados["areas"]} | {0})
for andar in andares:
    y_base = andar * galpao["alturaAndarM"]
    # piso do andar: largura em X, profundidade em Y (Blender), 10 cm de espessura
    caixa(f"Piso_{andar}", 0, 0, y_base - 0.05, galpao["larguraM"], galpao["profundidadeM"], 0.1, col_pisos, "outro")

for a in dados["areas"]:
    tipo = a["tipo"] or "outro"
    if tipo == "prateleira":
        altura = niveis * altura_nivel + 0.3
    else:
        altura = ALTURAS.get(tipo, 0.08)
    # JSON (glTF): centroX, alturaBaseY, centroZ  ->  Blender: X, Y = -Z, Z = altura
    caixa(
        a["codigo"],
        a["centroX"], -a["centroZ"], a["alturaBaseY"] + altura / 2,
        a["larguraX"], a["profundidadeZ"], altura,
        col_areas, tipo,
    )

print(f"Criadas {len(dados['areas'])} caixas e {len(andares)} piso(s).")

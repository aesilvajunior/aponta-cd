import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  fetchMapAreas,
  fetchMapItems,
  addMapArea,
  updateMapArea,
  deleteMapArea,
  AREA_TYPES,
  MAP_OBJECT_PRESETS,
  colorForType,
  labelForType,
  labelForSide,
  resolveSpecialAreaKind,
} from "../lib/stockMap";
import { Accordion } from "./ui/Accordion";
import { IconEdit, IconPlus, IconTrash, IconX, IconCheck } from "./Icons";
import { fetchSystemStatus, upsertSystemStatus, fetchStockMapHistory, fetchConferenceHistory } from "../lib/api";
import { fetchRecentScans } from "../lib/mapScan";
import { computeSlottingAnalysis, heatmapColor, abcColor } from "../lib/slotting";
import {
  mergeConfig, floorIndex, areaToMeters, rackGeometry, layoutItems, matchItems, categoryColor, exportForBlender,
} from "../lib/map3dLayout";

const GOLD = new THREE.Color("#ffd54a");

function disposeObject(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
  });
}

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(10,14,20,0.95)";
  ctx.strokeText(text, 128, 48);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 128, 48);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(3.2, 1.2, 1);
  return sprite;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function buildStairs3D(m, floorHeightM) {
  const grp = new THREE.Group();
  grp.position.set(m.x, m.y, m.z);
  const alongX = m.w >= m.d;
  const runLen = alongX ? m.w : m.d;
  const width = alongX ? m.d : m.w;
  const totalH = Math.min(floorHeightM, Math.max(2.0, floorHeightM * 0.92));
  const steps = Math.max(6, Math.min(14, Math.round(runLen / 0.36)));
  const stepLen = runLen / steps;
  const stepRise = totalH / steps;

  const treadMat = new THREE.MeshStandardMaterial({ color: "#7c3aed", roughness: 0.6 });
  const railMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.4, roughness: 0.4 });

  for (let i = 0; i < steps; i++) {
    const h = stepRise * (i + 1);
    const geom = alongX
      ? new THREE.BoxGeometry(stepLen * 0.96, h, width * 0.92)
      : new THREE.BoxGeometry(width * 0.92, h, stepLen * 0.96);
    const mesh = new THREE.Mesh(geom, treadMat);
    const posAlong = -runLen / 2 + stepLen * (i + 0.5);
    mesh.position.set(alongX ? posAlong : 0, h / 2, alongX ? 0 : posAlong);
    grp.add(mesh);
  }

  // Corrimãos laterais inclinados
  const slopeLen = Math.hypot(runLen, totalH);
  const slopeAngle = Math.atan2(totalH, runLen);
  [-1, 1].forEach((sgn) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? slopeLen : 0.06, 0.06, alongX ? 0.06 : slopeLen), railMat);
    rail.position.set(
      alongX ? 0 : (sgn * width * 0.46),
      totalH / 2 + 0.75,
      alongX ? (sgn * width * 0.46) : 0
    );
    if (alongX) rail.rotation.z = slopeAngle;
    else rail.rotation.x = -slopeAngle;
    grp.add(rail);
  });

  return { group: grp, height: totalH + 0.8 };
}

function buildElevator3D(m, floorHeightM) {
  const grp = new THREE.Group();
  grp.position.set(m.x, m.y, m.z);
  const shaftH = Math.max(3.2, floorHeightM);

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#4f46e5",
    transparent: true,
    opacity: 0.34,
    roughness: 0.25,
    metalness: 0.2,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.5, roughness: 0.35 });
  const doorMat = new THREE.MeshStandardMaterial({ color: "#1e1b4b", metalness: 0.4, roughness: 0.4 });
  const capMat = new THREE.MeshStandardMaterial({ color: "#6366f1", roughness: 0.4 });

  // Poço translúcido
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.94, shaftH, m.d * 0.94), glassMat);
  shaft.position.y = shaftH / 2;
  grp.add(shaft);

  // 4 pilares metálicos nos cantos
  const pw = 0.09;
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(pw, shaftH, pw), frameMat);
      post.position.set((sx * m.w) / 2 * 0.94, shaftH / 2, (sz * m.d) / 2 * 0.94);
      grp.add(post);
    });
  });

  // Portas duplas frontais
  const doorH = Math.min(2.3, shaftH * 0.72);
  const doorW = m.w * 0.36;
  [-1, 1].forEach((sgn) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), doorMat);
    door.position.set(sgn * (doorW / 2 + 0.03), doorH / 2 + 0.04, (m.d / 2) * 0.95);
    grp.add(door);
  });

  // Casa de máquina no topo
  const cap = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.98, 0.26, m.d * 0.98), capMat);
  cap.position.y = shaftH + 0.13;
  grp.add(cap);

  return { group: grp, height: shaftH + 0.3 };
}

function buildConferenceTable3D(m, kind) {
  const grp = new THREE.Group();
  grp.position.set(m.x, m.y, m.z);
  const isTransf = kind === "conferencia_transferencia";
  const topColor = isTransf ? "#0284c7" : "#10b981";
  const trimColor = isTransf ? "#38bdf8" : "#34d399";
  const tableH = 0.92;

  const legMat = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.4, roughness: 0.5 });
  const topMat = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.45 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.3 });

  // Tampo principal
  const top = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.94, 0.08, m.d * 0.94), topMat);
  top.position.y = tableH;
  grp.add(top);

  // Prateleira inferior de apoio
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.86, 0.05, m.d * 0.86), legMat);
  shelf.position.y = 0.28;
  grp.add(shelf);

  // Faixa superior de identificação (Pedidos = verde, Transferência = azul)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(m.w * 0.9, 0.02, Math.max(0.14, m.d * 0.18)), trimMat);
  trim.position.set(0, tableH + 0.05, 0);
  grp.add(trim);

  // 4 pés metálicos
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, tableH, 0.07), legMat);
      leg.position.set(sx * (m.w * 0.42), tableH / 2, sz * (m.d * 0.42));
      grp.add(leg);
    });
  });

  // Mini monitor/terminal na ponta da mesa
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.05), new THREE.MeshStandardMaterial({ color: "#0f172a", emissive: topColor, emissiveIntensity: 0.25 }));
  screen.position.set(m.w * 0.28, tableH + 0.22, -m.d * 0.26);
  grp.add(screen);

  return { group: grp, height: tableH + 0.4 };
}

function buildSupportCart3D(m) {
  const grp = new THREE.Group();
  grp.position.set(m.x, m.y, m.z);
  const cartH = 0.86;
  const w = Math.max(0.65, m.w * 0.9);
  const d = Math.max(0.55, m.d * 0.9);

  const trayMat = new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.45, metalness: 0.15 });
  const frameMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.55, roughness: 0.35 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.85 });

  // 4 rodízios (rodas)
  const wheelGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const wh = new THREE.Mesh(wheelGeom, wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(sx * (w * 0.42), 0.08, sz * (d * 0.42));
      grp.add(wh);
    });
  });

  // 2 bandejas (inferior e superior)
  [0.24, cartH].forEach((yy) => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), trayMat);
    tray.position.y = yy;
    grp.add(tray);
  });

  // 4 hastes de canto
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, cartH - 0.12, 0.045), frameMat);
      post.position.set(sx * (w * 0.45), (cartH + 0.12) / 2, sz * (d * 0.45));
      grp.add(post);
    });
  });

  // Alça de empurrar elevada em uma extremidade
  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.045, 0.045), frameMat);
  handleBar.position.set(0, cartH + 0.18, -d * 0.48);
  grp.add(handleBar);

  return { group: grp, height: cartH + 0.25 };
}

export default function StockMap3D({ isAdmin, onScanArea, onOpenMap, entries = [], shortages = [] }) {
  const mountRef = useRef(null);
  const three = useRef({}); // renderer, scene, camera, controls, world, floors, fly...

  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [scans, setScans] = useState([]);
  const [mapHistory, setMapHistory] = useState([]);
  const [conferenceHistory, setConferenceHistory] = useState([]);
  const [colorMode, setColorMode] = useState("category"); // "category" | "heatmap"
  const [slottingOpen, setSlottingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState(() => mergeConfig());
  const [cfgDraft, setCfgDraft] = useState(null);
  const [floorFilter, setFloorFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { areaId, itemId? }
  const [shellStatus, setShellStatus] = useState("");
  const [webgl] = useState(() => webglAvailable());
  const [saveMsg, setSaveMsg] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [extraFloors, setExtraFloors] = useState([]);
  const [newObjModal, setNewObjModal] = useState(false);
  const [newObjForm, setNewObjForm] = useState({
    code: "", label: "", areaType: "prateleira", floor: "terreo",
    x: 42, y: 42, width: 10, height: 15, hasSides: false,
  });
  const [objBusy, setObjBusy] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");

  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const onDragCommitRef = useRef(null);

  function showFlash(msg) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(""), 2600);
  }

  const reloadAreas = useCallback(async () => {
    const [a, i] = await Promise.all([fetchMapAreas(), fetchMapItems()]);
    if (a.error) setError(a.error.message || "Erro ao carregar o mapa.");
    setAreas(a.data);
    setItems(i.data);
  }, []);

  // ---------- dados ----------
  useEffect(() => {
    (async () => {
      const [a, i, st] = await Promise.all([fetchMapAreas(), fetchMapItems(), fetchSystemStatus()]);
      if (a.error) setError(a.error.message || "Erro ao carregar o mapa.");
      setAreas(a.data);
      setItems(i.data);
      const saved = (st.data || []).find((r) => r.key === "map3d_config");
      if (saved?.value) setCfg(mergeConfig(saved.value));
      setLoading(false);

      Promise.all([
        fetchRecentScans({ limit: 500 }).catch(() => ({ data: [] })),
        fetchStockMapHistory({ limit: 500 }).catch(() => ({ data: [] })),
        fetchConferenceHistory({ limit: 200 }).catch(() => ({ data: [] })),
      ]).then(([sc, hi, ch]) => {
        setScans(sc?.data || []);
        setMapHistory(hi?.data || []);
        setConferenceHistory(ch?.data || []);
      });
    })();
  }, []);

  const itemsByArea = useMemo(() => {
    const m = new Map();
    items.forEach((it) => {
      const k = String(it.area_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    return m;
  }, [items]);

  const floorOptions = useMemo(() => {
    const map = new Map([[0, "terreo"]]);
    areas.forEach((a) => {
      const idx = floorIndex(a.floor);
      if (!map.has(idx)) map.set(idx, a.floor || (idx === 0 ? "terreo" : `${idx}o_andar`));
    });
    extraFloors.forEach((fl) => {
      const idx = floorIndex(fl);
      if (!map.has(idx)) map.set(idx, fl);
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, value]) => ({ idx, value, label: idx === 0 ? "Térreo" : `${idx}º andar` }));
  }, [areas, extraFloors]);

  const floors = useMemo(() => floorOptions.map((f) => f.idx), [floorOptions]);

  const commitMove3D = useCallback(async (area, nextX, nextY) => {
    const x = Math.round(Math.max(0, Math.min(100 - (Number(area.width) || 5), nextX)) * 10) / 10;
    const y = Math.round(Math.max(0, Math.min(100 - (Number(area.height) || 5), nextY)) * 10) / 10;
    setAreas((prev) => prev.map((item) => (item.id === area.id ? { ...item, x, y } : item)));
    const { error: err } = await updateMapArea(area.id, { x, y });
    if (err) setError(err.message);
    else showFlash(`${area.code} movido (${x}%, ${y}%)`);
  }, []);

  onDragCommitRef.current = commitMove3D;

  function handleAddFloor3D() {
    const nextIdx = floorOptions.length > 0 ? Math.max(...floorOptions.map((f) => f.idx)) + 1 : 1;
    const floorVal = `${nextIdx}o_andar`;
    setExtraFloors((prev) => (prev.includes(floorVal) ? prev : [...prev, floorVal]));
    setFloorFilter(String(nextIdx));
    showFlash(`${nextIdx}º andar criado — adicione objetos nele!`);
  }

  function openNewObjModal3D(preset = null) {
    const targetFloorOpt =
      floorFilter === "all"
        ? floorOptions[0]
        : floorOptions.find((f) => String(f.idx) === String(floorFilter)) || floorOptions[0];
    const floorVal = targetFloorOpt?.value || "terreo";
    if (preset) {
      const count = areas.filter((a) => a.area_type === preset.areaType).length + 1;
      setNewObjForm({
        code: `${preset.prefix}-${count}`,
        label: `${preset.label} ${count}`,
        areaType: preset.areaType,
        floor: floorVal,
        x: 42,
        y: 42,
        width: preset.width,
        height: preset.height,
        hasSides: preset.hasSides,
      });
    } else {
      setNewObjForm((f) => ({ ...f, floor: floorVal }));
    }
    setNewObjModal(true);
  }

  async function handleCreateObj3D() {
    const code = newObjForm.code.trim().toUpperCase();
    const label = newObjForm.label.trim();
    if (!code) return setError("Digite o código do objeto.");
    if (!label) return setError("Digite o nome/rótulo.");

    setObjBusy(true);
    const { data, error: err } = await addMapArea({
      code,
      label,
      areaType: newObjForm.areaType,
      floor: newObjForm.floor || "terreo",
      hasSides: newObjForm.hasSides,
      x: Number(newObjForm.x),
      y: Number(newObjForm.y),
      width: Number(newObjForm.width),
      height: Number(newObjForm.height),
      color: colorForType(newObjForm.areaType),
    });
    setObjBusy(false);
    if (err) { setError(err.message); return; }
    setNewObjModal(false);
    setNewObjForm({ code: "", label: "", areaType: "prateleira", floor: newObjForm.floor || "terreo", x: 42, y: 42, width: 10, height: 15, hasSides: false });
    await reloadAreas();
    if (data?.id) setSelected({ areaId: data.id });
    showFlash(`"${label}" adicionado ao Mapa 3D`);
  }

  async function handlePatchArea3D(area, patch, msg) {
    setAreas((prev) => prev.map((item) => (item.id === area.id ? { ...item, ...patch } : item)));
    const { error: err } = await updateMapArea(area.id, patch);
    if (err) setError(err.message);
    else if (msg) showFlash(msg);
  }

  async function handleDeleteArea3D(area) {
    if (!window.confirm(`Remover "${area.label || area.code}" do mapa?`)) return;
    const { error: err } = await deleteMapArea(area.id);
    if (err) { setError(err.message); return; }
    setSelected(null);
    await reloadAreas();
    showFlash("Objeto removido do mapa");
  }
  const matches = useMemo(() => matchItems(items, query), [items, query]);
  const slotting = useMemo(
    () =>
      computeSlottingAnalysis({
        areas,
        items,
        scans,
        shortages,
        history: mapHistory,
        entries,
        conferenceHistory,
        warehouseConfig: cfg,
      }),
    [areas, items, scans, shortages, mapHistory, entries, conferenceHistory, cfg]
  );

  const flyToArea = useCallback((area, itemId = null) => {
    const t = three.current;
    if (!t.camera || !area) return;
    const m = areaToMeters(area, cfg);
    const target = new THREE.Vector3(m.x, m.y + 1.5, m.z);
    t.fly = { target, pos: target.clone().add(new THREE.Vector3(6, 6, 8)) };
    setSelected({ areaId: area.id, itemId: itemId || undefined });
  }, [cfg]);

  // ---------- cena (uma vez) ----------
  useEffect(() => {
    if (!webgl || !mountRef.current) return undefined;
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor("#10151c");
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#334155", 1.1));
    const sun = new THREE.DirectionalLight("#ffffff", 1.2);
    sun.position.set(20, 40, 15);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2;
    controls.maxDistance = 150;

    const world = new THREE.Group();
    scene.add(world);

    const outline = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd54a })
    );
    outline.visible = false;
    scene.add(outline);

    const resize = () => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const t = three.current;
    Object.assign(t, { renderer, scene, camera, controls, world, outline, floors: new Map(), fly: null });

    renderer.setAnimationLoop(() => {
      const f = t.fly;
      if (f) {
        camera.position.lerp(f.pos, 0.08);
        controls.target.lerp(f.target, 0.08);
        if (camera.position.distanceTo(f.pos) < 0.05) t.fly = null;
      }
      controls.update();
      renderer.render(scene, camera);
    });

    // clique seleciona; no Modo Edição, arrastar um objeto move pelo piso 3D
    let down = null;
    let drag = null;
    const ray = new THREE.Raycaster();
    const hitPt = new THREE.Vector3();

    const getNdc = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY };
      if (!editModeRef.current) return;
      ray.setFromCamera(getNdc(e), camera);
      const visible = [...t.floors.values()].filter((fl) => fl.group.visible);
      const hitA = ray.intersectObjects(visible.flatMap((fl) => fl.picks), false)[0];
      if (!hitA) return;
      const areaId = hitA.object.userData.areaId;
      const area = areasRef.current.find((a) => String(a.id) === String(areaId));
      if (!area) return;
      const m = areaToMeters(area, cfgRef.current);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -m.y);
      if (ray.ray.intersectPlane(plane, hitPt)) {
        drag = {
          area,
          pickMesh: hitA.object,
          plane,
          offsetX: m.x - hitPt.x,
          offsetZ: m.z - hitPt.z,
          lastX: m.x,
          lastZ: m.z,
          moved: false,
        };
        controls.enabled = false;
        setSelected({ areaId: area.id });
      }
    };

    const onMove = (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) drag.moved = true;
      ray.setFromCamera(getNdc(e), camera);
      if (ray.ray.intersectPlane(drag.plane, hitPt)) {
        const nx = hitPt.x + drag.offsetX;
        const nz = hitPt.z + drag.offsetZ;
        drag.lastX = nx;
        drag.lastZ = nz;
        outline.position.set(nx, drag.pickMesh.position.y, nz);
        outline.visible = true;
      }
    };

    const onUp = (e) => {
      if (drag) {
        const finished = drag;
        drag = null;
        controls.enabled = true;
        if (finished.moved) {
          const c = cfgRef.current;
          const m = areaToMeters(finished.area, c);
          const pctX = ((finished.lastX + c.widthM / 2 - m.w / 2) / c.widthM) * 100;
          const pctY = ((finished.lastZ + c.depthM / 2 - m.d / 2) / c.depthM) * 100;
          onDragCommitRef.current?.(finished.area, pctX, pctY);
        }
        return;
      }
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      ray.setFromCamera(getNdc(e), camera);
      const visible = [...t.floors.values()].filter((fl) => fl.group.visible);
      const products = visible.map((fl) => fl.products).filter(Boolean);
      const hitP = ray.intersectObjects(products, false)[0];
      const hitA = ray.intersectObjects(visible.flatMap((fl) => fl.picks), false)[0];
      // produto só vale se estiver na frente da estante clicada
      if (hitP && (!hitA || hitP.distance <= hitA.distance + 0.5)) {
        const meta = hitP.object.userData.meta[hitP.instanceId];
        setSelected({ areaId: meta.areaId, itemId: meta.item.id });
      } else if (hitA) {
        setSelected({ areaId: hitA.object.userData.areaId });
      } else {
        setSelected(null);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      three.current = {};
    };
  }, [webgl]);

  // ---------- reconstrói o galpão quando dados/ajustes mudam ----------
  useEffect(() => {
    const t = three.current;
    if (!t.world || loading) return undefined;

    // limpa o que havia
    [...t.world.children].forEach((c) => { t.world.remove(c); disposeObject(c); });
    t.floors = new Map();

    const dummy = new THREE.Object3D();
    const floorsPresent = [...new Set([...areas.map((a) => floorIndex(a.floor)), ...extraFloors.map((f) => floorIndex(f))])];
    if (floorsPresent.length === 0) floorsPresent.push(0);

    const levelH = Math.min(1.2, (cfg.floorHeightM - 0.6) / cfg.levels);

    floorsPresent.forEach((fl) => {
      const group = new THREE.Group();
      t.world.add(group);

      const ground = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.widthM, 0.1, cfg.depthM),
        new THREE.MeshStandardMaterial({ color: fl === 0 ? "#1b2430" : "#232d3b", roughness: 0.95 })
      );
      ground.position.set(0, fl * cfg.floorHeightM - 0.06, 0);
      group.add(ground);
      if (fl === 0) {
        const grid = new THREE.GridHelper(Math.max(cfg.widthM, cfg.depthM), Math.round(Math.max(cfg.widthM, cfg.depthM) / 2), "#2c3a4d", "#222c3a");
        grid.position.y = 0;
        group.add(grid);
      }

      const floorAreas = areas.filter((a) => floorIndex(a.floor) === fl);
      const racks = floorAreas.filter((a) => a.area_type === "prateleira");
      const others = floorAreas.filter((a) => a.area_type !== "prateleira");
      const picks = [];

      // áreas que não são estante: modelos 3D dedicados (escada, elevador, mesas, carros) ou blocos coloridos
      others.forEach((a) => {
        const m = areaToMeters(a, cfg);
        const specialKind = resolveSpecialAreaKind(a);

        if (specialKind) {
          let built;
          if (specialKind === "escada") built = buildStairs3D(m, cfg.floorHeightM);
          else if (specialKind === "elevador") built = buildElevator3D(m, cfg.floorHeightM);
          else if (specialKind === "carro_apoio") built = buildSupportCart3D(m);
          else built = buildConferenceTable3D(m, specialKind);

          group.add(built.group);

          const pick = new THREE.Mesh(
            new THREE.BoxGeometry(m.w, built.height, m.d),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
          );
          pick.position.set(m.x, m.y + built.height / 2, m.z);
          pick.userData = { areaId: a.id, floor: fl };
          group.add(pick);
          picks.push(pick);

          const label = makeLabel(a.code || a.label || "");
          label.position.set(m.x, m.y + built.height + 0.75, m.z);
          group.add(label);
          return;
        }

        const h = a.area_type === "escritorio" ? 2.8 : a.area_type === "infra" ? 1.2 : a.area_type === "corredor" ? 0.04 : 0.08;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(m.w, h, m.d),
          new THREE.MeshStandardMaterial({ color: colorForType(a.area_type), transparent: true, opacity: h < 0.1 ? 0.55 : 0.85 })
        );
        mesh.position.set(m.x, m.y + h / 2, m.z);
        mesh.userData = { areaId: a.id, floor: fl };
        group.add(mesh);
        picks.push(mesh);
        if (a.area_type !== "corredor") {
          const label = makeLabel(a.code || "");
          label.position.set(m.x, m.y + h + 0.9, m.z);
          group.add(label);
        }
      });

      // estantes: postes e tábuas instanciados (poucos objetos mesmo com muitas ruas)
      const postsPer = racks.map((a) => rackGeometry(a, cfg)).map((g) => 2 * (g.bays + 1));
      const totalPosts = postsPer.reduce((s, n) => s + n, 0);
      const totalBoards = racks.length * (cfg.levels + 1);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1, 0.06), new THREE.MeshStandardMaterial({ color: "#f59e0b" }), Math.max(1, totalPosts));
      const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial({ color: "#64748b" }), Math.max(1, totalBoards));
      posts.count = totalPosts;
      boards.count = totalBoards;
      let pi = 0;
      let bi = 0;
      const rackH = cfg.levels * levelH + 0.3;

      racks.forEach((a) => {
        const g = rackGeometry(a, cfg);
        const bayLen = g.length / g.bays;
        for (let i = 0; i <= g.bays; i++) {
          [-1, 1].forEach((sgn) => {
            const u = -g.length / 2 + i * bayLen;
            const v = (sgn * g.thickness) / 2;
            dummy.position.set(g.x + (g.alongX ? u : v), g.y + rackH / 2, g.z + (g.alongX ? v : u));
            dummy.scale.set(1, rackH, 1);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            posts.setMatrixAt(pi++, dummy.matrix);
          });
        }
        for (let k = 0; k <= cfg.levels; k++) {
          dummy.position.set(g.x, g.y + 0.08 + k * levelH, g.z);
          dummy.scale.set(g.alongX ? g.length : g.thickness, 1, g.alongX ? g.thickness : g.length);
          dummy.updateMatrix();
          boards.setMatrixAt(bi++, dummy.matrix);
        }

        const pick = new THREE.Mesh(
          new THREE.BoxGeometry(g.alongX ? g.length : g.thickness, rackH, g.alongX ? g.thickness : g.length),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        pick.position.set(g.x, g.y + rackH / 2, g.z);
        pick.userData = { areaId: a.id, floor: fl };
        group.add(pick);
        picks.push(pick);

        const label = makeLabel(a.code || "");
        label.position.set(g.x, g.y + rackH + 0.9, g.z);
        group.add(label);
      });
      posts.instanceMatrix.needsUpdate = true;
      boards.instanceMatrix.needsUpdate = true;
      group.add(posts, boards);

      // produtos (uma caixa por item), colorida por categoria
      const placed = racks.flatMap((a) => layoutItems(a, itemsByArea.get(String(a.id)) || [], cfg).map((p) => ({ ...p, areaId: a.id })));
      let productsMesh = null;
      if (placed.length > 0) {
        productsMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), placed.length);
        const baseColors = [];
        placed.forEach((p, i) => {
          dummy.position.set(...p.position);
          dummy.scale.set(...p.size);
          dummy.updateMatrix();
          productsMesh.setMatrixAt(i, dummy.matrix);
          const c = categoryColor(p.item.category);
          const color = new THREE.Color().setHSL(c.h / 360, c.s / 100, c.l / 100);
          baseColors.push(color);
          productsMesh.setColorAt(i, color);
        });
        productsMesh.instanceMatrix.needsUpdate = true;
        productsMesh.instanceColor.needsUpdate = true;
        productsMesh.userData = { meta: placed, baseColors };
        group.add(productsMesh);
      }

      t.floors.set(fl, { group, picks, products: productsMesh });
    });

    // enquadra a câmera apenas na primeira montagem (não reseta ao mover/criar objetos)
    if (!t.cameraFramed) {
      t.camera.position.set(0, cfg.widthM * 0.55, cfg.depthM * 0.85);
      t.controls.target.set(0, 0, 0);
      t.cameraFramed = true;
    }

    // casca feita no Blender (opcional)
    let cancelled = false;
    (async () => {
      setShellStatus("");
      const s = cfg.shell;
      if (!s?.url) return;
      try {
        const head = await fetch(s.url, { method: "HEAD" });
        const type = head.headers.get("content-type") || "";
        // o site devolve a página inicial (HTML) para arquivos que não existem
        if (!head.ok || type.includes("text/html")) return;
        const gltf = await new GLTFLoader().loadAsync(s.url);
        if (cancelled) { disposeObject(gltf.scene); return; }
        gltf.scene.scale.setScalar(s.scale || 1);
        gltf.scene.position.set(s.offsetX || 0, s.offsetY || 0, s.offsetZ || 0);
        gltf.scene.rotation.y = ((s.rotationY || 0) * Math.PI) / 180;
        t.world.add(gltf.scene);
        setShellStatus("Modelo do Blender carregado.");
      } catch {
        setShellStatus("Não foi possível carregar o modelo do Blender (confira o arquivo).");
      }
    })();
    return () => { cancelled = true; };
  }, [areas, extraFloors, itemsByArea, cfg, loading, webgl]);

  // ---------- andar visível ----------
  useEffect(() => {
    three.current.floors?.forEach((fl, idx) => { fl.group.visible = floorFilter === "all" || Number(floorFilter) === idx; });
  }, [floorFilter, areas, cfg, loading]);

  // ---------- destaque da busca / mapa de calor + voo da câmera ----------
  useEffect(() => {
    const t = three.current;
    if (!t.floors) return;
    const ids = new Set(matches.map((m) => m.id));
    const active = query.trim().length > 0;
    let first = null;
    t.floors.forEach((fl) => {
      const mesh = fl.products;
      if (!mesh) return;
      const { meta, baseColors } = mesh.userData;
      const c = new THREE.Color();
      meta.forEach((p, i) => {
        const hit = ids.has(p.item.id);
        if (hit && !first) first = p.position;
        if (active) {
          if (hit) c.copy(GOLD);
          else c.copy(baseColors[i]).multiplyScalar(0.22);
        } else if (colorMode === "heatmap") {
          const im = slotting.itemMetrics[String(p.item.id)];
          c.set(im ? heatmapColor(im.heat) : "#334155");
        } else {
          c.copy(baseColors[i]);
        }
        mesh.setColorAt(i, c);
      });
      mesh.instanceColor.needsUpdate = true;
    });
    if (active && first) {
      const target = new THREE.Vector3(...first);
      t.fly = { target, pos: target.clone().add(new THREE.Vector3(4, 4, 6)) };
    }
  }, [matches, query, areas, cfg, loading, colorMode, slotting.itemMetrics]);

  // ---------- contorno da área selecionada ----------
  useEffect(() => {
    const t = three.current;
    if (!t.outline) return;
    if (!selected) { t.outline.visible = false; return; }
    let pickMesh = null;
    t.floors.forEach((fl) => fl.picks.forEach((p) => { if (String(p.userData.areaId) === String(selected.areaId)) pickMesh = p; }));
    if (!pickMesh) { t.outline.visible = false; return; }
    t.outline.geometry.dispose();
    t.outline.geometry = new THREE.EdgesGeometry(pickMesh.geometry);
    t.outline.position.copy(pickMesh.position);
    t.outline.visible = true;
  }, [selected, areas, cfg, loading]);

  const selArea = selected ? areas.find((a) => String(a.id) === String(selected.areaId)) : null;
  const selItems = selArea ? itemsByArea.get(String(selArea.id)) || [] : [];
  const selItem = selected?.itemId ? items.find((i) => i.id === selected.itemId) : null;

  const resetCamera = useCallback(() => {
    const t = three.current;
    if (!t.camera) return;
    t.fly = { target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(0, cfg.widthM * 0.55, cfg.depthM * 0.85) };
  }, [cfg]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(exportForBlender(areas, cfg), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "areas-para-blender.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveCfg() {
    const next = mergeConfig(cfgDraft);
    const { error: err } = await upsertSystemStatus("map3d_config", next);
    if (err) { setSaveMsg("Não foi possível salvar (rode a migração 2026-10-11_features.sql)."); return; }
    setCfg(next);
    setCfgDraft(null);
    setSaveMsg("Ajustes salvos.");
    setTimeout(() => setSaveMsg(""), 3000);
  }

  const setDraft = (key, value) => setCfgDraft((d) => ({ ...(d || cfg), [key]: value }));
  const setShell = (key, value) => setCfgDraft((d) => ({ ...(d || cfg), shell: { ...(d || cfg).shell, [key]: value } }));
  const draft = cfgDraft || cfg;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="page-title">Mapa 3D</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {editMode
              ? "Modo edição 3D ativo · Arraste qualquer objeto pelo piso para mover · Use a paleta para criar objetos e andares."
              : "Arraste para girar · role/pinça para aproximar · toque numa estante ou produto para ver os detalhes."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn-small ${editMode ? "btn-excel" : ""}`}
            onClick={() => setEditMode((v) => !v)}
            style={editMode ? { background: "var(--ok)", color: "#fff", borderColor: "var(--ok)" } : undefined}
          >
            <IconEdit size={14} /> {editMode ? "Sair da edição 3D" : "Modo edição 3D"}
          </button>
          {editMode && (
            <button type="button" className="btn-small btn-excel" onClick={() => openNewObjModal3D()}>
              <IconPlus size={14} /> Novo objeto
            </button>
          )}
        </div>
      </div>

      {!webgl && (
        <div className="alert-card alert-danger"><strong>Este aparelho/navegador não suporta gráficos 3D (WebGL).</strong> Use o Mapa 2D.</div>
      )}
      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 12 }}>
          <strong>Erro:</strong> {error}
          <button type="button" className="btn-small" style={{ marginLeft: 10 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}
      {flashMsg && (
        <div className="alert-card" style={{ marginBottom: 12, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)", display: "flex", alignItems: "center", gap: 8 }}>
          <IconCheck size={15} /> {flashMsg}
        </div>
      )}

      {editMode && (
        <div className="map-object-palette">
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginRight: 4 }}>
            Criar no 3D:
          </span>
          {MAP_OBJECT_PRESETS.map((preset) => (
            <button
              key={preset.areaType}
              type="button"
              className="map-palette-chip"
              onClick={() => openNewObjModal3D(preset)}
            >
              <span className="map-palette-dot" style={{ background: colorForType(preset.areaType) }} />
              + {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="map-palette-chip"
            style={{ borderStyle: "dashed", borderColor: "var(--accent)", color: "var(--accent)" }}
            onClick={handleAddFloor3D}
          >
            + Novo andar
          </button>
        </div>
      )}

      <div className="map3d-toolbar">
        <input className="field" style={{ maxWidth: 300 }} placeholder="Buscar produto (código, nome ou código de barras)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar produto" />
        {query.trim() && <span className="map3d-count">{matches.length} encontrado(s)</span>}
        <div className="scan-chips" style={{ margin: 0 }} role="group" aria-label="Andar">
          <button type="button" className={`scan-chip ${floorFilter === "all" ? "active" : ""}`} onClick={() => setFloorFilter("all")} aria-pressed={floorFilter === "all"}>Todos os andares</button>
          {floors.map((f) => (
            <button key={f} type="button" className={`scan-chip ${String(floorFilter) === String(f) ? "active" : ""}`} onClick={() => setFloorFilter(String(f))} aria-pressed={String(floorFilter) === String(f)}>
              {f === 0 ? "Térreo" : `${f}º andar`}
            </button>
          ))}
        </div>
        <div className="scan-chips" style={{ margin: 0 }} role="group" aria-label="Modo de cor">
          <button type="button" className={`scan-chip ${colorMode === "category" ? "active" : ""}`} onClick={() => setColorMode("category")} aria-pressed={colorMode === "category"}>Categorias</button>
          <button type="button" className={`scan-chip ${colorMode === "heatmap" ? "active" : ""}`} onClick={() => setColorMode("heatmap")} aria-pressed={colorMode === "heatmap"}>🔥 Mapa de Calor (ABC)</button>
        </div>
        <button type="button" className="btn-small" onClick={() => setSlottingOpen((v) => !v)}>
          Slotting ({slotting.suggestions.length})
        </button>
        <button type="button" className="btn-small" onClick={resetCamera}>Recentralizar</button>
      </div>

      {slottingOpen && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Sugestões de Slotting 3D (Curva A longe de {slotting.origin.label})</strong>
            <button type="button" className="btn-small" onClick={() => setSlottingOpen(false)}>Fechar</button>
          </div>
          {slotting.suggestions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Nenhum item Curva A distante da expedição encontrado.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {slotting.suggestions.slice(0, 8).map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => {
                    setColorMode("heatmap");
                    flyToArea(sug.fromArea, sug.item.id);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    borderLeft: "4px solid #ef4444",
                    background: "var(--surface-raised)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5 }}>
                    {sug.productCode} <span style={{ color: "var(--ok)", fontWeight: 700 }}>(-{sug.savedPct}%)</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {sug.fromArea.code} ({sug.fromDistanceM}m) → {sug.toArea.code} ({sug.toDistanceM}m)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="map3d-wrap">
        <div ref={mountRef} className="map3d-canvas" aria-label="Mapa 3D do estoque" role="img" />
        {loading && <div className="map3d-overlay">Carregando mapa...</div>}

        {selArea && (
          <aside className="map3d-panel" aria-live="polite">
            <button type="button" className="map3d-close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            <div className="map3d-panel-title">{selArea.code}{selArea.label ? ` · ${selArea.label}` : ""}</div>
            <div className="map3d-panel-sub">
              {labelForType(selArea.area_type)} · andar {selArea.floor || "térreo"} · {selItems.length} produto(s)
              {slotting.areaMetrics[String(selArea.id)] && (
                <>
                  {" · "}
                  <strong style={{ color: abcColor(slotting.areaMetrics[String(selArea.id)].abc) }}>
                    Curva {slotting.areaMetrics[String(selArea.id)].abc}
                  </strong>
                  {" "}({slotting.areaMetrics[String(selArea.id)].distanceM}m da expedição)
                </>
              )}
            </div>
            {selItem && (
              <div className="map3d-item-card">
                <strong>{selItem.product_name || selItem.product_code}</strong>
                <div>Código: {selItem.product_code}{selItem.barcode ? ` · EAN ${selItem.barcode}` : ""}</div>
                <div>{[selItem.side ? labelForSide(selItem.side) : null, selItem.slot ? `pos. ${selItem.slot}` : null, selItem.level ? `nível ${selItem.level}` : null].filter(Boolean).join(" · ") || "Sem posição"}</div>
                <div>Quantidade: {selItem.quantity ?? 0}{selItem.counted_at ? ` · bipado em ${new Date(selItem.counted_at).toLocaleDateString("pt-BR")}` : ""}</div>
              </div>
            )}
            <div className="map3d-list">
              {selItems.slice(0, 40).map((it) => (
                <button key={it.id} type="button" className={`map3d-row ${selected.itemId === it.id ? "active" : ""}`} onClick={() => setSelected({ areaId: selArea.id, itemId: it.id })}>
                  <span>{it.product_name || it.product_code}</span>
                  <span style={{ opacity: 0.7 }}>{it.slot ? `p${it.slot}` : ""}{it.level ? ` n${it.level}` : ""}</span>
                </button>
              ))}
              {selItems.length > 40 && <div style={{ fontSize: 12, opacity: 0.7 }}>+ {selItems.length - 40} produtos (veja no Mapa 2D)</div>}
              {selItems.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>Nenhum produto cadastrado aqui ainda.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {selArea.area_type === "prateleira" && <button type="button" className="btn-small" onClick={() => onScanArea?.(selArea)}>Coletar aqui</button>}
              <button type="button" className="btn-small" onClick={() => onOpenMap?.(selArea)}>Ver no 2D</button>
            </div>

            {editMode && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.25)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#38bdf8" }}>
                  Editar objeto no 3D
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                  <button type="button" className="btn-small" onClick={() => commitMove3D(selArea, Number(selArea.x) - 2, Number(selArea.y))} title="Mover esquerda">←</button>
                  <button type="button" className="btn-small" onClick={() => commitMove3D(selArea, Number(selArea.x), Number(selArea.y) - 2)} title="Mover fundo">↑</button>
                  <button type="button" className="btn-small" onClick={() => commitMove3D(selArea, Number(selArea.x), Number(selArea.y) + 2)} title="Mover frente">↓</button>
                  <button type="button" className="btn-small" onClick={() => commitMove3D(selArea, Number(selArea.x) + 2, Number(selArea.y))} title="Mover direita">→</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <label style={{ fontSize: 11, opacity: 0.85 }}>
                    Largura (%)
                    <input
                      type="number"
                      min="2"
                      max="100"
                      className="field"
                      style={{ marginTop: 2, padding: "5px 8px", fontSize: 12 }}
                      value={selArea.width}
                      onChange={(e) => handlePatchArea3D(selArea, { width: Math.max(2, Number(e.target.value) || 2) })}
                    />
                  </label>
                  <label style={{ fontSize: 11, opacity: 0.85 }}>
                    Profund. (%)
                    <input
                      type="number"
                      min="2"
                      max="100"
                      className="field"
                      style={{ marginTop: 2, padding: "5px 8px", fontSize: 12 }}
                      value={selArea.height}
                      onChange={(e) => handlePatchArea3D(selArea, { height: Math.max(2, Number(e.target.value) || 2) })}
                    />
                  </label>
                </div>
                <label style={{ fontSize: 11, opacity: 0.85 }}>
                  Andar
                  <select
                    className="field"
                    style={{ marginTop: 2, padding: "5px 8px", fontSize: 12 }}
                    value={selArea.floor || "terreo"}
                    onChange={(e) => handlePatchArea3D(selArea, { floor: e.target.value }, "Andar atualizado")}
                  >
                    {floorOptions.map((f) => (
                      <option key={f.idx} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-small"
                  style={{ width: "100%", color: "#f87171", borderColor: "rgba(248,113,113,0.5)" }}
                  onClick={() => handleDeleteArea3D(selArea)}
                >
                  <IconTrash size={13} /> Remover objeto
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      <div className="card" style={{ marginTop: 16, padding: "6px 18px" }}>
        <Accordion
          items={[
            {
              id: "blender-cfg",
              title: "Modelo do Blender e medidas do galpão",
              badge: `${cfg.widthM}m × ${cfg.depthM}m`,
              content: (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
                    As estantes, escadas, elevadores, salas e mesas sincronizam entre o 2D e o 3D automaticamente. Um modelo feito no Blender pode ser
                    colocado em <code>public/models/cd-shell.glb</code>. {shellStatus || "Nenhum modelo carregado no momento."}
                  </p>
                  <div className="map3d-settings">
                    {[["widthM", "Largura do galpão (m)"], ["depthM", "Profundidade (m)"], ["floorHeightM", "Altura entre andares (m)"], ["levels", "Níveis por estante"]].map(([k, label]) => (
                      <label key={k} className="scan-label">{label}
                        <input className="field" type="number" step="0.5" min="1" disabled={!isAdmin} value={draft[k]} onChange={(e) => setDraft(k, Number(e.target.value))} />
                      </label>
                    ))}
                    {[["scale", "Modelo: escala"], ["offsetX", "Modelo: deslocar X (m)"], ["offsetZ", "Modelo: deslocar Z (m)"], ["rotationY", "Modelo: girar (graus)"]].map(([k, label]) => (
                      <label key={k} className="scan-label">{label}
                        <input className="field" type="number" step="0.1" disabled={!isAdmin} value={draft.shell[k]} onChange={(e) => setShell(k, Number(e.target.value))} />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {isAdmin && <button type="button" className="btn-small" onClick={saveCfg} disabled={!cfgDraft}>Salvar ajustes</button>}
                    <button type="button" className="btn-small" onClick={exportJson} disabled={areas.length === 0}>Exportar áreas para o Blender (JSON)</button>
                    {!isAdmin && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Só o administrador altera as medidas.</span>}
                    {saveMsg && <span role="status" style={{ fontSize: 13 }}>{saveMsg}</span>}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {newObjModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !objBusy && setNewObjModal(false)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Novo objeto no Mapa 3D</div>
                <div className="kiosk-modal-sub">Aparece automaticamente nos mapas 2D e 3D</div>
              </div>
              <button type="button" className="kiosk-modal-close" onClick={() => setNewObjModal(false)}>
                <IconX size={18} />
              </button>
            </div>
            <div className="kiosk-modal-body">
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Código *</label>
                  <input className="schedule-modal-field" placeholder="Ex: ESC-1, ELV-1, SALA-1" value={newObjForm.code} onChange={(e) => setNewObjForm({ ...newObjForm, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Tipo *</label>
                  <select className="schedule-modal-field" value={newObjForm.areaType} onChange={(e) => setNewObjForm({ ...newObjForm, areaType: e.target.value })}>
                    {AREA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Nome / Rótulo *</label>
                  <input className="schedule-modal-field" placeholder="Ex: Escada Mezanino, Mesa Pedidos 01" value={newObjForm.label} onChange={(e) => setNewObjForm({ ...newObjForm, label: e.target.value })} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Andar *</label>
                  <select className="schedule-modal-field" value={newObjForm.floor || "terreo"} onChange={(e) => setNewObjForm({ ...newObjForm, floor: e.target.value })}>
                    {floorOptions.map((f) => (
                      <option key={f.idx} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="schedule-modal-label">X (%)</label>
                  <input type="number" min="0" max="98" className="schedule-modal-field" value={newObjForm.x} onChange={(e) => setNewObjForm({ ...newObjForm, x: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Y (%)</label>
                  <input type="number" min="0" max="98" className="schedule-modal-field" value={newObjForm.y} onChange={(e) => setNewObjForm({ ...newObjForm, y: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Largura (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={newObjForm.width} onChange={(e) => setNewObjForm({ ...newObjForm, width: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Profundidade (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={newObjForm.height} onChange={(e) => setNewObjForm({ ...newObjForm, height: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="kiosk-modal-footer">
              <button type="button" className="kiosk-btn kiosk-btn-secondary" onClick={() => setNewObjModal(false)} disabled={objBusy}>Cancelar</button>
              <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={handleCreateObj3D} disabled={objBusy}>
                <IconCheck size={14} /> {objBusy ? "Criando..." : "Criar no 3D"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

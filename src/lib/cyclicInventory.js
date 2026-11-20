// ============================================================
// Inventário Cíclico Automático por Gatilho (Contagem Cega)
// Conecta Faltas (ShortagePanel), Divergências de Conferência
// (ConferenceTable) e Inconsistências (InconsistencyList) com
// a tela de Coleta (StockScan).
// Persiste em cyclic_count_tasks no Supabase com fallback local.
// ============================================================
import { supabase } from "../supabaseClient";
import { logStockMapAction } from "./api";

const LOCAL_TASKS_KEY = "aponta_cyclic_count_tasks_v1";

function isMissingTable(error) {
  const code = error?.code || "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error?.message || "")
  );
}

function readLocalTasks() {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalTasks(tasks) {
  try {
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks.slice(0, 300)));
  } catch {
    /* sem espaço */
  }
}

function makeTaskId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `cyc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const norm = (v) => String(v || "").trim().toUpperCase();

// ============================================================
// Funções puras de resolução de endereço e criação de gatilhos
// ============================================================

export function resolveAddressForProduct(productCode, areas = [], items = []) {
  const target = norm(productCode);
  if (!target) return null;

  const hitItem = items.find(
    (it) => norm(it.product_code) === target || norm(it.barcode) === target
  );
  if (!hitItem) return null;

  const area = areas.find((a) => String(a.id) === String(hitItem.area_id)) || null;
  return {
    area_id: area ? String(area.id) : String(hitItem.area_id),
    area_code: area?.code || "",
    side: hitItem.side || null,
    slot: hitItem.slot || null,
    level: hitItem.level || null,
    item_id: hitItem.id,
    product_code: hitItem.product_code,
    product_name: hitItem.product_name || null,
    expected_quantity: Number(hitItem.quantity) || 0,
  };
}

export function resolveAddressFromText(text, areas = [], items = []) {
  const upper = norm(text);
  if (!upper) return null;

  // 1) Tenta bater código de produto citado na descrição
  const matchedItem = items.find((it) => {
    const c = norm(it.product_code);
    return c.length >= 3 && upper.includes(c);
  });
  if (matchedItem) {
    return resolveAddressForProduct(matchedItem.product_code, areas, items);
  }

  // 2) Tenta bater código de área (ex: "1V", "R2D", "2A") como palavra/token
  const sortedAreas = [...areas]
    .filter((a) => a.area_type === "prateleira" || a.area_type === "outro")
    .sort((a, b) => String(b.code || "").length - String(a.code || "").length);

  for (const a of sortedAreas) {
    const code = norm(a.code);
    if (!code) continue;
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
    if (rx.test(upper)) {
      const areaItems = items.filter((it) => String(it.area_id) === String(a.id));
      const totalQty = areaItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      return {
        area_id: String(a.id),
        area_code: a.code,
        side: null,
        slot: null,
        level: null,
        item_id: null,
        product_code: null,
        product_name: null,
        expected_quantity: totalQty,
      };
    }
  }

  return null;
}

export function buildCyclicTaskFromShortage({ shortage, entry = null, areas = [], items = [] }) {
  const code = String(shortage?.product_code || shortage?.productCode || "").trim();
  const qty = Number(shortage?.quantity) || 1;
  const resolved = resolveAddressForProduct(code, areas, items);
  const order = entry?.order_number || shortage?.orderNumber || null;

  return {
    trigger_source: "falta",
    trigger_ref_id: `shortage:${shortage?.id || `${entry?.id || "e"}-${code}`}`,
    area_id: resolved?.area_id || null,
    area_code: resolved?.area_code || "SEM ENDEREÇO",
    side: resolved?.side || null,
    slot: resolved?.slot || null,
    level: resolved?.level || null,
    item_id: resolved?.item_id ? String(resolved.item_id) : null,
    product_code: code || null,
    product_name: resolved?.product_name || null,
    reason: `Falta registrada (${qty} un)${order ? ` · Pedido #${order}` : ""}`,
    expected_quantity: resolved ? resolved.expected_quantity : null,
    blind_mode: true,
    status: "pendente",
  };
}

export function buildCyclicTaskFromConference({ conferenceItem, reason, note = "", areas = [], items = [] }) {
  const combined = `${reason || ""} ${note || ""}`.trim();
  const resolved = resolveAddressFromText(combined, areas, items);
  const order = conferenceItem?.order_number || conferenceItem?.transfer_number || "";

  return {
    trigger_source: "conferencia",
    trigger_ref_id: `conference:${conferenceItem?.id || Date.now()}`,
    area_id: resolved?.area_id || null,
    area_code: resolved?.area_code || "CONFERÊNCIA",
    side: resolved?.side || null,
    slot: resolved?.slot || null,
    level: resolved?.level || null,
    item_id: resolved?.item_id ? String(resolved.item_id) : null,
    product_code: resolved?.product_code || null,
    product_name: resolved?.product_name || null,
    reason: `Divergência na conferência${order ? ` (#${order})` : ""}: ${reason || "Problema"}${note ? ` — ${note}` : ""}`,
    expected_quantity: resolved ? resolved.expected_quantity : null,
    blind_mode: true,
    status: "pendente",
  };
}

export function buildCyclicTaskFromInconsistency({ inconsistency, areas = [], items = [] }) {
  const combined = `${inconsistency?.location || ""} ${inconsistency?.description || ""}`;
  const resolved = resolveAddressFromText(combined, areas, items);

  return {
    trigger_source: "inconsistencia",
    trigger_ref_id: `inconsistency:${inconsistency?.id || Date.now()}`,
    area_id: resolved?.area_id || null,
    area_code: resolved?.area_code || String(inconsistency?.location || "CD").trim().toUpperCase(),
    side: resolved?.side || null,
    slot: resolved?.slot || null,
    level: resolved?.level || null,
    item_id: resolved?.item_id ? String(resolved.item_id) : null,
    product_code: resolved?.product_code || null,
    product_name: resolved?.product_name || null,
    reason: `Inconsistência em ${inconsistency?.location || "CD"}: ${inconsistency?.description || ""}`,
    expected_quantity: resolved ? resolved.expected_quantity : null,
    blind_mode: true,
    status: "pendente",
  };
}

// Avalia o resultado da contagem cega (revelado somente APÓS concluir a contagem)
export function evaluateBlindCount({ expectedQty, countedQty }) {
  const counted = Math.max(0, Number(countedQty) || 0);
  if (expectedQty === null || expectedQty === undefined || Number.isNaN(Number(expectedQty))) {
    return {
      expected: null,
      counted,
      divergence: null,
      status: "sem_referencia",
      summary: `Contagem registrada: ${counted} un (sem saldo prévio no mapa)`,
    };
  }
  const expected = Number(expectedQty);
  const divergence = counted - expected;
  if (divergence === 0) {
    return {
      expected,
      counted,
      divergence: 0,
      status: "ok",
      summary: `Estoque bateu exatamente (${counted} un)`,
    };
  }
  if (divergence < 0) {
    return {
      expected,
      counted,
      divergence,
      status: "falta",
      summary: `Falta confirmada de ${Math.abs(divergence)} un (sistema: ${expected}, contado: ${counted})`,
    };
  }
  return {
    expected,
    counted,
    divergence,
    status: "sobra",
    summary: `Sobra de ${divergence} un (sistema: ${expected}, contado: ${counted})`,
  };
}

// ============================================================
// Persistência (Supabase cyclic_count_tasks + fallback localStorage)
// ============================================================

export async function fetchCyclicCountTasks({ status = "all", limit = 150 } = {}) {
  try {
    if (!supabase?.from) throw { code: "42P01" };
    let q = supabase
      .from("cyclic_count_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      if (isMissingTable(error)) {
        const local = readLocalTasks();
        const filtered = status && status !== "all" ? local.filter((t) => t.status === status) : local;
        return { data: filtered, error: null, localOnly: true };
      }
      return { data: [], error };
    }
    return { data: data || [], error: null, localOnly: false };
  } catch {
    const local = readLocalTasks();
    const filtered = status && status !== "all" ? local.filter((t) => t.status === status) : local;
    return { data: filtered, error: null, localOnly: true };
  }
}

export async function createCyclicCountTask(task) {
  const row = {
    id: task.id || makeTaskId(),
    created_at: new Date().toISOString(),
    trigger_source: task.trigger_source || "manual",
    trigger_ref_id: task.trigger_ref_id || null,
    area_id: task.area_id || null,
    area_code: task.area_code || "SEM ENDEREÇO",
    side: task.side || null,
    slot: task.slot || null,
    level: task.level || null,
    item_id: task.item_id || null,
    product_code: task.product_code || null,
    product_name: task.product_name || null,
    reason: task.reason || "Contagem cíclica",
    expected_quantity: task.expected_quantity ?? null,
    counted_quantity: null,
    divergence: null,
    blind_mode: true,
    status: "pendente",
  };

  try {
    if (!supabase?.from) throw { code: "42P01" };
    // Deduplicação por trigger_ref_id quando pendente/em_contagem
    if (row.trigger_ref_id) {
      const { data: existing } = await supabase
        .from("cyclic_count_tasks")
        .select("*")
        .eq("trigger_ref_id", row.trigger_ref_id)
        .maybeSingle();
      if (existing) return { data: existing, duplicate: true, error: null };
    }

    const { data, error } = await supabase
      .from("cyclic_count_tasks")
      .insert(row)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") return { data: row, duplicate: true, error: null };
      if (isMissingTable(error)) return saveLocalTask(row);
      return { data: null, error };
    }
    return { data: data || row, duplicate: false, error: null };
  } catch {
    return saveLocalTask(row);
  }
}

function saveLocalTask(row) {
  const list = readLocalTasks();
  if (row.trigger_ref_id) {
    const exists = list.find((t) => t.trigger_ref_id === row.trigger_ref_id);
    if (exists) return { data: exists, duplicate: true, error: null, localOnly: true };
  }
  const next = [row, ...list];
  writeLocalTasks(next);
  return { data: row, duplicate: false, error: null, localOnly: true };
}

export async function completeCyclicCountTask(task, { countedQuantity, operator, updateStockMap = true }) {
  const evalResult = evaluateBlindCount({
    expectedQty: task.expected_quantity,
    countedQty: countedQuantity,
  });

  const patch = {
    status: "concluida",
    counted_quantity: evalResult.counted,
    divergence: evalResult.divergence,
    counted_by_code: operator?.code || null,
    counted_by_name: operator?.name || null,
    counted_at: new Date().toISOString(),
  };

  let error = null;
  try {
    if (!supabase?.from) throw { code: "42P01" };
    const res = await supabase
      .from("cyclic_count_tasks")
      .update(patch)
      .eq("id", task.id)
      .select()
      .maybeSingle();
    if (res.error) {
      if (isMissingTable(res.error)) updateLocalTask(task.id, patch);
      else error = res.error;
    }
  } catch {
    updateLocalTask(task.id, patch);
  }

  // Opcionalmente atualiza a quantidade no mapa do estoque + auditoria
  if (!error && updateStockMap && task.item_id && supabase?.from) {
    try {
      await supabase
        .from("stock_map_items")
        .update({
          quantity: evalResult.counted,
          counted_at: patch.counted_at,
          counted_by: operator?.code || null,
        })
        .eq("id", task.item_id);

      await logStockMapAction({
        areaId: task.area_id,
        areaCode: task.area_code,
        action: "cyclic_count",
        beforeData: { productCode: task.product_code, quantity: task.expected_quantity },
        afterData: {
          productCode: task.product_code,
          quantity: evalResult.counted,
          divergence: evalResult.divergence,
          trigger: task.trigger_source,
        },
        actorCode: operator?.code,
        actorName: operator?.name,
      });
    } catch {
      /* melhor esforço */
    }
  }

  return { task: { ...task, ...patch }, evaluation: evalResult, error };
}

export async function cancelCyclicCountTask(id) {
  const patch = { status: "cancelada" };
  try {
    if (!supabase?.from) throw { code: "42P01" };
    const { error } = await supabase.from("cyclic_count_tasks").update(patch).eq("id", id);
    if (error && isMissingTable(error)) {
      updateLocalTask(id, patch);
      return { error: null };
    }
    return { error };
  } catch {
    updateLocalTask(id, patch);
    return { error: null };
  }
}

function updateLocalTask(id, patch) {
  const list = readLocalTasks();
  const next = list.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t));
  writeLocalTasks(next);
}

// Gatilho automático ao registrar falta no Kiosk ou painel
export async function triggerCyclicCountForShortages(entryId, shortages = []) {
  if (!shortages || shortages.length === 0 || !supabase?.from) return [];
  try {
    const [{ data: areas }, { data: items }] = await Promise.all([
      supabase.from("stock_map_areas").select("*"),
      supabase.from("stock_map_items").select("*"),
    ]);
    const created = [];
    for (const s of shortages) {
      const payload = buildCyclicTaskFromShortage({
        shortage: s,
        entry: { id: entryId },
        areas: areas || [],
        items: items || [],
      });
      const res = await createCyclicCountTask(payload);
      if (res.data && !res.duplicate) created.push(res.data);
    }
    return created;
  } catch {
    return [];
  }
}

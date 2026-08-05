const SAFE_TOKEN = /^[A-Za-z0-9._-]+$/;

export const CLIENT_PERF_EVENT_BY_ACTION = Object.freeze({
  unifiedLogin: "login_submit_to_response",
  init: "admin_initial_screen",
  list: "admin_job_list_ready",
  dashboard: "admin_initial_screen",
  paymentSnapshot: "admin_payment_snapshot",
  getPartnerJobs: "portal_job_list_ready",
  getPhotoMetaCounts: "photo_count_ready",
  getPhotoMetaCountsBatch: "photo_count_ready",
  listPhotos: "photo_list_response",
  batchCreateR2ViewUrls: "photo_view_url_complete",
  presignR2View: "photo_view_url_complete",
  saveOrder: "admin_save_order",
  adminUpdateOrder: "action_submit_to_complete",
  adminAssignPartner: "admin_assign_partner",
  adminAssignEngineer: "admin_assign_engineer",
  assignEngineer: "portal_assign_engineer",
  addCompanionEngineer: "portal_companion_update",
  removeCompanionEngineer: "portal_companion_update",
  completeJob: "portal_complete_job",
  uploadPhoto: "photo_upload_complete",
  batchSavePhotoMeta: "photo_upload_complete",
  deleteR2Photo: "photo_delete_complete",
  requestDeleteR2Photo: "photo_delete_complete",
  getActiveNotices: "admin_notice_list",
  adminNotices: "admin_notice_list",
  adminAccounts: "admin_account_management",
  partnerEngineerAccounts: "portal_account_management",
  getPartnerPaymentCsvData: "portal_csv_download",
});
const READY_AFTER_PAINT = new Set([
  "admin_initial_screen", "admin_job_list_ready", "admin_save_order",
  "admin_assign_partner", "admin_assign_engineer", "portal_job_list_ready",
  "portal_assign_engineer", "portal_companion_update", "portal_complete_job",
  "photo_count_ready", "photo_upload_complete", "photo_delete_complete",
  "action_submit_to_complete",
]);

function safeToken(value, fallback = "", maxLength = 80) {
  const text = String(value || "").trim();
  return text && text.length <= maxLength && SAFE_TOKEN.test(text) ? text : fallback;
}

function nonNegativeInteger(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : undefined;
}

export function createCorrelationId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  } catch {
    return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function detectClientDeviceType() {
  if (typeof window === "undefined") return "unknown";
  const width = Number(window.innerWidth) || 0;
  const coarse = globalThis.matchMedia?.("(pointer: coarse)")?.matches === true;
  if (width > 0 && width < 768) return "mobile";
  if (coarse && width > 0 && width < 1180) return "tablet";
  return width ? "pc" : "unknown";
}

export function detectClientNetworkClass() {
  const connection = globalThis.navigator?.connection;
  if (!connection) return "unknown";
  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  if (connection.saveData || effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") {
    return "cellular-or-limited";
  }
  return effectiveType === "4g" ? "wifi-or-fast" : "unknown";
}

export function withClientCorrelation(payload = {}, correlationId = payload?.correlationId || createCorrelationId()) {
  return { ...payload, correlationId };
}

function responseServerDuration(response) {
  return nonNegativeInteger(
    response?.performanceDebug?.readPath?.totalMs ??
    response?.performanceDebug?.totalMs ??
    response?.serverDurationMs,
  );
}

function responseCacheHit(response) {
  const value = response?.performanceDebug?.readPath?.cacheHit ??
    response?.performanceDebug?.cacheHit ??
    response?.cacheHit;
  return typeof value === "boolean" ? value : undefined;
}

function requestRole(payload, response) {
  return safeToken(response?.role || response?.authRole || payload?.role || "", "");
}

function requestMonth(payload) {
  const month = String(payload?.month || payload?.selectedMonth || "");
  return /^\d{2}\.\d{2}$/.test(month) ? month : "";
}

export function sendClientPerformance(endpoint, record) {
  try {
    const body = {
      action: "logClientPerformance",
      clientPerformance: record,
    };
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 계측 실패는 실제 기능 성공/실패와 분리한다.
  }
}

export function recordApiClientPerformance({
  endpoint,
  appType,
  payload,
  response,
  error,
  startedAt,
  eventName,
  renderDurationMs,
  itemCount,
  paintObserved = false,
}) {
  try {
    const route = safeToken(payload?.action);
    const selectedEvent = safeToken(eventName || CLIENT_PERF_EVENT_BY_ACTION[route]);
    const correlationId = safeToken(payload?.correlationId);
    if (!route || !selectedEvent || !correlationId) return;
    if (!error && response?.success !== false && READY_AFTER_PAINT.has(selectedEvent) && !paintObserved && typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => recordApiClientPerformance({ endpoint, appType, payload, response, startedAt, eventName: selectedEvent, renderDurationMs, itemCount, paintObserved: true }));
      return;
    }
    const endedAt = globalThis.performance?.now?.() ?? Date.now();
    const durationMs = Math.max(0, Math.round(endedAt - Number(startedAt || endedAt)));
    const success = !error && response?.success !== false;
    const errorCode = safeToken(
      error?.code || response?.errorCode || response?.code ||
      (success ? "" : "REQUEST_FAILED"),
      "",
      60,
    );
    const record = {
      occurredAt: new Date().toISOString(),
      eventName: selectedEvent,
      appType: route === "unifiedLogin" && response?.appType && response.appType !== "admin"
        ? "unified_portal"
        : safeToken(appType, "direct_portal"),
      role: requestRole(payload, response),
      deviceType: detectClientDeviceType(),
      networkClass: detectClientNetworkClass(),
      route,
      success,
      durationMs,
      correlationId,
      month: requestMonth(payload),
      version: 1,
    };
    const serverDurationMs = responseServerDuration(response);
    const safeRenderDuration = nonNegativeInteger(renderDurationMs);
    const safeItemCount = nonNegativeInteger(itemCount);
    if (serverDurationMs !== undefined) record.serverDurationMs = serverDurationMs;
    if (safeRenderDuration !== undefined) record.renderDurationMs = safeRenderDuration;
    else if (paintObserved && serverDurationMs !== undefined) record.renderDurationMs = Math.max(0, durationMs - serverDurationMs);
    if (safeItemCount !== undefined) record.itemCount = safeItemCount;
    const cacheHit = responseCacheHit(response);
    if (cacheHit !== undefined) record.cacheHit = cacheHit;
    if (errorCode) record.errorCode = errorCode;
    sendClientPerformance(endpoint, record);
  } catch {
    // 계측 실패는 실제 기능 성공/실패와 분리한다.
  }
}

export function startClientPerformance(eventName, context = {}) {
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const correlationId = context.correlationId || createCorrelationId();
  let finished = false;
  return {
    correlationId,
    finish(result = {}) {
      if (finished) return;
      finished = true;
      recordApiClientPerformance({
        ...context,
        ...result,
        eventName,
        startedAt,
        payload: {
          action: context.route || result.route || "client",
          correlationId,
          month: context.month || result.month,
          role: context.role || result.role,
        },
      });
    },
  };
}

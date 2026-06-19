export const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzunWIU75WOPAnZLS9MGqgLLJ9-P4P1f59gNpggLcWcEGs_P0NArHOLdKNwwPQGekMewg/exec";

const SESSION_STORAGE_KEY = "daelimPartnerPortalUser";
const SESSION_TTL = 1000 * 60 * 60 * 8;

export function readPartnerSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const savedAt = parsed.savedAt || 0;
    const user = parsed.user || parsed;

    if (!user?.role || !user?.name) return null;

    if (savedAt && Date.now() - savedAt > SESSION_TTL) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return {
      user,
      authPassword: parsed.authPassword || user.currentPassword || "",
    };
  } catch (err) {
    return null;
  }
}

export function writePartnerSession(user, authPassword) {
  try {
    const cleanUser = { ...user };
    delete cleanUser.currentPassword;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      user: cleanUser,
      authPassword,
    }));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {}
}

export function clearPartnerSession() {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {}
}

export function parseApiJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const preview = String(text || "").slice(0, 180);
    throw new Error(`API response parse failed: ${preview}`);
  }
}

export function stripPartnerPasswordFieldsForSessionAction(payload) {
  const action = String(payload?.action || "");
  const sessionOnlyActions = new Set([
    "assignEngineer",
    "completeJob",
    "addHistory",
    "requestPartnerEngineerAccount",
  ]);

  if (!sessionOnlyActions.has(action)) return payload;

  const sessionToken = String(payload?.sessionToken || "").trim();
  if (!sessionToken) return payload;

  const {
    password,
    currentPassword,
    authPassword,
    userPassword,
    ...rest
  } = payload;

  return { ...rest, sessionToken };
}

export async function apiPost(payload) {
  const requestPayload = stripPartnerPasswordFieldsForSessionAction(payload);
  const response = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(requestPayload),
  });

  const text = await response.text();

  try {
    const data = JSON.parse(text);
    if (data?.success === false) {
      console.warn("[partner-api] failed", { action: requestPayload?.action || "", code: data.code || "", message: data.message || "" });
      if (data?.code === "SESSION_EXPIRED") {
        clearPartnerSession();
      }
    }
    return data;
  } catch (err) {
    throw new Error(`API ?묐떟 ?뺤떇 ?ㅻ쪟: ${text.slice(0, 160)}`);
  }
}

export function partnerAuthPayload(user, authPassword) {
  const loginId = String(user?.loginId || user?.id || user?.name || "").trim();
  const sessionToken = String(user?.sessionToken || "").trim();
  const password = String(authPassword || user?.authPassword || "").trim();

  return {
    id: loginId,
    loginId,
    sessionToken,
    password,
    currentPassword: password,
    authPassword: password,
  };
}

export function partnerSessionPreferredAuthPayload(user, authPassword) {
  const auth = partnerAuthPayload(user, authPassword);
  if (auth.sessionToken) {
    return {
      id: auth.id,
      loginId: auth.loginId,
      sessionToken: auth.sessionToken,
    };
  }
  return auth;
}

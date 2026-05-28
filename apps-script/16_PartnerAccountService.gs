/***************************************
 * 16_PartnerAccountService.gs
 * 협력사 포털 계정 로그인 / 비밀번호 변경
 ***************************************/

const PARTNER_ACCOUNT_SHEET_NAME = "협력사데이터";

const PARTNER_ACCOUNT_COL = {
  PARTNER_NAME: 1,        // A 협력사명
  NAME: 2,                // B 이름
  PHONE: 3,               // C 연락처
  BIZ_NO: 4,              // D 사업자번호
  PASSWORD: 5,            // E 비밀번호
  ROLE: 6,                // F 권한 partner / engineer
  LOGIN_ID: 7,            // G 로그인ID
  ENABLED: 8,             // H 사용여부 승인 / 중지
  PASSWORD_STATUS: 9,     // I 비밀번호상태 임시 / 정상
  LAST_LOGIN_AT: 10,      // J 마지막로그인일시
  CREATED_BY: 11,         // K 생성자
  CREATED_AT: 12          // L 생성일시
};

function getPartnerAccountSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PARTNER_ACCOUNT_SHEET_NAME);

  if (!sheet) {
    throw new Error("협력사데이터 시트를 찾을 수 없습니다.");
  }

  return sheet;
}

function normalizePartnerPassword_(password) {
  return String(password || "").trim();
}

function isPartnerPasswordHash_(value) {
  return String(value || "").startsWith("SHA256:");
}

function hashPartnerPassword_(password) {
  return "SHA256:" + Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || ""),
    Utilities.Charset.UTF_8
  ).map(function(byte) {
    const value = (byte < 0 ? byte + 256 : byte).toString(16);
    return value.length === 1 ? "0" + value : value;
  }).join("");
}

function verifyPartnerPassword_(inputPassword, savedPassword) {
  const input = normalizePartnerPassword_(inputPassword);
  const saved = String(savedPassword || "").trim();

  if (!input || !saved) return false;

  if (isPartnerPasswordHash_(saved)) {
    return saved === hashPartnerPassword_(input);
  }

  return saved === input;
}

function rowToPartnerAccount_(values, rowNumber) {
  return {
    rowNumber: rowNumber,
    partnerName: String(values[PARTNER_ACCOUNT_COL.PARTNER_NAME - 1] || "").trim(),
    name: String(values[PARTNER_ACCOUNT_COL.NAME - 1] || "").trim(),
    phone: String(values[PARTNER_ACCOUNT_COL.PHONE - 1] || "").trim(),
    bizNo: String(values[PARTNER_ACCOUNT_COL.BIZ_NO - 1] || "").trim(),
    password: String(values[PARTNER_ACCOUNT_COL.PASSWORD - 1] || "").trim(),
    role: String(values[PARTNER_ACCOUNT_COL.ROLE - 1] || "").trim(),
    loginId: String(values[PARTNER_ACCOUNT_COL.LOGIN_ID - 1] || "").trim(),
    enabled: String(values[PARTNER_ACCOUNT_COL.ENABLED - 1] || "").trim(),
    passwordStatus: String(values[PARTNER_ACCOUNT_COL.PASSWORD_STATUS - 1] || "").trim(),
    lastLoginAt: values[PARTNER_ACCOUNT_COL.LAST_LOGIN_AT - 1],
    createdBy: String(values[PARTNER_ACCOUNT_COL.CREATED_BY - 1] || "").trim(),
    createdAt: values[PARTNER_ACCOUNT_COL.CREATED_AT - 1]
  };
}

function findPartnerAccountByLoginId_(loginId) {
  const sheet = getPartnerAccountSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet.getRange(
    2,
    1,
    lastRow - 1,
    sheet.getLastColumn()
  ).getValues();

  const targetId = String(loginId || "").trim();

  for (let i = 0; i < values.length; i += 1) {
    const account = rowToPartnerAccount_(values[i], i + 2);

    const finalLoginId =
      account.loginId ||
      account.name;

    if (finalLoginId === targetId) {
      account.loginId = finalLoginId;
      return account;
    }
  }

  return null;
}

function partnerLogin(body) {
  const loginId = String(
    body.id ||
    body.loginId ||
    ""
  ).trim();

  const password = String(
    body.password || ""
  ).trim();

  if (!loginId || !password) {
    return {
      success: false,
      message: "아이디와 비밀번호를 입력해 주세요."
    };
  }

  const account = findPartnerAccountByLoginId_(loginId);

  if (!account) {
    return {
      success: false,
      message: "아이디 또는 비밀번호를 확인해 주세요."
    };
  }

  if (account.enabled !== "승인") {
    return {
      success: false,
      message: "사용 승인되지 않은 계정입니다."
    };
  }

  if (!verifyPartnerPassword_(password, account.password)) {
    return {
      success: false,
      message: "아이디 또는 비밀번호를 확인해 주세요."
    };
  }

  if (
    account.role !== "partner" &&
    account.role !== "engineer"
  ) {
    return {
      success: false,
      message: "협력사 포털 권한이 올바르지 않습니다."
    };
  }

  const sheet = getPartnerAccountSheet_();

  sheet
    .getRange(account.rowNumber, PARTNER_ACCOUNT_COL.LAST_LOGIN_AT)
    .setValue(new Date());

  const mustChangePassword =
    account.passwordStatus === "임시" ||
    !isPartnerPasswordHash_(account.password);

  return {
    success: true,
    id: loginId,
    loginId: loginId,
    name: account.name,
    role: account.role,
    partnerName: account.partnerName,
    partner: account.partnerName,
    engineerName:
      account.role === "engineer"
        ? account.name
        : "",

    engineer:
      account.role === "engineer"
        ? account.name
        : "",

    engineerPhone: account.phone,
    phone: account.phone,

    passwordStatus:
      mustChangePassword
        ? "임시"
        : "정상",

    mustChangePassword: mustChangePassword,

    message:
      mustChangePassword
        ? "임시 비밀번호입니다. 비밀번호를 변경해 주세요."
        : "로그인 성공"
  };
}

function partnerChangePassword(body) {
  const loginId = String(
    body.id ||
    body.loginId ||
    ""
  ).trim();

  const currentPassword = String(
    body.currentPassword ||
    body.password ||
    ""
  ).trim();

  const nextPassword = String(
    body.nextPassword || ""
  ).trim();

  if (!loginId) {
    return {
      success: false,
      message: "로그인ID가 없습니다."
    };
  }

  if (!/^[0-9]{4}$/.test(currentPassword)) {
    return {
      success: false,
      message: "현재 비밀번호는 숫자 4자리로 입력해 주세요."
    };
  }

  if (!/^[0-9]{4}$/.test(nextPassword)) {
    return {
      success: false,
      message: "새 비밀번호는 숫자 4자리로 입력해 주세요."
    };
  }

  if (nextPassword === "0000") {
    return {
      success: false,
      message: "0000은 임시비밀번호라 사용할 수 없습니다."
    };
  }

  const account = findPartnerAccountByLoginId_(loginId);

  if (!account) {
    return {
      success: false,
      message: "계정을 찾을 수 없습니다."
    };
  }

  if (account.enabled !== "승인") {
    return {
      success: false,
      message: "사용 승인되지 않은 계정입니다."
    };
  }

  if (!verifyPartnerPassword_(currentPassword, account.password)) {
    return {
      success: false,
      message: "현재 비밀번호가 일치하지 않습니다."
    };
  }

  const sheet = getPartnerAccountSheet_();

  sheet
    .getRange(account.rowNumber, PARTNER_ACCOUNT_COL.PASSWORD)
    .setValue(hashPartnerPassword_(nextPassword));

  sheet
    .getRange(account.rowNumber, PARTNER_ACCOUNT_COL.PASSWORD_STATUS)
    .setValue("정상");

  sheet
    .getRange(account.rowNumber, PARTNER_ACCOUNT_COL.LAST_LOGIN_AT)
    .setValue(new Date());

  return {
    success: true,
    message: "비밀번호가 변경되었습니다.",
    passwordStatus: "정상"
  };
}
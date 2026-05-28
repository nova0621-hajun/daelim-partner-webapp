/***************************************
 * 16_PartnerAccountService.gs
 * 협력사 포털 계정 로그인 / 비밀번호 변경 / 기사 계정 요청
 ***************************************/

const PARTNER_ACCOUNT_SHEET_NAME = "협력사데이터";
const PARTNER_ACCOUNT_REQUEST_SHEET_NAME = "PARTNER_ACCOUNT_REQUESTS";

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

const PARTNER_ACCOUNT_REQUEST_COL = {
  REQUEST_ID: 1,          // A 요청ID
  REQUESTED_AT: 2,        // B 요청일시
  REQUEST_PARTNER: 3,     // C 요청협력사
  REQUESTER: 4,           // D 요청자
  ENGINEER_NAME: 5,       // E 기사명
  PHONE: 6,               // F 연락처
  STATUS: 7,              // G 상태 대기 / 승인 / 반려
  HANDLER: 8,             // H 처리자
  HANDLED_AT: 9,          // I 처리일시
  NOTE: 10                // J 비고
};

function getPartnerAccountSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PARTNER_ACCOUNT_SHEET_NAME);

  if (!sheet) {
    throw new Error("협력사데이터 시트를 찾을 수 없습니다.");
  }

  return sheet;
}

/**
 * 협력사 기사 계정 요청 시트 조회
 *
 * 시트가 없으면 헤더를 포함해 자동 생성합니다.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 요청 시트
 */
function getPartnerAccountRequestSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PARTNER_ACCOUNT_REQUEST_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(PARTNER_ACCOUNT_REQUEST_SHEET_NAME);
    sheet.appendRow([
      "요청ID",
      "요청일시",
      "요청협력사",
      "요청자",
      "기사명",
      "연락처",
      "상태",
      "처리자",
      "처리일시",
      "비고"
    ]);
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

/**
 * 휴대전화 뒤 4자리 조회
 *
 * @param {string} phone 연락처
 * @returns {string} 뒤 4자리
 */
function getPhoneLast4_(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits.slice(-4);
}

/**
 * 협력사 포털 로그인ID 생성
 *
 * @param {string} name 이름
 * @param {string} phone 연락처
 * @returns {string} 로그인ID
 */
function buildPartnerLoginId_(name, phone) {
  return String(name || "").trim() + getPhoneLast4_(phone);
}

/**
 * 협력사 요청 행을 API 응답 데이터로 변환
 *
 * @param {Array} row 시트 행
 * @param {number} rowNumber 행 번호
 * @returns {Object} 요청 데이터
 */
function rowToPartnerAccountRequest_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    requestId: String(row[PARTNER_ACCOUNT_REQUEST_COL.REQUEST_ID - 1] || "").trim(),
    requestedAt: row[PARTNER_ACCOUNT_REQUEST_COL.REQUESTED_AT - 1],
    partnerName: String(row[PARTNER_ACCOUNT_REQUEST_COL.REQUEST_PARTNER - 1] || "").trim(),
    requester: String(row[PARTNER_ACCOUNT_REQUEST_COL.REQUESTER - 1] || "").trim(),
    engineerName: String(row[PARTNER_ACCOUNT_REQUEST_COL.ENGINEER_NAME - 1] || "").trim(),
    phone: String(row[PARTNER_ACCOUNT_REQUEST_COL.PHONE - 1] || "").trim(),
    status: String(row[PARTNER_ACCOUNT_REQUEST_COL.STATUS - 1] || "").trim(),
    handler: String(row[PARTNER_ACCOUNT_REQUEST_COL.HANDLER - 1] || "").trim(),
    handledAt: row[PARTNER_ACCOUNT_REQUEST_COL.HANDLED_AT - 1],
    note: String(row[PARTNER_ACCOUNT_REQUEST_COL.NOTE - 1] || "").trim()
  };
}

/**
 * 협력사 partner 권한 인증
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 인증 결과
 */
function verifyPartnerRequester_(body) {
  const loginId = String(body.loginId || body.id || "").trim();
  const password = String(body.password || body.currentPassword || "").trim();
  const account = findPartnerAccountByLoginId_(loginId);

  if (!account) {
    return {
      success: false,
      message: "협력사 계정을 찾을 수 없습니다."
    };
  }

  if (account.enabled !== "승인") {
    return {
      success: false,
      message: "승인된 협력사 계정만 요청할 수 있습니다."
    };
  }

  if (account.role !== "partner") {
    return {
      success: false,
      message: "partner 권한만 기사 계정 생성을 요청할 수 있습니다."
    };
  }

  if (!verifyPartnerPassword_(password, account.password)) {
    return {
      success: false,
      message: "협력사 계정 비밀번호가 일치하지 않습니다."
    };
  }

  account.success = true;
  return account;
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

/**
 * 협력사 포털 기사 계정 생성 요청
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 요청 결과
 */
function requestPartnerEngineerAccount(body) {
  const auth = verifyPartnerRequester_(body);

  if (!auth.success) {
    return auth;
  }

  const engineerName = String(body.engineerName || body.name || "").trim();
  const phone = String(body.phone || "").trim();

  if (!engineerName || !/^[0-9-]{10,13}$/.test(phone)) {
    return {
      success: false,
      message: "기사명과 연락처를 입력해 주세요."
    };
  }

  const loginId = buildPartnerLoginId_(engineerName, phone);
  const existing = findPartnerAccountByLoginId_(loginId);

  if (existing) {
    return {
      success: false,
      message: "이미 등록된 기사 계정입니다. 로그인ID: " + loginId
    };
  }

  const requestSheet = getPartnerAccountRequestSheet_();
  const requestValues = requestSheet.getDataRange().getValues();

  for (let i = 1; i < requestValues.length; i += 1) {
    const request = rowToPartnerAccountRequest_(requestValues[i], i + 1);

    if (
      request.status === "대기" &&
      request.partnerName === auth.partnerName &&
      buildPartnerLoginId_(request.engineerName, request.phone) === loginId
    ) {
      return {
        success: false,
        message: "이미 대기 중인 기사 계정 요청입니다."
      };
    }
  }

  const requestId = "PER-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");

  requestSheet.appendRow([
    requestId,
    new Date(),
    auth.partnerName,
    auth.name,
    engineerName,
    phone,
    "대기",
    "",
    "",
    ""
  ]);

  if (typeof createNotification_ === "function") {
    createNotification_({
      targetRole: "master",
      title: "협력사 기사 계정 요청",
      content: auth.partnerName + " / " + engineerName + " 기사 계정 생성 요청이 등록되었습니다.",
      type: "partner_engineer_request"
    });
  }

  return {
    success: true,
    requestId: requestId,
    loginId: loginId,
    message: "기사 계정 생성 요청이 등록되었습니다. master 승인 후 로그인할 수 있습니다."
  };
}

/**
 * master 전용 협력사 기사 계정 요청 목록 조회
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 요청 목록
 */
function getPartnerEngineerAccountRequests(body) {
  const auth = verifyAdminMasterForAccount_(body);

  if (!auth.success) {
    return auth;
  }

  const sheet = getPartnerAccountRequestSheet_();
  const lastRow = sheet.getLastRow();
  const rows = [];

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, PARTNER_ACCOUNT_REQUEST_COL.NOTE).getValues();

    values.forEach(function(row, index) {
      const request = rowToPartnerAccountRequest_(row, index + 2);
      request.loginId = buildPartnerLoginId_(request.engineerName, request.phone);
      rows.push(request);
    });
  }

  rows.sort(function(a, b) {
    if (a.status === "대기" && b.status !== "대기") return -1;
    if (a.status !== "대기" && b.status === "대기") return 1;
    return Number(new Date(b.requestedAt || 0)) - Number(new Date(a.requestedAt || 0));
  });

  return {
    success: true,
    rows: rows
  };
}

/**
 * master 전용 협력사 기사 계정 요청 승인 / 반려
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 처리 결과
 */
function updatePartnerEngineerAccountRequest(body) {
  const auth = verifyAdminMasterForAccount_(body);

  if (!auth.success) {
    return auth;
  }

  const rowNumber = Number(body.rowNumber);
  const status = String(body.status || "").trim();
  const note = String(body.note || "").trim();

  if (!rowNumber || rowNumber < 2) {
    return {
      success: false,
      message: "요청 행 번호가 올바르지 않습니다."
    };
  }

  if (status !== "승인" && status !== "반려") {
    return {
      success: false,
      message: "상태는 승인 또는 반려만 가능합니다."
    };
  }

  const requestSheet = getPartnerAccountRequestSheet_();
  const requestRow = requestSheet
    .getRange(rowNumber, 1, 1, PARTNER_ACCOUNT_REQUEST_COL.NOTE)
    .getValues()[0];
  const request = rowToPartnerAccountRequest_(requestRow, rowNumber);

  if (!request.requestId) {
    return {
      success: false,
      message: "요청 정보를 찾을 수 없습니다."
    };
  }

  if (request.status !== "대기") {
    return {
      success: false,
      message: "이미 처리된 요청입니다."
    };
  }

  const loginId = buildPartnerLoginId_(request.engineerName, request.phone);

  if (status === "승인") {
    const existing = findPartnerAccountByLoginId_(loginId);

    if (existing) {
      return {
        success: false,
        message: "이미 같은 로그인ID의 계정이 있습니다. 로그인ID: " + loginId
      };
    }

    const accountSheet = getPartnerAccountSheet_();

    accountSheet.appendRow([
      request.partnerName,
      request.engineerName,
      request.phone,
      "",
      "0000",
      "engineer",
      loginId,
      "승인",
      "임시",
      "",
      auth.name,
      new Date()
    ]);
  }

  requestSheet.getRange(rowNumber, PARTNER_ACCOUNT_REQUEST_COL.STATUS).setValue(status);
  requestSheet.getRange(rowNumber, PARTNER_ACCOUNT_REQUEST_COL.HANDLER).setValue(auth.name);
  requestSheet.getRange(rowNumber, PARTNER_ACCOUNT_REQUEST_COL.HANDLED_AT).setValue(new Date());
  requestSheet.getRange(rowNumber, PARTNER_ACCOUNT_REQUEST_COL.NOTE).setValue(note);

  SpreadsheetApp.flush();

  const updatedRow = requestSheet
    .getRange(rowNumber, 1, 1, PARTNER_ACCOUNT_REQUEST_COL.NOTE)
    .getValues()[0];
  const updatedRequest = rowToPartnerAccountRequest_(updatedRow, rowNumber);
  updatedRequest.loginId = loginId;

  return {
    success: true,
    request: updatedRequest,
    message:
      status === "승인"
        ? "기사 계정이 승인되었습니다. 임시비밀번호는 0000입니다."
        : "기사 계정 요청이 반려되었습니다."
  };
}

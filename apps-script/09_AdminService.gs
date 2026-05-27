/***************************************
 * 09_AdminService.gs
 * 관리자 / 마스터 계정 전용 현장 관리 기능
 ***************************************/

/**
 * 마스터 비밀번호 확인
 *
 * 기존 MASTER_PASSWORD 방식과 호환하기 위해 유지합니다.
 *
 * @param {Object} e GET 요청 이벤트
 * @returns {Object} 확인 결과
 */
function checkAdminPassword(e) {
  const password = e.parameter.masterPassword || "";

  return {
    success: password === MASTER_PASSWORD
  };
}

/**
 * 마스터 계정 작업 권한 확인
 *
 * 우선 시공관리 계정 인증을 확인하고,
 * 기존 MASTER_PASSWORD 방식도 호환합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 확인 결과
 */
function verifyAdminOperation_(body) {
  const userName = String(body.userName || "").trim();
  const userPassword = String(body.userPassword || "").trim();
  const masterPassword = String(body.masterPassword || "").trim();

  if (userName && userPassword && typeof verifyAdminUserCredentials_ === "function") {
    const userAuth = verifyAdminUserCredentials_(userName, userPassword);

    if (userAuth.success && userAuth.role === "master") {
      return {
        success: true,
        method: "adminAccount",
        user: userAuth
      };
    }
  }

  if (masterPassword && masterPassword === MASTER_PASSWORD) {
    return {
      success: true,
      method: "masterPassword"
    };
  }

  return {
    success: false,
    message: "마스터 권한이 필요합니다."
  };
}

/**
 * 관리자 잠금 / 해제
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 처리 결과
 */
function setEditLock(body) {
  const month = body.month || "";
  const row = Number(body.rowNumber);
  const locked = body.locked === true;

  if (!month) throw new Error("month 값이 없습니다.");
  if (!row) throw new Error("rowNumber 값이 없습니다.");

  const auth = verifyAdminOperation_(body);
  if (!auth.success) throw new Error(auth.message);

  const sheet = getMonthlySheet(month);

  sheet
    .getRange(row, COL.EDIT_LOCKED)
    .setValue(locked ? "Y" : "");

  SpreadsheetApp.flush();
  clearMonthCache_(month);

  return {
    success: true,
    locked: locked
  };
}

/**
 * 삭제요청 등록
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 처리 결과
 */
function requestDelete(body) {
  const month = body.month || "";
  const row = Number(body.rowNumber);
  const password = String(body.password || "");

  if (!month) throw new Error("month 값이 없습니다.");
  if (!row) throw new Error("rowNumber 값이 없습니다.");
  if (!password) throw new Error("수정 비밀번호가 없습니다.");

  const sheet = getMonthlySheet(month);

  const savedHash = sheet
    .getRange(row, COL.EDIT_PASSWORD_HASH)
    .getDisplayValue();

  if (!savedHash) {
    throw new Error("등록된 수정 비밀번호가 없습니다.");
  }

  if (savedHash !== hashPassword_(password)) {
    throw new Error("수정 비밀번호 불일치");
  }

  sheet
    .getRange(row, COL.DELETE_REQUEST)
    .setValue("Y");

  SpreadsheetApp.flush();
  clearMonthCache_(month);

  return {
    success: true
  };
}

/**
 * 삭제요청 해제
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 처리 결과
 */
function approveDelete(body) {
  const month = body.month || "";
  const row = Number(body.rowNumber);

  if (!month) throw new Error("month 값이 없습니다.");
  if (!row) throw new Error("rowNumber 값이 없습니다.");

  const auth = verifyAdminOperation_(body);
  if (!auth.success) throw new Error(auth.message);

  const sheet = getMonthlySheet(month);

  sheet
    .getRange(row, COL.DELETE_REQUEST)
    .setValue("");

  SpreadsheetApp.flush();
  clearMonthCache_(month);

  return {
    success: true
  };
}

/**
 * 완전 삭제
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 처리 결과
 */
function hardDelete(body) {
  const month = body.month || "";
  const row = Number(body.rowNumber);

  if (!month) throw new Error("month 값이 없습니다.");
  if (!row) throw new Error("rowNumber 값이 없습니다.");

  const auth = verifyAdminOperation_(body);
  if (!auth.success) throw new Error(auth.message);

  const sheet = getMonthlySheet(month);

  sheet.deleteRow(row);

  SpreadsheetApp.flush();
  clearMonthCache_(month);

  return {
    success: true
  };
}

/**
 * 전체 월 삭제요청 현장 조회
 *
 * @returns {Object} 삭제요청 현장 목록
 */
function getDeleteRequestsAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const rows = [];

  sheets.forEach(function(sheet) {
    const month = sheet.getName();
    if (!MONTH_SHEET_REGEX.test(month)) return;

    const values = sheet.getDataRange().getValues();

    for (let i = DATA_START_ROW - 1; i < values.length; i++) {
      const row = values[i];
      const rowNumber = i + 1;

      if (row[COL.DELETE_REQUEST - 1] !== "Y") continue;
      if (!row[COL.CUSTOMER - 1]) continue;

      const job = rowToJob(row, rowNumber);
      job.month = month;
      rows.push(job);
    }
  });

  return {
    success: true,
    rows: rows
  };
}

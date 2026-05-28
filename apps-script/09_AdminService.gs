/***************************************
 * 09_AdminService.gs
 * 관리자 / 마스터 계정 전용 현장 관리 기능
 ***************************************/

/**
 * 마스터 계정 작업 권한 확인
 *
 * 시공관리 master 계정 인증만 허용합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 확인 결과
 */
function verifyAdminOperation_(body) {
  const userName = String(body.userName || "").trim();
  const userPassword = String(body.userPassword || "").trim();

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
  const lockCell = sheet.getRange(row, COL.EDIT_LOCKED);

  if (locked) {
    lockCell.setValue("Y");
  } else {
    lockCell.clearContent();
  }

  const job = rowToJob(
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0],
    row
  );

  if (typeof writeHistoryLog === "function") {
    writeHistoryLog({
      month: month,
      rowNumber: row,
      customer: job.customer,
      actionType: locked ? "현장잠금" : "현장잠금해제",
      fieldName: "관리자잠금",
      beforeValue: locked ? "" : "Y",
      afterValue: locked ? "Y" : "",
      actor: auth.user && auth.user.name ? auth.user.name : "master"
    });
  }

  if (typeof createNotification_ === "function") {
    createNotification_({
      targetName: job.manager,
      targetRole: "master",
      title: locked ? "현장 잠금" : "현장 잠금해제",
      content: job.customer + " 현장의 잠금 상태가 변경되었습니다.",
      jobId: job.id || row,
      type: locked ? "job_locked" : "job_unlocked"
    });
  }

  SpreadsheetApp.flush();
  clearMonthCache_(month);

  return {
    success: true,
    locked: locked,
    storedValue: lockCell.getDisplayValue()
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

  const sheet = getMonthlySheet(month);
  const job = rowToJob(
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0],
    row
  );

  const accountAuth = typeof verifyOrderAccountAccess_ === "function"
    ? verifyOrderAccountAccess_(body, job)
    : { success: false, message: "계정 권한 확인 함수를 찾을 수 없습니다." };

  if (!accountAuth.success) {
    if (!password) {
      throw new Error(accountAuth.message || "계정 권한 또는 수정 비밀번호가 필요합니다.");
    }

    const savedHash = sheet
      .getRange(row, COL.EDIT_PASSWORD_HASH)
      .getDisplayValue();

    if (!savedHash) {
      throw new Error("등록된 수정 비밀번호가 없습니다.");
    }

    if (savedHash !== hashPassword_(password)) {
      throw new Error("수정 비밀번호 불일치");
    }
  }

  sheet
    .getRange(row, COL.DELETE_REQUEST)
    .setValue("Y");

  if (typeof createNotification_ === "function") {
    createNotification_({
      targetRole: "master",
      title: "삭제요청 접수",
      content: job.customer + " 현장의 삭제요청이 접수되었습니다.",
      jobId: job.id || row,
      type: "delete_request"
    });
  }

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

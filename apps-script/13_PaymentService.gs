/***************************************
 * 13_PaymentService.gs
 * 계약시공비 / 지급시공비 정산 API
 ***************************************/

/** 계약시공비: I열 */
const CONTRACT_PAYMENT_COLUMN = 9;

/** 지급시공비: T열 */
const PARTNER_PAYMENT_ADMIN_COLUMN = 20;

/**
 * 마스터 비밀번호 확인
 *
 * @param {string} masterPassword 마스터 비밀번호
 * @returns {Object} 확인 결과
 */
function verifyPaymentMaster_(masterPassword) {
  return checkAdminPassword({
    parameter: {
      masterPassword: String(masterPassword || "").trim()
    }
  });
}

/**
 * 시트 저장용 금액 변환
 *
 * @param {*} value 원본 금액
 * @returns {number|string} 저장할 금액
 */
function normalizePaymentAmount_(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return "";

  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    throw new Error("지급시공비는 숫자로 입력해야 합니다.");
  }

  return amount;
}

/**
 * 대상 월 시트 조회
 *
 * @param {string} month 월 시트명
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 월 시트
 */
function getPaymentMonthSheet_(month) {
  const sheetName = String(month || "").trim();
  if (!sheetName) {
    throw new Error("월 정보가 없습니다.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(sheetName + " 시트를 찾을 수 없습니다.");
  }

  return sheet;
}

/**
 * 정산 조회 권한 확인
 *
 * master 비밀번호 또는 시공관리 계정 인증을 허용합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 권한 정보
 */
function verifyPaymentViewer_(body) {
  if (body.masterPassword) {
    const masterAuth = verifyPaymentMaster_(body.masterPassword);
    if (masterAuth.success) {
      return {
        success: true,
        role: "master",
        name: "master",
        team: ""
      };
    }
  }

  const userAuth = verifyAdminUserCredentials_(body.userName, body.userPassword);
  if (!userAuth.success) {
    return userAuth;
  }

  if (userAuth.role === "viewer") {
    return {
      success: false,
      message: "시공비 조회 권한이 없습니다."
    };
  }

  return userAuth;
}

/**
 * 권한별 정산 행 조회 가능 여부
 *
 * @param {Object} user 권한 정보
 * @param {Array} row 현장 행 데이터
 * @returns {boolean} 조회 가능 여부
 */
function canReadPaymentRow_(user, row) {
  if (user.role === "master") return true;

  const team = String(row[COL.TEAM - 1] || "").trim();
  const manager = String(row[COL.MANAGER - 1] || "").trim();

  if (user.role === "team1_leader") {
    return team === "영업1팀" || team === user.team;
  }

  if (user.role === "team2_leader") {
    return team === "영업2팀" || team === user.team;
  }

  if (user.role === "sales") {
    return manager === user.name;
  }

  return false;
}

/**
 * 권한별 정산 스냅샷 조회
 *
 * 계약시공비는 I열, 지급시공비는 T열 기준으로 반환합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 정산 조회 결과
 */
function getPaymentSnapshot(body) {
  const auth = verifyPaymentViewer_(body);
  if (!auth.success) {
    return {
      success: false,
      message: auth.message || "시공비 조회 권한이 없습니다."
    };
  }

  const sheet = getPaymentMonthSheet_(body.month);
  const lastRow = sheet.getLastRow();

  if (lastRow < DATA_START_ROW) {
    return {
      success: true,
      rows: []
    };
  }

  const lastColumn = Math.max(COL.DELETE_REQUEST, CONTRACT_PAYMENT_COLUMN, PARTNER_PAYMENT_ADMIN_COLUMN);
  const values = sheet
    .getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastColumn)
    .getValues();

  const rows = values
    .map(function(row, index) {
      if (!canReadPaymentRow_(auth, row)) return null;

      return {
        rowNumber: DATA_START_ROW + index,
        contractPrice: row[CONTRACT_PAYMENT_COLUMN - 1] || "",
        partnerPaymentAmount: row[PARTNER_PAYMENT_ADMIN_COLUMN - 1] || ""
      };
    })
    .filter(Boolean);

  return {
    success: true,
    rows: rows
  };
}

/**
 * 마스터 확정 지급시공비 저장
 *
 * 지급시공비는 T열에 저장합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 저장 결과
 */
function savePartnerPayment(body) {
  const masterAuth = verifyPaymentMaster_(body.masterPassword);
  const userAuth = verifyAdminUserCredentials_(body.userName, body.userPassword);

  if (!masterAuth.success && !(userAuth.success && userAuth.role === "master")) {
    return {
      success: false,
      message: "마스터 권한이 없습니다."
    };
  }

  const rowNumber = Number(body.rowNumber);
  if (!rowNumber || rowNumber < DATA_START_ROW) {
    return {
      success: false,
      message: "행 번호가 올바르지 않습니다."
    };
  }

  const sheet = getPaymentMonthSheet_(body.month);
  const amount = normalizePaymentAmount_(body.partnerPaymentAmount);

  sheet
    .getRange(rowNumber, PARTNER_PAYMENT_ADMIN_COLUMN)
    .setValue(amount);

  return {
    success: true,
    rowNumber: rowNumber,
    partnerPaymentAmount: amount,
    message: "지급시공비가 저장되었습니다."
  };
}

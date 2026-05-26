/***************************************
 * 12_PartnerJobService.gs
 * 협력사 / 시공엔지니어 전용 현장 조회 API
 ***************************************/

/**
 * 협력사 / 시공엔지니어 권한별 현장 목록 조회
 *
 * partner:
 * - U열 협력사 기준으로 본인 협력사 현장만 조회
 *
 * engineer:
 * - V열 시공기사 기준으로 본인 배정 현장만 조회
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 현장 목록 조회 결과
 */
function getPartnerJobs(body) {

  const role = String(body.role || "").trim();
  const partnerName = String(body.partnerName || "").trim();
  const engineerName = String(body.engineerName || "").trim();

  if (!role) {
    return {
      success: false,
      message: "권한 정보가 없습니다."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  const rows = [];

  sheets.forEach(function(sheet) {

    const sheetName = sheet.getName();

    /** 월 시트만 조회 */
    if (!MONTH_SHEET_REGEX.test(sheetName)) return;

    const lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) return;

    const lastColumn = Math.max(COL.DELETE_REQUEST, COL.EDIT_LOCKED || 0);
    const values = sheet
      .getRange(
        DATA_START_ROW,
        1,
        lastRow - DATA_START_ROW + 1,
        lastColumn
      )
      .getValues();

    values.forEach(function(row, index) {

      const rowNumber = DATA_START_ROW + index;

      const customer = row[COL.CUSTOMER - 1];
      const status = row[COL.STATUS - 1];
      const partner = row[COL.PARTNER - 1];
      const engineer = row[COL.INSTALLER - 1];
      const folderUrl = row[COL.FOLDER_URL - 1] || "";
      const editLock = getEditLockValueFromRow_(row);
      const photoInfo = folderUrl
        ? getPhotoCategoryInfoByFolderUrl_(folderUrl)
        : {
            counts: { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 },
            urls: { 계약도면: "", 시공전: "", 완료사진: "", 기타: "" }
          };

      /** 고객명 없는 행 제외 */
      if (!customer) return;

      /** 삭제 행 제외 */
      if (status === STATUS.DELETED) return;

      /***************************************
       * 권한별 필터
       ***************************************/
      if (role === "partner") {
        if (String(partner || "").trim() !== partnerName) return;
      }

      if (role === "engineer") {
        if (String(engineer || "").trim() !== engineerName) return;
      }

      rows.push({
        month: sheetName,
        rowNumber: rowNumber,

        /** 기본 정보 */
        customer: row[COL.CUSTOMER - 1] || "",
        manager: row[COL.MANAGER - 1] || "",
        team: row[COL.TEAM - 1] || "",
        phone: row[COL.PHONE - 1] || "",
        address: row[COL.ADDRESS - 1] || "",
        item: row[COL.ITEM - 1] || "",

        /** 계약 / 상태 */
        orderStatus: row[COL.ORDER_STATUS - 1] || "",
        status: row[COL.STATUS - 1] || "",

        /** 시공 정보 */
        installDate: formatDateForApi_(row[COL.INSTALL_START - 1]),
        endDate: formatDateForApi_(row[COL.INSTALL_END - 1]),
        stoneDate: formatDateForApi_(row[COL.STONE_DATE - 1]),
        living: row[COL.LIVING - 1] || "",
        assembly: row[COL.ASSEMBLY - 1] || "",

        /** 협력사 / 엔지니어 */
        partner: row[COL.PARTNER - 1] || "",
        engineer: row[COL.INSTALLER - 1] || "",
        engineerPhone: row[COL.INSTALLER_PHONE - 1] || "",

        /** 메모 / 이력 */
        siteMemo: row[COL.SITE_MEMO - 1] || "",
        history: row[COL.HISTORY - 1] || "",

        /** 사진 */
        photo: folderUrl ? "등록완료" : "미등록",
        photoUrl: folderUrl,
        photoLink: row[COL.PHOTO_LINK - 1] || "",
        photoCounts: photoInfo.counts,
        photoUrls: photoInfo.urls,
        editLock: editLock,
        editLocked: isLockedValue_(editLock),
        deleteRequest: row[COL.DELETE_REQUEST - 1] || ""
      });
    });
  });

  return {
    success: true,
    role: role,
    partnerName: partnerName,
    engineerName: engineerName,
    rows: rows
  };
}


/**
 * 협력사 포털 엔지니어 배정 저장
 *
 * 저장 대상:
 * - V열: 시공엔지니어
 * - W열: 엔지니어 연락처
 * - 상태: 엔지니어배정완료
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 저장 결과
 */
function assignEngineer(body) {
  const month = String(body.month || "").trim();
  const rowNumber = Number(body.rowNumber || 0);
  const partnerName = String(body.partnerName || "").trim();
  const engineerName = String(body.engineerName || body.installerName || body.engineer || body.installer || "").trim();
  let engineerPhone = String(body.engineerPhone || body.installerPhone || "").trim();

  if (!month) {
    return {
      success: false,
      message: "월 시트 정보가 없습니다."
    };
  }

  if (!rowNumber || rowNumber < DATA_START_ROW) {
    return {
      success: false,
      message: "현장 행 번호가 올바르지 않습니다."
    };
  }

  if (!engineerName) {
    return {
      success: false,
      message: "배정할 엔지니어를 선택해 주세요."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(month);

  if (!sheet) {
    return {
      success: false,
      message: month + " 시트를 찾을 수 없습니다."
    };
  }

  const currentPartner = String(
    sheet.getRange(rowNumber, COL.PARTNER).getValue() || ""
  ).trim();

  if (partnerName && currentPartner !== partnerName) {
    return {
      success: false,
      message: "해당 협력사 현장이 아닙니다."
    };
  }

  if (isPartnerJobLocked_(sheet, rowNumber)) {
    return {
      success: false,
      message: "관리자가 잠근 현장입니다. 잠금 해제 후 처리할 수 있습니다."
    };
  }

  if (!engineerPhone) {
    engineerPhone = findEngineerPhone_(currentPartner, engineerName);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    sheet.getRange(rowNumber, COL.INSTALLER).setValue(engineerName);
    sheet.getRange(rowNumber, COL.INSTALLER_PHONE).setValue(engineerPhone);
    sheet.getRange(rowNumber, COL.STATUS).setValue("엔지니어배정완료");

    return {
      success: true,
      message: "엔지니어 배정이 저장되었습니다.",
      month: month,
      rowNumber: rowNumber,
      engineerName: engineerName,
      engineerPhone: engineerPhone
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 협력사 포털 중요 이력 추가 저장
 *
 * 저장 대상:
 * - Y열: 중요 이력
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 저장 결과
 */
function addHistory(body) {
  const month = String(body.month || "").trim();
  const rowNumber = Number(body.rowNumber || 0);
  const role = String(body.role || "").trim();
  const partnerName = String(body.partnerName || "").trim();
  const engineerName = String(body.engineerName || "").trim();
  const actor = String(body.actor || "사용자").trim();
  const text = String(body.text || "").trim();

  if (!month) {
    return {
      success: false,
      message: "월 시트 정보가 없습니다."
    };
  }

  if (!rowNumber || rowNumber < DATA_START_ROW) {
    return {
      success: false,
      message: "현장 행 번호가 올바르지 않습니다."
    };
  }

  if (!text) {
    return {
      success: false,
      message: "이력 내용을 입력해 주세요."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(month);

  if (!sheet) {
    return {
      success: false,
      message: month + " 시트를 찾을 수 없습니다."
    };
  }

  const access = checkPartnerJobAccess_(sheet, rowNumber, role, partnerName, engineerName);

  if (!access.success) {
    return access;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const historyCell = sheet.getRange(rowNumber, COL.HISTORY);
    const currentHistory = String(historyCell.getValue() || "").trim();
    const stamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
    const nextLine = stamp + " " + actor + ": " + text;
    const nextHistory = currentHistory ? currentHistory + "\n" + nextLine : nextLine;

    historyCell.setValue(nextHistory);

    return {
      success: true,
      message: "이력등록이 저장되었습니다.",
      month: month,
      rowNumber: rowNumber,
      history: nextHistory
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 협력사 포털 완료보고 저장
 *
 * 저장 대상:
 * - 상태: 시공완료
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 저장 결과
 */
function completeJob(body) {
  const month = String(body.month || "").trim();
  const rowNumber = Number(body.rowNumber || 0);
  const role = String(body.role || "").trim();
  const partnerName = String(body.partnerName || "").trim();
  const engineerName = String(body.engineerName || "").trim();

  if (!month) {
    return {
      success: false,
      message: "월 시트 정보가 없습니다."
    };
  }

  if (!rowNumber || rowNumber < DATA_START_ROW) {
    return {
      success: false,
      message: "현장 행 번호가 올바르지 않습니다."
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(month);

  if (!sheet) {
    return {
      success: false,
      message: month + " 시트를 찾을 수 없습니다."
    };
  }

  const access = checkPartnerJobAccess_(sheet, rowNumber, role, partnerName, engineerName);

  if (!access.success) {
    return access;
  }

  if (!hasRequiredCompletionPhoto_(sheet, rowNumber)) {
    return {
      success: false,
      message: "완료사진을 1장 이상 등록한 뒤 완료보고할 수 있습니다."
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    sheet.getRange(rowNumber, COL.STATUS).setValue("시공완료");

    return {
      success: true,
      message: "완료보고가 저장되었습니다.",
      month: month,
      rowNumber: rowNumber,
      status: "시공완료"
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 협력사 포털 현장 접근 권한 확인
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 월 시트
 * @param {number} rowNumber 현장 행 번호
 * @param {string} role 권한
 * @param {string} partnerName 협력사명
 * @param {string} engineerName 엔지니어명
 * @returns {Object} 확인 결과
 */
function checkPartnerJobAccess_(sheet, rowNumber, role, partnerName, engineerName) {
  const customer = String(sheet.getRange(rowNumber, COL.CUSTOMER).getValue() || "").trim();
  const status = String(sheet.getRange(rowNumber, COL.STATUS).getValue() || "").trim();
  const currentPartner = String(sheet.getRange(rowNumber, COL.PARTNER).getValue() || "").trim();
  const currentEngineer = String(sheet.getRange(rowNumber, COL.INSTALLER).getValue() || "").trim();

  if (!customer) {
    return {
      success: false,
      message: "현장 정보를 찾을 수 없습니다."
    };
  }

  if (status === STATUS.DELETED) {
    return {
      success: false,
      message: "삭제된 현장은 처리할 수 없습니다."
    };
  }

  if (isPartnerJobLocked_(sheet, rowNumber)) {
    return {
      success: false,
      message: "관리자가 잠근 현장입니다. 잠금 해제 후 처리할 수 있습니다."
    };
  }

  if (role === "partner" && partnerName && currentPartner !== partnerName) {
    return {
      success: false,
      message: "해당 협력사 현장이 아닙니다."
    };
  }

  if (role === "engineer" && engineerName && currentEngineer !== engineerName) {
    return {
      success: false,
      message: "배정된 시공엔지니어 현장이 아닙니다."
    };
  }

  return {
    success: true
  };
}


/**
 * 사진 업로드 전 현장잠금 상태 확인 후 기존 uploadPhoto 실행
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 업로드 결과
 */
function uploadPhotoWithLockGuard(body) {
  const guard = checkJobUnlockedByBody_(body);

  if (!guard.success) {
    return guard;
  }

  return uploadPhoto(body);
}


/**
 * 도면 업로드 전 현장잠금 상태 확인 후 기존 uploadDrawing 실행
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 업로드 결과
 */
function uploadDrawingWithLockGuard(body) {
  const guard = checkJobUnlockedByBody_(body);

  if (!guard.success) {
    return guard;
  }

  return uploadDrawing(body);
}


/**
 * 요청 본문 기준으로 현장잠금 상태 확인
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 확인 결과
 */
function checkJobUnlockedByBody_(body) {
  const month = String(body.month || "").trim();
  const rowNumber = Number(body.rowNumber || 0);
  const role = String(body.role || "").trim();
  const partnerName = String(body.partnerName || "").trim();
  const engineerName = String(body.engineerName || "").trim();

  if (!month || !rowNumber) {
    return {
      success: true
    };
  }

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(month);

  if (!sheet) {
    return {
      success: false,
      message: month + " 시트를 찾을 수 없습니다."
    };
  }

  if (isPartnerJobLocked_(sheet, rowNumber)) {
    return {
      success: false,
      message: "관리자가 잠근 현장입니다. 잠금 해제 후 업로드할 수 있습니다."
    };
  }

  if (role === "partner" || role === "engineer") {
    const access = checkPartnerJobAccessWithoutLock_(sheet, rowNumber, role, partnerName, engineerName);

    if (!access.success) {
      return access;
    }
  }

  return {
    success: true
  };
}


/**
 * 업로드용 현장 접근 권한 확인
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 월 시트
 * @param {number} rowNumber 현장 행 번호
 * @param {string} role 권한
 * @param {string} partnerName 협력사명
 * @param {string} engineerName 엔지니어명
 * @returns {Object} 확인 결과
 */
function checkPartnerJobAccessWithoutLock_(sheet, rowNumber, role, partnerName, engineerName) {
  const customer = String(sheet.getRange(rowNumber, COL.CUSTOMER).getValue() || "").trim();
  const status = String(sheet.getRange(rowNumber, COL.STATUS).getValue() || "").trim();
  const currentPartner = String(sheet.getRange(rowNumber, COL.PARTNER).getValue() || "").trim();
  const currentEngineer = String(sheet.getRange(rowNumber, COL.INSTALLER).getValue() || "").trim();

  if (!customer) {
    return {
      success: false,
      message: "현장 정보를 찾을 수 없습니다."
    };
  }

  if (status === STATUS.DELETED) {
    return {
      success: false,
      message: "삭제된 현장은 처리할 수 없습니다."
    };
  }

  if (role === "partner" && partnerName && currentPartner !== partnerName) {
    return {
      success: false,
      message: "해당 협력사 현장이 아닙니다."
    };
  }

  if (role === "engineer" && engineerName && currentEngineer !== engineerName) {
    return {
      success: false,
      message: "배정된 시공엔지니어 현장이 아닙니다."
    };
  }

  return {
    success: true
  };
}


/**
 * 월 시트 행의 현장잠금 여부 확인
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 월 시트
 * @param {number} rowNumber 현장 행 번호
 * @returns {boolean} 잠금 여부
 */
function isPartnerJobLocked_(sheet, rowNumber) {
  if (!COL.EDIT_LOCKED) return false;

  const value = sheet.getRange(rowNumber, COL.EDIT_LOCKED).getValue();

  return isLockedValue_(value);
}


/**
 * 행 데이터에서 현장잠금 값 조회
 *
 * @param {Array} row 행 데이터
 * @returns {string} 잠금 값
 */
function getEditLockValueFromRow_(row) {
  if (!COL.EDIT_LOCKED) return "";

  return row[COL.EDIT_LOCKED - 1] || "";
}


/**
 * 잠금 값 판정
 *
 * @param {*} value 원본 값
 * @returns {boolean} 잠금 여부
 */
function isLockedValue_(value) {
  const text = String(value || "").trim().toUpperCase();

  return text === "Y" || text === "TRUE" || text === "잠금";
}


/**
 * 완료보고 전 필수 완료사진 등록 여부 확인
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 월 시트
 * @param {number} rowNumber 현장 행 번호
 * @returns {boolean} 완료사진 등록 여부
 */
function hasRequiredCompletionPhoto_(sheet, rowNumber) {
  const folderUrl = String(sheet.getRange(rowNumber, COL.FOLDER_URL).getValue() || "").trim();

  if (!folderUrl) return false;

  const photoInfo = getPhotoCategoryInfoByFolderUrl_(folderUrl);
  const completionCount = Number(photoInfo.counts && photoInfo.counts["완료사진"] || 0);

  return completionCount > 0;
}


/**
 * 협력사데이터 시트에서 엔지니어 연락처 조회
 *
 * @param {string} partnerName 협력사명
 * @param {string} engineerName 엔지니어명
 * @returns {string} 엔지니어 연락처
 */
function findEngineerPhone_(partnerName, engineerName) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("협력사데이터");

  if (!sheet) return "";

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const rowPartnerName = String(row[0] || "").trim();
    const rowEngineerName = String(row[1] || "").trim();
    const rowEngineerPhone = String(row[2] || "").trim();
    const enabled = String(row[9] || "").trim().toUpperCase();

    if (enabled !== "Y") continue;

    if (
      rowPartnerName === partnerName &&
      rowEngineerName === engineerName
    ) {
      return rowEngineerPhone;
    }
  }

  return "";
}


/**
 * API 응답용 날짜 포맷 변환
 *
 * @param {*} value 날짜 값
 * @returns {string} yyyy-MM-dd 형식 문자열
 */
function formatDateForApi_(value) {

  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(
      value,
      TIMEZONE,
      "yyyy-MM-dd"
    );
  }

  return String(value);
}

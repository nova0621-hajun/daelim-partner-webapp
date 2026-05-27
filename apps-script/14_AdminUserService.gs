/***************************************
 * 14_AdminUserService.gs
 * 시공관리 웹앱 계정 인증
 ***************************************/

/** 시공관리 계정 시트명 */
const ADMIN_USER_SHEET_NAME = "기초데이터";

/** 시공관리 계정 시트 컬럼 */
const ADMIN_USER_COL = {
  TEAM: 1,
  POSITION: 2,
  NAME: 3,
  EXTENSION: 4,
  PHONE: 5,
  PASSWORD: 6,
  ROLE: 7,
  ENABLED: 8,
  PASSWORD_STATUS: 9
};

/**
 * 계정 값을 문자열로 정리
 *
 * @param {*} value 원본 값
 * @returns {string} 앞뒤 공백 제거 문자열
 */
function adminUserText_(value) {
  return String(value || "").trim();
}

/**
 * 시공관리 계정 시트 조회
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 계정 시트
 */
function getAdminUserSheet_() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(ADMIN_USER_SHEET_NAME);

  if (!sheet) {
    throw new Error("기초데이터 시트를 찾을 수 없습니다.");
  }

  return sheet;
}

/**
 * 계정 승인 여부 확인
 *
 * @param {*} value 사용여부 값
 * @returns {boolean} 승인 여부
 */
function isAdminUserApproved_(value) {
  const enabled = adminUserText_(value);
  return enabled === "승인" || enabled.toUpperCase() === "Y";
}

/**
 * 시공관리 계정 인증
 *
 * 로그인 ID는 이름이고, 비밀번호는 숫자 4자리입니다.
 *
 * @param {string} loginName 로그인 이름
 * @param {string} loginPassword 로그인 비밀번호
 * @returns {Object} 인증 결과
 */
function verifyAdminUserCredentials_(loginName, loginPassword) {
  loginName = adminUserText_(loginName);
  loginPassword = adminUserText_(loginPassword);

  if (!loginName || !/^[0-9]{4}$/.test(loginPassword)) {
    return {
      success: false,
      message: "이름과 숫자 4자리 비밀번호를 입력해 주세요."
    };
  }

  const sheet = getAdminUserSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const name = adminUserText_(row[ADMIN_USER_COL.NAME - 1]);
    const password = adminUserText_(row[ADMIN_USER_COL.PASSWORD - 1]);

    if (name !== loginName) continue;

    if (!isAdminUserApproved_(row[ADMIN_USER_COL.ENABLED - 1])) {
      return {
        success: false,
        message: "승인되지 않았거나 중지된 계정입니다."
      };
    }

    if (password !== loginPassword) {
      return {
        success: false,
        message: "이름 또는 비밀번호가 일치하지 않습니다."
      };
    }

    sheet.getRange(i + 1, ADMIN_USER_COL.EXTENSION).setNote("lastLogin: " + new Date());

    return {
      success: true,
      name: name,
      team: adminUserText_(row[ADMIN_USER_COL.TEAM - 1]),
      position: adminUserText_(row[ADMIN_USER_COL.POSITION - 1]),
      phone: adminUserText_(row[ADMIN_USER_COL.PHONE - 1]),
      role: adminUserText_(row[ADMIN_USER_COL.ROLE - 1]) || "viewer",
      passwordStatus: adminUserText_(row[ADMIN_USER_COL.PASSWORD_STATUS - 1]) || "정상",
      loginTime: new Date(),
      message: "인증 성공"
    };
  }

  return {
    success: false,
    message: "이름 또는 비밀번호가 일치하지 않습니다."
  };
}

/**
 * 시공관리 웹앱 로그인
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 로그인 결과
 */
function adminLogin(body) {
  const result = verifyAdminUserCredentials_(body.name, body.password);

  if (result.success) {
    result.message = "로그인 성공";
  }

  return result;
}

/**
 * 시공관리 웹앱 계정 가입 요청
 *
 * 신규 계정은 viewer / 대기 / 임시 상태로 등록합니다.
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 가입 요청 결과
 */
function adminRegister(body) {
  const name = adminUserText_(body.name);
  const team = adminUserText_(body.team);
  const phone = adminUserText_(body.phone);
  const password = adminUserText_(body.password);

  if (!name || !team || !phone || !/^[0-9]{4}$/.test(password)) {
    return {
      success: false,
      message: "이름, 소속팀, 휴대전화, 숫자 4자리 비밀번호를 입력해 주세요."
    };
  }

  const sheet = getAdminUserSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (adminUserText_(values[i][ADMIN_USER_COL.NAME - 1]) === name) {
      return {
        success: false,
        message: "이미 등록된 이름입니다."
      };
    }
  }

  sheet.appendRow([
    team,
    "",
    name,
    "",
    phone,
    password,
    "viewer",
    "대기",
    "임시"
  ]);

  return {
    success: true,
    message: "가입 요청이 등록되었습니다. master 승인 후 로그인할 수 있습니다."
  };
}

/**
 * 시공관리 웹앱 비밀번호 변경
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 변경 결과
 */
function adminChangePassword(body) {
  const name = adminUserText_(body.name);
  const currentPassword = adminUserText_(body.currentPassword);
  const nextPassword = adminUserText_(body.nextPassword);

  if (!name || !/^[0-9]{4}$/.test(currentPassword) || !/^[0-9]{4}$/.test(nextPassword)) {
    return {
      success: false,
      message: "이름과 현재/새 숫자 4자리 비밀번호를 입력해 주세요."
    };
  }

  const sheet = getAdminUserSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    if (adminUserText_(row[ADMIN_USER_COL.NAME - 1]) !== name) continue;

    if (adminUserText_(row[ADMIN_USER_COL.PASSWORD - 1]) !== currentPassword) {
      return {
        success: false,
        message: "현재 비밀번호가 일치하지 않습니다."
      };
    }

    sheet.getRange(i + 1, ADMIN_USER_COL.PASSWORD).setValue(nextPassword);
    sheet.getRange(i + 1, ADMIN_USER_COL.PASSWORD_STATUS).setValue("정상");

    return {
      success: true,
      message: "비밀번호가 변경되었습니다."
    };
  }

  return {
    success: false,
    message: "계정을 찾을 수 없습니다."
  };
}

/**
 * 마스터 권한 확인
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 확인 결과
 */
function verifyAdminMasterForAccount_(body) {
  const masterPassword = adminUserText_(body.masterPassword);

  if (masterPassword) {
    const masterAuth = checkAdminPassword({
      parameter: {
        masterPassword: masterPassword
      }
    });

    if (masterAuth.success) {
      return {
        success: true,
        role: "master",
        name: "master"
      };
    }
  }

  const userAuth = verifyAdminUserCredentials_(body.userName, body.userPassword);

  if (userAuth.success && userAuth.role === "master") {
    return userAuth;
  }

  return {
    success: false,
    message: "master 권한이 없습니다."
  };
}

/**
 * 계정 행을 API 응답 데이터로 변환
 *
 * @param {Array} row 시트 행
 * @param {number} rowNumber 행 번호
 * @returns {Object} 계정 데이터
 */
function adminAccountRowToApi_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    team: adminUserText_(row[ADMIN_USER_COL.TEAM - 1]),
    position: adminUserText_(row[ADMIN_USER_COL.POSITION - 1]),
    name: adminUserText_(row[ADMIN_USER_COL.NAME - 1]),
    extension: adminUserText_(row[ADMIN_USER_COL.EXTENSION - 1]),
    phone: adminUserText_(row[ADMIN_USER_COL.PHONE - 1]),
    role: adminUserText_(row[ADMIN_USER_COL.ROLE - 1]) || "viewer",
    enabled: adminUserText_(row[ADMIN_USER_COL.ENABLED - 1]) || "대기",
    passwordStatus: adminUserText_(row[ADMIN_USER_COL.PASSWORD_STATUS - 1]) || "임시"
  };
}

/**
 * master 전용 계정 목록 조회
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 계정 목록
 */
function getAdminAccounts(body) {
  const auth = verifyAdminMasterForAccount_(body);

  if (!auth.success) {
    return auth;
  }

  const sheet = getAdminUserSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const name = adminUserText_(row[ADMIN_USER_COL.NAME - 1]);

    if (!name) continue;

    rows.push(adminAccountRowToApi_(row, i + 1));
  }

  return {
    success: true,
    rows: rows
  };
}

/**
 * master 전용 계정 승인/중지/권한 변경
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 변경 결과
 */
function adminUpdateAccount(body) {
  const auth = verifyAdminMasterForAccount_(body);

  if (!auth.success) {
    return auth;
  }

  const rowNumber = Number(body.rowNumber);
  const role = adminUserText_(body.role);
  const enabled = adminUserText_(body.enabled);
  const team = adminUserText_(body.team);
  const position = adminUserText_(body.position);

  const allowedRoles = ["master", "team1_leader", "team2_leader", "sales", "viewer"];
  const allowedEnabled = ["승인", "대기", "중지"];

  if (!rowNumber || rowNumber < 2) {
    return {
      success: false,
      message: "행 번호가 올바르지 않습니다."
    };
  }

  if (role && allowedRoles.indexOf(role) === -1) {
    return {
      success: false,
      message: "지원하지 않는 권한입니다."
    };
  }

  if (enabled && allowedEnabled.indexOf(enabled) === -1) {
    return {
      success: false,
      message: "지원하지 않는 사용여부 값입니다."
    };
  }

  const sheet = getAdminUserSheet_();

  if (team) sheet.getRange(rowNumber, ADMIN_USER_COL.TEAM).setValue(team);
  sheet.getRange(rowNumber, ADMIN_USER_COL.POSITION).setValue(position);
  if (role) sheet.getRange(rowNumber, ADMIN_USER_COL.ROLE).setValue(role);
  if (enabled) sheet.getRange(rowNumber, ADMIN_USER_COL.ENABLED).setValue(enabled);

  SpreadsheetApp.flush();

  const row = sheet
    .getRange(rowNumber, 1, 1, ADMIN_USER_COL.PASSWORD_STATUS)
    .getValues()[0];

  return {
    success: true,
    account: adminAccountRowToApi_(row, rowNumber),
    message: "계정 정보가 저장되었습니다."
  };
}

/**
 * master 전용 비밀번호 초기화
 *
 * @param {Object} body 요청 데이터
 * @returns {Object} 초기화 결과
 */
function adminResetPassword(body) {
  const auth = verifyAdminMasterForAccount_(body);

  if (!auth.success) {
    return auth;
  }

  const rowNumber = Number(body.rowNumber);
  const nextPassword = adminUserText_(body.nextPassword);

  if (!rowNumber || rowNumber < 2) {
    return {
      success: false,
      message: "행 번호가 올바르지 않습니다."
    };
  }

  if (!/^[0-9]{4}$/.test(nextPassword)) {
    return {
      success: false,
      message: "초기화 비밀번호는 숫자 4자리여야 합니다."
    };
  }

  const sheet = getAdminUserSheet_();
  sheet.getRange(rowNumber, ADMIN_USER_COL.PASSWORD).setValue(nextPassword);
  sheet.getRange(rowNumber, ADMIN_USER_COL.PASSWORD_STATUS).setValue("임시");

  SpreadsheetApp.flush();

  const row = sheet
    .getRange(rowNumber, 1, 1, ADMIN_USER_COL.PASSWORD_STATUS)
    .getValues()[0];

  return {
    success: true,
    account: adminAccountRowToApi_(row, rowNumber),
    message: "비밀번호가 초기화되었습니다."
  };
}

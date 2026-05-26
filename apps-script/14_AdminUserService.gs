/***************************************
 * 14_AdminUserService.gs
 * Admin webapp account authentication
 ***************************************/

/** Admin account sheet name */
const ADMIN_USER_SHEET_NAME = "기초데이터";

/** Admin account sheet columns */
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
 * Normalize account text.
 *
 * @param {*} value Raw value
 * @returns {string} Trimmed text
 */
function adminUserText_(value) {
  return String(value || "").trim();
}

/**
 * Get admin user sheet.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} User sheet
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
 * Check whether account is approved.
 *
 * @param {*} value Enabled value
 * @returns {boolean} Approved status
 */
function isAdminUserApproved_(value) {
  const enabled = adminUserText_(value);
  return enabled === "승인" || enabled.toUpperCase() === "Y";
}

/**
 * Login to admin webapp.
 *
 * Login ID is the user name.
 * Password is a 4-digit number.
 *
 * @param {Object} body Request body
 * @returns {Object} Login result
 */
function adminLogin(body) {
  const loginName = adminUserText_(body.name);
  const loginPassword = adminUserText_(body.password);

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
      message: "로그인 성공"
    };
  }

  return {
    success: false,
    message: "이름 또는 비밀번호가 일치하지 않습니다."
  };
}

/**
 * Request admin webapp account registration.
 *
 * New accounts are appended as viewer / 대기 / 임시.
 *
 * @param {Object} body Request body
 * @returns {Object} Registration result
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
 * Change admin webapp password.
 *
 * @param {Object} body Request body
 * @returns {Object} Change result
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

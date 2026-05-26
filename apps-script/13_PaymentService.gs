/***************************************
 * 13_PaymentService.gs
 * Contract / partner payment settlement API
 ***************************************/

/** Contract construction fee: column I */
const CONTRACT_PAYMENT_COLUMN = 9;

/** Partner payment fee: column T */
const PARTNER_PAYMENT_ADMIN_COLUMN = 20;

/**
 * Verify master password.
 *
 * @param {string} masterPassword Master password
 * @returns {Object} Verification result
 */
function verifyPaymentMaster_(masterPassword) {
  return checkAdminPassword({
    parameter: {
      masterPassword: String(masterPassword || "").trim()
    }
  });
}

/**
 * Normalize payment amount for sheet storage.
 *
 * @param {*} value Raw amount
 * @returns {number|string} Amount to save
 */
function normalizePaymentAmount_(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return "";

  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    throw new Error("Payment amount must be numeric.");
  }

  return amount;
}

/**
 * Get target month sheet.
 *
 * @param {string} month Month sheet name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Month sheet
 */
function getPaymentMonthSheet_(month) {
  const sheetName = String(month || "").trim();
  if (!sheetName) {
    throw new Error("Month is required.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(sheetName + " sheet was not found.");
  }

  return sheet;
}

/**
 * Master-only payment snapshot.
 *
 * Contract construction fee uses column I.
 * Partner payment fee uses column T.
 *
 * @param {Object} body Request body
 * @returns {Object} Payment snapshot
 */
function getPaymentSnapshot(body) {
  const auth = verifyPaymentMaster_(body.masterPassword);
  if (!auth.success) {
    return {
      success: false,
      message: "Master password does not match."
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

  const rows = values.map(function(row, index) {
    return {
      rowNumber: DATA_START_ROW + index,
      contractPrice: row[CONTRACT_PAYMENT_COLUMN - 1] || "",
      partnerPaymentAmount: row[PARTNER_PAYMENT_ADMIN_COLUMN - 1] || ""
    };
  });

  return {
    success: true,
    rows: rows
  };
}

/**
 * Save master-decided partner payment fee.
 *
 * Partner payment fee is saved to column T.
 *
 * @param {Object} body Request body
 * @returns {Object} Save result
 */
function savePartnerPayment(body) {
  const auth = verifyPaymentMaster_(body.masterPassword);
  if (!auth.success) {
    return {
      success: false,
      message: "Master password does not match."
    };
  }

  const rowNumber = Number(body.rowNumber);
  if (!rowNumber || rowNumber < DATA_START_ROW) {
    return {
      success: false,
      message: "Invalid row number."
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
    message: "Partner payment fee was saved."
  };
}

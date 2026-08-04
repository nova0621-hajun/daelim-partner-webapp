export const PARTNER_PAYMENT_CSV_HEADERS = [
  "월",
  "시공일",
  "고객명",
  "현장주소",
  "담당자",
  "시공기사",
  "주방 지급",
  "붙박이 지급",
  "현관 지급",
  "추가 지급",
  "추가 지급비용 내용",
  "실지급시공비",
  "상태",
];

function safeCsvValue(value) {
  if (value == null) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";

  const text = String(value);
  // Excel에서 사용자 입력이 수식으로 실행되지 않도록 문자열 셀을 보호합니다.
  if (typeof value === "string" && /^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

export function csvEscape(value) {
  return `"${safeCsvValue(value).replace(/"/g, '""')}"`;
}

export function buildPartnerPaymentCsv(rows = []) {
  const csvRows = rows.map((row) => [
    row.month,
    row.installDate,
    row.customerName,
    row.siteAddress,
    row.salesManagerName,
    row.engineerName,
    row.kitchenPayment,
    row.storagePayment,
    row.entrancePayment,
    row.extraPayment,
    row.extraPaymentMemo,
    row.totalPayment,
    row.status,
  ]);

  return `\uFEFF${[PARTNER_PAYMENT_CSV_HEADERS, ...csvRows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n")}`;
}

export function sanitizeCsvFileNamePart(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim() || "협력사";
}

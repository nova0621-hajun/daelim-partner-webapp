export function onlyDigits(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

export function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function numberValue(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

export function formatMoney(value) {
  const amount = numberValue(value);
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function parseJobDate(value) {
  if (!value) return null;
  const text = String(value).trim().replace(/\./g, "-");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

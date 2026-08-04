import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARTNER_PAYMENT_CSV_HEADERS,
  buildPartnerPaymentCsv,
  sanitizeCsvFileNamePart,
} from "../src/utils/partnerPaymentCsv.js";
import { formatCompanionEngineerNames } from "../src/utils/companionEngineerNames.js";

assert.equal(PARTNER_PAYMENT_CSV_HEADERS.length, 14);
assert.deepEqual(PARTNER_PAYMENT_CSV_HEADERS, [
  "월", "시공일", "고객명", "현장주소", "담당자", "시공기사", "동행기사", "주방 지급",
  "붙박이 지급", "현관 지급", "추가 지급", "추가 지급비용 내용", "실지급시공비", "상태",
]);
assert.equal(formatCompanionEngineerNames([], "기사"), "");
assert.equal(formatCompanionEngineerNames([{ engineerName: "동행 1", status: "active" }], "기사"), "동행 1");
assert.equal(formatCompanionEngineerNames([
  { companionId: "MAIN", engineerName: "기사", status: "active" },
  { companionId: "ONE", engineerName: " 동행 1 ", status: "active" },
  { companionId: "TWO", engineerName: "동행 1", status: "active" },
  { companionId: "THREE", engineerName: "동행 2", status: "active" },
  { companionId: "REMOVED", engineerName: "해제 기사", status: "removed" },
], "기사"), "동행 1, 동행 2");

const csv = buildPartnerPaymentCsv([{
  month: "26.08",
  installDate: "2026-08-03",
  customerName: "=위험",
  siteAddress: "서울, 강남\n101호",
  salesManagerName: "담당자",
  engineerName: "기사",
  companionEngineerNames: " 동행 1, 동행 2, 동행 1 ",
  kitchenPayment: 10,
  storagePayment: 20,
  entrancePayment: null,
  extraPayment: Number.NaN,
  extraPaymentMemo: "따옴표 \"확인\"",
  totalPayment: 30,
  status: "시공완료",
}]);

assert.equal(csv.charCodeAt(0), 0xFEFF);
assert.match(csv, /"서울, 강남\n101호"/);
assert.match(csv, /"따옴표 ""확인"""/);
assert.match(csv, /"동행 1, 동행 2"/);
assert.match(csv, /"'=위험"/);
assert.ok(!csv.includes("null"));
assert.ok(!csv.includes("NaN"));
assert.equal(csv.trimEnd().split("\r\n")[1].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length, 14);
assert.equal(sanitizeCsvFileNamePart('협력/사:*?"<>|'), "협력_사_______");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
assert.match(appSource, /user\.role === "partner"[\s\S]*?CSV 다운로드/);
assert.doesNotMatch(appSource, /user\.role === "engineer"[\s\S]{0,300}?CSV 다운로드/);
assert.match(appSource, /action: "getPartnerPaymentCsvData"/);
assert.match(appSource, /sessionToken: String\(user\?\.sessionToken/);

console.log("partner payment CSV frontend tests passed");

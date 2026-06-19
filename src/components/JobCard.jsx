import { Loader2 } from "lucide-react";
import { formatMoney, numberValue } from "../utils/partnerUtils";

const STATUS_CLASS = {
  기사배정요청: "border-amber-200 bg-amber-50 text-amber-700",
  기사배정완료: "border-blue-200 bg-blue-50 text-blue-700",
  시공계획확정: "border-lime-200 bg-lime-50 text-lime-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  시공완료: "border-emerald-700 bg-emerald-600 text-white",
};

const REFINISHING_FIELD_KEYS = [
  "item",
  "itemName",
  "itemType",
  "productItem",
  "jobItem",
  "orderItem",
  "workItem",
  "constructionItem",
  "constructionType",
  "category",
  "product",
  "productName",
  "type",
];

function Badge({ children, className = "" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black leading-none ${className}`}>{children}</span>;
}

function Info({ label, value }) {
  return <div><p className="text-[11px] font-black text-slate-400">{label}</p><p className="mt-1 font-black text-slate-700">{value || "-"}</p></div>;
}

function normalizeRefinishingText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
}

function isRefinishingItem(value) {
  const text = normalizeRefinishingText(value);
  return text === "재마감" || text.includes("재마감");
}

function getRefinishingFieldValues(job) {
  if (!job || typeof job !== "object") return [];
  return REFINISHING_FIELD_KEYS.map((key) => job[key]).filter((value) => value != null && value !== "");
}

function isRefinishingJob(job) {
  return getRefinishingFieldValues(job).some(isRefinishingItem);
}

function RefinishingBadge() {
  return <Badge className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">재마감</Badge>;
}

function shortDate(value) {
  if (!value) return "-";
  const [yyyy, mm, dd] = String(value).split("-");
  return `${yyyy}.${mm}.${dd}`;
}

function installPeriod(job) {
  if (!job.installDate) return "-";
  if (!job.endDate || job.installDate === job.endDate) return shortDate(job.installDate);
  return `${shortDate(job.installDate)} ~ ${shortDate(job.endDate)}`;
}

function isJobLocked(job) {
  if (!job) return false;
  const lockValue = String(job.editLock || job.editLocked || job.locked || "").trim().toUpperCase();
  return job.editLocked === true || job.locked === true || lockValue === "Y" || lockValue === "TRUE";
}

function activeCompanions(job) {
  if (!Array.isArray(job?.companions)) return [];

  return job.companions.filter((companion) => (
    companion &&
    String(companion.status || "").trim().toLowerCase() === "active"
  ));
}

function completionPhotoCount(job) {
  const counts = job?.photoCounts || {};
  return (
    Number(counts?.완료사진 || 0) +
    Number(counts?.시공후 || 0) +
    Number(counts?.complete || 0) +
    Number(counts?.completion || 0) +
    Number(counts?.after || 0)
  );
}

function hasCompletionPhoto(job) {
  return completionPhotoCount(job) > 0;
}

function partnerPaymentAmount(job) {
  const splitTotal =
    numberValue(job?.kitchenPaymentAmount) +
    numberValue(job?.builtInPaymentAmount ?? job?.storagePaymentAmount) +
    numberValue(job?.entrancePaymentAmount) +
    numberValue(job?.extraPaymentAmount);

  return splitTotal || numberValue(job?.partnerPaymentAmount || job?.paymentAmount || job?.installPayment || job?.contractPrice);
}

function isUnassignedEngineerValue(value) {
  const text = String(value || "").trim();
  return !text || text === "\uBBF8\uBC30\uC815" || text.includes("\uBBF8\uBC30\uC815");
}

export default function JobCard({ job, user, onDetail, onUpload, onHistory, onComplete, completing = false }) {
  const isComplete = job.status === "시공완료";
  const locked = isJobLocked(job);
  const completePhotoReady = hasCompletionPhoto(job);
  const needsEngineer = user.role === "partner" && (isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청");
  const companions = activeCompanions(job);

  return (
    <article className="rounded-3xl border bg-white p-3 shadow-sm md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{job.customer}</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{job.address}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {locked ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">잠금</Badge> : null}
          <Badge className={STATUS_CLASS[job.status] || "border-slate-200 bg-slate-100 text-slate-600"}>{job.status}</Badge>
          {needsEngineer ? <Badge className="border-amber-300 bg-amber-50 text-amber-700">시공기사 미배정</Badge> : null}
          {isRefinishingJob(job) ? <RefinishingBadge /> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2.5 text-sm md:mt-4 md:p-3">
        <Info label="시공일" value={installPeriod(job)} />
        <Info label="아이템" value={job.item} />
        <Info label="담당자" value={job.manager} />
        <Info label="기사" value={isUnassignedEngineerValue(job.engineer) ? "미배정" : job.engineer} />
        {user.role === "partner" ? <Info label="지급시공비" value={formatMoney(partnerPaymentAmount(job))} /> : null}
      </div>

      {companions.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {companions.map((companion) => (
            <Badge key={companion.companionId || `${companion.engineerName}-${companion.engineerPhone}`} className="border-violet-200 bg-violet-50 text-violet-700">
              동행 {companion.engineerName}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 md:mt-4 md:grid-cols-4">
        <button onClick={onDetail} className="rounded-2xl bg-slate-900 px-3 py-3 text-xs font-black text-white">상세보기</button>
        <button onClick={onUpload} disabled={locked} className="rounded-2xl border bg-white px-3 py-3 text-xs font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">사진등록</button>
        <button onClick={onHistory} disabled={locked} className="rounded-2xl border bg-white px-3 py-3 text-xs font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">이력등록</button>
        <button onClick={onComplete} disabled={locked || !completePhotoReady || completing || isComplete} className="flex items-center justify-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700 disabled:opacity-50">
          {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {locked ? "잠금" : isComplete ? "완료됨" : !completePhotoReady ? "사진필요" : completing ? "저장중" : "완료보고"}
        </button>
      </div>

      {locked ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">관리자가 잠근 현장입니다. 상세보기와 주소 확인만 가능합니다.</div>
      ) : null}

      {needsEngineer ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">시공기사 배정이 필요한 현장입니다.</div>
      ) : null}

      {!isComplete && !completePhotoReady && !locked ? (
        <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs font-bold text-orange-700">완료보고 전 완료사진 1장 이상 등록이 필요합니다.</div>
      ) : null}
    </article>
  );
}

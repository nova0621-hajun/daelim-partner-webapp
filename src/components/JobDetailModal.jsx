import { useEffect, useState } from "react";
import { Copy, Loader2, MapPin, Phone, Upload, X } from "lucide-react";
import { formatMoney, formatPhone, numberValue, onlyDigits } from "../utils/partnerUtils";

const STATUS_CLASS = {
  기사배정요청: "border-amber-200 bg-amber-50 text-amber-700",
  기사배정완료: "border-blue-200 bg-blue-50 text-blue-700",
  시공계획확정: "border-lime-200 bg-lime-50 text-lime-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  시공완료: "border-emerald-700 bg-emerald-600 text-white",
};

const PHOTO_CATEGORY_OPTIONS = ["계약도면", "시공전", "완료사진", "기타"];

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
  return job.companions.filter((item) => item && String(item.status || "").toLowerCase() === "active");
}

function normalizeEngineerName(value) {
  return String(value || "").trim();
}

function completionPhotoCount(job) {
  const counts = job?.photoCounts || {};
  return Number(counts?.완료사진 || 0) || 0;
}

function hasCompletionPhoto(job) {
  return completionPhotoCount(job) > 0;
}

function partnerPaymentAmount(job) {
  return (
    numberValue(job?.actualPayment) ||
    numberValue(job?.paidCost) ||
    numberValue(job?.partnerPayment) ||
    numberValue(job?.realPayment) ||
    numberValue(job?.paymentAmount)
  );
}

function isUnassignedEngineerValue(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return text === "기사배정요청" || text === "미배정" || text === "-";
}

function DetailBox({ title, children, className = "" }) {
  return <section className={`rounded-3xl border bg-white p-4 shadow-sm ${className}`}><h3 className="font-black">{title}</h3><div className="mt-3 space-y-3">{children}</div></section>;
}

function DetailRow({ label, value }) {
  return <div className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-b-0"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-black text-slate-800">{value || "-"}</span></div>;
}

function PhoneLink({ value }) {
  const phone = formatPhone(value || "");
  if (!phone) return <span>-</span>;
  return <a href={`tel:${onlyDigits(phone)}`} className="font-black text-blue-700 underline decoration-blue-300 underline-offset-2"><Phone className="mr-1 inline h-3.5 w-3.5" />{phone}</a>;
}

export default function JobDetailModal({ job, user, onClose, onUpload, onHistory, onAssign, onAddCompanion, onRemoveCompanion, engineerOptions = [], assigning = false, companionSaving = false, completing = false, actionMessage = "", onComplete, onCopyAddress, addressCopied = false, onPhotoView }) {
  const [engineer, setInstaller] = useState(isUnassignedEngineerValue(job.engineer) ? "" : job.engineer || "");
  const [selectedCompanionEngineers, setSelectedCompanionEngineers] = useState([]);
  const [selectedRemoveCompanionIds, setSelectedRemoveCompanionIds] = useState([]);

  useEffect(() => {
    setInstaller(isUnassignedEngineerValue(job.engineer) ? "" : job.engineer || "");
    setSelectedCompanionEngineers([]);
    setSelectedRemoveCompanionIds([]);
  }, [job.engineer, job.rowNumber, job.month]);

  const engineerNames = engineerOptions.map((item) => item.name);
  const isComplete = job.status === "시공완료";
  const locked = isJobLocked(job);
  const completePhotoReady = hasCompletionPhoto(job);
  const canAssignEngineer = user.role === "partner";
  const companions = activeCompanions(job);
  const companionNames = companions.map((companion) => normalizeEngineerName(companion.engineerName));
  const mainEngineerName = normalizeEngineerName(job.engineer);
  const companionOptions = engineerOptions.filter((item) => {
    const name = normalizeEngineerName(item.name);
    if (!name) return false;
    if (name === mainEngineerName) return false;
    return !companionNames.includes(name);
  });
  const toggleCompanionEngineer = (name) => {
    const normalizedName = normalizeEngineerName(name);
    if (!normalizedName) return;
    setSelectedCompanionEngineers((current) => (
      current.includes(normalizedName)
        ? current.filter((item) => item !== normalizedName)
        : [...current, normalizedName]
    ));
  };
  const companionKey = (companion) => companion.companionId || `${companion.engineerName || ""}-${companion.engineerPhone || ""}`;
  const toggleRemoveCompanion = (companion) => {
    const key = companionKey(companion);
    if (!key) return;
    setSelectedRemoveCompanionIds((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  };
  const selectedRemoveCompanions = companions.filter((companion) => selectedRemoveCompanionIds.includes(companionKey(companion)));

  const renderPaymentInfoSection = () => (
    <>
            {user.role === "partner" ? <DetailRow label="지급시공비" value={formatMoney(partnerPaymentAmount(job))} /> : null}
            {user.role === "partner" && job.extraPaymentMemo ? <DetailRow label="지급 추가비용 내용" value={job.extraPaymentMemo} /> : null}

    </>
  );

  const renderEngineerAssignSection = () => (
        canAssignEngineer ? (
          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="font-black text-blue-900">시공기사 배정</h3>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <select value={engineer} onChange={(e) => setInstaller(e.target.value)} disabled={locked || assigning} className="rounded-2xl border bg-white px-3 py-3 text-sm font-bold disabled:opacity-60">
                <option value="">시공기사 선택</option>
                {engineerNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button onClick={() => engineer && onAssign(job, engineer)} disabled={locked || !engineer || assigning} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:bg-blue-300">
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {locked ? "잠금" : assigning ? "저장 중" : "배정"}
              </button>
            </div>
          </div>
        ) : null
  );

  const renderCompanionSection = () => (
        <DetailBox title="동행기사" className="mt-4">
          {companions.length ? (
            <div className="space-y-2">
              {companions.map((companion) => {
                const key = companionKey(companion);
                const checked = selectedRemoveCompanionIds.includes(key);

                return (
                  <label key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      {user.role === "partner" ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRemoveCompanion(companion)}
                          disabled={locked || companionSaving}
                          className="h-4 w-4 rounded border-violet-300 text-violet-600"
                        />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block font-black text-violet-900">{companion.engineerName}</span>
                        <span className="block text-xs font-bold text-violet-600"><PhoneLink value={companion.engineerPhone} /></span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">동행기사 없음</p>
          )}

          {user.role === "partner" ? (
            <div className="mt-3 space-y-3">
              {companions.length ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedRemoveCompanions.length) return;
                    await onRemoveCompanion?.(job, selectedRemoveCompanions);
                    setSelectedRemoveCompanionIds([]);
                  }}
                  disabled={locked || companionSaving || !selectedRemoveCompanions.length}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700 disabled:opacity-50"
                >
                  {companionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {companionSaving ? "처리중" : "선택한 동행기사 해제"}
                </button>
              ) : null}

              <div className="rounded-2xl border border-violet-100 bg-white p-3">
                <p className="text-xs font-black text-violet-700">동행기사 추가</p>
                {companionOptions.length ? (
                  <div className="mt-2 grid gap-2">
                    {companionOptions.map((item) => {
                      const name = normalizeEngineerName(item.name);
                      const checked = selectedCompanionEngineers.includes(name);

                      return (
                        <label key={name} className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-bold text-violet-900">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCompanionEngineer(name)}
                            disabled={locked || companionSaving}
                            className="h-4 w-4 rounded border-violet-300 text-violet-600"
                          />
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          {item.phone ? <span className="text-xs text-violet-500">{item.phone}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">추가 가능한 동행기사가 없습니다.</p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedCompanionEngineers.length) return;
                    await onAddCompanion?.(job, selectedCompanionEngineers);
                    setSelectedCompanionEngineers([]);
                  }}
                  disabled={locked || companionSaving || !selectedCompanionEngineers.length}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:bg-violet-300"
                >
                  {companionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {companionSaving ? "처리중" : "선택한 동행기사 추가"}
                </button>
              </div>
            </div>
          ) : null}
        </DetailBox>
  );

  const renderHistorySection = () => (
        <DetailBox title="현장 메모 / 중요 이력" className="mt-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{job.siteMemo || "메모 없음"}</div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-900 whitespace-pre-wrap">{job.history || "중요 이력 없음"}</div>
        </DetailBox>
  );

  const renderPhotoSection = () => (
        <DetailBox title="사진 / 도면" className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {PHOTO_CATEGORY_OPTIONS.map((category) => {
              const count = job.photoCounts?.[category] || 0;

              return (
                <button key={category} type="button" onClick={() => onPhotoView?.(category)} className="rounded-2xl border bg-slate-50 p-3 text-center text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                  <p>{category}</p>
                  <p className="mt-1 text-sm text-slate-900">{count}{"\uAC1C"}</p>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onPhotoView?.("\uC804\uCCB4")} className="mt-3 flex w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{"\uC0AC\uC9C4\uBCF4\uAE30"}</button>
          <button onClick={onUpload} disabled={locked} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300"><Upload className="h-4 w-4" /> {locked ? "잠금" : "사진등록"}</button>
        </DetailBox>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{job.customer}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {locked ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">관리자 잠금</Badge> : null}
              <Badge className={STATUS_CLASS[job.status] || "border-slate-200 bg-slate-100 text-slate-600"}>{job.status}</Badge>
              {user.role === "partner" && (isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청") ? (
                <Badge className="border-amber-300 bg-amber-50 text-amber-700">시공기사 미배정</Badge>
              ) : null}
              {isRefinishingJob(job) ? <RefinishingBadge /> : <Badge className="border-slate-200 bg-slate-50 text-slate-600">{job.item}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="min-w-0 flex-1 text-sm font-bold leading-relaxed text-slate-700">{job.address}</p>
          </div>
          <button onClick={() => onCopyAddress(job)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-3 text-xs font-black text-slate-700">
            <Copy className="h-4 w-4" /> {addressCopied ? "복사됨" : "주소복사"}
          </button>
        </div>

        {locked || (!isComplete && !completePhotoReady) ? (
          <div className={`mt-4 rounded-3xl border p-4 text-sm font-bold leading-relaxed ${locked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}>
            {locked
              ? "마스터가 잠금 처리한 현장입니다. 잠금 해제 전까지 사진등록, 이력등록, 완료보고, 시공기사 배정을 사용할 수 없습니다."
              : "완료보고 전 완료사진 1장 이상 등록이 필요합니다."}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailBox title="기본 정보">
            <DetailRow label="담당자" value={job.manager} />
            <DetailRow label="담당자 연락처" value={<PhoneLink value={job.managerPhone} />} />
            <DetailRow label="고객 연락처" value={<PhoneLink value={job.phone} />} />
            <DetailRow label="계약/발주" value={job.orderStatus} />
            <DetailRow label="거주여부" value={job.living} />
            <DetailRow label="조립출고" value={job.assembly} />
          </DetailBox>

          <DetailBox title="시공 정보">
            <DetailRow label="시공기간" value={installPeriod(job)} />
            <DetailRow label="대리석" value={shortDate(job.stoneDate)} />
            <DetailRow label="협력사" value={job.partner} />
            <DetailRow label="시공기사" value={isUnassignedEngineerValue(job.engineer) ? "미배정" : job.engineer} />
            <DetailRow label="시공기사 연락처" value={<PhoneLink value={job.engineerPhone} />} />
            {renderPaymentInfoSection()}
          </DetailBox>
        </div>

        {renderEngineerAssignSection()}

        {renderCompanionSection()}

        {renderHistorySection()}

        {renderPhotoSection()}

        {actionMessage ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{actionMessage}</div> : null}

        <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 border-t bg-white/95 px-5 py-4 backdrop-blur">
          <button onClick={onHistory} disabled={locked} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:bg-slate-100 disabled:text-slate-400">이력등록</button>
          <button onClick={() => onComplete(job)} disabled={locked || !completePhotoReady || completing || isComplete} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:bg-emerald-300">
            {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {locked ? "잠금" : isComplete ? "완료됨" : !completePhotoReady ? "사진필요" : completing ? "저장 중" : "완료보고"}
          </button>
        </div>
      </div>
    </div>
  );
}

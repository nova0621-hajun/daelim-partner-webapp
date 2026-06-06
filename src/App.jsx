import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzunWIU75WOPAnZLS9MGqgLLJ9-P4P1f59gNpggLcWcEGs_P0NArHOLdKNwwPQGekMewg/exec";
const SESSION_STORAGE_KEY = "daelimPartnerPortalUser";
const SESSION_TTL = 1000 * 60 * 60 * 8;

function readPartnerSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const savedAt = parsed.savedAt || 0;
    const user = parsed.user || parsed;

    if (!user?.role || !user?.name) return null;

    if (savedAt && Date.now() - savedAt > SESSION_TTL) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return {
      user,
      authPassword: parsed.authPassword || user.currentPassword || "",
    };
  } catch (err) {
    return null;
  }
}

function writePartnerSession(user, authPassword) {
  try {
    const cleanUser = { ...user };
    delete cleanUser.currentPassword;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      user: cleanUser,
      authPassword,
    }));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {}
}

function clearPartnerSession() {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {}
}

const STATUS_CLASS = {
  기사배정요청: "border-amber-200 bg-amber-50 text-amber-700",
  기사배정완료: "border-blue-200 bg-blue-50 text-blue-700",
  시공계획확정: "border-lime-200 bg-lime-50 text-lime-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  시공완료: "border-emerald-700 bg-emerald-600 text-white",
};

const PHOTO_CATEGORY_OPTIONS = ["계약도면", "시공전", "완료사진", "기타"];
const PHOTO_UPLOAD_ACCEPT = ".jpg,.jpeg,.jfif,.png,.webp,.heic,.heif,.gif,.bmp,.tif,.tiff,.avif";
const DRAWING_UPLOAD_ACCEPT = `${PHOTO_UPLOAD_ACCEPT},.pdf`;
const JOB_PAGE_SIZE = 15;

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

function calendarDebugRow(job) {
  return REFINISHING_FIELD_KEYS.reduce(
    (acc, key) => {
      if (job?.[key] != null && job?.[key] !== "") acc[key] = job[key];
      return acc;
    },
    {
      month: job?.month,
      rowNumber: job?.rowNumber,
      customer: job?.customer,
      installDate: job?.installDate,
      remakeDetected: isRefinishingJob(job),
    },
  );
}

function RefinishingBadge() {
  return <Badge className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">재마감</Badge>;
}
function getUploadAccept(category) {
  return category === "계약도면" ? DRAWING_UPLOAD_ACCEPT : PHOTO_UPLOAD_ACCEPT;
}

function parseApiJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const preview = String(text || "").slice(0, 180);
    throw new Error(`API response parse failed: ${preview}`);
  }
}

function r2Now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

function r2Elapsed(start) {
  return Math.round(r2Now() - start);
}

function logR2Timing(scope, step, start, extra = {}) {
  console.info(`[${scope}] ${step}`, { ms: r2Elapsed(start), ...extra });
}

function logPartnerLoginTiming(step, start, extra = {}) {
  console.info(`[partner-login] ${step}`, start ? { ms: r2Elapsed(start), ...extra } : extra);
}

function getCurrentPortalMonth() {
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}.${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizePhotoCategory(value) {
  const text = String(value || "").trim();
  if (text === "\uC2DC\uACF5\uD6C4") return "\uC644\uB8CC\uC0AC\uC9C4";
  return PHOTO_CATEGORY_OPTIONS.includes(text) ? text : "\uAE30\uD0C0";
}

function readR2WorkerSecret() {
  return "";
}

function writeR2WorkerSecret() {}

async function callR2WorkerApi(path, payload = {}) {
  const action = path === "/presignUpload"
    ? "presignR2Upload"
    : path === "/presignView"
      ? "presignR2View"
      : "";

  if (!action) {
    throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 R2 \uC694\uCCAD\uC785\uB2C8\uB2E4.");
  }

  const data = await apiPost({
    action,
    ...payload,
  });

  if (data.success !== true) {
    throw new Error(data.message || "R2 URL \uBC1C\uAE09\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  }

  return data;
}
function shouldCompressUploadImage(file, category) {
  const normalizedCategory = normalizePhotoCategory(category);
  if (normalizedCategory === "\uACC4\uC57D\uB3C4\uBA74") return false;
  if (!file?.type?.startsWith("image/")) return false;
  if (file.size <= SMALL_IMAGE_SKIP_COMPRESS_BYTES) return false;
  return true;
}

function compressImageFile(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith("image/")) { resolve(file); return; }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      if (file.size <= SMALL_IMAGE_SKIP_COMPRESS_BYTES || Math.max(image.width, image.height) <= maxWidth) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }
      const scale = Math.min(1, maxWidth / Math.max(image.width, image.height));
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    image.src = objectUrl;
  });
}

function onlyDigits(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function numberValue(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function formatMoney(value) {
  const amount = numberValue(value);
  return `${amount.toLocaleString("ko-KR")}원`;
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

function parseJobDate(value) {
  if (!value) return null;
  const text = String(value).trim().replace(/\./g, "-");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sortJobsByInstallDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const ad = parseJobDate(a.installDate);
    const bd = parseJobDate(b.installDate);

    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;

    return bd - ad;
  });
}

function isThisWeekJob(job) {
  const start = parseJobDate(job?.installDate);
  const end = parseJobDate(job?.endDate) || start;
  if (!start) return false;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return start <= weekEnd && end >= weekStart;
}

function isTodayJob(job) {
  const date = parseJobDate(job?.installDate);
  if (!date) return false;
  return toDateKey(date) === toDateKey(new Date());
}

function isPastOrTodayJob(job) {
  const date = parseJobDate(job?.installDate);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date <= today;
}

function jobKey(job) {
  if (!job) return "";
  return `${job.month || job.sheet || ""}-${job.rowNumber || job.id || job.jobId || ""}`;
}

function isJobLocked(job) {
  if (!job) return false;
  const lockValue = String(job.editLock || job.editLocked || job.locked || "").trim().toUpperCase();
  return job.editLocked === true || job.locked === true || lockValue === "Y" || lockValue === "TRUE";
}

function countPhotosByCategory(photos = []) {
  const counts = {};
  PHOTO_CATEGORY_OPTIONS.forEach((category) => {
    counts[category] = 0;
  });
  photos.forEach((photo) => {
    const category = normalizePhotoCategory(photo?.photoCategory);
    counts[category] = (counts[category] || 0) + 1;
  });
  return counts;
}
function completionPhotoCount(job) {
  return Number(job?.photoCounts?.완료사진 || 0);
}

function hasCompletionPhoto(job) {
  return completionPhotoCount(job) > 0;
}

function isEngineerPhotoNeededJob(job) {
  return job?.status !== "\uC2DC\uACF5\uC644\uB8CC" && isPastOrTodayJob(job) && !hasCompletionPhoto(job);
}

function isCompletionReportPendingJob(job) {
  return job?.status !== "\uC2DC\uACF5\uC644\uB8CC" && hasCompletionPhoto(job);
}

function filterEngineerDashboardJobs(rows, filter) {
  if (!filter || filter === "all") return rows;
  if (filter === "today") return rows.filter(isTodayJob);
  if (filter === "week") return rows.filter(isThisWeekJob);
  if (filter === "month") return rows;
  if (filter === "photoNeeded") return rows.filter(isEngineerPhotoNeededJob);
  if (filter === "completePending") return rows.filter(isCompletionReportPendingJob);
  if (filter === "complete") return rows.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC");
  return rows;
}

function partnerPaymentAmount(job) {
  const splitTotal =
    numberValue(job?.kitchenPaymentAmount) +
    numberValue(job?.builtInPaymentAmount ?? job?.storagePaymentAmount) +
    numberValue(job?.entrancePaymentAmount) +
    numberValue(job?.extraPaymentAmount);

  return splitTotal || numberValue(job?.partnerPaymentAmount || job?.paymentAmount || job?.installPayment || job?.contractPrice);
}

function monthPaymentTotal(rows) {
  return rows.reduce((sum, job) => sum + partnerPaymentAmount(job), 0);
}

function buildEngineerOptions(data, partnerName) {
  const installersByPartner = data?.installersByPartner || {};
  const phoneByInstaller = data?.phoneByInstaller || {};
  const names = installersByPartner[partnerName] || [];

  return names
    .map((name) => ({
      name: String(name || "").trim(),
      phone: String(phoneByInstaller[name] || "").trim(),
    }))
    .filter((engineer) => engineer.name);
}

async function apiPost(payload) {
  const response = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`API 응답 형식 오류: ${text.slice(0, 160)}`);
  }
}

function portalActor(user) {
  return String(
    user?.loginId ||
    user?.id ||
    user?.name ||
    user?.engineerName ||
    user?.partnerName ||
    "사용자",
  ).trim();
}

function isUnassignedEngineerValue(value) {
  const text = String(value || "").trim();
  return !text || text === "\uBBF8\uBC30\uC815" || text.includes("\uBBF8\uBC30\uC815");
}

function partnerAuthPayload(user, authPassword) {
  const loginId = String(user?.loginId || user?.id || user?.name || "").trim();
  const password = String(authPassword || user?.authPassword || "").trim();

  return {
    id: loginId,
    loginId,
    password,
    currentPassword: password,
    authPassword: password,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateUploadFiles(files, category) {
  const fileList = Array.from(files || []);
  const maxFiles = 15;
  const maxFileSize = 20 * 1024 * 1024;

  if (!fileList.length) return { ok: false, message: "첨부할 파일을 선택해 주세요." };
  if (fileList.length > maxFiles) return { ok: false, message: `한 번에 최대 ${maxFiles}개까지만 등록할 수 있습니다.` };

  for (const file of fileList) {
    const lowerName = file.name.toLowerCase();
    const isImage = file.type?.startsWith("image/");
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

    if (!isImage && !isPdf) return { ok: false, message: "이미지 또는 PDF 파일만 등록할 수 있습니다." };
    if (file.size > maxFileSize) return { ok: false, message: `${file.name} 파일이 20MB를 초과합니다.` };
    if (isPdf && category !== "계약도면") return { ok: false, message: "PDF는 계약도면 구분에만 등록해 주세요." };
  }

  return { ok: true };
}

function Badge({ children, className = "" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black leading-none ${className}`}>{children}</span>;
}

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function PartnerInstallerPortal() {
  const [screen, setScreen] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [nextPassword, setNextPassword] = useState("");
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState("");
  const [user, setUser] = useState(null);
  const [partnerAuthPassword, setPartnerAuthPassword] = useState("");
  const [jobs, setJobs] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [engineerOptions, setEngineerOptions] = useState([]);
  const [restoringSession, setRestoringSession] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedEngineerFilter, setSelectedEngineerFilter] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [engineerDashboardFilter, setEngineerDashboardFilter] = useState("");
  const [detailJob, setDetailJob] = useState(null);
  const [uploadJob, setUploadJob] = useState(null);
  const [photoViewerJob, setPhotoViewerJob] = useState(null);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerInfo, setPhotoViewerInfo] = useState(null);
  const [photoViewerLoading, setPhotoViewerLoading] = useState(false);
  const [photoViewerError, setPhotoViewerError] = useState("");
  const [photoViewerInitialCategory, setPhotoViewerInitialCategory] = useState("\uC804\uCCB4");
  const [historyJob, setHistoryJob] = useState(null);
  const [assigningJobId, setAssigningJobId] = useState("");
  const [completingJobId, setCompletingJobId] = useState("");
  const [historySavingJobId, setHistorySavingJobId] = useState("");
  const [uploadingJobId, setUploadingJobId] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [copiedAddressJobId, setCopiedAddressJobId] = useState("");
  const [engineerRequestForm, setEngineerRequestForm] = useState({ name: "", phone: "" });
  const [engineerRequestLoading, setEngineerRequestLoading] = useState(false);
  const [engineerRequestMessage, setEngineerRequestMessage] = useState("");
  const [showEngineerRequest, setShowEngineerRequest] = useState(false);
  const [visibleJobLimit, setVisibleJobLimit] = useState(JOB_PAGE_SIZE);
  const listRef = useRef(null);
  const engineerRequestRef = useRef(null);

  useEffect(() => {
    if (!detailJob?.month || !detailJob?.rowNumber || !user) return;

    let ignore = false;

    const loadPhotoCounts = async () => {
      try {
        const result = await apiPost({
          action: "getPhotoMetaCounts",
          ...partnerAuthPayload(user, partnerAuthPassword || user.authPassword || ""),
          month: detailJob.month,
          rowNumber: detailJob.rowNumber,
          orderNo: detailJob.id || detailJob.jobId || "",
          siteId: detailJob.id || detailJob.jobId || `${detailJob.month}-ROW${detailJob.rowNumber}`,
        });

        if (ignore || !result.success) return;

        const key = jobKey(detailJob);
        applyJobUpdate(key, {
          photoCounts: result.counts || {},
          photoUrls: detailJob.photoUrls || {},
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadPhotoCounts();

    return () => {
      ignore = true;
    };
  }, [detailJob?.month, detailJob?.rowNumber, user, partnerAuthPassword]);

  const visibleJobs = useMemo(() => {
    if (!user) return [];
    const scopedJobs = user.role === "partner"
      ? jobs.filter((job) => job.partner === user.partnerName)
      : jobs.filter((job) => job.engineer === user.engineerName);

    return sortJobsByInstallDateDesc(scopedJobs);
  }, [jobs, user]);

  const monthOptions = useMemo(() => {
    const months = availableMonths.length
      ? availableMonths
      : Array.from(new Set(
        visibleJobs
          .map((job) => String(job.month || job.sheet || "").trim())
          .filter(Boolean),
      ));

    return months.slice().sort((a, b) => b.localeCompare(a));
  }, [availableMonths, visibleJobs]);

  useEffect(() => {
    if (selectedMonth === "all") return;
    if (!monthOptions.includes(selectedMonth)) setSelectedMonth("all");
  }, [monthOptions, selectedMonth]);

  useEffect(() => {
    if (!user || selectedMonth === "all") return;
    const hasSelectedMonthJobs = jobs.some((job) => String(job.month || job.sheet || "").trim() === selectedMonth);
    if (hasSelectedMonthJobs) return;

    let cancelled = false;
    setRefreshing(true);
    fetchPartnerJobs(user, { month: selectedMonth, silent: true })
      .then((rows) => {
        if (cancelled) return;
        setJobs((current) => [
          ...current.filter((job) => String(job.month || job.sheet || "").trim() !== selectedMonth),
          ...rows,
        ]);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, user?.loginId, user?.id]);

  const monthVisibleJobs = useMemo(() => {
    if (selectedMonth === "all") return visibleJobs;
    return visibleJobs.filter((job) => String(job.month || job.sheet || "").trim() === selectedMonth);
  }, [selectedMonth, visibleJobs]);

  const filteredJobs = useMemo(() => {
    const engineerScoped = selectedEngineerFilter
      ? monthVisibleJobs.filter((job) => String(job.engineer || "미배정").trim() === selectedEngineerFilter)
      : monthVisibleJobs;
    const calendarScoped = selectedCalendarDate
      ? engineerScoped.filter((job) => {
        const date = parseJobDate(job.installDate);
        return date && toDateKey(date) === selectedCalendarDate;
      })
      : engineerScoped;

    const dashboardScoped = user?.role === "engineer"
      ? filterEngineerDashboardJobs(calendarScoped, engineerDashboardFilter)
      : calendarScoped;

    if (activeTab === "unassigned") return dashboardScoped.filter((job) => isUnassignedEngineerValue(job.engineer) || job.status === "\uAE30\uC0AC\uBC30\uC815\uC694\uCCAD");
    if (activeTab === "photo") return dashboardScoped.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC" && !hasCompletionPhoto(job));
    if (activeTab === "complete") return dashboardScoped.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC");
    if (activeTab === "progress") return dashboardScoped.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC");
    return dashboardScoped;
  }, [activeTab, monthVisibleJobs, selectedCalendarDate, selectedEngineerFilter, engineerDashboardFilter, user?.role]);

  const stats = useMemo(() => ({
    total: monthVisibleJobs.length,
    unassigned: monthVisibleJobs.filter((job) => isUnassignedEngineerValue(job.engineer) || job.status === "\uAE30\uC0AC\uBC30\uC815\uC694\uCCAD").length,
    week: monthVisibleJobs.filter(isThisWeekJob).length,
    photoMissing: monthVisibleJobs.filter((job) => job.photo !== "\uB4F1\uB85D\uC644\uB8CC").length,
    completePhotoMissing: monthVisibleJobs.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC" && !hasCompletionPhoto(job)).length,
    complete: monthVisibleJobs.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC").length,
    incomplete: monthVisibleJobs.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC").length,
  }), [monthVisibleJobs]);

  const engineerStats = useMemo(() => ({
    today: monthVisibleJobs.filter(isTodayJob).length,
    week: monthVisibleJobs.filter(isThisWeekJob).length,
    month: monthVisibleJobs.length,
    photoNeeded: monthVisibleJobs.filter(isEngineerPhotoNeededJob).length,
    completePending: monthVisibleJobs.filter(isCompletionReportPendingJob).length,
    complete: monthVisibleJobs.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC").length,
    total: monthVisibleJobs.length,
  }), [monthVisibleJobs]);

  const pagedJobs = useMemo(() => filteredJobs.slice(0, visibleJobLimit), [filteredJobs, visibleJobLimit]);

  useEffect(() => {
    setVisibleJobLimit(JOB_PAGE_SIZE);
  }, [activeTab, selectedMonth, selectedCalendarDate, selectedEngineerFilter, engineerDashboardFilter, user?.role]);

  const groupedJobs = useMemo(() => {
    const groups = new Map();

    pagedJobs.forEach((job) => {
      const month = job.month || "월 미지정";
      const rows = groups.get(month) || [];
      rows.push(job);
      groups.set(month, rows);
    });

    return Array.from(groups.entries()).map(([month, rows]) => ({ month, rows }));
  }, [pagedJobs]);

  const paymentTotal = useMemo(() => {
    if (user?.role !== "partner") return 0;
    return monthPaymentTotal(monthVisibleJobs);
  }, [monthVisibleJobs, user]);

  const filteredPaymentTotal = useMemo(() => {
    if (user?.role !== "partner") return 0;
    return monthPaymentTotal(filteredJobs);
  }, [filteredJobs, user]);

  useEffect(() => {
    setSelectedEngineerFilter("");
    setSelectedCalendarDate("");
    setEngineerDashboardFilter("");
  }, [selectedMonth, user?.role]);

  const activeTabLabel = useMemo(() => {
    const partnerLabels = {
      today: "전체 현장",
      unassigned: "시공기사 미배정",
      photo: "완료사진 필요",
      progress: "진행중",
      complete: "시공완료",
    };
    const engineerLabels = {
      today: "전체 현장",
      progress: "진행중",
      photo: "완료사진 필요",
      complete: "시공완료",
    };

    return (user?.role === "partner" ? partnerLabels : engineerLabels)[activeTab] || "전체 현장";
  }, [activeTab, user?.role]);

  const engineerDashboardFilterLabel = useMemo(() => {
    const labels = {
      today: "오늘 시공 현장",
      week: "이번주 시공 현장",
      month: "이번달 시공 현장",
      photoNeeded: "완료사진 필요 현장",
      completePending: "완료보고 대기 현장",
      complete: "시공완료 현장",
    };

    return labels[engineerDashboardFilter] || "";
  }, [engineerDashboardFilter]);

  const selectTab = (tab) => {
    setSelectedEngineerFilter("");
    setSelectedCalendarDate("");
    setEngineerDashboardFilter("");
    setActiveTab(tab);
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const selectEngineerDashboardFilter = (filter) => {
    setSelectedEngineerFilter("");
    setSelectedCalendarDate("");
    setEngineerDashboardFilter(filter === "all" ? "" : filter);
    setActiveTab("today");
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const fetchPartnerJobs = async (loginUser, options = {}) => {
    const jobsStart = r2Now();
    const requestMonth = options.month || (selectedMonth !== "all" ? selectedMonth : getCurrentPortalMonth());
    logPartnerLoginTiming("getPartnerJobs start", jobsStart, { role: loginUser?.role || "", month: requestMonth });
    try {
      const authPassword = options.authPassword || loginUser.authPassword || partnerAuthPassword || "";
      const result = await apiPost({
        action: "getPartnerJobs",
        ...partnerAuthPayload(loginUser, authPassword),
        role: loginUser.role,
        partnerName: loginUser.partnerName,
        engineerName: loginUser.engineerName || "",
        month: requestMonth,
      });


      if (!result.success) {
        if (!options.silent) setLoginMessage(result.message || "현장 목록 조회 실패");
        if (options.throwOnError) throw new Error(result.message || "현장 목록 조회 실패");
        return [];
      }

      const rows = result.rows || [];
      if (Array.isArray(result.months)) setAvailableMonths(result.months);
      logPartnerLoginTiming("getPartnerJobs done", jobsStart, { count: rows.length, month: result.month || requestMonth });
      return rows;
    } catch (err) {
      console.error(err);
      if (!options.silent) setLoginMessage(err.message || "현장 목록 API 연결 실패");
      if (options.throwOnError) throw err;
      return [];
    }
  };

  const fetchEngineerOptions = async (loginUser) => {
    if (!loginUser?.partnerName) return [];

    try {
      const authPassword = loginUser.authPassword || partnerAuthPassword || "";
      const auth = partnerAuthPayload(loginUser, authPassword);
      const response = await fetch(`${WEBAPP_URL}?action=partnerInstallerData&id=${encodeURIComponent(auth.id)}&loginId=${encodeURIComponent(auth.loginId)}&password=${encodeURIComponent(auth.password)}&currentPassword=${encodeURIComponent(auth.currentPassword)}&authPassword=${encodeURIComponent(auth.authPassword)}&t=${Date.now()}`);
      const result = await response.json();

      if (!result.success) return [];

      return buildEngineerOptions(result, loginUser.partnerName);
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const restoreStart = r2Now();
      logPartnerLoginTiming("login start", restoreStart, { source: "session" });
      try {
        const savedSession = readPartnerSession();
        if (!savedSession?.user) return;

        const savedUser = { ...savedSession.user, authPassword: savedSession.authPassword || "" };
        logPartnerLoginTiming("login api done", restoreStart, { success: true, source: "session" });
        logPartnerLoginTiming("session restore start", restoreStart, { role: savedUser.role || "" });

        const rows = await fetchPartnerJobs(savedUser, { silent: true });

        if (cancelled) return;

        setUser(savedUser);
        setPartnerAuthPassword(savedSession.authPassword || "");
        writePartnerSession(savedUser, savedSession.authPassword || "");
        setJobs(rows);
        logPartnerLoginTiming("render jobs", restoreStart, { count: rows.length, source: "session" });
        setScreen(savedUser.mustChangePassword ? "passwordChange" : "portal");
        setActiveTab("today");

        fetchEngineerOptions(savedUser).then((engineers) => {
          if (!cancelled) setEngineerOptions(engineers);
        });
      } catch (err) {
        console.error(err);
        clearPartnerSession();
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
  if (loginLoading) return;

  const trimmedId = loginId.trim();
  const trimmedPw = loginPw.trim();

  if (!trimmedId || !trimmedPw) {
    setLoginMessage("아이디와 비밀번호를 입력해 주세요.");
    return;
  }

  setLoginMessage("\uB85C\uADF8\uC778 \uD655\uC778 \uC911\uC785\uB2C8\uB2E4.");
  setLoginLoading(true);
  const loginStart = r2Now();
  logPartnerLoginTiming("login start", loginStart);

  try {
    const loginApiStart = r2Now();
    const result = await apiPost({
      action: "partnerLogin",
      id: trimmedId,
      password: trimmedPw,
    });
    logPartnerLoginTiming("login api done", loginApiStart, { success: result.success === true });

    if (!result.success) {
      setLoginMessage(result.message || "아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }

    const loginUser = {
      id: result.id || trimmedId,
      loginId: result.loginId || result.id || trimmedId,
      name: result.name || result.partnerName || result.engineerName || trimmedId,
      role: result.role || "",
      partnerName: result.partnerName || result.partner || "",
      engineerName: result.engineerName || result.engineer || "",
      engineerPhone: result.engineerPhone || result.phone || "",
      passwordStatus: result.passwordStatus || "",
      mustChangePassword: result.mustChangePassword === true,
      authPassword: trimmedPw,
    };

    if (!loginUser.role) {
      setLoginMessage("계정 권한 정보를 확인할 수 없습니다.");
      return;
    }

    setUser(loginUser);
    setPartnerAuthPassword(trimmedPw);
    setLoginMessage("");

    if (loginUser.mustChangePassword) {
      writePartnerSession(loginUser, trimmedPw);
      setScreen("passwordChange");
      return;
    }

    const rows = await fetchPartnerJobs(loginUser);

    setJobs(rows);
    logPartnerLoginTiming("render jobs", loginStart, { count: rows.length, source: "login" });
    writePartnerSession(loginUser, trimmedPw);
    setLoginPw("");
    setActiveTab("today");
    setScreen("portal");
    setLoginLoading(false);

    fetchEngineerOptions(loginUser).then(setEngineerOptions);
  } catch (err) {
    console.error(err);
    setLoginMessage(err.message || "로그인 API 연결 실패");
  } finally {
    setLoginLoading(false);
  }
};

  const handlePartnerPasswordChange = async () => {
  if (passwordChanging || !user) return;

  setPasswordChangeMessage("");

  if (!/^[0-9]{4}$/.test(nextPassword) || !/^[0-9]{4}$/.test(nextPasswordConfirm)) {
    setPasswordChangeMessage("새 비밀번호는 숫자 4자리로 입력해 주세요.");
    return;
  }

  if (nextPassword === "0000") {
    setPasswordChangeMessage("0000은 임시비밀번호라 사용할 수 없습니다.");
    return;
  }

  if (nextPassword !== nextPasswordConfirm) {
    setPasswordChangeMessage("새 비밀번호가 서로 일치하지 않습니다.");
    return;
  }

  try {
    setPasswordChanging(true);

    const result = await apiPost({
      action: "partnerChangePassword",
      id: user.loginId || user.id,
      currentPassword: partnerAuthPassword || loginPw,
      nextPassword,
    });

    if (!result.success) {
      setPasswordChangeMessage(result.message || "비밀번호 변경에 실패했습니다.");
      return;
    }

    const nextUser = {
      ...user,
      passwordStatus: "정상",
      mustChangePassword: false,
      authPassword: nextPassword,
    };

    const rows = await fetchPartnerJobs(nextUser);

    setUser(nextUser);
    setPartnerAuthPassword(nextPassword);
    setJobs(rows);
    writePartnerSession(nextUser, nextPassword);

    setNextPassword("");
    setNextPasswordConfirm("");
    setLoginPw("");
    setPasswordChangeMessage("");
    setActiveTab("today");
    setScreen("portal");
    setPasswordChanging(false);

    fetchEngineerOptions(nextUser).then(setEngineerOptions);
  } catch (err) {
    console.error(err);
    setPasswordChangeMessage(err.message || "비밀번호 변경 API 연결 실패");
  } finally {
    setPasswordChanging(false);
  }
};

  const handleLogout = () => {
    clearPartnerSession();
    setUser(null);
    setPartnerAuthPassword("");
    setLoginPw("");
    setLoginMessage("");
    setPasswordChangeMessage("");
    setNextPassword("");
    setNextPasswordConfirm("");
    setScreen("login");
    setDetailJob(null);
    setUploadJob(null);
    setHistoryJob(null);
    setEngineerOptions([]);
  };

  const submitEngineerAccountRequest = async () => {
    if (!user || user.role !== "partner" || engineerRequestLoading) return;

    const engineerName = engineerRequestForm.name.trim();
    const phone = engineerRequestForm.phone.trim();

    setEngineerRequestMessage("");

    if (!engineerName || !/^[0-9-]{10,13}$/.test(phone)) {
      setEngineerRequestMessage("기사명과 연락처를 입력해 주세요.");
      return;
    }

    try {
      setEngineerRequestLoading(true);
      const result = await apiPost({
        action: "requestPartnerEngineerAccount",
        ...partnerAuthPayload(user, partnerAuthPassword),
        engineerName,
        phone,
      });

      if (!result.success) {
        setEngineerRequestMessage(result.message || "기사 계정 생성 요청에 실패했습니다.");
        return;
      }

      setEngineerRequestForm({ name: "", phone: "" });
      setEngineerRequestMessage(result.message || "기사 계정 생성 요청이 등록되었습니다.");
    } catch (error) {
      setEngineerRequestMessage(error?.message || "기사 계정 생성 요청 API 연결에 실패했습니다.");
    } finally {
      setEngineerRequestLoading(false);
    }
  };

  const refreshJobs = async (message = "현장 목록을 새로고침했습니다.") => {
    if (!user) return;
    setRefreshing(true);
    setActionMessage("");

    try {
      const rows = await fetchPartnerJobs(user);
      setJobs(rows);
      setDetailJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setHistoryJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setActionMessage(message);
    } finally {
      setRefreshing(false);
    }
  };

  const applyJobUpdate = (targetKey, updater) => {
    setJobs((prev) => prev.map((item) => {
      if (jobKey(item) !== targetKey) return item;
      return typeof updater === "function" ? updater(item) : { ...item, ...updater };
    }));
    setDetailJob((current) => {
      if (!current || jobKey(current) !== targetKey) return current;
      return typeof updater === "function" ? updater(current) : { ...current, ...updater };
    });
    setHistoryJob((current) => {
      if (!current || jobKey(current) !== targetKey) return current;
      return typeof updater === "function" ? updater(current) : { ...current, ...updater };
    });
  };

  const refreshJobsQuietly = (delay = 1200) => {
    if (!user) return;

    window.setTimeout(async () => {
      try {
        const rows = await fetchPartnerJobs(user, { silent: true, throwOnError: true });

        setJobs(rows);
        setDetailJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || null : current);
        setHistoryJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || null : current);
      } catch (err) {
        console.error(err);
      }
    }, delay);
  };

  const assignInstaller = async (job, engineer) => {
    if (!job || !engineer || !user) return;

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 잠금 해제 후 이용할 수 있습니다.");
      return;
    }

    const key = jobKey(job);
    const selectedEngineer = engineerOptions.find((item) => item.name === engineer);
    const nextEngineerPhone = selectedEngineer?.phone || job.engineerPhone || "";
    const assignedPatch = {
      engineer,
      engineerPhone: nextEngineerPhone,
      status: "시공계획확정",
    };

    setAssigningJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "assignEngineer",
        ...partnerAuthPayload(user, partnerAuthPassword || user.authPassword || ""),
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        partnerName: user.partnerName || job.partner || "",
        engineerName: engineer,
        engineerPhone: nextEngineerPhone,
        actor: portalActor(user),
      });

      if (!result.success) {
        setActionMessage(result.message || "시공기사 배정 저장에 실패했습니다.");
        return;
      }

      applyJobUpdate(key, assignedPatch);
      setActionMessage("시공기사 배정이 저장되었습니다.");
      refreshJobsQuietly();
    } catch (err) {
      console.error(err);
      if (String(err?.message || "").includes("Failed to fetch")) {
        applyJobUpdate(key, assignedPatch);
        setActionMessage("배정 요청을 보냈습니다. 화면에 먼저 반영했고, 잠시 후 자동으로 다시 확인합니다.");
        refreshJobsQuietly(1800);
        refreshJobsQuietly(4500);
      } else {
        setActionMessage(err.message || "시공기사 배정 API 연결 실패");
      }
    } finally {
      setAssigningJobId("");
    }
  };

  const completeJob = async (job) => {
    if (!job || !user) return;

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 완료보고를 저장할 수 없습니다.");
      return;
    }

    if (!hasCompletionPhoto(job)) {
      setActionMessage("완료사진을 1장 이상 등록한 뒤 완료보고할 수 있습니다.");
      return;
    }

    const key = jobKey(job);
    const completePatch = { status: "시공완료" };
    setCompletingJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "completeJob",
        ...partnerAuthPayload(user, partnerAuthPassword || user.authPassword || ""),
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
        requireCompletionPhoto: true,
        actor: portalActor(user),
      });

      if (!result.success) {
        setActionMessage(result.message || "완료보고 저장에 실패했습니다.");
        return;
      }

      applyJobUpdate(key, completePatch);
      setActionMessage("완료보고가 저장되었습니다.");
      refreshJobsQuietly();
    } catch (err) {
      console.error(err);
      if (String(err?.message || "").includes("Failed to fetch")) {
        applyJobUpdate(key, completePatch);
        setActionMessage("완료보고 요청을 보냈습니다. 화면에 먼저 반영했고, 잠시 후 자동으로 다시 확인합니다.");
        refreshJobsQuietly(1800);
        refreshJobsQuietly(4500);
      } else {
        setActionMessage(err.message || "완료보고 API 연결 실패");
      }
    } finally {
      setCompletingJobId("");
    }
  };

  const addHistory = async (job, text) => {
    if (!text.trim()) return;
    if (!job || !user) return;

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 이력을 등록할 수 없습니다.");
      return;
    }

    const key = jobKey(job);
    const nextHistoryLine = `${new Date().toLocaleString("ko-KR")} ${portalActor(user)}: ${text.trim()}`;
    const appendHistory = (item) => ({
      ...item,
      history: [item.history, nextHistoryLine].filter(Boolean).join("\n"),
    });

    setHistorySavingJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "addHistory",
        ...partnerAuthPayload(user, partnerAuthPassword || user.authPassword || ""),
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
        actor: portalActor(user),
        text: text.trim(),
      });

      if (!result.success) {
        setActionMessage(result.message || "이력등록 저장에 실패했습니다.");
        return;
      }

      applyJobUpdate(key, appendHistory);
      setHistoryJob(null);
      setActionMessage("이력등록이 저장되었습니다.");
      refreshJobsQuietly();
    } catch (err) {
      console.error(err);
      if (String(err?.message || "").includes("Failed to fetch")) {
        applyJobUpdate(key, appendHistory);
        setHistoryJob(null);
        setActionMessage("이력등록 요청을 보냈습니다. 화면에 먼저 반영했고, 잠시 후 자동으로 다시 확인합니다.");
        refreshJobsQuietly(1800);
        refreshJobsQuietly(4500);
      } else {
        setActionMessage(err.message || "이력등록 API 연결 실패");
      }
    } finally {
      setHistorySavingJobId("");
    }
  };

  const buildPhotoAuthPayload = () => partnerAuthPayload(user, partnerAuthPassword || user?.authPassword || "");

  const uploadPhotoToR2 = async ({ job, uploadFile, originalFile, selectedCategory }) => {
    const totalStart = r2Now();
    console.info("[photo-upload] r2 upload flow entered");
    const month = job.month || job.sheet || "";
    const siteId = job.id || job.jobId || `${month}-ROW${job.rowNumber}`;
    const orderNo = job.id || job.jobId || "";
    const category = normalizePhotoCategory(selectedCategory);

    const presignStart = r2Now();
    console.info("[photo-upload] presignUpload start");
    const presign = await callR2WorkerApi("/presignUpload", {
      ...buildPhotoAuthPayload(),
      month,
      rowNumber: job.rowNumber || "",
      orderNo,
      siteId,
      customer: job.customer || "",
      installDate: job.installDate || job.woodDate || "",
      photoCategory: category,
      originalFileName: originalFile?.name || uploadFile.name,
      uploaderId: portalActor(user),
      uploaderRole: user?.role || "",
      mimeType: uploadFile.type || "application/octet-stream",
      fileSize: uploadFile.size,
    });

    if (presign.success !== true || !presign.uploadUrl || !presign.storageKey || !presign.fileName) {
      throw new Error("R2 \uC5C5\uB85C\uB4DC URL \uBC1C\uAE09 \uC2E4\uD328");
    }
    logR2Timing("photo-upload", "presignUpload success", presignStart);

    const putStart = r2Now();
    console.info("[photo-upload] r2 put start");
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": uploadFile.type || "application/octet-stream" },
      body: uploadFile,
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 \uD30C\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328 (${uploadResponse.status})`);
    }
    logR2Timing("photo-upload", "r2 put success", putStart, { size: uploadFile.size });

    const metaStart = r2Now();
    console.info("[photo-upload] savePhotoMeta start");
    const metaResult = await apiPost({
      action: "savePhotoMeta",
      ...buildPhotoAuthPayload(),
      orderNo,
      siteId,
      month,
      rowNumber: job.rowNumber || "",
      customer: job.customer || "",
      installDate: job.installDate || job.woodDate || "",
      displayFolder: presign.displayFolder,
      photoCategory: category,
      storageLocation: "r2",
      storageKey: presign.storageKey,
      fileName: presign.fileName,
      originalFileName: originalFile?.name || uploadFile.name,
      uploadedBy: portalActor(user),
      uploaderRole: user?.role || "",
      uploadedAt: new Date().toISOString(),
      mimeType: uploadFile.type || "application/octet-stream",
      fileSize: uploadFile.size,
      source: user?.role || "partner",
      includeCounts: false,
    });

    if (metaResult.success !== true || (!metaResult.photoId && !metaResult.savedMeta)) {
      throw new Error(metaResult.message || "PHOTO_META \uC800\uC7A5 \uC2E4\uD328");
    }
    logR2Timing("photo-upload", "savePhotoMeta success", metaStart);
    logR2Timing("photo-upload", "file total", totalStart, { category });

    return {
      ...metaResult,
      success: true,
      usedStorage: "r2",
      storageKey: presign.storageKey,
      fileName: presign.fileName,
      photoCategory: category,
    };
  };
  const uploadPhotoToDriveFallback = async ({ job, uploadFile, selectedCategory }) => {
    const base64 = await fileToBase64(uploadFile);
    return apiPost({
      action: "uploadPhoto",
      ...buildPhotoAuthPayload(),
      month: job.month || job.sheet || "",
      rowNumber: job.rowNumber || "",
      category: selectedCategory,
      fileName: uploadFile.name,
      mimeType: uploadFile.type || "application/octet-stream",
      base64,
      role: user.role,
      partnerName: user.partnerName || job.partner || "",
      engineerName: user.engineerName || job.engineer || "",
      actor: portalActor(user),
    });
  };

  const loadPhotoGallery = async (job, initialCategory = "\uC804\uCCB4") => {
    if (!job || !user) return;
    setPhotoViewerJob(job);
    setPhotoViewerInitialCategory(initialCategory || "\uC804\uCCB4");
    setPhotoViewerLoading(true);
    setPhotoViewerError("");

    const month = job.month || job.sheet || "";
    const siteId = job.id || job.jobId || `${month}-ROW${job.rowNumber}`;
    const orderNo = job.id || job.jobId || "";

    try {
      const listStart = r2Now();
      const result = await apiPost({
        action: "listPhotos",
        ...buildPhotoAuthPayload(),
        month,
        rowNumber: job.rowNumber || "",
        orderNo,
        siteId,
        includeDeleted: false,
      });

      if (result.success) {
        logR2Timing("partner-photo-viewer", "listPhotos success", listStart, { count: (result.photos || []).length });
        const photos = result.photos || [];
        const actualCounts = countPhotosByCategory(photos);
        setPhotoViewerPhotos(photos);
        setPhotoViewerInfo({ counts: actualCounts, urls: job.photoUrls || {}, source: "listPhotos" });
        applyJobUpdate(jobKey(job), { photoCounts: actualCounts, photoUrls: job.photoUrls || {} });
      } else {
        setPhotoViewerPhotos([]);
        setPhotoViewerInfo({ counts: {}, urls: job.photoUrls || {}, source: "listPhotos" });
        setPhotoViewerError(result.message || "\uC0AC\uC9C4\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
    } catch (error) {
      setPhotoViewerPhotos([]);
      setPhotoViewerInfo({ counts: {}, urls: job.photoUrls || {}, source: "listPhotos" });
      setPhotoViewerError(error?.message || "\uC0AC\uC9C4\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setPhotoViewerLoading(false);
    }
  };

  const viewR2Photo = async (photo) => {
    const job = photoViewerJob || {};
    const month = job.month || job.sheet || photo.month || "";
    const rowNumber = job.rowNumber || photo.rowNumber || "";
    const viewStart = r2Now();
    const data = await callR2WorkerApi("/presignView", {
      ...buildPhotoAuthPayload(),
      storageKey: photo.storageKey,
      photoId: photo.photoId,
      month,
      rowNumber,
      orderNo: job.id || job.jobId || photo.orderNo || "",
      siteId: job.id || job.jobId || photo.siteId || (month && rowNumber ? `${month}-ROW${rowNumber}` : ""),
    });
    logR2Timing("partner-photo-viewer", "createR2ViewUrl success", viewStart);
    return data.viewUrl;
  };
  const uploadPhotoFiles = async (job, category, files) => {
    if (!job || !user) return { success: false, message: "\uC798\uBABB\uB41C \uD604\uC7A5\uC785\uB2C8\uB2E4." };

    if (isJobLocked(job)) {
      const message = "\uAD00\uB9AC\uC790\uAC00 \uC7A0\uADFC \uD604\uC7A5\uC785\uB2C8\uB2E4. \uC0AC\uC9C4\uC744 \uB4F1\uB85D\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
      setActionMessage(message);
      return { success: false, message };
    }

    const selectedCategory = normalizePhotoCategory(category);
    const fileList = Array.from(files || []);
    const check = validateUploadFiles(fileList, selectedCategory);
    const key = jobKey(job);
    const month = job.month || job.sheet || "";
    const siteId = job.id || job.jobId || `${month}-ROW${job.rowNumber}`;
    const orderNo = job.id || job.jobId || "";

    if (!check.ok) { setActionMessage(check.message); return { success: false, message: check.message }; }

    const uploadBatchStart = r2Now();
    setUploadingJobId(key);
    setUploadProgress("\uC5C5\uB85C\uB4DC \uC900\uBE44 \uC911");
    setActionMessage("");

    const prepareFile = async (file, index) => {
      const compressStart = r2Now();
      const shouldCompress = shouldCompressUploadImage(file, selectedCategory);
      if (!shouldCompress) {
        logR2Timing("photo-upload", "compress skipped", compressStart, { index: index + 1, originalSize: file.size });
        return file;
      }
      const uploadFile = await compressImageFile(file);
      logR2Timing("photo-upload", "compress", compressStart, { index: index + 1, originalSize: file.size, uploadSize: uploadFile.size, skipped: uploadFile === file });
      return uploadFile;
    };

    try {
      const preparedItems = await Promise.all(fileList.map(async (file, index) => ({ file, index, uploadFile: await prepareFile(file, index) })));
      const authPayload = buildPhotoAuthPayload();
      if (preparedItems.length === 1) {
        const item = preparedItems[0];
        let usedStorage = "r2";
        let folderUrl = job.photoUrl || "";
        try {
          await uploadPhotoToR2({ job, uploadFile: item.uploadFile, originalFile: item.file, selectedCategory });
        } catch (r2Error) {
          console.warn("[photo-upload] single r2 failed, fallback drive", r2Error);
          const fallbackResult = await uploadPhotoToDriveFallback({ job, uploadFile: item.uploadFile, selectedCategory });
          if (fallbackResult.success !== true) throw new Error(fallbackResult.message || "\uAE30\uC874 \uC800\uC7A5\uC18C \uC0AC\uC9C4\uB4F1\uB85D \uC2E4\uD328");
          folderUrl = fallbackResult.folderUrl || folderUrl;
          usedStorage = "drive";
        }

        const successCount = 1;
        let optimisticCounts = {};
        applyJobUpdate(key, (itemJob) => {
          optimisticCounts = { ...(itemJob.photoCounts || {}) };
          optimisticCounts[selectedCategory] = Number(optimisticCounts[selectedCategory] || 0) + successCount;
          return { ...itemJob, photo: "\uB4F1\uB85D\uC644\uB8CC", photoUrl: folderUrl || itemJob.photoUrl, photoCounts: optimisticCounts };
        });
        logR2Timing("photo-upload", "count optimistic", uploadBatchStart, { total: Object.values(optimisticCounts).reduce((sum, value) => sum + Number(value || 0), 0) });

        const countRefreshStart = r2Now();
        apiPost({ action: "getPhotoMetaCounts", ...authPayload, month, rowNumber: job.rowNumber || "", orderNo, siteId })
          .then((serverCount) => {
            logR2Timing("photo-upload", "count background refresh", countRefreshStart, { total: serverCount?.total || 0 });
            if (serverCount?.success === true && serverCount.counts) {
              applyJobUpdate(key, (itemJob) => ({ ...itemJob, photoCounts: serverCount.counts || itemJob.photoCounts || {} }));
            }
          })
          .catch((countError) => { console.warn("[photo-upload] count background refresh failed", countError); });

        logR2Timing("photo-upload", "batch total", uploadBatchStart, { files: fileList.length, success: successCount, failed: 0, path: "single", storage: usedStorage });
        const message = usedStorage === "r2"
          ? `${selectedCategory} ${successCount}\uC7A5 \uC0AC\uC9C4\uB4F1\uB85D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`
          : "\uAE30\uC874 \uC800\uC7A5\uC18C\uB85C \uC0AC\uC9C4\uB4F1\uB85D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
        setUploadProgress(usedStorage === "r2" ? "\uC0AC\uC9C4\uB4F1\uB85D \uC644\uB8CC" : "\uAE30\uC874 \uC800\uC7A5\uC18C\uB85C \uC0AC\uC9C4\uB4F1\uB85D \uC644\uB8CC");
        setActionMessage("");
        if (usedStorage === "drive") refreshJobsQuietly();
        return { success: true, usedStorage, message };
      }

      const presignStart = r2Now();
      const batchPresign = await apiPost({
        action: "batchPresignR2Upload",
        ...authPayload,
        month, rowNumber: job.rowNumber || "", orderNo, siteId,
        customer: job.customer || "",
        installDate: job.installDate || job.woodDate || "",
        photoCategory: selectedCategory,
        uploadedBy: portalActor(user),
        uploaderId: portalActor(user),
        uploaderRole: user?.role || "",
        source: user?.role || "partner",
        files: preparedItems.map(({ file, uploadFile, index }) => ({
          index,
          originalFileName: file?.name || uploadFile.name,
          mimeType: uploadFile.type || "application/octet-stream",
          fileSize: uploadFile.size,
        })),
      });
      logR2Timing("photo-upload", "batchPresignR2Upload", presignStart, { files: preparedItems.length });
      const presignResults = batchPresign?.results || [];

      const uploadPrepared = async (item) => {
        const presign = presignResults.find((result) => Number(result.index) === item.index);
        const fileStart = r2Now();
        if (!presign?.success || !presign.uploadUrl) {
          const fallbackResult = await uploadPhotoToDriveFallback({ job, uploadFile: item.uploadFile, selectedCategory });
          if (fallbackResult.success !== true) throw new Error(fallbackResult.message || "\uAE30\uC874 \uC800\uC7A5\uC18C \uC0AC\uC9C4\uB4F1\uB85D \uC2E4\uD328");
          logR2Timing("photo-upload", "file total", fileStart, { index: item.index + 1, storage: "drive" });
          return { success: true, result: fallbackResult, storage: "drive", item };
        }

        try {
          const putStart = r2Now();
          const uploadResponse = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": item.uploadFile.type || "application/octet-stream" },
            body: item.uploadFile,
          });
          if (!uploadResponse.ok) throw new Error(`R2 \uD30C\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328 (${uploadResponse.status})`);
          logR2Timing("photo-upload", "r2 put", putStart, { index: item.index + 1, size: item.uploadFile.size });
          logR2Timing("photo-upload", "file total", fileStart, { index: item.index + 1, storage: "r2" });
          return { success: true, presign, storage: "r2", item };
        } catch (r2Error) {
          console.warn("[photo-upload] r2 put failed, fallback drive", r2Error);
          const fallbackResult = await uploadPhotoToDriveFallback({ job, uploadFile: item.uploadFile, selectedCategory });
          if (fallbackResult.success !== true) throw new Error(fallbackResult.message || "\uAE30\uC874 \uC800\uC7A5\uC18C \uC0AC\uC9C4\uB4F1\uB85D \uC2E4\uD328");
          logR2Timing("photo-upload", "file total", fileStart, { index: item.index + 1, storage: "drive" });
          return { success: true, result: fallbackResult, storage: "drive", item };
        }
      };

      const results = [];
      for (let start = 0; start < preparedItems.length; start += R2_UPLOAD_CONCURRENCY) {
        const chunk = preparedItems.slice(start, start + R2_UPLOAD_CONCURRENCY);
        setUploadProgress(`\uC5C5\uB85C\uB4DC \uC911 \u00B7 ${Math.min(start + 1, preparedItems.length)}-${Math.min(start + chunk.length, preparedItems.length)}/${preparedItems.length}`);
        results.push(...await Promise.allSettled(chunk.map(uploadPrepared)));
      }

      const fulfilled = results.filter((item) => item.status === "fulfilled" && item.value?.success).map((item) => item.value);
      const r2Uploads = fulfilled.filter((item) => item.storage === "r2");
      const driveUploads = fulfilled.filter((item) => item.storage === "drive");
      const failures = results.filter((item) => item.status === "rejected");
      let batchSaveResult = null;

      if (r2Uploads.length) {
        const saveStart = r2Now();
        batchSaveResult = await apiPost({
          action: "batchSavePhotoMeta",
          ...authPayload,
          metas: r2Uploads.map(({ presign, item }) => ({
            orderNo, siteId, month, rowNumber: job.rowNumber || "",
            customer: job.customer || "",
            installDate: job.installDate || job.woodDate || "",
            displayFolder: presign.displayFolder, photoCategory: selectedCategory,
            storageLocation: "r2", storageKey: presign.storageKey, fileName: presign.fileName,
            originalFileName: item.file?.name || item.uploadFile.name,
            uploadedBy: portalActor(user), uploaderRole: user?.role || "",
            uploadedAt: new Date().toISOString(),
            mimeType: item.uploadFile.type || "application/octet-stream", fileSize: item.uploadFile.size,
            source: user?.role || "partner",
          })),
        });
        if (batchSaveResult.success !== true) throw new Error(batchSaveResult.message || "PHOTO_META \uC800\uC7A5 \uC2E4\uD328");
        logR2Timing("photo-upload", "batchSavePhotoMeta", saveStart, { saved: batchSaveResult.saved || 0, failed: batchSaveResult.failed || 0 });
      }

      const successCount = Number(batchSaveResult?.saved || 0) + driveUploads.length;
      const failureCount = failures.length + Number(batchSaveResult?.failed || 0) + Math.max(0, r2Uploads.length - Number(batchSaveResult?.saved || 0));
      if (!successCount) throw new Error(failures[0]?.reason?.message || "\uC0AC\uC9C4\uB4F1\uB85D \uC2E4\uD328");

      const lastDriveResult = driveUploads[driveUploads.length - 1]?.result || {};
      let optimisticCounts = {};
      applyJobUpdate(key, (item) => {
        optimisticCounts = { ...(item.photoCounts || {}) };
        optimisticCounts[selectedCategory] = Number(optimisticCounts[selectedCategory] || 0) + successCount;
        return {
          ...item,
          photo: "\uB4F1\uB85D\uC644\uB8CC",
          photoUrl: lastDriveResult?.folderUrl || item.photoUrl,
          photoCounts: optimisticCounts,
          photoUrls: lastDriveResult?.photoUrls || item.photoUrls || {},
        };
      });
      logR2Timing("photo-upload", "count optimistic", uploadBatchStart, { total: Object.values(optimisticCounts).reduce((sum, value) => sum + Number(value || 0), 0) });

      const countRefreshStart = r2Now();
      apiPost({ action: "getPhotoMetaCounts", ...authPayload, month, rowNumber: job.rowNumber || "", orderNo, siteId })
        .then((serverCount) => {
          logR2Timing("photo-upload", "count background refresh", countRefreshStart, { total: serverCount?.total || 0 });
          if (serverCount?.success === true && serverCount.counts) {
            applyJobUpdate(key, (item) => ({ ...item, photoCounts: serverCount.counts || item.photoCounts || {} }));
          }
        })
        .catch((countError) => {
          console.warn("[photo-upload] count background refresh failed", countError);
        });

      logR2Timing("photo-upload", "batch total", uploadBatchStart, { files: fileList.length, success: successCount, failed: failureCount, storage: r2Uploads.length ? "r2" : "drive" });
      const message = failureCount
        ? `${successCount}\uC7A5 \uB4F1\uB85D \uC644\uB8CC, ${failureCount}\uC7A5 \uC2E4\uD328`
        : r2Uploads.length
          ? `${selectedCategory} ${successCount}\uC7A5 \uC0AC\uC9C4\uB4F1\uB85D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`
          : "\uAE30\uC874 \uC800\uC7A5\uC18C\uB85C \uC0AC\uC9C4\uB4F1\uB85D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
      setUploadProgress(r2Uploads.length ? "\uC0AC\uC9C4\uB4F1\uB85D \uC644\uB8CC" : "\uAE30\uC874 \uC800\uC7A5\uC18C\uB85C \uC0AC\uC9C4\uB4F1\uB85D \uC644\uB8CC");
      setActionMessage("");
      if (driveUploads.length && !r2Uploads.length) refreshJobsQuietly();
      return { success: true, usedStorage: r2Uploads.length ? "r2" : "drive", message };
    } catch (err) {
      console.warn("[photo-upload] failed", err);
      const message = err?.message || "\uC0AC\uC9C4\uB4F1\uB85D API \uC5F0\uACB0 \uC2E4\uD328";
      setActionMessage(message);
      return { success: false, message };
    } finally {
      setUploadingJobId("");
    }
  };
  const copyAddress = async (job) => {
    const address = String(job?.address || "").trim();

    if (!address) {
      setActionMessage("복사할 현장주소가 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      const key = jobKey(job);
      setCopiedAddressJobId(key);
      setActionMessage("현장주소를 복사했습니다.");
      window.setTimeout(() => setCopiedAddressJobId((current) => current === key ? "" : current), 1800);
    } catch (err) {
      console.error(err);
      setActionMessage("주소 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  };

  const openUpload = (job) => {
    setActionMessage("");

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 사진을 등록할 수 없습니다.");
      return;
    }

    setUploadJob(job);
  };

  const openHistory = (job) => {
    setActionMessage("");

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 이력을 등록할 수 없습니다.");
      return;
    }

    setHistoryJob(job);
  };

  if (screen === "passwordChange") {
  return (
    <PasswordChangeForm
      user={user}
      nextPassword={nextPassword}
      nextPasswordConfirm={nextPasswordConfirm}
      setNextPassword={setNextPassword}
      setNextPasswordConfirm={setNextPasswordConfirm}
      message={passwordChangeMessage}
      loading={passwordChanging}
      onSubmit={handlePartnerPasswordChange}
      onLogout={handleLogout}
    />
  );
}

  const toggleEngineerRequestPanel = () => {
    setShowEngineerRequest((current) => {
      const next = !current;
      if (next) {
        window.setTimeout(() => {
          engineerRequestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
      return next;
    });
  };
  if (screen === "login") {
    if (restoringSession) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500" />
            <p className="mt-3 text-sm font-black text-slate-600">로그인 정보를 확인 중입니다.</p>
          </div>
        </main>
      );
    }

    return (
      <LoginForm
        id={loginId}
        password={loginPw}
        setId={setLoginId}
        setPassword={setLoginPw}
        message={loginMessage}
        loading={loginLoading}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <PortalHeader
          user={user}
          onLogout={handleLogout}
          canRequestEngineer={user.role === "partner"}
          showEngineerRequest={showEngineerRequest}
          onToggleEngineerRequest={toggleEngineerRequestPanel}
        />
        {false && user.role === "partner" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleEngineerRequestPanel}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black shadow-sm active:scale-[0.99] ${showEngineerRequest ? "border-slate-300 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <Users className="h-4 w-4" />
              시공기사 계정신청
            </button>
          </div>
        ) : null}
        {user.role === "partner" && showEngineerRequest ? (
          <div ref={engineerRequestRef} className="scroll-mt-4">
            <EngineerAccountRequestPanel
              form={engineerRequestForm}
              setForm={setEngineerRequestForm}
              loading={engineerRequestLoading}
              message={engineerRequestMessage}
              onSubmit={submitEngineerAccountRequest}
              onCollapse={() => setShowEngineerRequest(false)}
            />
          </div>
        ) : null}
        <MonthFilter
          months={monthOptions}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          totalCount={visibleJobs.length}
        />
        <MonthlyConstructionCalendar
          jobs={monthVisibleJobs}
          selectedMonth={selectedMonth}
          selectedDate={selectedCalendarDate}
          userRole={user.role}
          onSelectDate={(dateKey) => {
            setSelectedEngineerFilter("");
            setSelectedCalendarDate(dateKey);
            setEngineerDashboardFilter("");
            setActiveTab("today");
            window.setTimeout(() => {
              listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
          }}
        />
        {user.role === "partner" ? (
          <PartnerPaymentDashboard
            jobs={monthVisibleJobs}
            stats={stats}
            paymentTotal={paymentTotal}
            selectedEngineer={selectedEngineerFilter}
            onSelectEngineer={(name) => {
              setSelectedCalendarDate("");
              setSelectedEngineerFilter((current) => current === name ? "" : name);
              setActiveTab("today");
              window.setTimeout(() => {
                listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 80);
            }}
            onClearEngineer={() => setSelectedEngineerFilter("")}
            onSelectSummary={selectTab}
          />
        ) : null}
        {user.role === "engineer" ? (
          <EngineerDashboard
            stats={engineerStats}
            selectedFilter={engineerDashboardFilter}
            onSelectFilter={selectEngineerDashboardFilter}
          />
        ) : null}
        {user.role === "partner" || user.role === "engineer" ? null : <StatGrid user={user} stats={stats} setActiveTab={selectTab} />}
        <TabBar user={user} activeTab={activeTab} setActiveTab={selectTab} />

        <section ref={listRef} className="scroll-mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">{user.role === "partner" ? "협력사 현장 목록" : "내 현장 목록"}</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                총 {filteredJobs.length}건 표시 중{user.role === "partner" ? ` · 표시 합계 ${formatMoney(filteredPaymentTotal)}` : ""}
              </p>
              {selectedCalendarDate || selectedEngineerFilter || activeTab !== "today" || engineerDashboardFilter ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {engineerDashboardFilter ? (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                      {engineerDashboardFilterLabel}
                    </Badge>
                  ) : null}
                  {activeTab !== "today" ? (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      현재 필터: {activeTabLabel}
                    </Badge>
                  ) : null}
                  {selectedCalendarDate ? (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                      선택 날짜: {selectedCalendarDate}
                    </Badge>
                  ) : null}
                  {selectedEngineerFilter ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      선택 기사: {selectedEngineerFilter}
                    </Badge>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDate("");
                      setSelectedEngineerFilter("");
                      setEngineerDashboardFilter("");
                      setActiveTab("today");
                      window.setTimeout(() => {
                        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 60);
                    }}
                    className="rounded-full border px-3 py-1 text-[11px] font-black text-slate-600"
                  >
                    {"\uC804\uCCB4 \uD604\uC7A5 \uBCF4\uAE30"}
                  </button>
                </div>
              ) : null}
            </div>
            <button onClick={() => refreshJobs()} disabled={refreshing} className="rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">{refreshing ? "조회중" : "새로고침"}</button>
          </div>
          {actionMessage ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">{actionMessage}</div> : null}

          {groupedJobs.length ? groupedJobs.map(({ month, rows }) => (
            <section key={month} className="rounded-3xl border bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">{month}</h3>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">{rows.length}건{user.role === "partner" ? ` · 월 합계 ${formatMoney(monthPaymentTotal(rows))}` : ""}</p>
                </div>
                {user.role === "partner" ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{formatMoney(monthPaymentTotal(rows))}</Badge> : null}
              </div>
              <div className="space-y-3">
                {rows.map((job) => (
                  <JobCard
                    key={jobKey(job)}
                    job={job}
                    user={user}
                    onDetail={() => {
                      setActionMessage("");
                      setDetailJob(job);
                    }}
                    onUpload={() => {
                      openUpload(job);
                    }}
                    onHistory={() => openHistory(job)}
                    onComplete={() => completeJob(job)}
                    completing={completingJobId === jobKey(job)}
                  />
                ))}
              </div>
            </section>
          )) : (
            <div className="rounded-3xl border border-dashed p-8 text-center text-sm font-bold text-slate-400">표시할 현장이 없습니다.</div>
          )}
          {filteredJobs.length > pagedJobs.length ? (
            <button
              type="button"
              onClick={() => setVisibleJobLimit((current) => current + JOB_PAGE_SIZE)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm active:scale-[0.99]"
            >
              더보기 {pagedJobs.length}/{filteredJobs.length}
            </button>
          ) : null}
        </section>
      </div>

      {detailJob ? (
        <JobDetailModal
          job={detailJob}
          user={user}
          onClose={() => setDetailJob(null)}
          onUpload={() => {
            if (isJobLocked(detailJob)) {
              setActionMessage("관리자가 잠근 현장입니다. 사진을 등록할 수 없습니다.");
              return;
            }
            setActionMessage("");
            setUploadJob(detailJob);
            setDetailJob(null);
          }}
          onHistory={() => {
            if (isJobLocked(detailJob)) {
              setActionMessage("관리자가 잠근 현장입니다. 이력을 등록할 수 없습니다.");
              return;
            }
            setActionMessage("");
            setHistoryJob(detailJob);
            setDetailJob(null);
          }}
          onAssign={assignInstaller}
          engineerOptions={engineerOptions}
          assigning={assigningJobId === jobKey(detailJob)}
          completing={completingJobId === jobKey(detailJob)}
          actionMessage={actionMessage}
          onComplete={completeJob}
          onCopyAddress={copyAddress}
          addressCopied={copiedAddressJobId === jobKey(detailJob)}
          onPhotoView={(category) => loadPhotoGallery(detailJob, category || "\uC804\uCCB4")}
        />
      ) : null}

      {uploadJob ? <UploadModal job={uploadJob} onClose={() => setUploadJob(null)} onSubmit={uploadPhotoFiles} uploading={uploadingJobId === jobKey(uploadJob)} progress={uploadProgress} message={actionMessage} onPhotoView={() => loadPhotoGallery(uploadJob, "\uC804\uCCB4")} /> : null}
      {photoViewerJob ? <PhotoViewerModal job={photoViewerJob} photos={photoViewerPhotos} photoInfo={photoViewerInfo} loading={photoViewerLoading} error={photoViewerError} initialCategory={photoViewerInitialCategory} onClose={() => setPhotoViewerJob(null)} onRefresh={() => loadPhotoGallery(photoViewerJob, photoViewerInitialCategory)} onViewR2={viewR2Photo} /> : null}
      {historyJob ? <HistoryModal job={historyJob} onClose={() => setHistoryJob(null)} onSubmit={addHistory} saving={historySavingJobId === jobKey(historyJob)} message={actionMessage} /> : null}
    </div>
  );
}

function LoginForm({ id, password, setId, setPassword, message, loading = false, onSubmit }) {
  const submitLogin = (event) => {
    event?.preventDefault?.();
    if (loading) return;
    onSubmit();
  };

  const submitOnEnter = (event) => {
    if (event.key !== "Enter") return;
    submitLogin(event);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <form className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl" onSubmit={submitLogin}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400">DAELIM BATH & KITCHEN</p>
            <h1 className="text-2xl font-black">시공사 포털 로그인</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">계정 권한에 따라 화면이 자동으로 열립니다.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>ID</FieldLabel>
            <input value={id} onKeyDown={submitOnEnter} onChange={(e) => setId(e.target.value)} disabled={loading} className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60" />
          </div>
          <div>
            <FieldLabel>비밀번호</FieldLabel>
            <input type="password" value={password} onKeyDown={submitOnEnter} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60" />
          </div>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}

        <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {loading ? "확인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}

function EngineerAccountRequestPanel({ form, setForm, loading = false, message = "", onSubmit, onCollapse }) {
  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "phone" ? formatPhone(value) : value,
    }));
  };

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black text-slate-400">ENGINEER ACCOUNT</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">시공기사 계정 생성 요청</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">master 승인 후 기사 로그인ID가 생성됩니다.</p>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {loading ? "요청 중" : "요청 보내기"}
        </button>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-2xl border bg-white px-4 py-3 text-sm font-black text-slate-600"
          >
            접기
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>기사명</FieldLabel>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            disabled={loading}
            className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            placeholder="예: 김대림"
          />
        </div>
        <div>
          <FieldLabel>연락처</FieldLabel>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            disabled={loading}
            inputMode="tel"
            className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">
          {message}
        </div>
      ) : null}
    </section>
  );
}

function PasswordChangeForm({
  user,
  nextPassword,
  nextPasswordConfirm,
  setNextPassword,
  setNextPasswordConfirm,
  message,
  loading = false,
  onSubmit,
  onLogout,
}) {
  const submitOnEnter = (event) => {
    if (event.key !== "Enter") return;
    onSubmit();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400">DAELIM BATH & KITCHEN</p>
            <h1 className="text-2xl font-black">비밀번호 변경</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {user?.name || "사용자"}님, 최초 로그인 후 비밀번호 변경이 필요합니다.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>새 비밀번호</FieldLabel>
            <input
              type="password"
              value={nextPassword}
              onKeyDown={submitOnEnter}
              onChange={(e) => setNextPassword(e.target.value)}
              disabled={loading}
              maxLength={4}
              placeholder="숫자 4자리"
              className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            />
          </div>

          <div>
            <FieldLabel>새 비밀번호 확인</FieldLabel>
            <input
              type="password"
              value={nextPasswordConfirm}
              onKeyDown={submitOnEnter}
              onChange={(e) => setNextPasswordConfirm(e.target.value)}
              disabled={loading}
              maxLength={4}
              placeholder="숫자 4자리 재입력"
              className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            />
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onLogout}
            disabled={loading}
            className="rounded-2xl border px-4 py-4 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            로그아웃
          </button>

          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? "변경 중" : "변경하기"}
          </button>
        </div>
      </div>
    </main>
  );
}

function PortalHeader({
  user,
  onLogout,
  canRequestEngineer = false,
  showEngineerRequest = false,
  onToggleEngineerRequest,
}) {
  return (
    <header className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-slate-400">대림바스&키친</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{user.role === "partner" ? "협력사 포털" : "시공기사 포털"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={user.role === "partner" ? "border-slate-300 bg-slate-900 text-white" : "border-blue-200 bg-blue-50 text-blue-700"}>{user.role === "partner" ? "협력사" : "시공기사"}</Badge>
            <span className="text-sm font-bold text-slate-600">{user.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {canRequestEngineer ? (
            <button
              type="button"
              onClick={onToggleEngineerRequest}
              className={`flex items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-black shadow-sm active:scale-[0.99] ${
                showEngineerRequest
                  ? "border-slate-300 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Users className="h-4 w-4" />
              시공기사 계정신청
            </button>
          ) : null}
          <button onClick={onLogout} className="flex items-center gap-1 rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600">
          <LogOut className="h-4 w-4" /> 로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

function MonthFilter({ months, selectedMonth, setSelectedMonth, totalCount }) {
  const options = [["all", "\uC804\uCCB4"], ...months.map((month) => [month, month])];

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black text-slate-500">{"\uC6D4 \uD544\uD130"}</p>
          <p className="text-[11px] font-bold text-slate-400">{"\uC804\uCCB4 \uC870\uD68C "}{totalCount}{"\uAC74"}</p>
        </div>
        <Badge className="border-slate-200 bg-slate-50 text-slate-600">
          {selectedMonth === "all" ? "\uC804\uCCB4" : selectedMonth}
        </Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelectedMonth(value)}
            className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black ${selectedMonth === value ? "bg-slate-900 text-white" : "border bg-white text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MonthlyConstructionCalendar({ jobs = [], selectedMonth = "", selectedDate = "", userRole = "", onSelectDate }) {
  const calendarData = useMemo(() => {
    const canHighlightUnassigned = userRole === "partner";
    const jobMonth = jobs
      .map((job) => parseJobDate(job.installDate))
      .find(Boolean);
    const selectedMatch = /^(\d{2})\.(\d{2})$/.exec(String(selectedMonth || ""));
    const today = new Date();
    const baseDate = selectedMatch
      ? new Date(2000 + Number(selectedMatch[1]), Number(selectedMatch[2]) - 1, 1)
      : jobMonth || today;
    const year = baseDate.getFullYear();
    const monthIndex = baseDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    const jobMap = new Map();
    jobs.forEach((job) => {
      const date = parseJobDate(job.installDate);
      if (!date) return;
      if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return;

      const key = toDateKey(date);
      const rows = jobMap.get(key) || [];
      rows.push(job);
      jobMap.set(key, rows);
    });

    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);

      const rows = jobMap.get(key) || [];
      const hasUnassigned = canHighlightUnassigned && rows.some((job) => isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청");
      const hasRefinishing = rows.some(isRefinishingJob);

      return {
        date,
        key,
        inMonth: date.getMonth() === monthIndex,
        isToday: key === toDateKey(today),
        rows,
        hasUnassigned,
        hasRefinishing,
      };
    });

    return {
      title: `${year}.${String(monthIndex + 1).padStart(2, "0")}`,
      cells,
      scheduledCount: Array.from(jobMap.values()).reduce((sum, rows) => sum + rows.length, 0),
    };
  }, [jobs, selectedMonth, userRole]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const sample = jobs.slice(0, 30).map(calendarDebugRow);
    const logKey = `portal-${selectedMonth}-${sample.length}-${sample.some((job) => job.remakeDetected)}`;
    if (window.__DAELIM_PORTAL_CALENDAR_DEBUG_KEY__ === logKey) return;
    window.__DAELIM_PORTAL_CALENDAR_DEBUG_KEY__ = logKey;
    console.log("[MonthlyConstructionCalendar:portal] jobs", sample);
  }, [jobs, selectedMonth]);

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-blue-600">{"\uC2DC\uACF5 \uCE98\uB9B0\uB354"}</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">
            {calendarData.title} {"\uC2DC\uACF5\uC77C\uC815"}
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {"\uB0A0\uC9DC\uBCC4 \uBC30\uC815 \uD604\uC7A5"} {calendarData.scheduledCount}{"\uAC74"}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              일반
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              재마감
            </span>
            {userRole === "partner" ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              기사 미배정
            </span>
            ) : null}
          </div>
        </div>
        <CalendarDays className="h-5 w-5 text-blue-500" />
      </div>

      <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[10px] font-black text-slate-400">
        {["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"].map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5 md:gap-1">
        {calendarData.cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            onClick={() => cell.rows.length && onSelectDate?.(cell.key)}
            className={`min-h-[66px] rounded-xl border p-1.5 text-left transition active:scale-[0.99] md:min-h-[104px] md:rounded-2xl md:p-2 ${
              cell.inMonth
                ? cell.hasUnassigned
                  ? "border-rose-300 bg-rose-50"
                  : cell.hasRefinishing
                    ? "border-orange-300 bg-orange-50"
                    : "border-slate-100 bg-slate-50"
                : "border-slate-50 bg-white text-slate-300"
            } ${cell.rows.length ? (cell.hasUnassigned ? "hover:border-rose-400 hover:bg-rose-100" : cell.hasRefinishing ? "hover:border-orange-400 hover:bg-orange-100" : "hover:border-blue-200 hover:bg-blue-50") : ""} ${
              selectedDate === cell.key
                ? cell.hasUnassigned
                  ? "border-rose-500 bg-rose-100 ring-2 ring-rose-200 hover:border-rose-500 hover:bg-rose-100"
                  : cell.hasRefinishing
                    ? "border-orange-500 bg-orange-100 ring-2 ring-orange-200 hover:border-orange-500 hover:bg-orange-100"
                    : "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-0.5">
              <div className="flex items-center gap-1">
                <span className={`text-xs font-black ${cell.isToday ? "rounded-full bg-blue-600 px-1.5 py-0.5 text-white" : cell.hasUnassigned ? "text-rose-700" : cell.hasRefinishing ? "text-orange-700" : "text-slate-600"}`}>
                  {cell.date.getDate()}
                </span>
                {cell.hasUnassigned ? (
                  <span className="rounded-full bg-rose-500 px-1 text-[8px] font-black leading-3 text-white">미</span>
                ) : null}
                {cell.hasRefinishing ? (
                  <span className="rounded-full bg-orange-500 px-1 text-[8px] font-black leading-3 text-white">재</span>
                ) : null}
              </div>
              {cell.rows.length ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${cell.hasUnassigned ? "bg-rose-100 text-rose-700" : cell.hasRefinishing ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                  {cell.rows.length}
                </span>
              ) : null}
            </div>
            {cell.rows.length ? (
              <div className="mt-1 flex flex-wrap items-center gap-0.5">
                {cell.rows.slice(0, 6).map((job, dotIndex) => (
                  <span
                    key={`${cell.key}-dot-${job.rowNumber || dotIndex}-${dotIndex}`}
                    className={`h-1.5 w-1.5 rounded-full ring-1 ring-white md:h-2 md:w-2 ${cell.hasUnassigned && (isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청") ? "bg-rose-500" : isRefinishingJob(job) ? "bg-orange-500" : "bg-emerald-500"}`}
                  />
                ))}
                {cell.rows.length > 6 ? (
                  <span className="text-[9px] font-black leading-none text-slate-500">+{cell.rows.length - 6}</span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-0.5 space-y-0.5 md:mt-1 md:space-y-1">
              {cell.rows.slice(0, 2).map((job) => (
                <div key={`${cell.key}-${job.month}-${job.rowNumber}`} className={`hidden truncate rounded-lg bg-white px-1 py-0.5 text-[9px] font-black shadow-sm sm:block md:px-1.5 md:py-1 md:text-[10px] ${cell.hasUnassigned && (isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청") ? "text-rose-700" : isRefinishingJob(job) ? "text-orange-700" : "text-slate-700"}`}>
                  {job.customer || "\uD604\uC7A5"}
                </div>
              ))}
              {cell.rows.length > 2 ? (
                <div className="px-1 text-[9px] font-black text-blue-600 md:px-1.5 md:text-[10px]">+{cell.rows.length - 2}</div>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EngineerDashboard({ stats, selectedFilter = "", onSelectFilter }) {
  const cards = [
    ["오늘 시공", stats.today, "today", CalendarDays],
    ["이번주 시공", stats.week, "week", CalendarDays],
    ["이번달 시공", stats.month, "month", ClipboardList],
    ["완료사진 필요", stats.photoNeeded, "photoNeeded", Camera],
    ["완료보고 대기", stats.completePending, "completePending", Upload],
    ["시공완료", stats.complete, "complete", CheckCircle2],
    ["내 전체 현장", stats.total, "all", ShieldCheck],
  ];

  const isSelected = (filter) => {
    if (filter === "all") return !selectedFilter;
    return selectedFilter === filter;
  };

  return (
    <section className="space-y-3 rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div>
        <p className="text-xs font-black text-blue-600">시공기사 대시보드</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">내 일정 / 처리 현장</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(([label, value, filter, Icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectFilter?.(filter)}
            className={`rounded-2xl border p-3 text-left shadow-sm active:scale-[0.99] ${
              isSelected(filter)
                ? "border-blue-300 bg-blue-50"
                : "border-slate-100 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black text-slate-500">{label}</p>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function PartnerPaymentDashboard({ jobs = [], stats, paymentTotal, selectedEngineer, onSelectEngineer, onClearEngineer, onSelectSummary }) {
  const dashboard = useMemo(() => {
    const itemTotals = jobs.reduce((acc, job) => {
      acc.kitchen += numberValue(job.kitchenPaymentAmount);
      acc.builtIn += numberValue(job.builtInPaymentAmount ?? job.storagePaymentAmount);
      acc.entrance += numberValue(job.entrancePaymentAmount);
      acc.extra += numberValue(job.extraPaymentAmount);
      acc.total += partnerPaymentAmount(job);
      return acc;
    }, { kitchen: 0, builtIn: 0, entrance: 0, extra: 0, total: 0 });

    const engineerMap = new Map();
    jobs.forEach((job) => {
      const name = String(job.engineer || "\uBBF8\uBC30\uC815").trim() || "\uBBF8\uBC30\uC815";
      const row = engineerMap.get(name) || { name, count: 0, total: 0 };
      row.count += 1;
      row.total += partnerPaymentAmount(job);
      engineerMap.set(name, row);
    });

    return {
      itemTotals,
      engineerRows: Array.from(engineerMap.values()).sort((a, b) => b.total - a.total || b.count - a.count),
    };
  }, [jobs]);

  const summaryCards = [
    ["\uC804\uCCB4 \uD604\uC7A5", stats.total, "today"],
    ["\uC774\uBC88\uB2EC \uBC30\uC815 \uD604\uC7A5", stats.total, "today"],
    ["\uC774\uBC88\uC8FC \uC2DC\uACF5 \uC608\uC815", stats.week, "today"],
    ["\uC2DC\uACF5\uC644\uB8CC", stats.complete, "complete"],
    ["\uC644\uB8CC\uC0AC\uC9C4 \uD544\uC694", stats.completePhotoMissing, "photo"],
    ["\uC2DC\uACF5\uAE30\uC0AC \uBBF8\uBC30\uC815", stats.unassigned, "unassigned"],
    ["\uC9C0\uAE09\uC2DC\uACF5\uBE44 \uD569\uACC4", formatMoney(paymentTotal), "today"],
  ];
  const itemRows = [
    ["\uC8FC\uBC29 \uC9C0\uAE09", dashboard.itemTotals.kitchen],
    ["\uBD99\uBC15\uC774 \uC9C0\uAE09", dashboard.itemTotals.builtIn],
    ["\uD604\uAD00 \uC9C0\uAE09", dashboard.itemTotals.entrance],
    ["\uCD94\uAC00 \uC9C0\uAE09", dashboard.itemTotals.extra],
    ["\uCD1D \uC9C0\uAE09", dashboard.itemTotals.total],
  ];

  return (
    <section className="space-y-3 rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-emerald-600">{"\uC9C0\uAE09\uC2DC\uACF5\uBE44 \uC694\uC57D"}</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{"\uBC30\uC815\uD604\uC7A5 \uC815\uC0B0 \uD604\uD669"}</h2>
        </div>
        {selectedEngineer ? (
          <button type="button" onClick={onClearEngineer} className="rounded-full border px-3 py-1.5 text-xs font-black text-slate-600">
            {"\uD544\uD130 \uD574\uC81C"}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {summaryCards.map(([label, value, tab]) => (
          <button key={label} type="button" onClick={() => onSelectSummary?.(tab)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left active:scale-[0.99]">
            <p className="text-[11px] font-black text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 p-3">
          <h3 className="text-sm font-black text-slate-900">{"\uC544\uC774\uD15C\uBCC4 \uC9C0\uAE09\uC2DC\uACF5\uBE44"}</h3>
          <div className="mt-3 space-y-2">
            {itemRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-500">{label}</span>
                <span className="font-black text-slate-900">{formatMoney(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 p-3">
          <h3 className="text-sm font-black text-slate-900">{"\uC2DC\uACF5\uAE30\uC0AC\uBCC4 \uC9C0\uAE09\uC2DC\uACF5\uBE44"}</h3>
          <div className="mt-3 space-y-2">
            {dashboard.engineerRows.length ? dashboard.engineerRows.map((row) => (
              <button
                key={row.name}
                type="button"
                onClick={() => onSelectEngineer(row.name)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${
                  selectedEngineer === row.name ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-slate-50"
                }`}
              >
                <span>
                  <span className="block text-sm font-black text-slate-900">{row.name}</span>
                  <span className="text-xs font-bold text-slate-400">{row.count}{"\uAC74"}</span>
                </span>
                <span className="text-sm font-black text-slate-900">{formatMoney(row.total)}</span>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm font-bold text-slate-400">
                {"\uBC30\uC815\uB41C \uC2DC\uACF5\uAE30\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConstructionCalendar({ jobs = [], selectedMonth = "", onSelectTab }) {
  const days = useMemo(() => {
    const map = new Map();

    jobs.forEach((job) => {
      const date = parseJobDate(job.installDate);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const rows = map.get(key) || [];
      rows.push(job);
      map.set(key, rows);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10)
      .map(([date, rows]) => ({ date, rows }));
  }, [jobs]);

  const emptyText = selectedMonth === "all" ? "표시할 시공 일정이 없습니다." : `${selectedMonth} 시공 일정이 없습니다.`;

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-blue-600">시공 캘린더</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">
            {selectedMonth === "all" ? "전체 월 시공 일정" : `${selectedMonth} 시공 일정`}
          </h2>
        </div>
        <CalendarDays className="h-5 w-5 text-blue-500" />
      </div>

      <div className="mt-4 space-y-2">
        {days.length ? days.map(({ date, rows }) => (
          <button
            key={date}
            type="button"
            onClick={() => onSelectTab?.("today")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-black text-slate-900">{shortDate(date)}</p>
              <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-500">
                {rows.slice(0, 3).map((job) => job.customer).filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">{rows.some(isRefinishingJob) ? <RefinishingBadge /> : null}<Badge className="border-blue-200 bg-blue-50 text-blue-700">{rows.length}건</Badge></div>
          </button>
        )) : (
          <div className="rounded-2xl border border-dashed p-5 text-center text-sm font-bold text-slate-400">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

function StatGrid({ user, stats, setActiveTab }) {
  const cards = user.role === "partner" ? [
    ["전체 현장", stats.total, "today", ClipboardList],
    ["시공기사 미배정", stats.unassigned, "unassigned", Users],
    ["완료사진 필요", stats.completePhotoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ] : [
    ["내 현장", stats.total, "today", ClipboardList],
    ["진행중", stats.total - stats.complete, "progress", ShieldCheck],
    ["완료사진 필요", stats.completePhotoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ];

  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map(([title, value, tab, Icon]) => (
        <button key={title} onClick={() => setActiveTab(tab)} className="rounded-2xl border bg-white p-3 text-left shadow-sm active:scale-[0.99] md:rounded-3xl md:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-500">{title}</p>
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black md:mt-3 md:text-3xl">{value}</p>
        </button>
      ))}
    </section>
  );
}

function TabBar({ user, activeTab, setActiveTab }) {
  const tabs = user.role === "partner"
    ? [["today", "전체"], ["unassigned", "미배정"], ["photo", "사진필요"], ["progress", "진행중"], ["complete", "완료"]]
    : [["today", "전체"], ["progress", "진행중"], ["photo", "사진필요"], ["complete", "완료"]];

  return (
    <nav className="sticky top-0 z-30 rounded-3xl border bg-white/95 p-1 shadow-sm backdrop-blur">
      <div className={`grid gap-1 ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`rounded-2xl px-2 py-3 text-[12px] font-black ${activeTab === key ? "bg-slate-900 text-white" : "text-slate-500"}`}>{label}</button>
        ))}
      </div>
    </nav>
  );
}

function JobCard({ job, user, onDetail, onUpload, onHistory, onComplete, completing = false }) {
  const isComplete = job.status === "시공완료";
  const locked = isJobLocked(job);
  const completePhotoReady = hasCompletionPhoto(job);
  const needsEngineer = user.role === "partner" && (isUnassignedEngineerValue(job.engineer) || job.status === "기사배정요청");

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

function Info({ label, value }) {
  return <div><p className="text-[11px] font-black text-slate-400">{label}</p><p className="mt-1 font-black text-slate-700">{value || "-"}</p></div>;
}

function JobDetailModal({ job, user, onClose, onUpload, onHistory, onAssign, engineerOptions = [], assigning = false, completing = false, actionMessage = "", onComplete, onCopyAddress, addressCopied = false, onPhotoView }) {
  const [engineer, setInstaller] = useState(isUnassignedEngineerValue(job.engineer) ? "" : job.engineer || "");
  const engineerNames = engineerOptions.map((item) => item.name);
  const isComplete = job.status === "시공완료";
  const locked = isJobLocked(job);
  const completePhotoReady = hasCompletionPhoto(job);
  const canAssignEngineer = user.role === "partner";

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
            {user.role === "partner" ? <DetailRow label="지급시공비" value={formatMoney(partnerPaymentAmount(job))} /> : null}
            {user.role === "partner" && job.extraPaymentMemo ? <DetailRow label="지급 추가비용 내용" value={job.extraPaymentMemo} /> : null}
          </DetailBox>
        </div>

        {canAssignEngineer ? (
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
        ) : null}

        <DetailBox title="현장 메모 / 중요 이력" className="mt-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{job.siteMemo || "메모 없음"}</div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-900 whitespace-pre-wrap">{job.history || "중요 이력 없음"}</div>
        </DetailBox>

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

function PhotoViewerModal({ job, photos = [], photoInfo = null, loading = false, error = "", initialCategory = "\uC804\uCCB4", onClose, onRefresh, onViewR2 }) {
  const ALL_TAB = "\uC804\uCCB4";
  const counts = photoInfo?.counts || job?.photoCounts || {};
  const urls = photoInfo?.urls || job?.photoUrls || {};
  const tabs = [ALL_TAB, ...PHOTO_CATEGORY_OPTIONS];
  const r2Photos = useMemo(() => photos.filter((photo) => String(photo.storageLocation || "").toLowerCase() === "r2" || !!photo.storageKey), [photos]);
  const [activeCategory, setActiveCategory] = useState(initialCategory || ALL_TAB);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [secretVersion, setSecretVersion] = useState(0);
  const touchStartXRef = useRef(null);
  const viewUrlCacheRef = useRef({});

  const visiblePhotos = useMemo(() => {
    if (activeCategory === ALL_TAB) return r2Photos;
    return r2Photos.filter((photo) => photo.photoCategory === activeCategory);
  }, [activeCategory, r2Photos]);

  const categoryCount = (category) => {
    const actualCount = category === ALL_TAB
      ? r2Photos.length
      : r2Photos.filter((photo) => normalizePhotoCategory(photo.photoCategory) === category).length;
    const fallbackCount = category === ALL_TAB
      ? PHOTO_CATEGORY_OPTIONS.reduce((sum, key) => sum + numberValue(counts?.[key]), 0)
      : numberValue(counts?.[category]);
    return actualCount || fallbackCount;
  };
  const categoryCountLabel = (category) => `${category} ${categoryCount(category)}\uC7A5`;
  const activeCountLabel = `${activeCategory === ALL_TAB ? "\uC804\uCCB4" : activeCategory} ${categoryCount(activeCategory)}\uC7A5`;

  const activePhoto = visiblePhotos[activeIndex] || null;
  const fallbackCount = visiblePhotos.length ? 0 : (activeCategory === ALL_TAB ? PHOTO_CATEGORY_OPTIONS.reduce((sum, key) => sum + numberValue(counts?.[key]), 0) : numberValue(counts?.[activeCategory]));
  const fallbackUrl = activeCategory === ALL_TAB ? job?.photoUrl : urls?.[activeCategory] || job?.photoUrl || "";
  const hasFallback = !!fallbackUrl && fallbackCount > 0;
  const hasPhotos = visiblePhotos.length > 0 || hasFallback;
  const needsSecret = false;

  useEffect(() => {
    setActiveCategory(initialCategory || ALL_TAB);
  }, [initialCategory, job?.rowNumber, job?.month]);

  useEffect(() => {
    setActiveIndex(0);
    setImageUrl("");
    setImageError("");
  }, [activeCategory, visiblePhotos.length, job?.rowNumber]);

  useEffect(() => {
    let ignore = false;
    const loadImage = async () => {
      if (!activePhoto) {
        setImageUrl("");
        setImageError("");
        return;
      }
      const key = activePhoto.photoId || activePhoto.storageKey;
      if (viewUrlCacheRef.current[key]) {
        setImageUrl(viewUrlCacheRef.current[key]);
        return;
      }
      setImageLoading(true);
      setImageError("");
      try {
        const url = await onViewR2(activePhoto);
        if (!ignore) {
          viewUrlCacheRef.current[key] = url;
          imageDisplayStartRef.current = r2Now();
          setImageUrl(url || "");
          if (!url) setImageError("\uC0AC\uC9C4\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        }
      } catch (err) {
        if (!ignore) {
          setImageUrl("");
          setImageError(err?.message || "\uC0AC\uC9C4\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        }
      } finally {
        if (!ignore) setImageLoading(false);
      }
    };
    loadImage();
    return () => { ignore = true; };
  }, [activePhoto, secretVersion]);

  const move = (direction) => {
    if (visiblePhotos.length <= 1) return;
    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) return visiblePhotos.length - 1;
      if (next >= visiblePhotos.length) return 0;
      return next;
    });
  };


  if (!job) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-white p-4 shadow-2xl md:rounded-[2rem] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-indigo-600">{"\uC0AC\uC9C4\uBCF4\uAE30"}</p>
            <h2 className="mt-1 break-words text-xl font-black text-slate-900">{job.customer}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{job.month} / ROW {job.rowNumber} / {installPeriod(job)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${activeCategory === category ? "bg-slate-900 text-white" : "border bg-white text-slate-600"}`}>{categoryCountLabel(category)}</button>)}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-500">{activeCountLabel}</p>
          <button type="button" onClick={onRefresh} disabled={loading} className="rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">{"\uC0C8\uB85C\uACE0\uCE68"}</button>
        </div>

        {loading ? <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{"\uC0AC\uC9C4 \uBD88\uB7EC\uC624\uB294 \uC911"}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-black text-rose-700">{error}</div> : null}

        {visiblePhotos.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white">
            <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-black md:min-h-[420px]" onTouchStart={(e) => { touchStartXRef.current = e.touches?.[0]?.clientX ?? null; }} onTouchEnd={(e) => { if (touchStartXRef.current === null) return; const endX = e.changedTouches?.[0]?.clientX ?? touchStartXRef.current; const diff = touchStartXRef.current - endX; touchStartXRef.current = null; if (Math.abs(diff) >= 40) move(diff > 0 ? 1 : -1); }}>
              {imageLoading ? <div className="flex items-center gap-2 text-sm font-bold text-white"><Loader2 className="h-4 w-4 animate-spin" />{"\uC0AC\uC9C4 \uBD88\uB7EC\uC624\uB294 \uC911"}</div> : null}
              {!imageLoading && imageUrl ? <button type="button" onClick={() => setZoomOpen(true)} className="flex h-full w-full items-center justify-center" aria-label="\uC0AC\uC9C4 \uD655\uB300\uBCF4\uAE30"><img src={imageUrl} alt="\uC0AC\uC9C4 \uC0C1\uC138" className="max-h-[70vh] w-full object-contain" onLoad={() => logR2Timing("partner-photo-viewer", "image displayed", imageDisplayStartRef.current || r2Now())} /></button> : null}
              {!imageLoading && imageError ? <div className="mx-4 rounded-xl bg-rose-500/15 px-4 py-3 text-center text-sm font-bold text-rose-100">{imageError}</div> : null}
              {visiblePhotos.length > 1 ? (
                <>
                  <button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg font-black text-slate-900">{"<"}</button>
                  <button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg font-black text-slate-900">{">"}</button>
                </>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-300">{activeCategory} / {activeIndex + 1}/{visiblePhotos.length}</p>
              <div className="flex max-w-[70%] gap-2 overflow-x-auto">
                {visiblePhotos.map((photo, index) => <button key={photo.photoId || photo.storageKey} type="button" onClick={() => setActiveIndex(index)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black ${index === activeIndex ? "border-white bg-white text-slate-900" : "border-white/20 bg-white/10 text-white"}`}>{index + 1}</button>)}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !hasPhotos ? <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm font-bold text-slate-400">{"\uB4F1\uB85D\uB41C \uC0AC\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : null}

        {!visiblePhotos.length && hasFallback ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">{"\uAE30\uC874 \uC0AC\uC9C4"} {fallbackCount}{"\uAC1C"}</p>
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white">{"\uAE30\uC874 \uC0AC\uC9C4 \uBCF4\uAE30"}</a>
          </div>
        ) : null}
      </div>
      {zoomOpen && imageUrl ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 p-3 text-white md:p-6" onTouchStart={(e) => { touchStartXRef.current = e.touches?.[0]?.clientX ?? null; }} onTouchEnd={(e) => { if (touchStartXRef.current === null) return; const endX = e.changedTouches?.[0]?.clientX ?? touchStartXRef.current; const diff = touchStartXRef.current - endX; touchStartXRef.current = null; if (Math.abs(diff) >= 40) move(diff > 0 ? 1 : -1); }}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-black">{activeCategory} ? {activeIndex + 1} / {visiblePhotos.length}</p>
            <button type="button" onClick={() => setZoomOpen(false)} className="rounded-full bg-white/15 p-3 text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <img src={imageUrl} alt="\uC0AC\uC9C4 \uC0C1\uC138" className="max-h-full max-w-full object-contain" />
            {visiblePhotos.length > 1 ? (<>
              <button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-lg font-black text-slate-900">{"<"}</button>
              <button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-lg font-black text-slate-900">{">"}</button>
            </>) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
function UploadModal({ job, onClose, onSubmit, uploading = false, progress = "", message = "", onPhotoView }) {
  const [category, setCategory] = useState("시공전");
  const [files, setFiles] = useState([]);
  const [localMessage, setLocalMessage] = useState("");
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadDoneMessage, setUploadDoneMessage] = useState("");

  const submit = async () => {
    const check = validateUploadFiles(files, category);

    if (!check.ok) {
      setLocalMessage(check.message);
      return;
    }

    setLocalMessage("");
    try {
      const result = await onSubmit(job, category, files);
      if (result?.success === true || result === true) {
        setLocalMessage("");
        setUploadDone(true);
        setUploadDoneMessage(result?.message || `${category} ${files.length}\uC7A5 \uC0AC\uC9C4\uB4F1\uB85D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
        return;
      }
      setUploadDone(false);
      setUploadDoneMessage("");
      setLocalMessage(result?.message || "\uC0AC\uC9C4\uB4F1\uB85D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      console.error(error);
      setUploadDone(false);
      setUploadDoneMessage("");
      setLocalMessage(error?.message || "\uC0AC\uC9C4\uB4F1\uB85D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">사진등록</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{job.customer} 현장</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">이미지는 최대 15개, PDF는 계약도면에만 등록합니다.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>사진 구분</FieldLabel>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setFiles([]); setLocalMessage(""); setUploadDone(false); setUploadDoneMessage(""); }} disabled={uploading || uploadDone} className="w-full rounded-2xl border px-4 py-3 font-bold disabled:opacity-50">
              {PHOTO_CATEGORY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>{category === "계약도면" ? "PDF 또는 이미지 선택" : "갤러리에서 사진 선택"}</FieldLabel>
            <input type="file" accept={getUploadAccept(category)} multiple disabled={uploading || uploadDone} onChange={(e) => { setFiles(Array.from(e.target.files || [])); setLocalMessage(""); setUploadDone(false); setUploadDoneMessage(""); }} className="w-full rounded-2xl border px-4 py-3 text-sm disabled:opacity-50" />
            {files.length ? <p className="mt-2 text-xs font-bold text-emerald-700">선택됨: {files.length}개</p> : null}
          </div>
        </div>

        {!uploadDone && progress ? <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{progress}</div> : null}
        {uploadDone ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700"><p>{"\uC0AC\uC9C4\uB4F1\uB85D \uC644\uB8CC"}</p>{uploadDoneMessage ? <p className="mt-1 text-xs font-bold text-emerald-600">{uploadDoneMessage}</p> : null}</div> : null}
        {!uploadDone && (localMessage || message) ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700"><p>{"\uC0AC\uC9C4\uB4F1\uB85D \uC2E4\uD328"}</p><p className="mt-1 text-xs font-bold text-rose-600">{localMessage || message}</p></div> : null}

        {uploadDone ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button onClick={onPhotoView} className="rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-black text-white">{"\uC0AC\uC9C4\uBCF4\uAE30"}</button>
            <button onClick={() => { setFiles([]); setLocalMessage(""); setUploadDone(false); setUploadDoneMessage(""); }} className="rounded-2xl border px-3 py-3 text-xs font-black">{"\uACC4\uC18D \uB4F1\uB85D"}</button>
            <button onClick={onClose} className="rounded-2xl border px-3 py-3 text-xs font-black">{"\uB2EB\uAE30"}</button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={onClose} disabled={uploading} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50">{"\uCDE8\uC18C"}</button>
            <button onClick={submit} disabled={uploading || !files.length || uploadDone} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "\uB4F1\uB85D \uC911" : "\uC0AC\uC9C4\uB4F1\uB85D"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryModal({ job, onClose, onSubmit, saving = false, message = "" }) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">이력등록</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{job.customer} 현장</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5">
          <FieldLabel>중요 이력 내용</FieldLabel>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-36 w-full rounded-2xl border px-4 py-3 text-sm" placeholder="예: 자재누락, 고객 요청, 재방문 필요, 완료보고 특이사항 등" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50">취소</button>
          <button onClick={() => onSubmit(job, text)} disabled={saving || !text.trim()} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "저장 중" : "등록"}
          </button>
        </div>
        {message ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div> : null}
      </div>
    </div>
  );
}


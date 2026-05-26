import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Camera, ClipboardList, Loader2, PlusCircle, Search, Upload, X } from "lucide-react";

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzunWIU75WOPAnZLS9MGqgLLJ9-P4P1f59gNpggLcWcEGs_P0NArHOLdKNwwPQGekMewg/exec";

const IS_CANVAS_PREVIEW =
  typeof window !== "undefined" &&
  /chatgpt|openai|oaiusercontent|sandbox|usercontent/i.test(window.location.hostname);

const MOCK_DELAY = 300;
const FRONT_CACHE_TTL = 1000 * 60 * 10;
const PHOTO_UPLOAD_ACCEPT = ".jpg,.jpeg,.jfif,.png,.webp,.heic,.heif,.gif,.bmp,.tif,.tiff,.avif";
const PDF_UPLOAD_ACCEPT = ".pdf";
const DRAWING_UPLOAD_ACCEPT = `${PHOTO_UPLOAD_ACCEPT},.pdf`;

function getUploadAccept(category) {
  return category === "계약도면" ? DRAWING_UPLOAD_ACCEPT : PHOTO_UPLOAD_ACCEPT;
}

function getUploadHelpText(category) {
  return category === "계약도면"
    ? "계약도면은 이미지 또는 PDF 파일을 등록할 수 있습니다."
    : "사진은 JPG, PNG, WEBP, HEIC 등 주요 이미지 파일을 등록할 수 있습니다.";
}

function readFrontCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > FRONT_CACHE_TTL) return null;
    return parsed.data;
  } catch (error) {
    return null;
  }
}

function writeFrontCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    // 저장공간 부족 등은 무시하고 API 조회로 대체
  }
}

function clearFrontCacheByMonth(month) {
  try {
    sessionStorage.removeItem(`init_${month}`);
    sessionStorage.removeItem(`jobs_${month}`);
    sessionStorage.removeItem(`dashboard_${month}`);
  } catch (error) {}
}

const MOCK_MONTHS = ["26.05", "26.06", "26.07"];

const MOCK_JOBS = [
  {
    rowNumber: 4,
    customer: "김민수",
    manager: "최하준",
    phone: "010-1234-5678",
    address: "서울 강남구 역삼동 123-45",
    item: "부엌",
    status: "시공중",
    installDate: "2026-05-24",
    endDate: "2026-05-26",
    partner: "대림 협력사 A",
    installer: "홍길동",
    installerPhone: "010-9999-1111",
    living: "Y",
    assembly: "Y",
    photo: "등록완료",
    photoUrl: "#",
    orderStatus: "발주완료",
    siteMemo: "엘리베이터 사용 가능",
    history: "2026-05-20 고객 일정 변경 요청",
    photoCounts: {
      계약도면: 2,
      시공전: 4,
      완료사진: 1,
      기타: 0,
    },
  },
  {
    rowNumber: 5,
    customer: "박서준",
    manager: "최하준",
    phone: "010-2222-3333",
    address: "경기 성남시 분당구 정자동",
    item: "현관",
    status: "협력사배정대기",
    installDate: "2026-05-28",
    endDate: "2026-05-28",
    partner: "미배정",
    installer: "미배정",
    installerPhone: "",
    living: "N",
    assembly: "N",
    photo: "미등록",
    photoUrl: "",
    orderStatus: "계약중",
    siteMemo: "주차 협소",
    history: "",
    photoCounts: {
      계약도면: 0,
      시공전: 0,
      완료사진: 0,
      기타: 0,
    },
  },
];

function mockWait() {
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
}

async function mockGetInit(month) {
  await mockWait();

  return {
    success: true,
    month,
    months: MOCK_MONTHS,
    rows: MOCK_JOBS,
    summary: {
      currentMonthCount: 18,
      currentMonthCompleted: 7,
      currentMonthInProgress: 11,
      weekCount: 5,
      nextMonthCount: 9,
    },
  };
}

async function mockGetJobs() {
  await mockWait();

  return {
    success: true,
    rows: MOCK_JOBS,
    sheet: "26.05",
  };
}

async function mockGetMonths() {
  await mockWait();

  return {
    success: true,
    months: MOCK_MONTHS,
  };
}

async function mockGetDashboard() {
  await mockWait();

  return {
    success: true,
    currentMonthCount: 18,
    currentMonthCompleted: 7,
    currentMonthInProgress: 11,
    weekCount: 5,
    nextMonthCount: 9,
  };
}

async function mockApiPost(payload) {
  await mockWait();

  console.log("MOCK API POST", payload);

  return {
    success: true,
    message: "MOCK SUCCESS",
  };
}


const EMPTY_FORM = {
  manager: "",
  customer: "",
  phone: "",
  contractPrice: "",
  orderStatus: "",
  address: "",
  addressDetail: "",
  item: "",
  living: "",
  assembly: "",
  woodDate: "",
  endDate: "",
  stoneDate: "",
  siteMemo: "",
  status: "",
  partner: "",
  installer: "",
  installerPhone: "",
  editPassword: "",
};

const ORDER_STATUS_OPTIONS = ["계약중", "발주완료", "보류", "취소"];
const ITEM_OPTIONS = ["부엌", "현관", "붙박이", "부엌, 현관", "부엌, 붙박이", "현관, 붙박이", "부엌, 현관, 붙박이"];
const LIVING_OPTIONS = [
  { value: "Y", label: "거주" },
  { value: "N", label: "비거주" },
];
const ASSEMBLY_OPTIONS = [
  { value: "Y", label: "조립출고" },
  { value: "N", label: "일반출고" },
];
const PHOTO_CATEGORY_OPTIONS = ["계약도면", "시공전", "완료사진", "기타"];
const STATUS_OPTIONS = ["협력사배정대기", "협력사배정완료", "기사배정요청", "기사배정완료", "시공계획확정", "시공중", "시공완료", "보류", "취소", "AS접수"];

const OPTION_CLASS = {
  계약중: "border-amber-200 bg-amber-50 text-amber-700",
  발주완료: "border-emerald-200 bg-emerald-50 text-emerald-700",
  보류: "border-yellow-200 bg-yellow-50 text-yellow-700",
  취소: "border-slate-300 bg-slate-100 text-slate-600",
  부엌: "border-orange-200 bg-orange-50 text-orange-700",
  현관: "border-cyan-200 bg-cyan-50 text-cyan-700",
  붙박이: "border-violet-200 bg-violet-50 text-violet-700",
  "부엌, 현관": "border-blue-200 bg-blue-50 text-blue-700",
  "부엌, 붙박이": "border-purple-200 bg-purple-50 text-purple-700",
  "현관, 붙박이": "border-teal-200 bg-teal-50 text-teal-700",
  "부엌, 현관, 붙박이": "border-rose-200 bg-rose-50 text-rose-700",
  Y: "border-blue-200 bg-blue-50 text-blue-700",
  N: "border-orange-200 bg-orange-50 text-orange-700",
  계약도면: "border-indigo-200 bg-indigo-50 text-indigo-700",
  시공전: "border-sky-200 bg-sky-50 text-sky-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  완료사진: "border-emerald-200 bg-emerald-50 text-emerald-700",
  기타: "border-slate-300 bg-slate-100 text-slate-600",
};

const STATUS_CLASS = {
  협력사배정대기: "bg-rose-50 text-rose-700 border-rose-200",
  협력사배정완료: "bg-sky-50 text-sky-700 border-sky-200",
  기사배정요청: "bg-amber-50 text-amber-700 border-amber-200",
  기사배정완료: "bg-blue-50 text-blue-700 border-blue-200",
  시공계획확정: "bg-lime-50 text-lime-700 border-lime-200",
  시공중: "bg-purple-50 text-purple-700 border-purple-200",
  시공완료: "bg-emerald-600 text-white border-emerald-700",
  보류: "bg-yellow-50 text-yellow-700 border-yellow-200",
  취소: "bg-slate-200 text-slate-500 border-slate-300",
  AS접수: "bg-red-50 text-red-700 border-red-200",
};

function Badge({ children, className = "" }) {
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium leading-none ${className}`}>{children}</span>;
}

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-semibold text-slate-500">{children}</label>;
}

function StatCard({ title, value, sub, Icon, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[86px] rounded-2xl border bg-white p-2.5 text-left shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[128px] md:p-5"
    >
      <div className="flex h-full flex-col justify-between md:flex-row md:items-center">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-slate-500 md:text-sm">{title}</p>
          <p className="mt-1 text-xl font-bold leading-none md:text-3xl">{value}</p>
          <p className="mt-1 truncate text-[10px] text-slate-500 md:text-xs">{sub}</p>
        </div>
        <div className="hidden rounded-2xl bg-slate-100 p-3 md:block">
          <Icon className="h-6 w-6 text-slate-700" />
        </div>
      </div>
    </button>
  );
}

function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const m = text.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(date) {
  return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value) {
  const d = parseLocalDate(value);
  if (!d) return value ? String(value) : "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function installPeriod(job) {
  const start = shortDate(job.installDate);
  const end = shortDate(job.endDate);
  if (!start) return "-";
  if (!end || start === end) return start;
  return `${start} ~ ${end}`;
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

function formatNumber(value) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function numberValue(value) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : 0;
}

function validateInstallDates(startValue, endValue) {
  const start = parseLocalDate(startValue);
  const end = parseLocalDate(endValue);

  if (!start || !end) return { ok: true };

  if (end < start) {
    return {
      ok: false,
      message: "시공 종료일은 시공 시작일보다 빠를 수 없습니다.",
    };
  }

  return { ok: true };
}

function validatePhoneValue(value, label) {
  const digits = onlyDigits(value);

  if (!digits) return { ok: true };

  if (digits.length < 10) {
    return {
      ok: false,
      message: `${label}는 10~11자리 숫자로 입력해 주세요.`,
    };
  }

  return { ok: true };
}

function validateUploadFiles(files, category) {
  const fileList = Array.from(files || []);
  const maxFiles = 15;
  const maxFileSize = 20 * 1024 * 1024;

  if (!fileList.length) {
    return { ok: false, message: "첨부할 파일을 선택해 주세요." };
  }

  if (fileList.length > maxFiles) {
    return { ok: false, message: `한 번에 최대 ${maxFiles}개까지만 등록할 수 있습니다.` };
  }

  for (const file of fileList) {
    const isImage = file.type?.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      return { ok: false, message: "이미지 또는 PDF 파일만 등록할 수 있습니다." };
    }

    if (file.size > maxFileSize) {
      return { ok: false, message: `${file.name} 파일이 20MB를 초과합니다.` };
    }

    if (isPdf && category !== "계약도면") {
      return { ok: false, message: "PDF는 계약도면 구분에만 등록해 주세요." };
    }

  }

  return { ok: true };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImageFile(file, maxWidth = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith("image/")) {
      resolve(file);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            resolve(file);
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    image.src = objectUrl;
  });
}

export default function DaelimInstallationWebApp() {
  const [tab, setTab] = useState("dashboard");
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${String(now.getFullYear()).slice(2)}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("전체");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("현장 정보를 불러오는 중입니다.");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadDoneMessage, setUploadDoneMessage] = useState("");
  const [photoCategory, setPhotoCategory] = useState("기타");
  const [pendingUploadJob, setPendingUploadJob] = useState(null);
  const [pendingUploadFiles, setPendingUploadFiles] = useState(null);
  const [summary, setSummary] = useState({ currentMonthCount: 0, currentMonthCompleted: 0, currentMonthInProgress: 0, weekCount: 0, nextMonthCount: 0 });
  const [selectedDate, setSelectedDate] = useState("");
  const [detailJob, setDetailJob] = useState(null);
  const [historyJob, setHistoryJob] = useState(null);
  const [historyActor, setHistoryActor] = useState("마스터 관리자");
  const [historyText, setHistoryText] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [postSavePhotoJob, setPostSavePhotoJob] = useState(null);
  const [postSavePhotoMonth, setPostSavePhotoMonth] = useState("");
  const [postSavePhotoMode, setPostSavePhotoMode] = useState("new");
  const [editJob, setEditJob] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editPassword, setEditPassword] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [copiedAddressJobId, setCopiedAddressJobId] = useState(null);
  const [deleteJob, setDeleteJob] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [adminJob, setAdminJob] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminProcessing, setAdminProcessing] = useState(false);
  const [adminMasterPassword, setAdminMasterPassword] = useState("");
  const [adminDeleteRequests, setAdminDeleteRequests] = useState([]);
  const [adminDeleteLoading, setAdminDeleteLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [partnerData, setPartnerData] = useState({ partners: [], installersByPartner: {}, phoneByInstaller: {} });
  const [dashboardView, setDashboardView] = useState("all");
  const [completeModal, setCompleteModal] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [serverDuplicateModal, setServerDuplicateModal] = useState(null);
  const [photoCountMap, setPhotoCountMap] = useState({});
  const touchStartX = useRef(null);
  const didInit = useRef(false);
  const postSavePhotoDismissed = useRef(false);
  const duplicateBypassRef = useRef(false);
  const jobsCacheRef = useRef({});
  const initCacheRef = useRef({});
  const operationBusy = saving || editing || deleting || adminProcessing || !!uploadingId;

  const fetchPhotoCounts = async (job, options = {}) => {
    if (!job?.rowNumber) return;
    const force = options.force === true;
    const monthForCounts = options.month || selectedMonth;
    const key = `${monthForCounts}_${job.rowNumber}`;
    if (!force && photoCountMap[key]) return photoCountMap[key];

    if (!job.photoUrl) {
      const empty = { counts: { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 }, urls: {} };
      setPhotoCountMap((prev) => ({ ...prev, [key]: empty }));
      return empty;
    }

    try {
      const data = IS_CANVAS_PREVIEW
        ? { success: true, counts: job.photoCounts || { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 }, urls: {} }
        : await fetch(`${WEBAPP_URL}?action=photoCounts&month=${encodeURIComponent(monthForCounts)}&rowNumber=${encodeURIComponent(job.rowNumber)}&t=${Date.now()}`).then((res) => res.json());

      if (!data.success) throw new Error(data.message || "사진 개수 조회 실패");

      setPhotoCountMap((prev) => ({
        ...prev,
        [key]: {
          counts: data.counts || { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 },
          urls: data.urls || {},
        },
      }));
      return {
        counts: data.counts || { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 },
        urls: data.urls || {},
      };
    } catch (error) {
      const fallback = { counts: { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 }, urls: {} };
      setPhotoCountMap((prev) => ({ ...prev, [key]: fallback }));
      return fallback;
    }
  }; 

  const applyInitData = (data, month) => {
    setMonths(data.months || []);
    setSummary(data.summary || { currentMonthCount: 0, currentMonthCompleted: 0, currentMonthInProgress: 0, weekCount: 0, nextMonthCount: 0 });
    const nextRows = data.rows || [];
    setJobs(nextRows);
    setDetailJob((current) => current ? nextRows.find((job) => job.rowNumber === current.rowNumber) || current : current);
    setMessage(`${data.month || month} 시트 ${data.rows?.length || 0}건 조회 완료`);
    if (data.month && data.month !== selectedMonth) setSelectedMonth(data.month);
  }; 

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const todayLabel = `${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  const fetchInit = async (month = selectedMonth, options = {}) => {
    const force = options.force === true;
    const cacheKey = `init_${month}`;

    if (!force) {
      const memoryCached = initCacheRef.current[month];
      if (memoryCached) {
        applyInitData(memoryCached, month);
        setMessage(`${month} 시트 ${memoryCached.rows?.length || 0}건 조회 완료 · 캐시`);
        return memoryCached;
      }

      const storageCached = readFrontCache(cacheKey);
      if (storageCached) {
        initCacheRef.current[month] = storageCached;
        applyInitData(storageCached, month);
        setMessage(`${month} 시트 ${storageCached.rows?.length || 0}건 조회 완료 · 캐시`);
        return storageCached;
      }
    }

    try {
      setLoading(true);

      if (IS_CANVAS_PREVIEW) {
        const data = await mockGetInit(month);
        initCacheRef.current[month] = data;
        jobsCacheRef.current[month] = data.rows || [];
        writeFrontCache(cacheKey, data);
        writeFrontCache(`jobs_${month}`, { success: true, rows: data.rows || [], sheet: month });
        applyInitData(data, month);
        setMessage(`[Canvas Mock] ${data.month} 시트 ${data.rows?.length || 0}건 조회 완료`);
        return data;
      }

      const res = await fetch(`${WEBAPP_URL}?action=init&month=${encodeURIComponent(month)}&t=${Date.now()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "초기 데이터 조회 실패");

      initCacheRef.current[month] = data;
      jobsCacheRef.current[month] = data.rows || [];
      writeFrontCache(cacheKey, data);
      writeFrontCache(`jobs_${month}`, { success: true, rows: data.rows || [], sheet: data.month || month });
      applyInitData(data, month);
      return data;
    } catch (err) {
      setMessage(String(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchMonths = async () => {
    const data = IS_CANVAS_PREVIEW
      ? await mockGetMonths()
      : await fetch(`${WEBAPP_URL}?action=months&t=${Date.now()}`).then((res) => res.json());
    if (data.success) {
      setMonths(data.months || []);
      if ((data.months || []).length && !(data.months || []).includes(selectedMonth)) setSelectedMonth(data.months[data.months.length - 1]);
    }
  };

  const fetchDashboard = async () => {
    const data = IS_CANVAS_PREVIEW
      ? await mockGetDashboard()
      : await fetch(`${WEBAPP_URL}?action=dashboard&month=${encodeURIComponent(selectedMonth)}&t=${Date.now()}`).then((res) => res.json());
    if (data.success) setSummary(data);
  };

  const fetchJobs = async (options = {}) => {
    const force = options.force === true;
    const cacheKey = `jobs_${selectedMonth}`;

    if (!force) {
      const memoryCached = jobsCacheRef.current[selectedMonth];
      if (memoryCached) {
        setJobs(memoryCached);
        setMessage(`${selectedMonth} 시트 ${memoryCached.length || 0}건 조회 완료 · 캐시`);
        return;
      }

      const storageCached = readFrontCache(cacheKey);
      if (storageCached?.rows) {
        jobsCacheRef.current[selectedMonth] = storageCached.rows || [];
        setJobs(storageCached.rows || []);
        setMessage(`${storageCached.sheet || selectedMonth} 시트 ${storageCached.rows?.length || 0}건 조회 완료 · 캐시`);
        return;
      }
    }

    try {
      setLoading(true);
      const data = IS_CANVAS_PREVIEW
        ? await mockGetJobs(selectedMonth)
        : await fetch(`${WEBAPP_URL}?action=list&month=${encodeURIComponent(selectedMonth)}&t=${Date.now()}`).then((res) => res.json());
      if (!data.success) throw new Error(data.message || "조회 실패");
      jobsCacheRef.current[selectedMonth] = data.rows || [];
      writeFrontCache(cacheKey, data);
      setJobs(data.rows || []);
      setMessage(`${data.sheet} 시트 ${data.rows?.length || 0}건 조회 완료`);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  };

  const apiPost = async (payload) => {
    if (IS_CANVAS_PREVIEW) {
      return mockApiPost(payload);
    }

    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error("API 응답을 확인할 수 없습니다.");
    }

    if (!data.success) {
      const cleanMessage = String(data.message || "요청 처리에 실패했습니다.")
        .replace(/^Error:\s*/i, "")
        .replace(/^Exception:\s*/i, "")
        .trim();

      const duplicateMatch = cleanMessage.match(/DUPLICATE_EXISTS::(.*)/);
      if (duplicateMatch) {
        const duplicateData = JSON.parse(duplicateMatch[1]);
        const duplicateError = new Error("중복 현장 감지");
        duplicateError.code = "DUPLICATE_EXISTS";
        duplicateError.duplicateData = duplicateData;
        throw duplicateError;
      }

      throw new Error(cleanMessage);
    }

    return data;
  };

  useEffect(() => {
    if (!selectedMonth) return;

    if (!didInit.current) {
      didInit.current = true;
      fetchInit(selectedMonth);
      return;
    }

    fetchInit(selectedMonth);
  }, [selectedMonth]);

  const filteredJobs = useMemo(() => {
    return [...jobs]
      .filter((job) => {
        const text = `${job.customer} ${job.address} ${job.manager} ${job.item} ${job.partner} ${job.installer} ${job.status}`;
        return (team === "전체" || job.team === team) && text.includes(query);
      })
      .sort((a, b) => {
        const ad = parseLocalDate(a.installDate || a.endDate || a.received);
        const bd = parseLocalDate(b.installDate || b.endDate || b.received);
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return ad - bd;
      });
  }, [jobs, query, team]);

  const calendar = useMemo(() => {
    const [yy, mm] = selectedMonth.split(".");
    const year = 2000 + Number(yy);
    const monthIndex = Number(mm) - 1;
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const byDate = {};
    jobs.forEach((job) => {
      const start = parseLocalDate(job.installDate);
      const end = parseLocalDate(job.endDate) || start;
      if (!start) return;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = dateKey(cursor);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(job);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    const days = [];
    for (let i = 0; i < first.getDay(); i += 1) days.push(null);
    for (let d = 1; d <= last.getDate(); d += 1) {
      const date = new Date(year, monthIndex, d);
      const key = dateKey(date);
      days.push({ day: d, key, jobs: byDate[key] || [] });
    }
    return { days, byDate };
  }, [jobs, selectedMonth]);

  const weekKeys = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return dateKey(d);
    });
  }, [today]);

  useEffect(() => {
    if (!selectedDate && todayKey.startsWith(selectedMonth)) setSelectedDate(todayKey);
  }, [selectedMonth, todayKey, selectedDate]);

  useEffect(() => {
    if (detailJob) fetchPhotoCounts(detailJob);
  }, [detailJob]);

  const selectedJobs = selectedDate ? calendar.byDate[selectedDate] || [] : [];

  const dashboardJobs = useMemo(() => {
    if (dashboardView === "week") {
      return filteredJobs.filter((job) => {
        const start = parseLocalDate(job.installDate);
        const end = parseLocalDate(job.endDate) || start;
        if (!start) return false;
        const cursor = new Date(start);
        while (cursor <= end) {
          if (weekKeys.includes(dateKey(cursor))) return true;
          cursor.setDate(cursor.getDate() + 1);
        }
        return false;
      });
    }

    return filteredJobs;
  }, [dashboardView, filteredJobs, weekKeys]);

  const dashboardTitle = dashboardView === "week"
    ? "이번주 현장 조회"
    : dashboardView === "nextMonth"
      ? "다음달 현장 조회"
      : "전체 현장 조회";

  const moveMonth = (direction) => {
    if (!months.length) return;

    const currentIndex = months.indexOf(selectedMonth);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= months.length) return;

    setSelectedMonth(months[nextIndex]);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;

    const diffX = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diffX) < 60) return;

    if (diffX < 0) {
      moveMonth(1);
    } else {
      moveMonth(-1);
    }

    touchStartX.current = null;
  };

  const updateForm = (key, value) => setForm((prev) => {
    const next = { ...prev, [key]: value };

    if (key === "woodDate" && value && (!prev.endDate || prev.endDate < value)) {
      next.endDate = value;
    }

    return next;
  });

  const showComplete = (title, message = "") => {
    setCompleteModal({ title, message });
  };

  const showError = (title, message = "") => {
    setErrorModal({ title, message });
  };

  const closeCompleteAndRefresh = async () => {
    setCompleteModal(null);
    setEditJob(null);
    setDeleteJob(null);
    setAdminJob(null);
    setDetailJob(null);
    setPendingUploadJob(null);
    setPendingUploadFiles(null);
    setPostSavePhotoJob(null);
    setPostSavePhotoMonth("");
    setPostSavePhotoMode("new");
    await fetchInit(selectedMonth, { force: true });
  };

  const openDashboardView = (view) => {
    setDashboardView(view);
    setTab("dashboard");

    if (view === "nextMonth") {
      const currentIndex = months.indexOf(selectedMonth);
      const nextMonth = currentIndex >= 0 ? months[currentIndex + 1] : "";
      if (nextMonth) setSelectedMonth(nextMonth);
    }

    setTimeout(() => {
      document.querySelector("nav")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const moveToTab = (nextTab, targetId) => {
    setTab(nextTab);
    setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const openAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소검색 스크립트가 연결되지 않았습니다. index.html에 우편번호 스크립트를 추가해 주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const roadAddress = data.roadAddress || "";
        const jibunAddress = data.jibunAddress || "";
        const buildingName = data.buildingName || "";
        const apartment = data.apartment === "Y" ? "아파트" : "";
        const extraInfo = [buildingName, apartment].filter(Boolean).join(", ");

        const address = roadAddress || jibunAddress;
        const finalAddress = extraInfo ? `${address} (${extraInfo})` : address;

        if (editJob) {
          setEditForm((prev) => ({ ...prev, address: finalAddress }));
        } else {
          updateForm("address", finalAddress);
        }
      },
    }).open();
  };

  const findDuplicateJobs = (targetForm) => {
    const normalize = (value) => String(value || "").replace(/\s/g, "").trim();

    const customer = normalize(targetForm.customer);
    const phone = onlyDigits(targetForm.phone);
    const address = normalize([targetForm.address, targetForm.addressDetail].filter(Boolean).join(" "));

    return jobs.filter((job) => {
      const jobCustomer = normalize(job.customer);
      const jobPhone = onlyDigits(job.phone);
      const jobAddress = normalize(job.address);

      return (
        (customer && phone && customer === jobCustomer && phone === jobPhone) ||
        (customer && address && customer === jobCustomer && address === jobAddress) ||
        (phone && phone === jobPhone) ||
        (address && address === jobAddress)
      );
    });
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaveMessage("");
    const required = [form.manager, form.customer, form.phone, form.address, form.item, form.woodDate, form.endDate, form.editPassword];
    if (required.some((v) => !v)) {
      showError("입력 확인", "담당자, 고객명, 연락처, 주소, 아이템, 시공 시작일, 시공 종료일, 수정 비밀번호는 필수입니다.");
      return;
    }

    if (!/^[0-9]{4}$/.test(form.editPassword)) {
      showError("입력 확인", "수정 비밀번호는 숫자 4자리로 입력해 주세요.");
      return;
    }

    const phoneCheck = validatePhoneValue(form.phone, "고객 연락처");
    if (!phoneCheck.ok) {
      showError("입력 확인", phoneCheck.message);
      return;
    }

    const dateCheck = validateInstallDates(form.woodDate, form.endDate);
    if (!dateCheck.ok) {
      showError("입력 확인", dateCheck.message);
      return;
    }

    const shouldSkipDuplicateCheck = duplicateBypassRef.current === true;

    if (!shouldSkipDuplicateCheck) {
      const duplicates = findDuplicateJobs(form);

      if (duplicates.length) {
        setDuplicateModal({
          count: duplicates.length,
          jobs: duplicates.slice(0, 5),
        });
        return;
      }
    }

    try {
      setSaving(true);
      const targetMonth = form.woodDate.slice(2, 7).replace("-", ".");
      const savedForm = { ...form };
      await apiPost({
        action: "saveOrder",
        month: targetMonth,
        skipDuplicateCheck: shouldSkipDuplicateCheck,
        ...form,
        phone: formatPhone(form.phone),
        contractPrice: numberValue(form.contractPrice),
        editPassword: form.editPassword,
        address: [form.address, form.addressDetail].filter(Boolean).join(" "),
      });

      clearFrontCacheByMonth(targetMonth);
      delete initCacheRef.current[targetMonth];
      delete jobsCacheRef.current[targetMonth];

      setForm(EMPTY_FORM);
      setSaveMessage("현장등록 완료");
      setSelectedMonth(targetMonth);

      postSavePhotoDismissed.current = false;
      setPostSavePhotoJob({
        rowNumber: null,
        customer: savedForm.customer,
        phone: savedForm.phone,
        installDate: savedForm.woodDate,
      });
      setPostSavePhotoMonth(targetMonth);
      setPostSavePhotoMode("new");

      setTimeout(async () => {
        try {
          const data = await fetchInit(targetMonth, { force: true });
          const savedJob = (data?.rows || []).slice().reverse().find((job) =>
            job.customer === savedForm.customer &&
            job.phone === savedForm.phone &&
            job.installDate === savedForm.woodDate
          );

          if (savedJob && !postSavePhotoDismissed.current) {
            setPostSavePhotoJob(savedJob);
            setPostSavePhotoMonth(targetMonth);
            setPostSavePhotoMode("new");
          }
        } catch (error) {
          console.error(error);
        }
      }, 900);
    } catch (err) {
      if (err?.code === "DUPLICATE_EXISTS") {
        setServerDuplicateModal(err.duplicateData);
        return;
      }

      showError("현장등록 실패", err?.message || "현장등록 중 오류가 발생했습니다.");
    } finally {
      duplicateBypassRef.current = false;
      setSaving(false);
    }
  };

  const uploadPhoto = async (job, files, selectedCategory = photoCategory, monthOverride = selectedMonth) => {
    if (uploadingId) return false;
    const uploadCheck = validateUploadFiles(files, selectedCategory);
    if (!uploadCheck.ok) {
      showError("사진등록 확인", uploadCheck.message);
      return false;
    }
    try {
      const fileList = Array.from(files);
      setUploadingId(job.id || `ROW-${job.rowNumber}`);
      setUploadDoneMessage("");
      setUploadProgress(`업로드 준비 중 · 0/${fileList.length}`);
      setPhotoMessage(`${job.customer} ${selectedCategory} 업로드를 시작합니다.`);

      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i];
        const shouldCompress = selectedCategory !== "계약도면";
        setUploadProgress(`${shouldCompress ? "사진 압축 중" : "파일 준비 중"} · ${i + 1}/${fileList.length}`);
        const uploadFile = shouldCompress ? await compressImageFile(file) : file;
        setUploadProgress(`등록 중 · ${i + 1}/${fileList.length}`);
        const base64 = await fileToBase64(uploadFile);
        await apiPost({
          action: "uploadPhoto",
          month: monthOverride,
          rowNumber: job.rowNumber,
          category: selectedCategory,
          fileName: uploadFile.name,
          mimeType: uploadFile.type,
          base64,
        });
      }
      setUploadProgress("사진등록 완료");
      setUploadDoneMessage(`${job.customer} ${selectedCategory} 사진등록 완료`);
      setPhotoCountMap((prev) => {
        const next = { ...prev };
        delete next[`${monthOverride}_${job.rowNumber}`];
        return next;
      });
      showComplete("사진등록 완료", `${job.customer} 현장의 ${selectedCategory} 사진등록이 완료되었습니다.`);
      setPhotoMessage(`${job.customer} ${selectedCategory} 사진 ${files.length}장 사진등록 완료`);
      clearFrontCacheByMonth(monthOverride);
      delete initCacheRef.current[monthOverride];
      delete jobsCacheRef.current[monthOverride];
      await fetchInit(monthOverride, { force: true });
      await fetchPhotoCounts(job, { force: true, month: monthOverride });
      return true;
    } catch (err) {
      setUploadProgress("사진등록 실패");
      setUploadDoneMessage(String(err));
      setPhotoMessage("");
      showError("사진등록 실패", err?.message || "사진등록 중 오류가 발생했습니다.");
      return false;
    } finally {
      setUploadingId("");
      setTimeout(() => {
        setUploadProgress("");
        setUploadDoneMessage("");
      }, 2500);
    }
  };

  const openEditModal = (job) => {
    setEditJob(job);
    setEditPassword("");
    setEditMessage("");
    setEditForm({
      manager: job.manager || "",
      customer: job.customer || "",
      phone: formatPhone(job.phone || ""),
      contractPrice: job.contractPrice ? formatNumber(job.contractPrice) : "",
      orderStatus: job.orderStatus || "",
      address: job.address || "",
      addressDetail: "",
      item: job.item || "",
      living: job.living || "",
      assembly: job.assembly || "",
      status: job.status || "",
      partner: job.partner === "미배정" ? "" : job.partner || "",
      installer: job.installer === "미배정" ? "" : job.installer || "",
      installerPhone: formatPhone(job.installerPhone || ""),
      woodDate: job.installDate || "",
      endDate: job.endDate || "",
      stoneDate: job.stoneDate || "",
      siteMemo: job.siteMemo || "",
      history: job.history || "",
      editPassword: "",
    });
  };

  const buildChangeSummary = (beforeJob, afterForm, isAdminMode) => {
    const fields = [
      ["담당자명", beforeJob.manager || "", afterForm.manager || ""],
      ["고객명", beforeJob.customer || "", afterForm.customer || ""],
      ["고객 연락처", formatPhone(beforeJob.phone || ""), formatPhone(afterForm.phone || "")],
      ["계약/발주", beforeJob.orderStatus || "", afterForm.orderStatus || ""],
      ["아이템", beforeJob.item || "", afterForm.item || ""],
      ["거주여부", beforeJob.living || "", afterForm.living || ""],
      ["조립출고", beforeJob.assembly || "", afterForm.assembly || ""],
      ["현장주소", beforeJob.address || "", [afterForm.address, afterForm.addressDetail].filter(Boolean).join(" ")],
      ["시공 시작일", beforeJob.installDate || "", afterForm.woodDate || ""],
      ["시공 종료일", beforeJob.endDate || "", afterForm.endDate || ""],
      ["대리석 시공일", beforeJob.stoneDate || "", afterForm.stoneDate || ""],
      ["현장 특이사항", beforeJob.siteMemo || "", afterForm.siteMemo || ""],
    ];

    if (isAdminMode) {
      fields.push(
        ["진행상태", beforeJob.status || "", afterForm.status || ""],
        ["협력사", beforeJob.partner === "미배정" ? "" : beforeJob.partner || "", afterForm.partner || ""],
        ["시공기사", beforeJob.installer === "미배정" ? "" : beforeJob.installer || "", afterForm.installer || ""],
        ["시공기사 연락처", formatPhone(beforeJob.installerPhone || ""), formatPhone(afterForm.installerPhone || "")],
        ["중요이력", beforeJob.history || "", afterForm.history || ""]
      );
    }

    const changed = fields
      .map(([label, beforeValue, afterValue]) => ({ label, beforeValue: String(beforeValue || "-"), afterValue: String(afterValue || "-") }))
      .filter((item) => item.beforeValue !== item.afterValue);

    if (!changed.length) return "변경된 항목은 없습니다.";

    return changed.map((item) => `- ${item.label}: ${item.beforeValue} → ${item.afterValue}`).join(String.fromCharCode(10));
  };

  const submitEditOrder = async () => {
    if (editing) return;
    setEditMessage("");

    if (!editJob) return;
    if (!adminMode && !/^[0-9]{4}$/.test(editPassword)) {
      showError("입력 확인", "수정 비밀번호 숫자 4자리를 입력해 주세요.");
      return;
    }

    const required = [editForm.manager, editForm.customer, editForm.phone, editForm.address, editForm.item, editForm.woodDate, editForm.endDate];
    if (required.some((v) => !v)) {
      showError("입력 확인", "담당자, 고객명, 연락처, 주소, 아이템, 시공 시작일, 시공 종료일은 필수입니다.");
      return;
    }

    const phoneCheck = validatePhoneValue(editForm.phone, "고객 연락처");
    if (!phoneCheck.ok) {
      showError("입력 확인", phoneCheck.message);
      return;
    }

    const installerPhoneCheck = validatePhoneValue(editForm.installerPhone, "시공기사 연락처");
    if (!installerPhoneCheck.ok) {
      showError("입력 확인", installerPhoneCheck.message);
      return;
    }

    const dateCheck = validateInstallDates(editForm.woodDate, editForm.endDate);
    if (!dateCheck.ok) {
      showError("입력 확인", dateCheck.message);
      return;
    }

    if (adminMode && editForm.installer && !editForm.partner) {
      showError("입력 확인", "시공기사를 선택하려면 협력사를 먼저 선택해 주세요.");
      return;
    }

    try {
      setEditing(true);
      await apiPost({
        action: adminMode ? "adminUpdateOrder" : "updateOrder",
        month: selectedMonth,
        rowNumber: editJob.rowNumber,
        password: adminMode ? "" : editPassword,
        masterPassword: adminMode ? adminMasterPassword : "",
        manager: editForm.manager,
        customer: editForm.customer,
        phone: formatPhone(editForm.phone),
        contractPrice: numberValue(editForm.contractPrice),
        orderStatus: editForm.orderStatus,
        address: [editForm.address, editForm.addressDetail].filter(Boolean).join(" "),
        item: editForm.item,
        living: editForm.living,
        assembly: editForm.assembly,
        status: editForm.status,
        partner: editForm.partner,
        installer: editForm.installer,
        installerPhone: formatPhone(editForm.installerPhone),
        woodDate: editForm.woodDate,
        endDate: editForm.endDate,
        stoneDate: editForm.stoneDate,
        siteMemo: editForm.siteMemo,
        history: adminMode ? editForm.history : "",
      });

      clearFrontCacheByMonth(selectedMonth);
      delete initCacheRef.current[selectedMonth];
      delete jobsCacheRef.current[selectedMonth];

      const changeSummary = buildChangeSummary(editJob, editForm, adminMode);
      setEditMessage(adminMode ? "관리자 수정 완료" : "수정 완료");
      showComplete(adminMode ? "관리자 수정 완료" : "수정 완료", changeSummary);
    } catch (err) {
      showError("수정 실패", err?.message || "수정 중 오류가 발생했습니다.");
    } finally {
      setEditing(false);
    }
  };

  const copyAddress = async (job) => {
    try {
      await navigator.clipboard.writeText(job.address || "");
      setCopiedAddressJobId(job.id || `ROW-${job.rowNumber}`);
      setTimeout(() => setCopiedAddressJobId(null), 1400);
    } catch (error) {
      setCopiedAddressJobId(job.id || `ROW-${job.rowNumber}`);
      setTimeout(() => setCopiedAddressJobId(null), 1400);
    }
  };

  const requestDelete = async () => {
    if (deleting) return;
    setDeleteMessage("");

    if (!deleteJob) return;
    if (!/^[0-9]{4}$/.test(deletePassword)) {
      showError("입력 확인", "등록 시 입력한 수정 비밀번호 숫자 4자리를 입력해 주세요.");
      return;
    }

    try {
      setDeleting(true);
      await apiPost({
        action: "requestDelete",
        month: selectedMonth,
        rowNumber: deleteJob.rowNumber,
        password: deletePassword,
      });

      setDeleteMessage("삭제요청 완료");
      showComplete("삭제요청 완료", `${deleteJob.customer} 현장의 삭제요청이 접수되었습니다.`);
    } catch (err) {
      showError("삭제요청 실패", err?.message || "삭제요청 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const fetchPartnerInstallerData = async () => {
    try {
      const data = IS_CANVAS_PREVIEW
        ? {
            success: true,
            partners: ["대림 협력사 A", "대림 협력사 B", "대림 협력사 C"],
            installersByPartner: {
              "대림 협력사 A": ["홍길동", "김기사"],
              "대림 협력사 B": ["이기사", "박기사"],
              "대림 협력사 C": ["최기사"],
            },
            phoneByInstaller: {
              홍길동: "010-9999-1111",
              김기사: "010-9999-2222",
              이기사: "010-9999-3333",
              박기사: "010-9999-4444",
              최기사: "010-9999-5555",
            },
          }
        : await fetch(`${WEBAPP_URL}?action=partnerInstallerData&t=${Date.now()}`).then((res) => res.json());
      if (!data.success && !data.partners) throw new Error(data.message || "협력사 데이터 조회 실패");
      setPartnerData({
        partners: data.partners || [],
        installersByPartner: data.installersByPartner || {},
        phoneByInstaller: data.phoneByInstaller || {},
      });
    } catch (err) {
      showError("협력사 데이터 조회 실패", err?.message || "협력사/시공기사 정보를 불러오지 못했습니다.");
    }
  };

  const verifyAdminPasswordClient = async (password) => {
    if (!password?.trim()) return false;
    if (IS_CANVAS_PREVIEW) return password === "1234";
    try {
      const res = await fetch(`${WEBAPP_URL}?action=checkAdminPassword&masterPassword=${encodeURIComponent(password)}&t=${Date.now()}`);
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      return false;
    }
  };

  const submitAdminLock = async (locked) => {
    if (adminProcessing) return;
    setAdminMessage("");

    if (!adminJob) return;
    const masterPassword = adminPassword || adminMasterPassword;
    if (!masterPassword.trim()) {
      showError("입력 확인", "마스터 비밀번호를 입력해 주세요.");
      return;
    }

    const verified = await verifyAdminPasswordClient(masterPassword);
    if (!verified) {
      showError("비밀번호 오류", "마스터 비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      setAdminProcessing(true);
      await apiPost({
        action: "setEditLock",
        month: selectedMonth,
        rowNumber: adminJob.rowNumber,
        masterPassword,
        locked,
      });

      showComplete(locked ? "관리자 잠금 완료" : "관리자 잠금해제 완료", `${adminJob.customer} 현장의 관리자 잠금 상태가 변경되었습니다.`);
    } catch (err) {
      showError("관리자 작업 실패", err?.message || "관리자 작업 중 오류가 발생했습니다.");
    } finally {
      setAdminProcessing(false);
    }
  };

  const fetchAllDeleteRequests = async () => {
    try {
      setAdminDeleteLoading(true);
      const data = IS_CANVAS_PREVIEW
        ? { success: true, rows: MOCK_JOBS.filter((job) => job.deleteRequest === "Y") }
        : await fetch(`${WEBAPP_URL}?action=deleteRequestsAll&t=${Date.now()}`).then((res) => res.json());
      if (!data.success) throw new Error(data.message || "삭제요청 조회 실패");
      setAdminDeleteRequests(data.rows || []);
    } catch (err) {
      showError("삭제요청 조회 실패", err?.message || "삭제요청 현장을 불러오지 못했습니다.");
    } finally {
      setAdminDeleteLoading(false);
    }
  };

  const submitAdminDeleteAction = async (job, action) => {
    if (adminProcessing) return;
    if (!adminMasterPassword.trim()) {
      showError("입력 확인", "마스터 비밀번호를 입력해 주세요.");
      return;
    }

    const verified = await verifyAdminPasswordClient(adminMasterPassword);
    if (!verified) {
      showError("비밀번호 오류", "마스터 비밀번호가 일치하지 않습니다.");
      return;
    }

    setAdminProcessing(true);
    try {
      await apiPost({
        action,
        month: job.month || selectedMonth,
        rowNumber: job.rowNumber,
        masterPassword: adminMasterPassword,
      });

      await fetchAllDeleteRequests();
      showComplete(action === "hardDelete" ? "완전삭제 완료" : "삭제요청 해제 완료", `${job.customer} 현장의 관리자 작업이 완료되었습니다.`);
    } catch (err) {
      showError("관리자 작업 실패", err?.message || "관리자 작업 중 오류가 발생했습니다.");
    } finally {
      setAdminProcessing(false);
    }
  };

  const submitImportantHistory = async () => {
    if (adminProcessing) return;
    setHistoryMessage("");

    if (!historyJob) return;
    if (!historyText.trim()) {
      showError("입력 확인", "이력 내용을 입력해 주세요.");
      return;
    }

    try {
      setAdminProcessing(true);
      await apiPost({
        action: "addImportantHistory",
        month: selectedMonth,
        rowNumber: historyJob.rowNumber,
        customer: historyJob.customer,
        actor: historyActor,
        text: historyText.trim(),
      });

      setHistoryText("");
      showComplete("이력등록 완료", `${historyJob.customer} 현장 중요 이력이 등록되었습니다.`);
    } catch (err) {
      showError("이력등록 실패", err?.message || "이력등록 중 오류가 발생했습니다.");
    } finally {
      setAdminProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">대림바스&키친</p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">시공관리 웹앱</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">Google Sheets 기반 현장관리</p>
              {adminMode ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                    관리자 모드 ON
                  </span>
                  <button
                    type="button"
                    onClick={() => { if (operationBusy) return; setAdminMode(false); setTab("dashboard"); }}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-600 disabled:opacity-50"
                    disabled={operationBusy}
                  >
                    종료
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:flex">
            <button disabled={operationBusy} onClick={() => moveToTab("sales", "sales-panel")} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300"><PlusCircle className="mr-2 h-4 w-4" />신규 등록</button>
            <button disabled={operationBusy} onClick={() => moveToTab("photos", "photos-panel")} className="inline-flex items-center justify-center rounded-xl border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"><Upload className="mr-2 h-4 w-4" />사진등록</button>
            <button disabled={operationBusy} onClick={() => moveToTab("admin", "admin-panel")} className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">관리자</button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <StatCard title="이번달 진행" value={`${summary.currentMonthCount || 0}건`} sub={`완료 ${summary.currentMonthCompleted || 0} / 진행 ${summary.currentMonthInProgress || 0}`} Icon={ClipboardList} onClick={() => openDashboardView("all")} disabled={operationBusy} />
          <StatCard title="이번주 시공" value={`${summary.weekCount || 0}건`} sub="이번 주 기준" Icon={CalendarDays} onClick={() => openDashboardView("week")} disabled={operationBusy} />
          <StatCard title="다음달 진행예정" value={`${summary.nextMonthCount || 0}건`} sub="다음달 시트 기준" Icon={CalendarDays} onClick={() => openDashboardView("nextMonth")} disabled={operationBusy} />
        </div>

        <CalendarPanel operationBusy={operationBusy} selectedMonth={selectedMonth} todayKey={todayKey} todayLabel={todayLabel} weekKeys={weekKeys} calendar={calendar} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedJobs={selectedJobs} setDetailJob={setDetailJob} moveMonth={moveMonth} handleTouchStart={handleTouchStart} handleTouchEnd={handleTouchEnd} />
        {postSavePhotoJob ? <PostSavePhotoModal job={postSavePhotoJob} month={postSavePhotoMonth} mode={postSavePhotoMode} uploadPhoto={uploadPhoto} uploadProgress={uploadProgress} uploadDoneMessage={uploadDoneMessage} uploadingId={uploadingId} onClose={() => { postSavePhotoDismissed.current = true; const customer = postSavePhotoJob.customer; const mode = postSavePhotoMode; setPostSavePhotoJob(null); setPostSavePhotoMonth(""); setPostSavePhotoMode("new"); if (mode === "new") showComplete("현장등록 완료", `${customer} 현장 등록이 완료되었습니다.`); }} /> : null}
        {completeModal ? <CompleteModal title={completeModal.title} message={completeModal.message} onConfirm={closeCompleteAndRefresh} /> : null}
        {errorModal ? <ErrorModal title={errorModal.title} message={errorModal.message} onConfirm={() => setErrorModal(null)} /> : null}
        {serverDuplicateModal ? (
          <DuplicateCheckModal
            data={serverDuplicateModal}
            serverMode
            onClose={() => setServerDuplicateModal(null)}
            onProceed={() => {
              setServerDuplicateModal(null);
              duplicateBypassRef.current = true;
              handleSubmit();
            }}
          />
        ) : null}

        {duplicateModal ? (
          <DuplicateCheckModal
            data={duplicateModal}
            onClose={() => setDuplicateModal(null)}
            onProceed={() => {
              setDuplicateModal(null);
              duplicateBypassRef.current = true;
              handleSubmit();
            }}
          />
        ) : null}
        {operationBusy ? <BusyOverlay uploadingId={uploadingId} saving={saving} editing={editing} deleting={deleting} adminProcessing={adminProcessing} /> : null}

        <nav className="sticky top-0 z-30 rounded-2xl border bg-white/95 p-1 shadow-sm backdrop-blur">
          <div className="grid grid-cols-5 gap-1 md:gap-2">
            {/* 메뉴 순서 : 전체현장 → 시공완료 → 배정대기 → 배정완료 → 계획확정 */}
            {[['dashboard', '전체현장'], ['completed', '시공완료'], ['waiting', '배정대기'], ['partner', '배정완료'], ['confirmed', '계획확정']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { if (operationBusy) return; setTab(key); if (key === "dashboard") setDashboardView("all"); }}
                disabled={operationBusy}
                className={`w-full rounded-xl py-3 text-center text-[12px] font-black disabled:opacity-50 md:text-sm ${tab === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {tab === "dashboard" && <DashboardPanel operationBusy={operationBusy} title={dashboardTitle} message={message} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} loading={loading} fetchJobs={fetchJobs} query={query} setQuery={setQuery} team={team} setTeam={setTeam} jobs={dashboardJobs} setDetailJob={setDetailJob} />}
        {tab === "waiting" && <DashboardPanel operationBusy={operationBusy} title="배정대기 현장" message={message} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} loading={loading} fetchJobs={fetchJobs} query={query} setQuery={setQuery} team={team} setTeam={setTeam} jobs={filteredJobs.filter((j) => (j.status || "협력사배정대기") === "협력사배정대기")} setDetailJob={setDetailJob} />}
        {tab === "completed" && <DashboardPanel operationBusy={operationBusy} title="시공완료 현장" message={message} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} loading={loading} fetchJobs={fetchJobs} query={query} setQuery={setQuery} team={team} setTeam={setTeam} jobs={filteredJobs.filter((j) => j.status === "시공완료")} setDetailJob={setDetailJob} />}
        {tab === "partner" && <DashboardPanel operationBusy={operationBusy} title="협력사배정완료 현장" message={message} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} loading={loading} fetchJobs={fetchJobs} query={query} setQuery={setQuery} team={team} setTeam={setTeam} jobs={filteredJobs.filter((j) => j.status === "협력사배정완료")} setDetailJob={setDetailJob} />}
        {tab === "confirmed" && <DashboardPanel operationBusy={operationBusy} title="시공계획확정 현장" message={message} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} months={months} loading={loading} fetchJobs={fetchJobs} query={query} setQuery={setQuery} team={team} setTeam={setTeam} jobs={filteredJobs.filter((j) => j.status === "시공계획확정")} setDetailJob={setDetailJob} />}
        {detailJob ? <JobDetailModal adminMode={adminMode} photoCounts={photoCountMap[`${selectedMonth}_${detailJob.rowNumber}`]} job={detailJob} onClose={() => setDetailJob(null)} onEdit={() => openEditModal(detailJob)} onDeleteRequest={() => { setDeleteJob(detailJob); setDeletePassword(""); setDeleteMessage(""); }} onAdmin={() => { setAdminJob(detailJob); setAdminPassword(""); setAdminMessage(""); }} onCopyAddress={() => copyAddress(detailJob)} copiedAddressJobId={copiedAddressJobId} onPhotoRegister={() => { setPostSavePhotoJob(detailJob); setPostSavePhotoMonth(selectedMonth); setPostSavePhotoMode("detail"); }} onHistoryEdit={() => openEditModal(detailJob)} /> : null}
        {editJob ? <EditOrderModal adminMode={adminMode} partnerData={partnerData} form={editForm} setForm={setEditForm} password={editPassword} setPassword={setEditPassword} message={editMessage} editing={editing} onSubmit={submitEditOrder} onClose={() => { setEditJob(null); setEditMessage(""); setEditPassword(""); }} openAddressSearch={openAddressSearch} /> : null}
        {deleteJob ? <DeleteRequestModal job={deleteJob} password={deletePassword} setPassword={setDeletePassword} message={deleteMessage} deleting={deleting} onSubmit={requestDelete} onClose={() => { if (deleting) return; setDeleteJob(null); setDeletePassword(""); setDeleteMessage(""); }} /> : null}
        {adminJob ? <AdminLockModal job={adminJob} password={adminPassword} setPassword={setAdminPassword} message={adminMessage} processing={adminProcessing} onLock={() => submitAdminLock(true)} onUnlock={() => submitAdminLock(false)} onClose={() => { if (adminProcessing) return; setAdminJob(null); setAdminPassword(""); setAdminMessage(""); }} /> : null}
        {tab === "sales" && <SalesPanel form={form} updateForm={updateForm} saving={saving} saveMessage={saveMessage} handleSubmit={handleSubmit} openAddressSearch={openAddressSearch} />}
        {tab === "photos" && <PhotosPanel jobs={jobs} loading={loading} fetchJobs={fetchJobs} photoMessage={photoMessage} uploadProgress={uploadProgress} uploadDoneMessage={uploadDoneMessage} uploadingId={uploadingId} uploadPhoto={uploadPhoto} photoCategory={photoCategory} setPhotoCategory={setPhotoCategory} pendingUploadJob={pendingUploadJob} setPendingUploadJob={setPendingUploadJob} pendingUploadFiles={pendingUploadFiles} setPendingUploadFiles={setPendingUploadFiles} />}
        {tab === "report" && <ReportPanel jobs={jobs} />}
        {tab === "admin" && <AdminPanel jobs={jobs} setAdminJob={setAdminJob} adminMasterPassword={adminMasterPassword} setAdminMasterPassword={setAdminMasterPassword} adminDeleteRequests={adminDeleteRequests} adminDeleteLoading={adminDeleteLoading} adminProcessing={adminProcessing} fetchAllDeleteRequests={fetchAllDeleteRequests} fetchPartnerInstallerData={fetchPartnerInstallerData} onDeleteAction={submitAdminDeleteAction} setAdminMode={setAdminMode} />}
      </div>
    </div>
  );
}

function CalendarPanel({ operationBusy = false, selectedMonth, todayKey, todayLabel, weekKeys, calendar, selectedDate, setSelectedDate, selectedJobs, setDetailJob, moveMonth, handleTouchStart, handleTouchEnd }) {
  return (
    <section onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold">시공 캘린더</h2>
          <p className="mt-1 text-xs text-slate-500">현장이 있는 날짜를 누르거나 좌우로 밀어서 월을 변경하세요.</p>
          <p className="mt-1 text-xs font-medium text-slate-700">오늘 {todayLabel}</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={operationBusy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-lg font-bold text-slate-600 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white active:scale-95 disabled:opacity-40"
            aria-label="이전달"
          >
            ‹
          </button>

          <div className="relative overflow-hidden rounded-[26px] border border-sky-200 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 px-6 py-4 text-center shadow-[0_10px_26px_rgba(99,102,241,0.16)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.20),transparent_45%)]" />
            <div className="relative">
              <p className="text-[10px] font-black tracking-[0.24em] text-sky-500">SCHEDULE</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-800 md:text-4xl">
                {selectedMonth}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => moveMonth(1)}
            disabled={operationBusy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-lg font-bold text-slate-600 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white active:scale-95 disabled:opacity-40"
            aria-label="다음달"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="py-1 font-medium">{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 touch-pan-y select-none">
        {calendar.days.map((date, idx) => date ? (
          <button
            key={date.key}
            onClick={() => { if (!operationBusy) setSelectedDate(date.key); }}
            disabled={operationBusy}
            className={`min-h-[60px] rounded-2xl border p-1 text-center text-sm disabled:opacity-50 ${selectedDate === date.key ? "border-slate-900 bg-slate-900 text-white" : date.key === todayKey ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200" : weekKeys.includes(date.key) ? "border-blue-100 bg-blue-50/60 text-blue-700" : date.jobs.length ? "border-green-200 bg-green-50 text-green-800" : "border-slate-100 bg-white text-slate-400"}`}
          >
            <div className="font-semibold">{date.day}</div>
            {date.key === todayKey ? (
              <div className="mt-1 flex flex-col items-center gap-1">
                <span className="whitespace-nowrap rounded-full bg-blue-600 px-1 py-0.5 text-[7px] font-bold leading-none tracking-[-0.04em] text-white md:px-2 md:text-[9px]">TODAY</span>
                {date.jobs.length ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white" /> : null}
              </div>
            ) : date.jobs.length ? (
              <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-current" />
            ) : null}
          </button>
        ) : <div key={`blank-${idx}`} />)}
      </div>

      {selectedDate ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900">{selectedDate.slice(3)} 시공 현장</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">{selectedJobs.length}건</span>
          </div>
          <div className="mt-2 space-y-2">
            {selectedJobs.length ? selectedJobs.map((job) => (
              <button key={`${selectedDate}-${job.rowNumber}`} disabled={operationBusy} onClick={() => setDetailJob(job)} className="block w-full text-left disabled:opacity-50">
                <JobCard job={job} />
              </button>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-medium text-slate-400">해당일 현장이 없습니다.</div>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const JobCard = React.memo(function JobCard({ job }) {
  return (
    <div className="rounded-2xl border bg-white p-3 text-sm shadow-sm transition active:scale-[0.99] md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-black leading-tight text-slate-950">{job.customer}</p>
          <p className="mt-1 line-clamp-2 whitespace-normal break-words text-xs leading-snug text-slate-500">{job.address || "주소 미입력"}</p>
        </div>
        <Badge className={`shrink-0 ${STATUS_CLASS[job.status] || "bg-slate-100 text-slate-700 border-slate-300"}`}>{job.status || "협력사배정대기"}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2">
        <Info label="시공일" value={installPeriod(job)} />
        <Info label="품목" value={job.item || "-"} />
      </div>

      <div className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
        <div className="grid grid-cols-2 gap-3">
          <Info label="담당자" value={job.manager || "-"} />
          <Info label="담당자 연락처" value={job.managerPhone ? <PhoneLink value={job.managerPhone} /> : "-"} />
          <Info label="협력사" value={job.partner || "미배정"} />
          <Info label="시공기사" value={job.installer || "미배정"} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className={job.living === "Y" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}>거주 {job.living || "-"}</Badge>
        <Badge className={job.assembly === "Y" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200"}>조립 {job.assembly || "-"}</Badge>
        <Badge className={job.photo === "등록완료" ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}>사진 {job.photo || "미등록"}</Badge>
      </div>

      {job.siteMemo ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-semibold text-amber-700">현장 특이사항</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">{job.siteMemo}</p>
        </div>
      ) : null}
    </div>
  );
});

function Info({ label, value, sub }) {
  return <div className="min-w-0"><p className="text-[11px] text-slate-400">{label}</p><p className="mt-1 break-words font-medium leading-snug text-slate-700">{value}</p>{sub ? <p className="text-xs text-slate-500">{sub}</p> : null}</div>;
}

function DashboardPanel({ title = "전체 현장 조회", message, selectedMonth, setSelectedMonth, months, loading, fetchJobs, query, setQuery, team, setTeam, jobs, setDetailJob, operationBusy = false }) {
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [title, selectedMonth, query, team, jobs.length]);

  const visibleJobs = useMemo(() => jobs.slice(0, visibleCount), [jobs, visibleCount]);
  const hasMore = visibleCount < jobs.length;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <p className={`mt-1 text-sm ${loading ? "font-bold text-slate-700" : String(message || "").includes("Error") || String(message || "").includes("오류") ? "font-bold text-rose-600" : "text-slate-500"}`}>
            {loading ? "현장 정보를 불러오는 중입니다." : message}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <select disabled={operationBusy || loading} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>{months.length ? months.map((m) => <option key={m} value={m}>{m}</option>) : <option>{selectedMonth}</option>}</select>
          <button onClick={() => fetchJobs({ force: true })} disabled={loading || operationBusy} className="inline-flex items-center rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-50">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}새로고침</button>
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input disabled={operationBusy} className="w-full rounded-xl border px-3 py-2 pl-9 text-sm disabled:opacity-50 md:w-64" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <select disabled={operationBusy} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50" value={team} onChange={(e) => setTeam(e.target.value)}><option>전체</option><option>영업1팀</option><option>영업2팀</option></select>
        </div>
      </div>
      <div className="space-y-3">
        {jobs.length ? (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>총 {jobs.length}건</span>
              <span>{visibleJobs.length}건 표시 중</span>
            </div>

            {visibleJobs.map((job) => (
              <button key={job.rowNumber} disabled={operationBusy} onClick={() => setDetailJob(job)} className="block w-full text-left disabled:opacity-50">
                <JobCard job={job} />
              </button>
            ))}

            {hasMore ? (
              <button
                type="button"
                disabled={operationBusy}
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm disabled:opacity-50"
              >
                더보기 · {Math.min(PAGE_SIZE, jobs.length - visibleJobs.length)}건 추가
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-medium text-slate-400">조건에 맞는 현장이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function SalesPanel({ form, updateForm, saving, saveMessage, handleSubmit, openAddressSearch }) {
  const disabled = saving;
  const requiredFields = [
    ["담당자", form.manager],
    ["고객명", form.customer],
    ["연락처", form.phone],
    ["주소", form.address],
    ["아이템", form.item],
    ["시작일", form.woodDate],
    ["종료일", form.endDate],
    ["비밀번호", form.editPassword],
  ];
  const requiredDone = requiredFields.filter(([, value]) => String(value || "").trim()).length;
  const missingRequired = requiredFields.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
  const readyToSave = requiredDone === requiredFields.length && /^[0-9]{4}$/.test(form.editPassword || "");

  return (
    <div id="sales-panel" className="rounded-2xl bg-white p-4 shadow-sm scroll-mt-24 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold">신규현장 등록</h2>
          <p className="mt-1 text-sm text-slate-500">시공 시작일 기준 월 시트에 저장됩니다.</p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm ${readyToSave ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          <p className="font-black">필수 {requiredDone}/{requiredFields.length}</p>
          <p className="mt-1 text-xs font-medium">{readyToSave ? "등록 준비 완료" : `${missingRequired.slice(0, 3).join(", ")}${missingRequired.length > 3 ? " 외" : ""}`}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-3 md:p-4">
          <p className="mb-3 text-sm font-black text-slate-900">기본 정보</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field disabled={disabled} label="담당자 *" value={form.manager} onChange={(v) => updateForm("manager", v)} placeholder="담당자명" />
            <Field disabled={disabled} label="고객명 *" value={form.customer} onChange={(v) => updateForm("customer", v)} placeholder="고객명" />
            <Field disabled={disabled} label="고객 연락처 *" value={form.phone} onChange={(v) => updateForm("phone", formatPhone(v))} inputMode="tel" placeholder="010-0000-0000" />
            <PasswordField disabled={disabled} label="수정 비밀번호 *" value={form.editPassword} onChange={(v) => updateForm("editPassword", onlyDigits(v).slice(0, 4))} />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">비밀번호는 현장 수정/삭제요청 때 사용하는 숫자 4자리입니다.</p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-3 md:p-4">
          <p className="mb-3 text-sm font-black text-slate-900">계약 / 현장 정보</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MoneyField disabled={disabled} label="계약 시공비" value={form.contractPrice} onChange={(v) => updateForm("contractPrice", formatNumber(v))} />
            <SelectField disabled={disabled} label="계약/발주 상태" value={form.orderStatus} onChange={(v) => updateForm("orderStatus", v)} options={ORDER_STATUS_OPTIONS} colorMode="option" />
            <SelectField disabled={disabled} label="아이템 *" value={form.item} onChange={(v) => updateForm("item", v)} options={ITEM_OPTIONS} colorMode="option" />
            <SelectField disabled={disabled} label="거주여부" value={form.living} onChange={(v) => updateForm("living", v)} options={LIVING_OPTIONS} colorMode="living" />
            <SelectField disabled={disabled} label="조립출고여부" value={form.assembly} onChange={(v) => updateForm("assembly", v)} options={ASSEMBLY_OPTIONS} colorMode="assembly" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-3 md:p-4">
          <p className="mb-3 text-sm font-black text-slate-900">일정</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DateField disabled={disabled} label="시공 시작일 *" value={form.woodDate} onChange={(v) => updateForm("woodDate", v)} />
            <DateField disabled={disabled} label="시공 종료일 *" value={form.endDate} onChange={(v) => updateForm("endDate", v)} />
            <DateField disabled={disabled} label="대리석 시공일" value={form.stoneDate} onChange={(v) => updateForm("stoneDate", v)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={disabled || !form.woodDate} onClick={() => updateForm("endDate", form.woodDate)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40">당일 시공</button>
            <button type="button" disabled={disabled || !form.endDate} onClick={() => updateForm("stoneDate", form.endDate)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40">대리석=종료일</button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-3 md:p-4">
          <p className="mb-3 text-sm font-black text-slate-900">주소 / 메모</p>
          <div className="space-y-3">
            <div>
              <FieldLabel>현장주소 *</FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input disabled={disabled} className="w-full rounded-xl border px-3 py-3 disabled:opacity-50" value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="주소검색 버튼으로 주소를 선택하세요" />
                <button type="button" disabled={disabled} onClick={openAddressSearch} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">주소검색</button>
              </div>
            </div>
            <div>
              <FieldLabel>상세주소</FieldLabel>
              <input disabled={disabled} className="w-full rounded-xl border px-3 py-3 disabled:opacity-50" value={form.addressDetail} onChange={(e) => updateForm("addressDetail", e.target.value)} placeholder="동/호수, 층수, 비밀번호 등 상세주소" />
            </div>
            <div>
              <FieldLabel>현장 특이사항</FieldLabel>
              <textarea disabled={disabled} className="min-h-24 w-full rounded-xl border px-3 py-3 disabled:opacity-50" value={form.siteMemo} onChange={(e) => updateForm("siteMemo", e.target.value)} placeholder="엘리베이터, 주차, 고객 요청사항 등" />
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white md:flex md:items-center md:justify-between md:gap-3">
          <div className="mb-3 md:mb-0">
            <p className="text-sm font-black">등록 후 사진 첨부 화면으로 이어집니다.</p>
            <p className="mt-1 text-xs text-slate-300">필수값과 중복 현장 확인 후 저장됩니다.</p>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 disabled:bg-slate-300 md:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "저장 중" : "등록하기"}
          </button>
        </div>

        {saveMessage ? <p className="text-sm font-medium text-slate-700">{saveMessage}</p> : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, inputMode, placeholder, disabled = false }) {
  return <div><FieldLabel>{label}</FieldLabel><input disabled={disabled} className="w-full rounded-xl border px-3 py-2 disabled:opacity-50" value={value} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
}

function MoneyField({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <FieldLabel>{label} (VAT 제외)</FieldLabel>
      <input disabled={disabled} className="w-full rounded-xl border px-3 py-2 text-right font-semibold disabled:opacity-50" value={value} inputMode="numeric" placeholder="0" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, colorMode, disabled = false }) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  const colorClass = (() => {
    if (!value) return "bg-white text-slate-700";
    if (colorMode === "living") {
      return value === "Y"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-orange-200 bg-orange-50 text-orange-700";
    }
    if (colorMode === "assembly") {
      return value === "Y"
        ? "border-purple-200 bg-purple-50 text-purple-700"
        : "border-orange-200 bg-orange-50 text-orange-700";
    }
    if (colorMode === "option") {
      return OPTION_CLASS[value] || "bg-white text-slate-700";
    }
    if (colorMode === "status") {
      return STATUS_CLASS[value] || "bg-white text-slate-700";
    }
    return "bg-white text-slate-700";
  })();

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select disabled={disabled} className={`w-full rounded-xl border px-3 py-2 font-medium disabled:opacity-50 ${colorClass}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">선택</option>
        {normalizedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange, disabled = false }) {
  return <div><FieldLabel>{label}</FieldLabel><input disabled={disabled} type="date" className="w-full rounded-xl border px-3 py-2 disabled:opacity-50" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function PasswordField({ label, value, onChange, disabled = false }) {
  return <div><FieldLabel>{label}</FieldLabel><input disabled={disabled} type="password" inputMode="numeric" maxLength={4} className="w-full rounded-xl border px-3 py-2 tracking-[0.4em] disabled:opacity-50" value={value} placeholder="숫자 4자리" onChange={(e) => onChange(e.target.value)} /></div>;
}

function PhotosPanel({ jobs, loading, fetchJobs, photoMessage, uploadProgress, uploadDoneMessage, uploadingId, uploadPhoto, photoCategory, setPhotoCategory, pendingUploadJob, setPendingUploadJob, pendingUploadFiles, setPendingUploadFiles }) {
  const photoReadyCount = jobs.filter((job) => job.photoUrl || job.photo === "등록완료").length;
  const selectedFileCount = Array.from(pendingUploadFiles || []).length;

  return (
    <div id="photos-panel" className="rounded-2xl bg-white p-4 shadow-sm scroll-mt-24 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold md:text-xl">현장사진 관리</h2>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">사진등록 버튼을 누른 뒤 사진 구분을 선택하세요. PDF는 계약도면에만 등록됩니다.</p>
          {photoMessage ? <p className="mt-1 text-xs font-medium text-slate-600">{photoMessage}</p> : null}
          
        </div>
        <button onClick={() => fetchJobs({ force: true })} disabled={!!uploadingId} className="shrink-0 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 md:text-sm">{loading ? "조회중" : "새로고침"}</button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold text-slate-400">전체</p>
          <p className="mt-1 text-lg font-black text-slate-900">{jobs.length}건</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-[11px] font-bold text-emerald-500">폴더 있음</p>
          <p className="mt-1 text-lg font-black text-emerald-700">{photoReadyCount}건</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3">
          <p className="text-[11px] font-bold text-orange-500">미등록</p>
          <p className="mt-1 text-lg font-black text-orange-700">{Math.max(jobs.length - photoReadyCount, 0)}건</p>
        </div>
      </div>

      {pendingUploadJob && pendingUploadFiles ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">사진 구분 선택</h3>
            <p className="mt-1 text-sm text-slate-500">{pendingUploadJob.customer} 현장에 업로드할 사진 종류를 선택하세요.</p>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
              선택된 파일 {selectedFileCount}개 · 계약도면은 이미지/PDF, 나머지는 이미지 파일만 등록됩니다.
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {PHOTO_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category}
                  type="button"
                  disabled={!!uploadingId}
                  onClick={async () => {
                    setPhotoCategory(category);
                    const success = await uploadPhoto(pendingUploadJob, pendingUploadFiles, category);
                    if (success) {
                      setTimeout(() => {
                        setPendingUploadJob(null);
                        setPendingUploadFiles(null);
                      }, 900);
                    }
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold hover:brightness-95 disabled:opacity-50 ${OPTION_CLASS[category] || "bg-white text-slate-700"}`}
                >
                  {category}
                </button>
              ))}
            </div>
            {uploadProgress && uploadingId === (pendingUploadJob.id || `ROW-${pendingUploadJob.rowNumber}`) ? (
              <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                <div className="flex items-center gap-2">
                  {uploadProgress === "사진등록 완료" ? null : <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{uploadProgress}</span>
                </div>
                {uploadDoneMessage ? <p className="mt-1 break-words text-xs text-slate-200">{uploadDoneMessage}</p> : null}
              </div>
            ) : null}
            <button
              type="button"
              disabled={!!uploadingId}
              onClick={() => { setPendingUploadJob(null); setPendingUploadFiles(null); }}
              className="mt-3 w-full rounded-xl bg-slate-100 px-3 py-3 text-sm font-medium text-slate-600 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 md:mt-5 md:grid-cols-3 md:gap-3">
        {jobs.map((job) => {
          const isReady = job.photo === "등록완료";
          return (
            <div key={job.rowNumber} className="rounded-2xl border bg-white p-3 shadow-sm md:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-extrabold leading-tight text-slate-900 md:text-lg">{job.customer}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{installPeriod(job)}</p>
                </div>
                <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold leading-none ${isReady ? "border-green-200 bg-green-50 text-green-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}>
                  {uploadingId === (job.id || `ROW-${job.rowNumber}`) ? "등록중" : (job.photo || "미등록")}
                </span>
              </div>

              {uploadingId === (job.id || `ROW-${job.rowNumber}`) && uploadProgress ? (
                <div className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  <div className="flex items-center gap-2">
                    {uploadProgress === "사진등록 완료" ? null : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{uploadProgress}</span>
                  </div>
                  {uploadDoneMessage ? <p className="mt-1 text-[11px] text-slate-200">{uploadDoneMessage}</p> : null}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {job.photoUrl ? (
                  <a className="rounded-xl bg-slate-900 px-3 py-2.5 text-center text-sm font-bold text-white md:py-3" href={job.photoUrl} target="_blank" rel="noreferrer">사진보기</a>
                ) : (
                  <button disabled className="rounded-xl bg-slate-300 px-3 py-2.5 text-sm font-bold text-white md:py-3">사진보기</button>
                )}
                <label className={`rounded-xl border px-3 py-2.5 text-center text-sm font-bold md:py-3 ${uploadingId ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${!isReady ? "border-slate-900 bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
                  {uploadingId === (job.id || `ROW-${job.rowNumber}`) ? "등록 중" : "사진등록"}
                  <input type="file" accept={`${PHOTO_UPLOAD_ACCEPT},.pdf`} multiple className="sr-only" disabled={!!uploadingId} onChange={(e) => { const files = Array.from(e.target.files || []); if (!files.length) return; setPendingUploadJob(job); setPendingUploadFiles(files); }} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhoneLink({ value }) {
  const phone = formatPhone(value || "");
  if (!phone) return <span>-</span>;
  return <a href={`tel:${onlyDigits(phone)}`} className="font-black text-blue-700 underline decoration-blue-300 underline-offset-2">{phone}</a>;
}

function JobDetailModal({ adminMode = false, photoCounts = null, job, onClose, onEdit, onDeleteRequest, onAdmin, onCopyAddress, copiedAddressJobId, onPhotoRegister, onHistoryEdit }) {
  const copied = copiedAddressJobId === (job.id || `ROW-${job.rowNumber}`);
  const photoInfo = photoCounts?.counts
    ? photoCounts
    : { counts: photoCounts || job.photoCounts || null, urls: photoCounts?.urls || {} };
  const counts = photoInfo.counts;
  const categoryUrls = photoInfo.urls || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-black leading-tight md:text-2xl">{job.customer}</h2>
              <Badge className={STATUS_CLASS[job.status] || "bg-slate-100 text-slate-700 border-slate-300"}>{job.status}</Badge>
              {job.editLocked || job.editLock === "Y" ? (
                <Badge className="bg-slate-900 text-white border-slate-900">관리자 잠금</Badge>
              ) : null}
              {job.deleteRequest === "Y" ? (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">삭제요청</Badge>
              ) : null}
              {adminMode ? (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200">관리자 편집 가능</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-1.5 md:justify-end">
            <div className="grid flex-1 grid-cols-2 gap-1.5 md:flex md:flex-none md:items-center">
              {adminMode ? (
                <button onClick={onEdit} className="whitespace-nowrap rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">
                  관리자수정
                </button>
              ) : job.editLocked || job.editLock === "Y" ? (
                <button
                  type="button"
                  onClick={onAdmin}
                  className="whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                >
                  잠금해제
                </button>
              ) : (
                <button onClick={onEdit} className="whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  수정
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteRequest}
                className="whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
              >
                삭제요청
              </button>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-xl border p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">시공기간</p>
            <p className="mt-1 text-sm font-black text-slate-900">{installPeriod(job)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">시공기사</p>
            <p className="mt-1 truncate text-sm font-black text-slate-900">{job.installer || "미배정"}</p>
          </div>
        </div>

        <div className="relative mt-3 w-full rounded-2xl bg-slate-50 p-4 pr-20 md:pr-24">
          <p className="w-full whitespace-normal break-words text-left text-sm leading-relaxed text-slate-600">
            {job.address || "주소 없음"}
          </p>
          <button
            type="button"
            onClick={onCopyAddress}
            className="absolute right-3 top-3 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            복사
          </button>
          {copied ? (
            <div className="absolute right-3 top-12 animate-pulse rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md">
              복사됨
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard title="기본 정보">
            <DetailRow label="담당자" value={job.manager} />
            <DetailRow label="담당자 연락처" value={<PhoneLink value={job.managerPhone} />} />
            <DetailRow label="고객 연락처" value={<PhoneLink value={job.phone} />} />
            <div className="grid grid-cols-2 gap-2">
              <DetailMiniBadge label="계약/발주" value={job.orderStatus || "-"} className={OPTION_CLASS[job.orderStatus]} />
              <DetailMiniBadge label="아이템" value={job.item || "-"} className={OPTION_CLASS[job.item]} />
              <DetailMiniBadge label="거주여부" value={job.living === "Y" ? "거주" : job.living === "N" ? "비거주" : "-"} className={OPTION_CLASS[job.living]} />
              <DetailMiniBadge label="조립출고" value={job.assembly === "Y" ? "조립출고" : job.assembly === "N" ? "일반출고" : "-"} className={OPTION_CLASS[job.assembly]} />
            </div>
          </DetailCard>

          <DetailCard title="시공 정보">
            <DetailRow label="시공기간" value={installPeriod(job)} />
            <DetailRow label="대리석 시공" value={shortDate(job.stoneDate) || "-"} />
            <DetailRow label="협력사" value={job.partner || "미배정"} />
            <DetailRow label="시공기사" value={job.installer || "미배정"} />
            <DetailRow label="시공기사 연락처" value={<PhoneLink value={job.installerPhone} />} />
          </DetailCard>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          
          <DetailCard title="현장 메모 / 특이사항">
            <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {job.siteMemo || "메모 없음"}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-700">중요 이력</p>
                {adminMode ? (
                  <button type="button" onClick={onHistoryEdit} className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white">
                    이력 수정
                  </button>
                ) : (
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
                    조회 전용
                  </span>
                )}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                {job.history || "이력 없음"}
              </div>
            </div>
          </DetailCard>

          <DetailCard title="사진 / 도면">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {PHOTO_CATEGORY_OPTIONS.map((category) => {
                  const count = counts?.[category] ?? 0;
                  return (
                    <a
                      key={category}
                      href={categoryUrls[category] || job.photoUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!categoryUrls[category] && !job.photoUrl}
                      className={`rounded-2xl border px-3 py-3 text-center text-xs font-bold transition ${count > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-400"} ${categoryUrls[category] || job.photoUrl ? "active:scale-[0.99]" : "pointer-events-none"}`}
                    >
                      <span className="block">{category}</span>
                      <span className="mt-1 block text-sm font-black">{counts ? `${count}개` : "조회중"}</span>
                    </a>
                  );
                })}
              </div>
              {job.photoUrl ? (
                <a
                  href={job.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-4 text-sm font-medium text-white"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  전체 사진 폴더 열기
                </a>
              ) : (
                <div className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm text-slate-400">
                  사진 폴더 없음
                </div>
              )}

              <button
                type="button"
                onClick={onPhotoRegister}
                className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-800"
              >
                <Upload className="mr-2 h-4 w-4" />
                사진등록
              </button>

              {job.editLocked || job.editLock === "Y" ? (
                <div className="rounded-2xl border border-slate-300 bg-slate-900 px-4 py-4 text-center text-sm font-bold text-white">
                  관리자 잠금 상태입니다. 일반 비밀번호로는 수정할 수 없습니다.
                </div>
              ) : null}
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

function DeleteRequestModal({ job, password, setPassword, message, deleting = false, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-rose-700">삭제요청</h2>
            <p className="mt-1 text-sm text-slate-500">{job.customer} 현장을 삭제요청 상태로 변경합니다.</p>
          </div>
          <button onClick={onClose} disabled={deleting} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          삭제요청 후에는 목록에서 상태가 표시되고, 실제 삭제는 마스터 관리자가 승인할 때 처리됩니다.
        </div>

        <div className="mt-5">
          <PasswordField label="수정 비밀번호 *" value={password} onChange={(v) => setPassword(onlyDigits(v).slice(0, 4))} />
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{message}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={deleting} className="rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50">취소</button>
          <button onClick={onSubmit} disabled={deleting} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white disabled:bg-rose-300">{deleting ? "요청 중" : "삭제요청"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminLockModal({ job, password, setPassword, message, processing = false, onLock, onUnlock, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">관리자 잠금</h2>
            <p className="mt-1 text-sm text-slate-500">{job.customer} 현장의 일반 수정권한을 제어합니다.</p>
          </div>
          <button onClick={onClose} disabled={processing} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          잠금 상태에서는 등록 비밀번호가 맞아도 일반 사용자는 수정할 수 없습니다. 관리자 수정 또는 잠금해제만 가능합니다.
        </div>

        <div className="mt-5">
          <FieldLabel>마스터 비밀번호</FieldLabel>
          <input type="password" inputMode="numeric" pattern="[0-9]*" className="w-full rounded-xl border px-3 py-2" value={password} placeholder="마스터 비밀번호" onChange={(e) => setPassword(onlyDigits(e.target.value))} />
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{message}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {job.editLocked || job.editLock === "Y" ? (
            <button onClick={onUnlock} disabled={processing} className="col-span-2 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">{processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{processing ? "처리 중" : "잠금해제"}</button>
          ) : (
            <button onClick={onLock} disabled={processing} className="col-span-2 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">{processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{processing ? "처리 중" : "현장 잠금"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditOrderModal({ adminMode = false, partnerData = { partners: [], installersByPartner: {}, phoneByInstaller: {} }, form, setForm, password, setPassword, message, editing, onSubmit, onClose, openAddressSearch }) {
  const update = (key, value) => setForm((prev) => {
    const next = { ...prev, [key]: value };
    if (key === "woodDate" && value && (!prev.endDate || prev.endDate < value)) {
      next.endDate = value;
    }
    return next;
  });
  const installerOptions = form.partner ? (partnerData.installersByPartner?.[form.partner] || []) : [];
  const requiredFields = [
    ["담당자", form.manager],
    ["고객명", form.customer],
    ["연락처", form.phone],
    ["주소", form.address],
    ["아이템", form.item],
    ["시작일", form.woodDate],
    ["종료일", form.endDate],
  ];
  const requiredDone = requiredFields.filter(([, value]) => String(value || "").trim()).length;
  const missingRequired = requiredFields.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
  const updatePartner = (value) => {
    setForm((prev) => ({
      ...prev,
      partner: value,
      installer: "",
      installerPhone: "",
      status: value ? "협력사배정완료" : "협력사배정대기",
    }));
  };
  const updateInstaller = (value) => {
    const phone = partnerData.phoneByInstaller?.[value] || "";
    setForm((prev) => ({
      ...prev,
      installer: value,
      installerPhone: formatPhone(phone),
      status: value ? "시공계획확정" : (prev.partner ? "협력사배정완료" : "협력사배정대기"),
    }));
  };

  const updateInstallDate = (key, value) => {
    update(key, value);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-h-[90vh] md:rounded-3xl md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{adminMode ? "관리자 현장 수정" : "현장 정보 수정"}</h2>
            <p className="mt-1 text-sm text-slate-500">{adminMode ? "관리자 모드에서는 비밀번호 없이 현장 정보를 수정할 수 있습니다." : "등록 시 입력한 수정 비밀번호 숫자 4자리가 필요합니다."}</p>
          </div>
          <button onClick={onClose} disabled={editing} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${requiredDone === requiredFields.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          <p className="font-black">필수 {requiredDone}/{requiredFields.length}</p>
          <p className="mt-1 text-xs font-medium">{requiredDone === requiredFields.length ? "수정 저장 준비 완료" : `${missingRequired.slice(0, 4).join(", ")}${missingRequired.length > 4 ? " 외" : ""}`}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">기본 정보</p>
          </div>
          {!adminMode ? (
            <PasswordField label="수정 비밀번호 *" value={password} onChange={(v) => setPassword(onlyDigits(v).slice(0, 4))} />
          ) : null}
          <Field disabled={editing} label="담당자 *" value={form.manager} onChange={(v) => update("manager", v)} />
          <Field disabled={editing} label="고객명 *" value={form.customer} onChange={(v) => update("customer", v)} />
          <Field disabled={editing} label="고객 연락처 *" value={form.phone} onChange={(v) => update("phone", formatPhone(v))} inputMode="tel" placeholder="010-0000-0000" />
          <div className="md:col-span-2">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">계약 / 현장 정보</p>
          </div>
          <MoneyField disabled={editing} label="계약 시공비" value={form.contractPrice} onChange={(v) => update("contractPrice", formatNumber(v))} />
          <SelectField disabled={editing} label="계약/발주 상태" value={form.orderStatus} onChange={(v) => update("orderStatus", v)} options={ORDER_STATUS_OPTIONS} colorMode="option" />
          <SelectField disabled={editing} label="아이템 *" value={form.item} onChange={(v) => update("item", v)} options={ITEM_OPTIONS} colorMode="option" />
          <SelectField disabled={editing} label="거주여부" value={form.living} onChange={(v) => update("living", v)} options={LIVING_OPTIONS} colorMode="living" />
          <SelectField disabled={editing} label="조립출고여부" value={form.assembly} onChange={(v) => update("assembly", v)} options={ASSEMBLY_OPTIONS} colorMode="assembly" />
          {adminMode ? (
            <>
              <div className="md:col-span-2">
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">관리자 배정 정보</p>
              </div>
              <SelectField disabled={editing} label="진행상태" value={form.status} onChange={(v) => update("status", v)} options={STATUS_OPTIONS} colorMode="status" />
              <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-relaxed text-blue-700">
                협력사를 선택하면 협력사배정완료, 시공기사를 선택하면 즉시 시공계획확정으로 자동 변경됩니다. 필요하면 진행상태를 직접 다시 선택할 수 있습니다.
              </div>
              <SelectField disabled={editing} label="협력사" value={form.partner} onChange={updatePartner} options={partnerData.partners || []} />
              <SelectField disabled={editing || !form.partner} label="시공기사" value={form.installer} onChange={updateInstaller} options={installerOptions} />
              <Field disabled={editing} label="시공기사 연락처" value={form.installerPhone} onChange={(v) => update("installerPhone", formatPhone(v))} inputMode="tel" placeholder="010-0000-0000" />
            </>
          ) : null}
          <div className="md:col-span-2">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">일정</p>
          </div>
          <DateField disabled={editing} label="시공 시작일 *" value={form.woodDate} onChange={(v) => updateInstallDate("woodDate", v)} />
          <DateField disabled={editing} label="시공 종료일 *" value={form.endDate} onChange={(v) => updateInstallDate("endDate", v)} />
          <DateField disabled={editing} label="대리석 시공일" value={form.stoneDate} onChange={(v) => update("stoneDate", v)} />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="button" disabled={editing || !form.woodDate} onClick={() => update("endDate", form.woodDate)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40">당일 시공</button>
            <button type="button" disabled={editing || !form.endDate} onClick={() => update("stoneDate", form.endDate)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40">대리석=종료일</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel>현장주소 *</FieldLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input disabled={editing} className="w-full rounded-xl border px-3 py-2 disabled:opacity-50" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="주소검색 버튼으로 주소를 선택하세요" />
              <button type="button" disabled={editing} onClick={openAddressSearch} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">주소검색</button>
            </div>
          </div>
          <div>
            <FieldLabel>상세주소</FieldLabel>
            <input disabled={editing} className="w-full rounded-xl border px-3 py-2 disabled:opacity-50" value={form.addressDetail} onChange={(e) => update("addressDetail", e.target.value)} placeholder="동/호수, 층수, 비밀번호 등 상세주소" />
          </div>
        </div>

        <div className="mt-4">
          <FieldLabel>현장 특이사항</FieldLabel>
          <textarea disabled={editing} className="min-h-28 w-full rounded-xl border px-3 py-2 disabled:opacity-50" value={form.siteMemo} onChange={(e) => update("siteMemo", e.target.value)} />
        </div>

        {adminMode ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <FieldLabel>중요이력 기재/수정</FieldLabel>
            <textarea
              disabled={editing}
              className="min-h-32 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-50"
              value={form.history || ""}
              onChange={(e) => update("history", e.target.value)}
              placeholder="중요이력을 입력하거나 기존 내용을 수정하세요."
            />
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{message}</p>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 border-t bg-white/95 px-5 py-4 backdrop-blur md:-mx-6 md:px-6">
          <button onClick={onClose} disabled={editing} className="rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50">취소</button>
          <button onClick={onSubmit} disabled={editing} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:bg-slate-300">
            {editing ? "수정 중" : adminMode ? "관리자 수정완료" : "수정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostSavePhotoModal({ job, month, mode = "new", uploadPhoto, uploadProgress, uploadDoneMessage, uploadingId, onClose }) {
  const [files, setFiles] = useState(null);
  const [category, setCategory] = useState("시공전");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const selectedFiles = Array.from(files || []);
  const isReady = !!job.rowNumber;
  const isUploadingThis = uploadingId === (job.id || `ROW-${job.rowNumber}`);
  const categoryFolderUrl = job.photoUrl || "";
  const accept = getUploadAccept(category);
  const uploadHelpText = getUploadHelpText(category);

  const handleUpload = async () => {
    if (!isReady) {
      setMessage("현장 저장 확인 중입니다. 잠시 후 다시 눌러주세요.");
      return;
    }

    const uploadCheck = validateUploadFiles(files, category);
    if (!uploadCheck.ok) {
      setMessage(uploadCheck.message);
      return;
    }

    setMessage("");
    const success = await uploadPhoto(job, files, category, month);
    if (success) {
      setDone(true);
    } else {
      setMessage("사진등록에 실패했습니다. 파일과 구분을 확인한 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{mode === "new" ? "사진도 함께 첨부할까요?" : "사진등록"}</h2>
            <p className="mt-1 text-sm text-slate-500">{isReady ? `${job.customer} 현장` : `${job.customer} 현장 저장 확인 중입니다.`}</p>
            <p className="mt-1 text-xs text-slate-400">사진은 최대 15개, 파일당 20MB 이하로 등록 가능합니다. PDF는 계약도면에서만 선택됩니다.</p>
          </div>
          <button onClick={onClose} disabled={isUploadingThis} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>사진 구분</FieldLabel>
            <select className="w-full rounded-xl border px-3 py-2" value={category} onChange={(e) => { setCategory(e.target.value); setFiles(null); setMessage(""); }} disabled={isUploadingThis || done}>
              {PHOTO_CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <p className="mt-2 text-xs font-medium text-slate-500">{uploadHelpText}</p>
          </div>

          <div>
            <FieldLabel>{category === "계약도면" ? "도면 파일 선택" : "사진 선택"}</FieldLabel>
            <input type="file" accept={accept} multiple className="w-full rounded-xl border px-3 py-2" disabled={isUploadingThis || done} onChange={(e) => { setFiles(Array.from(e.target.files || [])); setMessage(""); }} />
            {selectedFiles.length ? (
              <p className="mt-2 text-xs font-bold text-emerald-700">
                선택됨: {selectedFiles.length}개
              </p>
            ) : null}
          </div>
        </div>

        {isUploadingThis && uploadProgress ? (
          <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{uploadProgress}</span>
            </div>
          </div>
        ) : null}

        {done ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            사진등록 완료
            {uploadDoneMessage ? <p className="mt-1 text-xs font-medium text-emerald-600">{uploadDoneMessage}</p> : null}
            {categoryFolderUrl ? (
              <a
                href={categoryFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white"
              >
                사진 폴더 열기
              </a>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{message}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={isUploadingThis} className="rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50">{done ? "닫기" : mode === "new" ? "나중에" : "취소"}</button>
          <button onClick={handleUpload} disabled={!isReady || isUploadingThis || done} className={`rounded-xl px-4 py-3 text-sm font-medium text-white ${isReady && !isUploadingThis && !done ? "bg-slate-900" : "bg-slate-300"}`}>{isUploadingThis ? "등록 중" : done ? "완료" : isReady ? (message ? "다시 등록" : "사진등록") : "저장 확인 중"}</button>
        </div>
      </div>
    </div>
  );
}

function BusyOverlay({ uploadingId, saving, editing, deleting, adminProcessing }) {
  const label = uploadingId
    ? "사진등록 처리 중"
    : saving
      ? "현장등록 저장 중"
      : editing
        ? "수정 저장 중"
        : deleting
          ? "삭제요청 처리 중"
          : adminProcessing
            ? "관리자 작업 처리 중"
            : "처리 중";

  return (
    <div className="fixed inset-x-0 bottom-4 z-[95] flex justify-center px-4 pointer-events-none">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-2xl">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function CompleteModal({ title, message, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">✓</div>
        <h2 className="mt-4 text-xl font-black text-slate-900">{title}</h2>
        {message ? (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-left">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>
          </div>
        ) : null}
        <button type="button" onClick={onConfirm} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
          확인
        </button>
      </div>
    </div>
  );
}

function DuplicateCheckModal({ data, onClose, onProceed, serverMode = false }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-black text-amber-700">{serverMode ? "서버 중복 현장 감지" : "중복 현장 가능성 감지"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {serverMode ? "서버에서 동일 또는 유사 현장이 감지되었습니다. 기존 현장을 확인 후 진행하세요." : "유사 현장이 발견되었습니다. 기존 현장을 확인 후 계속 진행하세요."}
        </p>

        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
          {data.jobs.map((job, idx) => (
            <div key={`${job.rowNumber}-${idx}`} className="rounded-2xl border bg-white p-3">
              <p className="font-bold text-slate-900">{job.customer}</p>
              <p className="mt-1 text-xs text-slate-500">{formatPhone(job.phone || "-")}</p>
              <p className="mt-1 text-xs text-slate-500">{job.address || "주소 없음"}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-3 text-sm font-bold">
            다시 확인
          </button>
          <button type="button" onClick={onProceed} className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white">
            {serverMode ? "중복 무시 후 등록" : "그래도 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorModal({ title, message, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl font-black text-rose-700">!</div>
        <h2 className="mt-4 text-xl font-black text-slate-900">{title}</h2>
        {message ? <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p> : null}
        <button type="button" onClick={onConfirm} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
          확인
        </button>
      </div>
    </div>
  );
}

function HistoryModal({ job, actor, setActor, text, setText, message, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">중요 이력 등록</h2>
            <p className="mt-1 text-sm text-slate-500">{job.customer} 현장</p>
          </div>
          <button onClick={onClose} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>작성자 구분</FieldLabel>
            <select className="w-full rounded-xl border px-3 py-2" value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="마스터 관리자">마스터 관리자</option>
              <option value="시공기사">시공기사</option>
            </select>
          </div>

          <div>
            <FieldLabel>중요 이력 내용</FieldLabel>
            <textarea
              className="min-h-32 w-full rounded-xl border px-3 py-2"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 고객 컴플레인, 파손, 사고, 재방문, AS 진행내용 등"
            />
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{message}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-3 text-sm font-medium">취소</button>
          <button onClick={onSubmit} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">등록</button>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ title, children }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function DetailMiniBadge({ label, value, className }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <Badge className={`mt-2 ${className || "bg-slate-100 text-slate-700 border-slate-300"}`}>{value}</Badge>
    </div>
  );
}

function DetailRow({ label, value, sub, badge, badgeClass }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-b-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">
        {badge ? <Badge className={badgeClass || "bg-slate-100 text-slate-700 border-slate-300"}>{badge}</Badge> : (value || "-")}
        {sub ? <span className="mt-1 block text-[11px] font-medium text-slate-500">{sub}</span> : null}
      </span>
    </div>
  );
}

function AdminPanel({ jobs, setAdminJob, adminMasterPassword, setAdminMasterPassword, adminDeleteRequests, adminDeleteLoading, adminProcessing = false, fetchAllDeleteRequests, fetchPartnerInstallerData, onDeleteAction, setAdminMode }) {
  const [entered, setEntered] = useState(false);
  const [adminEntryMessage, setAdminEntryMessage] = useState("");
  const [adminVerifying, setAdminVerifying] = useState(false);

  const deleteRequested = adminDeleteRequests || [];
  const unlockedJobs = jobs.filter((j) => !(j.editLocked || String(j.editLock || "") === "Y"));

  if (!entered) {
    return (
      <div id="admin-panel" className="rounded-2xl bg-white p-4 shadow-sm scroll-mt-24 md:p-6">
        <h2 className="text-xl font-black text-slate-950">관리자 모드</h2>
        <p className="mt-1 text-sm text-slate-500">삭제요청 처리, 현장 잠금, 관리자 수정 기능에 접근합니다.</p>

        <div className="mt-5">
          <FieldLabel>마스터 비밀번호</FieldLabel>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full rounded-xl border px-3 py-3 text-lg font-bold tracking-[0.25em]"
            value={adminMasterPassword}
            onChange={(e) => setAdminMasterPassword(onlyDigits(e.target.value))}
            placeholder="숫자 비밀번호"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            if (adminVerifying || adminProcessing) return;
            setAdminEntryMessage("");
            if (!adminMasterPassword.trim()) {
              setAdminEntryMessage("마스터 비밀번호를 입력해 주세요.");
              return;
            }
            try {
              setAdminVerifying(true);
              const data = IS_CANVAS_PREVIEW
                ? { success: adminMasterPassword === "1234" }
                : await fetch(`${WEBAPP_URL}?action=checkAdminPassword&masterPassword=${encodeURIComponent(adminMasterPassword)}&t=${Date.now()}`).then((res) => res.json());
              if (!data.success) {
                setAdminEntryMessage("마스터 비밀번호가 일치하지 않습니다.");
                return;
              }
              setEntered(true);
              setAdminMode(true);
              fetchAllDeleteRequests();
              fetchPartnerInstallerData();
            } catch (error) {
              setAdminEntryMessage("관리자 확인 중 오류가 발생했습니다.");
            } finally {
              setAdminVerifying(false);
            }
          }}
          disabled={adminVerifying || adminProcessing}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-300 md:w-auto"
        >
          {adminVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {adminVerifying ? "확인 중" : "관리자 모드 진입"}
        </button>
        {adminEntryMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-700">{adminEntryMessage}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
      <div id="admin-panel" className="space-y-5 scroll-mt-24">
        <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">삭제요청 현장</h2>
            <p className="mt-1 text-sm text-slate-500">전체 월 기준 삭제요청 현장입니다.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={fetchAllDeleteRequests} disabled={adminDeleteLoading || adminProcessing} className="whitespace-nowrap rounded-xl border px-2.5 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-50 sm:px-3 sm:text-xs">
              {adminDeleteLoading ? "조회중" : "새로고침"}
            </button>
            <span className="whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-black text-rose-700 sm:px-3 sm:text-xs">
              {adminDeleteLoading ? "조회중" : `${deleteRequested.length}건`}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {deleteRequested.length ? deleteRequested.map((job) => (
            <div key={`delete-${job.rowNumber}`} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-rose-900">{job.month ? `${job.month} · ` : ""}{job.customer}</p>
                  <p className="mt-1 break-words text-sm leading-snug text-rose-700">{job.address || "주소 없음"}</p>
                  <p className="mt-2 text-xs font-bold text-rose-500">{installPeriod(job)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                  <button onClick={() => onDeleteAction(job, "approveDelete")} disabled={adminProcessing} className="whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">
                    요청해제
                  </button>
                  <button
                    onClick={() => {
                      const ok = window.confirm(
                        `${job.customer} 현장을 완전삭제할까요?\n삭제 후 복구가 어렵습니다.`
                      );
                      if (ok) onDeleteAction(job, "hardDelete");
                    }}
                    disabled={adminProcessing}
                    className="whitespace-nowrap rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white disabled:bg-rose-300"
                  >
                    완전삭제
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400">
              삭제요청 현장이 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">잠기지 않은 현장</h2>
            <p className="mt-1 text-sm text-slate-500">일반 수정이 가능한 현장 목록</p>
          </div>
          <Badge className="bg-amber-50 text-amber-700 border-amber-200">
            {unlockedJobs.length}건
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {unlockedJobs.length ? unlockedJobs.map((job) => (
            <div key={`unlock-${job.rowNumber}`} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{job.customer}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{installPeriod(job)}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{job.address || "주소 없음"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminJob(job)}
                  disabled={adminProcessing}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:bg-slate-300 md:w-auto"
                >
                  현장 잠금
                </button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400">
              모든 현장이 잠금 상태입니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportPanel({ jobs }) {
  const completed = jobs.filter((j) => j.status === "시공완료").length;
  return <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">월마감 리포트</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Summary label="총 현장" value={`${jobs.length}건`} /><Summary label="시공완료" value={`${completed}건`} /><Summary label="진행중" value={`${jobs.length - completed}건`} /><Summary label="사진완료" value={`${jobs.filter((j) => j.photo === "등록완료").length}건`} /></div></div>;
}

function Summary({ label, value }) {
  return <div className="rounded-2xl bg-slate-100 p-4"><p className="text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

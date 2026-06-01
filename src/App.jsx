import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
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

function getUploadAccept(category) {
  return category === "계약도면" ? DRAWING_UPLOAD_ACCEPT : PHOTO_UPLOAD_ACCEPT;
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

function jobKey(job) {
  if (!job) return "";
  return `${job.month || job.sheet || ""}-${job.rowNumber || job.id || job.jobId || ""}`;
}

function isJobLocked(job) {
  if (!job) return false;
  const lockValue = String(job.editLock || job.editLocked || job.locked || "").trim().toUpperCase();
  return job.editLocked === true || job.locked === true || lockValue === "Y" || lockValue === "TRUE";
}

function completionPhotoCount(job) {
  return Number(job?.photoCounts?.완료사진 || 0);
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
  const [engineerOptions, setEngineerOptions] = useState([]);
  const [restoringSession, setRestoringSession] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [detailJob, setDetailJob] = useState(null);
  const [uploadJob, setUploadJob] = useState(null);
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
  const listRef = useRef(null);

  useEffect(() => {
    if (!detailJob?.month || !detailJob?.rowNumber) return;

    let ignore = false;

    const loadPhotoCounts = async () => {
      try {
        const url = `${WEBAPP_URL}?action=photoCounts&month=${encodeURIComponent(detailJob.month)}&rowNumber=${encodeURIComponent(detailJob.rowNumber)}&t=${Date.now()}`;
        const response = await fetch(url);
        const result = await response.json();

        if (ignore || !result.success) return;

        const key = jobKey(detailJob);
        applyJobUpdate(key, {
          photoCounts: result.counts || {},
          photoUrls: result.urls || {},
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadPhotoCounts();

    return () => {
      ignore = true;
    };
  }, [detailJob?.month, detailJob?.rowNumber]);

  const visibleJobs = useMemo(() => {
    if (!user) return [];
    const scopedJobs = user.role === "partner"
      ? jobs.filter((job) => job.partner === user.partnerName)
      : jobs.filter((job) => job.engineer === user.engineerName);

    return sortJobsByInstallDateDesc(scopedJobs);
  }, [jobs, user]);

  const monthOptions = useMemo(() => {
    return Array.from(new Set(
      visibleJobs
        .map((job) => String(job.month || job.sheet || "").trim())
        .filter(Boolean),
    )).sort((a, b) => b.localeCompare(a));
  }, [visibleJobs]);

  useEffect(() => {
    if (selectedMonth === "all") return;
    if (!monthOptions.includes(selectedMonth)) setSelectedMonth("all");
  }, [monthOptions, selectedMonth]);

  const monthVisibleJobs = useMemo(() => {
    if (selectedMonth === "all") return visibleJobs;
    return visibleJobs.filter((job) => String(job.month || job.sheet || "").trim() === selectedMonth);
  }, [selectedMonth, visibleJobs]);

  const filteredJobs = useMemo(() => {
    if (activeTab === "unassigned") return monthVisibleJobs.filter((job) => !job.engineer || job.engineer === "\uBBF8\uBC30\uC815" || job.status === "\uAE30\uC0AC\uBC30\uC815\uC694\uCCAD");
    if (activeTab === "photo") return monthVisibleJobs.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC" && !hasCompletionPhoto(job));
    if (activeTab === "complete") return monthVisibleJobs.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC");
    if (activeTab === "progress") return monthVisibleJobs.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC");
    return monthVisibleJobs;
  }, [activeTab, monthVisibleJobs]);

  const stats = useMemo(() => ({
    total: monthVisibleJobs.length,
    unassigned: monthVisibleJobs.filter((job) => !job.engineer || job.engineer === "\uBBF8\uBC30\uC815" || job.status === "\uAE30\uC0AC\uBC30\uC815\uC694\uCCAD").length,
    week: monthVisibleJobs.filter(isThisWeekJob).length,
    photoMissing: monthVisibleJobs.filter((job) => job.photo !== "\uB4F1\uB85D\uC644\uB8CC").length,
    completePhotoMissing: monthVisibleJobs.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC" && !hasCompletionPhoto(job)).length,
    complete: monthVisibleJobs.filter((job) => job.status === "\uC2DC\uACF5\uC644\uB8CC").length,
    incomplete: monthVisibleJobs.filter((job) => job.status !== "\uC2DC\uACF5\uC644\uB8CC").length,
  }), [monthVisibleJobs]);

  const groupedJobs = useMemo(() => {
    const groups = new Map();

    filteredJobs.forEach((job) => {
      const month = job.month || "월 미지정";
      const rows = groups.get(month) || [];
      rows.push(job);
      groups.set(month, rows);
    });

    return Array.from(groups.entries()).map(([month, rows]) => ({ month, rows }));
  }, [filteredJobs]);

  const paymentTotal = useMemo(() => {
    if (user?.role !== "partner") return 0;
    return monthPaymentTotal(monthVisibleJobs);
  }, [monthVisibleJobs, user]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const fetchPartnerJobs = async (loginUser, options = {}) => {
    try {
      const result = await apiPost({
        action: "getPartnerJobs",
        role: loginUser.role,
        partnerName: loginUser.partnerName,
        engineerName: loginUser.engineerName || "",
      });

      if (!result.success) {
        if (!options.silent) setLoginMessage(result.message || "현장 목록 조회 실패");
        return [];
      }

      return result.rows || [];
    } catch (err) {
      console.error(err);
      if (!options.silent) setLoginMessage(err.message || "현장 목록 API 연결 실패");
      return [];
    }
  };

  const fetchEngineerOptions = async (loginUser) => {
    if (!loginUser?.partnerName) return [];

    try {
      const response = await fetch(`${WEBAPP_URL}?action=partnerInstallerData&t=${Date.now()}`);
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
      try {
        const savedSession = readPartnerSession();
        if (!savedSession?.user) return;

        const savedUser = savedSession.user;

        const [rows, engineers] = await Promise.all([
          fetchPartnerJobs(savedUser, { silent: true }),
          fetchEngineerOptions(savedUser),
        ]);

        if (cancelled) return;

        setUser(savedUser);
        setPartnerAuthPassword(savedSession.authPassword || "");
        writePartnerSession(savedUser, savedSession.authPassword || "");
        setJobs(rows);
        setEngineerOptions(engineers);
        setScreen(savedUser.mustChangePassword ? "passwordChange" : "portal");
        setActiveTab("today");
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

  setLoginMessage("로그인 확인 중입니다.");
  setLoginLoading(true);

  try {
    const result = await apiPost({
      action: "partnerLogin",
      id: trimmedId,
      password: trimmedPw,
    });

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

    const [rows, engineers] = await Promise.all([
      fetchPartnerJobs(loginUser),
      fetchEngineerOptions(loginUser),
    ]);

    setJobs(rows);
    setEngineerOptions(engineers);
    writePartnerSession(loginUser, trimmedPw);
    setLoginPw("");
    setActiveTab("today");
    setScreen("portal");
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
    };

    const [rows, engineers] = await Promise.all([
      fetchPartnerJobs(nextUser),
      fetchEngineerOptions(nextUser),
    ]);

    setUser(nextUser);
    setPartnerAuthPassword(nextPassword);
    setJobs(rows);
    setEngineerOptions(engineers);
    writePartnerSession(nextUser, nextPassword);

    setNextPassword("");
    setNextPasswordConfirm("");
    setLoginPw("");
    setPasswordChangeMessage("");
    setActiveTab("today");
    setScreen("portal");
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
        loginId: user.loginId || user.id,
        password: partnerAuthPassword,
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
      const rows = await fetchPartnerJobs(user, { silent: true });
      if (!rows.length) return;

      setJobs(rows);
      setDetailJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setHistoryJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
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
      status: "기사배정완료",
    };

    setAssigningJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "assignEngineer",
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        partnerName: user.partnerName || job.partner || "",
        engineerName: engineer,
        engineerPhone: nextEngineerPhone,
      });

      if (!result.success) {
        setActionMessage(result.message || "엔지니어 배정 저장에 실패했습니다.");
        return;
      }

      applyJobUpdate(key, assignedPatch);
      setActionMessage("엔지니어 배정이 저장되었습니다.");
      refreshJobsQuietly();
    } catch (err) {
      console.error(err);
      if (String(err?.message || "").includes("Failed to fetch")) {
        applyJobUpdate(key, assignedPatch);
        setActionMessage("배정 요청을 보냈습니다. 화면에 먼저 반영했고, 잠시 후 자동으로 다시 확인합니다.");
        refreshJobsQuietly(1800);
        refreshJobsQuietly(4500);
      } else {
        setActionMessage(err.message || "엔지니어 배정 API 연결 실패");
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
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
        requireCompletionPhoto: true,
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
    const nextHistoryLine = `${new Date().toLocaleString("ko-KR")} ${user.name || user.engineerName || user.partnerName || "사용자"}: ${text.trim()}`;
    const appendHistory = (item) => ({
      ...item,
      history: [item.history, nextHistoryLine].filter(Boolean).join("\n"),
    });

    setHistorySavingJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "addHistory",
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
        actor: user.name || user.engineerName || user.partnerName || "사용자",
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

  const uploadPhotoFiles = async (job, category, files) => {
    if (!job || !user) return false;

    if (isJobLocked(job)) {
      setActionMessage("관리자가 잠근 현장입니다. 사진을 등록할 수 없습니다.");
      return false;
    }

    const fileList = Array.from(files || []);
    const check = validateUploadFiles(fileList, category);
    const key = jobKey(job);

    if (!check.ok) {
      setActionMessage(check.message);
      return false;
    }

    setUploadingJobId(key);
    setUploadProgress("");
    setActionMessage("");

    try {
      let lastResult = null;

      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i];
        setUploadProgress(`파일 준비 중 ${i + 1}/${fileList.length}`);
        const base64 = await fileToBase64(file);

        setUploadProgress(`업로드 중 ${i + 1}/${fileList.length}`);
        const result = await apiPost({
          action: "uploadPhoto",
          month: job.month || job.sheet || "",
          rowNumber: job.rowNumber || "",
          category,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
          role: user.role,
          partnerName: user.partnerName || job.partner || "",
          engineerName: user.engineerName || job.engineer || "",
        });

        if (!result.success) {
          setActionMessage(result.message || "사진등록에 실패했습니다.");
          return false;
        }

        lastResult = result;
      }

      applyJobUpdate(key, (item) => ({
        ...item,
        photo: "등록완료",
        photoUrl: lastResult?.folderUrl || item.photoUrl,
        photoCounts: {
          ...item.photoCounts,
          [category]: (item.photoCounts?.[category] || 0) + fileList.length,
        },
      }));
      setUploadJob(null);
      setUploadProgress("");
      setActionMessage(`${category} ${fileList.length}개 파일 등록이 완료되었습니다.`);
      refreshJobsQuietly();
      return true;
    } catch (err) {
      console.error(err);
      setActionMessage(err.message || "사진등록 API 연결 실패");
      return false;
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
        <PortalHeader user={user} onLogout={handleLogout} />
        {user.role === "partner" ? (
          <EngineerAccountRequestPanel
            form={engineerRequestForm}
            setForm={setEngineerRequestForm}
            loading={engineerRequestLoading}
            message={engineerRequestMessage}
            onSubmit={submitEngineerAccountRequest}
          />
        ) : null}
        <MonthFilter
          months={monthOptions}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          totalCount={visibleJobs.length}
        />
        <PortalSummary user={user} stats={stats} paymentTotal={paymentTotal} selectedMonth={selectedMonth} />
        <StatGrid user={user} stats={stats} setActiveTab={selectTab} />
        <TabBar user={user} activeTab={activeTab} setActiveTab={selectTab} />

        <section ref={listRef} className="scroll-mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">{user.role === "partner" ? "협력사 현장 목록" : "내 현장 목록"}</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                총 {filteredJobs.length}건 표시 중{user.role === "partner" ? ` · 표시 합계 ${formatMoney(paymentTotal)}` : ""}
              </p>
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
        />
      ) : null}

      {uploadJob ? <UploadModal job={uploadJob} onClose={() => setUploadJob(null)} onSubmit={uploadPhotoFiles} uploading={uploadingJobId === jobKey(uploadJob)} progress={uploadProgress} message={actionMessage} /> : null}
      {historyJob ? <HistoryModal job={historyJob} onClose={() => setHistoryJob(null)} onSubmit={addHistory} saving={historySavingJobId === jobKey(historyJob)} message={actionMessage} /> : null}
    </div>
  );
}

function LoginForm({ id, password, setId, setPassword, message, loading = false, onSubmit }) {
  const submitOnEnter = (event) => {
    if (event.key !== "Enter") return;
    onSubmit();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl">
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

        <button onClick={onSubmit} disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {loading ? "확인 중" : "로그인"}
        </button>
      </div>
    </main>
  );
}

function EngineerAccountRequestPanel({ form, setForm, loading = false, message = "", onSubmit }) {
  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "phone" ? formatPhone(value) : value,
    }));
  };

  return (
    <section className="rounded-3xl border bg-white p-4 shadow-sm md:p-5">
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

function PortalHeader({ user, onLogout }) {
  return (
    <header className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400">대림바스&키친</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{user.role === "partner" ? "협력사 포털" : "시공엔지니어 포털"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={user.role === "partner" ? "border-slate-300 bg-slate-900 text-white" : "border-blue-200 bg-blue-50 text-blue-700"}>{user.role === "partner" ? "협력사" : "시공엔지니어"}</Badge>
            <span className="text-sm font-bold text-slate-600">{user.name}</span>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600">
          <LogOut className="h-4 w-4" /> 로그아웃
        </button>
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

function PortalSummary({ user, stats, paymentTotal, selectedMonth }) {
  const rows = user.role === "partner"
    ? [
        ["이번달 배정", stats.total],
        ["이번주 시공", stats.week],
        ["시공완료", stats.complete],
        ["미완료", stats.incomplete],
        ["기사 미배정", stats.unassigned],
      ]
    : [
        ["이번달 배정", stats.total],
        ["이번주 시공", stats.week],
        ["시공완료", stats.complete],
        ["미완료", stats.incomplete],
      ];

  return (
    <section className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">현장 요약</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">
            {selectedMonth === "all" ? "\uC804\uCCB4 \uC6D4" : selectedMonth}
          </h2>
        </div>
        {user.role === "partner" ? (
          <div className="text-right">
            <p className="text-[11px] font-black text-emerald-600">{"\uC9C0\uAE09\uC2DC\uACF5\uBE44 \uD569\uACC4"}</p>
            <p className="mt-1 text-lg font-black text-emerald-700">{formatMoney(paymentTotal)}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-black text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatGrid({ user, stats, setActiveTab }) {
  const cards = user.role === "partner" ? [
    ["전체 현장", stats.total, "today", ClipboardList],
    ["엔지니어 미배정", stats.unassigned, "unassigned", Users],
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
        <button key={title} onClick={() => setActiveTab(tab)} className="rounded-3xl border bg-white p-4 text-left shadow-sm active:scale-[0.99]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-500">{title}</p>
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-black">{value}</p>
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
  const needsEngineer = user.role === "partner" && (!job.engineer || job.engineer === "미배정" || job.status === "기사배정요청");

  return (
    <article className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{job.customer}</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{job.address}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {locked ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">잠금</Badge> : null}
          <Badge className={STATUS_CLASS[job.status] || "border-slate-200 bg-slate-100 text-slate-600"}>{job.status}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
        <Info label="시공일" value={installPeriod(job)} />
        <Info label="아이템" value={job.item} />
        <Info label="담당자" value={job.manager} />
        <Info label="기사" value={job.engineer || "미배정"} />
        {user.role === "partner" ? <Info label="지급시공비" value={formatMoney(partnerPaymentAmount(job))} /> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
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
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">엔지니어 배정이 필요한 현장입니다.</div>
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

function JobDetailModal({ job, user, onClose, onUpload, onHistory, onAssign, engineerOptions = [], assigning = false, completing = false, actionMessage = "", onComplete, onCopyAddress, addressCopied = false }) {
  const [engineer, setInstaller] = useState(job.engineer === "미배정" ? "" : job.engineer || "");
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
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">{job.item}</Badge>
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
              ? "마스터가 잠금 처리한 현장입니다. 잠금 해제 전까지 사진등록, 이력등록, 완료보고, 엔지니어 배정을 사용할 수 없습니다."
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
            <DetailRow label="시공엔지니어" value={job.engineer || "미배정"} />
            <DetailRow label="엔지니어 연락처" value={<PhoneLink value={job.engineerPhone} />} />
            {user.role === "partner" ? <DetailRow label="지급시공비" value={formatMoney(partnerPaymentAmount(job))} /> : null}
            {job.extraCostMemo ? <DetailRow label="계약 추가비용 내용" value={job.extraCostMemo} /> : null}
            {user.role === "partner" && job.extraPaymentMemo ? <DetailRow label="지급 추가비용 내용" value={job.extraPaymentMemo} /> : null}
          </DetailBox>
        </div>

        {canAssignEngineer ? (
          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="font-black text-blue-900">엔지니어 배정</h3>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <select value={engineer} onChange={(e) => setInstaller(e.target.value)} disabled={locked || assigning} className="rounded-2xl border bg-white px-3 py-3 text-sm font-bold disabled:opacity-60">
                <option value="">엔지니어 선택</option>
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
              const url = job.photoUrls?.[category] || "";

              return (
                <div key={category} className="rounded-2xl border bg-slate-50 p-3 text-center text-xs font-black text-slate-600">
                  <p>{category} {count}</p>
                  {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-700 underline">폴더열기</a> : null}
                </div>
              );
            })}
          </div>
          {job.photoUrl ? <a href={job.photoUrl} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">전체 사진보기</a> : null}
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

function UploadModal({ job, onClose, onSubmit, uploading = false, progress = "", message = "" }) {
  const [category, setCategory] = useState("시공전");
  const [files, setFiles] = useState([]);
  const [localMessage, setLocalMessage] = useState("");

  const submit = async () => {
    const check = validateUploadFiles(files, category);

    if (!check.ok) {
      setLocalMessage(check.message);
      return;
    }

    setLocalMessage("");
    await onSubmit(job, category, files);
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
            <select value={category} onChange={(e) => { setCategory(e.target.value); setFiles([]); setLocalMessage(""); }} disabled={uploading} className="w-full rounded-2xl border px-4 py-3 font-bold disabled:opacity-50">
              {PHOTO_CATEGORY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>{category === "계약도면" ? "PDF 또는 이미지 선택" : "갤러리에서 사진 선택"}</FieldLabel>
            <input type="file" accept={getUploadAccept(category)} multiple disabled={uploading} onChange={(e) => { setFiles(Array.from(e.target.files || [])); setLocalMessage(""); }} className="w-full rounded-2xl border px-4 py-3 text-sm disabled:opacity-50" />
            {files.length ? <p className="mt-2 text-xs font-bold text-emerald-700">선택됨: {files.length}개</p> : null}
          </div>
        </div>

        {progress ? <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{progress}</div> : null}
        {localMessage || message ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{localMessage || message}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={uploading} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={uploading || !files.length} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "등록 중" : "사진등록"}</button>
        </div>
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

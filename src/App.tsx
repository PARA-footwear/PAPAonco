import React, { useState, useEffect, useMemo } from "react";
import {
  Thermometer,
  Wind,
  Activity,
  AlertTriangle,
  History,
  PlusCircle,
  Check,
  Trash2,
  Heart,
  Calendar,
  Sparkles,
  Printer,
  Copy,
  Info,
  ChevronRight,
  TrendingUp,
  FileText
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from "recharts";
import { MedicalRecord, ComplaintOption, IndicatorStatus } from "./types";
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc } from "firebase/firestore";

// Helper to format date as DD.MM.YYYY HH:MM
const formatCurrentDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const COMPLAINT_OPTIONS: ComplaintOption[] = [
  { id: "nausea", label: "Нудота", emoji: "🤢" },
  { id: "stomach_burn", label: "Печія в шлунку", emoji: "🔥" },
  { id: "nosebleed", label: "Кров з носа", emoji: "🩸" },
  { id: "weakness", label: "Слабкість / Хиткість", emoji: "😵‍💫" },
  { id: "bone_pain", label: "Біль у кістках", emoji: "🦴" },
  { id: "vomiting", label: "Блювання", emoji: "🤮" },
  { id: "headache", label: "Головний біль", emoji: "🤕" }
];

const MEDICATION_SUGGESTIONS = [
  "Нічого не приймав(ла)",
  "Парацетамол 500мг",
  "Алмагель",
  "Ондансетрон 4мг",
  "Дексаметазон",
  "Регідрон",
  "Парацетамол 500мг, Алмагель"
];

const COMMENT_SUGGESTIONS = [
  "Почуваюся нормально",
  "Хороший апетит, багато сплю",
  "Є невелика слабкість",
  "Температура в нормі, нудоти немає",
  "Важко стояти на ногах"
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"entry" | "dashboard" | "history">("entry");

  // Form states - initialized to empty strings by default so they aren't sent unless measured/filled
  const [temperature, setTemperature] = useState<number | "">("");
  const [saturation, setSaturation] = useState<number | "">("");
  const [pulse, setPulse] = useState<number | "">("");
  const [pressureSys, setPressureSys] = useState<number | "">("");
  const [pressureDia, setPressureDia] = useState<number | "">("");
  const [bloodSugar, setBloodSugar] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [medications, setMedications] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // Status and data states
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<MedicalRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter and export states
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "warning" | "critical">("all");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Fetch all health records directly from Firestore (or fallback to local storage)
  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      if (db) {
        try {
          const recordsCollection = collection(db, "records");
          const q = query(recordsCollection, orderBy("createdAtMs", "desc"));
          const snapshot = await getDocs(q);
          const fetchedRecords: MedicalRecord[] = [];
          snapshot.forEach((docSnap) => {
            fetchedRecords.push({
              id: docSnap.id,
              ...docSnap.data()
            } as MedicalRecord);
          });
          setRecords(fetchedRecords);
          return;
        } catch (firestoreErr) {
          console.warn("Firestore fetch failed, trying local API/local storage:", firestoreErr);
        }
      }

      // Fallback: try proxy server API
      try {
        const res = await fetch("/api/records");
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
          return;
        }
      } catch (apiErr) {
        console.warn("Local API fetch failed, falling back to local storage:", apiErr);
      }

      // Ultimate fallback: Local Storage
      const localData = localStorage.getItem("chemo_tracker_records");
      setRecords(localData ? JSON.parse(localData) : []);
    } catch (e) {
      console.error("Error fetching medical records:", e);
      const localData = localStorage.getItem("chemo_tracker_records");
      setRecords(localData ? JSON.parse(localData) : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Sync to local storage as fallback whenever records change
  useEffect(() => {
    if (records.length > 0) {
      localStorage.setItem("chemo_tracker_records", JSON.stringify(records));
    }
  }, [records]);

  // Adjusters starting from current physiological values or fallback defaults
  const adjustTemp = (amount: number) => {
    setTemperature((prev) => {
      const current = typeof prev === "number" ? prev : 36.6;
      const next = parseFloat((current + amount).toFixed(1));
      if (next < 34) return 34;
      if (next > 43) return 43;
      return next;
    });
  };

  const adjustSaturation = (amount: number) => {
    setSaturation((prev) => {
      const current = typeof prev === "number" ? prev : 97;
      const next = current + amount;
      if (next < 50) return 50;
      if (next > 100) return 100;
      return next;
    });
  };

  const adjustPulse = (amount: number) => {
    setPulse((prev) => {
      const current = typeof prev === "number" ? prev : 75;
      const next = current + amount;
      if (next < 30) return 30;
      if (next > 220) return 220;
      return next;
    });
  };

  const adjustPressureSys = (amount: number) => {
    setPressureSys((prev) => {
      const current = typeof prev === "number" ? prev : 120;
      const next = current + amount;
      if (next < 40) return 40;
      if (next > 250) return 250;
      return next;
    });
  };

  const adjustPressureDia = (amount: number) => {
    setPressureDia((prev) => {
      const current = typeof prev === "number" ? prev : 80;
      const next = current + amount;
      if (next < 30) return 30;
      if (next > 180) return 180;
      return next;
    });
  };

  const setPressurePreset = (val: string) => {
    const parts = val.split("/");
    if (parts.length === 2) {
      setPressureSys(parseInt(parts[0]));
      setPressureDia(parseInt(parts[1]));
    }
  };

  const handleMedicationPreset = (preset: string) => {
    setMedications((prev) => {
      if (!prev) return preset;
      if (prev.includes(preset)) return prev;
      return `${prev}, ${preset}`;
    });
  };

  const handleCommentPreset = (preset: string) => {
    setComment(preset);
  };

  const toggleComplaint = (id: string) => {
    setSelectedComplaints((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Determine overall safety status based on medical rules (skipping empty fields)
  const calculateStatus = (
    temp: number | "",
    ox: number | "",
    pulseVal: number | "",
    sysVal: number | ""
  ): IndicatorStatus => {
    let isCritical = false;
    let isWarning = false;

    if (typeof temp === "number") {
      if (temp >= 38.0) isCritical = true;
      else if (temp >= 37.5) isWarning = true;
    }

    if (typeof ox === "number") {
      if (ox < 90) isCritical = true;
      else if (ox < 92) isWarning = true;
    }

    if (typeof pulseVal === "number") {
      if (pulseVal >= 100 || pulseVal <= 55) isWarning = true;
    }

    if (typeof sysVal === "number") {
      if (sysVal >= 160 || sysVal < 90) isCritical = true;
      else if (sysVal >= 140 || sysVal < 100) isWarning = true;
    }

    if (isCritical) return "critical";
    if (isWarning) return "warning";
    return "normal";
  };

  // Reset all form inputs to empty state
  const resetForm = () => {
    setTemperature("");
    setSaturation("");
    setPulse("");
    setPressureSys("");
    setPressureDia("");
    setBloodSugar("");
    setWeight("");
    setSelectedComplaints([]);
    setMedications("");
    setComment("");
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const calculatedStatus = calculateStatus(temperature, saturation, pulse, pressureSys);

    const newRecord: Partial<MedicalRecord> = {
      timestamp: formatCurrentDate(new Date()),
      createdAtMs: Date.now(),
      temperature: typeof temperature === "number" ? temperature : null,
      saturation: typeof saturation === "number" ? saturation : null,
      pulse: typeof pulse === "number" ? pulse : null,
      pressureSys: typeof pressureSys === "number" ? pressureSys : null,
      pressureDia: typeof pressureDia === "number" ? pressureDia : null,
      bloodSugar: typeof bloodSugar === "number" ? bloodSugar : null,
      weight: typeof weight === "number" ? weight : null,
      complaints: selectedComplaints,
      medications: medications || "Нічого не приймав(ла)",
      comment: comment || "Без коментаря",
      status: calculatedStatus
    };

    let recordAdded = false;

    if (db) {
      try {
        const recordsCollection = collection(db, "records");
        const docRef = await addDoc(recordsCollection, newRecord);
        const savedRecord = { id: docRef.id, ...newRecord } as MedicalRecord;
        setRecords((prev) => [savedRecord, ...prev]);
        recordAdded = true;
      } catch (firestoreErr) {
        console.warn("Direct Firestore insert failed, trying server API:", firestoreErr);
      }
    }

    if (!recordAdded) {
      try {
        const res = await fetch("/api/records", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(newRecord)
        });

        if (res.ok) {
          const savedRecord = await res.json();
          setRecords((prev) => [savedRecord, ...prev]);
          recordAdded = true;
        }
      } catch (apiErr) {
        console.warn("Local API insert failed, using local storage:", apiErr);
      }
    }

    if (!recordAdded) {
      const savedRecord = { id: "local_" + Date.now(), ...newRecord } as MedicalRecord;
      setRecords((prev) => [savedRecord, ...prev]);
    }

    setSaveSuccess(true);
    resetForm();
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  // Confirm delete of a record
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);

    const deleteFromState = () => {
      setRecords((prev) => prev.filter((r) => r.id !== recordToDelete.id));
      const filteredLocal = records.filter((r) => r.id !== recordToDelete.id);
      localStorage.setItem("chemo_tracker_records", JSON.stringify(filteredLocal));
    };

    let deletedFromServer = false;

    if (db && recordToDelete.id && !recordToDelete.id.startsWith("local_")) {
      try {
        const docRef = doc(db, "records", recordToDelete.id);
        await deleteDoc(docRef);
        deletedFromServer = true;
      } catch (firestoreErr) {
        console.warn("Direct Firestore delete failed, trying server API:", firestoreErr);
      }
    }

    if (!deletedFromServer) {
      try {
        const res = await fetch(`/api/records/${recordToDelete.id}`, {
          method: "DELETE"
        });
        if (res.ok) {
          deletedFromServer = true;
        }
      } catch (err) {
        console.error("Failed to delete from server API:", err);
      }
    }

    // Always clean up state and local cache
    deleteFromState();
    setIsDeleting(false);
    setRecordToDelete(null);
  };

  // Filter records by time window and safety status
  const filteredRecords = useMemo(() => {
    let list = [...records];

    // Filter by Timeframe
    if (timeFilter === "week") {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((r) => r.createdAtMs >= oneWeekAgo);
    } else if (timeFilter === "month") {
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((r) => r.createdAtMs >= oneMonthAgo);
    }

    // Filter by Safety Status
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    // Sort chronologically (descending for logs, ascending for charts)
    return list;
  }, [records, timeFilter, statusFilter]);

  // Chronologically sorted records for Recharts
  const chartData = useMemo(() => {
    return [...filteredRecords]
      .reverse() // from oldest to newest
      .map((r) => ({
        ...r,
        shortDate: r.timestamp.split(" ")[0], // just DD.MM.YYYY
        pressureLabel: r.pressureSys && r.pressureDia ? `${r.pressureSys}/${r.pressureDia}` : ""
      }));
  }, [filteredRecords]);

  // Smart Live Indicators
  const isTempCritical = typeof temperature === "number" && temperature >= 37.5;
  const isSatCritical = typeof saturation === "number" && saturation < 92;

  // Statistics summaries
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const temps = records.map((r) => r.temperature).filter((t) => t != null) as number[];
    const sats = records.map((r) => r.saturation).filter((s) => s != null) as number[];
    const pulses = records.map((r) => r.pulse).filter((p) => p != null) as number[];

    const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : "—";
    const avgSat = sats.length ? Math.round(sats.reduce((a, b) => a + b, 0) / sats.length) : "—";
    const avgPulse = pulses.length ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : "—";

    const warningCount = records.filter((r) => r.status === "warning").length;
    const criticalCount = records.filter((r) => r.status === "critical").length;

    return { avgTemp, avgSat, avgPulse, warningCount, criticalCount };
  }, [records]);

  // Export clinical text generator
  const exportSummaryText = useMemo(() => {
    if (filteredRecords.length === 0) return "Немає записів за вибраний період.";
    let report = `ЗВІТ ПРО СТАН ПАЦІЄНТА\n`;
    report += `=====================================\n`;
    report += `Пацієнт: Тищенко Павло Володимирович, 60 років\n`;
    report += `Діагноз: Плоскоклітинний рак легені (stage III)\n`;
    report += `Період звіту: ${timeFilter === "week" ? "Останній тиждень" : timeFilter === "month" ? "Останній місяць" : "Всі записи"}\n`;
    report += `Згенеровано: ${new Date().toLocaleString("uk-UA")}\n`;
    report += `=====================================\n\n`;

    filteredRecords.forEach((r, idx) => {
      report += `[Запис #${filteredRecords.length - idx}] ${r.timestamp}\n`;
      report += `- Температура: ${r.temperature != null ? r.temperature.toFixed(1) + "°C" : "не вимірювалась"}\n`;
      report += `- Сатурація (O2): ${r.saturation != null ? r.saturation + "%" : "не вимірювалась"}\n`;
      report += `- Пульс: ${r.pulse != null ? r.pulse + " уд/хв" : "не вимірювався"}\n`;
      if (r.pressureSys && r.pressureDia) {
        report += `- Тиск: ${r.pressureSys}/${r.pressureDia} мм рт. ст.\n`;
      } else {
        report += `- Тиск: не вимірювався\n`;
      }
      if (r.bloodSugar) report += `- Цукор: ${r.bloodSugar} ммоль/л\n`;
      if (r.weight) report += `- Вага: ${r.weight} кг\n`;
      if (r.complaints && r.complaints.length > 0) {
        const comps = r.complaints
          .map((id) => COMPLAINT_OPTIONS.find((o) => o.id === id)?.label || id)
          .join(", ");
        report += `- Скарги: ${comps}\n`;
      } else {
        report += `- Скарги: Немає скарг\n`;
      }
      report += `- Ліки: ${r.medications}\n`;
      report += `- Коментар: ${r.comment}\n`;
      let ukrStatus = "Норма";
      if (r.status === "warning") ukrStatus = "ПОПЕРЕДЖЕННЯ";
      if (r.status === "critical") ukrStatus = "КРИТИЧНИЙ";
      report += `- Статус ризику: ${ukrStatus}\n`;
      report += `-------------------------------------\n`;
    });

    return report;
  }, [filteredRecords, timeFilter]);

  const handleCopyReport = () => {
    navigator.clipboard.writeText(exportSummaryText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen text-slate-800 font-sans flex flex-col antialiased">
      {/* PRINT COVER AREA */}
      <div className="hidden print:block p-8 bg-white text-slate-900">
        <h1 className="text-3xl font-extrabold text-slate-900 border-b-2 border-slate-900 pb-4">
          Медичний Щоденник Спостережень
        </h1>
        <div className="mt-4 space-y-2">
          <p className="text-lg"><strong>Пацієнт:</strong> Тищенко Павло Володимирович, 60 років</p>
          <p className="text-lg"><strong>Діагноз:</strong> Плоскоклітинний рак легені (stage III)</p>
          <p className="text-sm text-slate-500">Згенеровано на платформі Медичний Щоденник</p>
        </div>
        <div className="mt-8">
          <pre className="font-mono whitespace-pre-wrap text-xs bg-slate-50 p-4 border rounded-xl leading-relaxed">
            {exportSummaryText}
          </pre>
        </div>
      </div>

      {/* WEB DISPLAY VIEW */}
      <div className="print:hidden flex-1 flex flex-col">
        {/* HEADER BAR */}
        <header className="bg-white border-b border-slate-200/80">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md shadow-rose-200 animate-pulse">
                ❤
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  МедТрекер <span className="text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">після хіміотерапії</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">Контроль стану в реальному часі</p>
              </div>
            </div>

            {/* Patient Info Card */}
            <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-2xl p-3 border border-slate-200/60 flex items-center gap-3 max-w-full">
              <div className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600 font-bold shrink-0">
                👴
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  Тищенко Павло Володимирович, 60 років
                </p>
                <p className="text-[11px] font-semibold text-slate-500 truncate">
                  Діагноз: Плоскоклітинний рак легені (stage III)
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* NAVIGATION TABS */}
        <div className="bg-white border-b border-slate-200/80">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-between items-center gap-2">
            <nav className="grid grid-cols-3 gap-1 py-2 w-full md:flex md:w-auto md:gap-1.5">
              <button
                onClick={() => setActiveTab("entry")}
                className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1 md:px-5 py-2.5 md:py-3 rounded-xl text-[10px] md:text-sm font-bold transition-all cursor-pointer text-center ${
                  activeTab === "entry"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Введення даних</span>
                <span className="md:hidden">Введення</span>
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1 md:px-5 py-2.5 md:py-3 rounded-xl text-[10px] md:text-sm font-bold transition-all cursor-pointer text-center ${
                  activeTab === "dashboard"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Динаміка та графіки</span>
                <span className="md:hidden">Динаміка</span>
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1 md:px-5 py-2.5 md:py-3 rounded-xl text-[10px] md:text-sm font-bold transition-all cursor-pointer text-center ${
                  activeTab === "history"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Історія щоденника</span>
                <span className="md:hidden">Історія</span>
              </button>
            </nav>

            <button
              onClick={() => setIsExporting(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 transition-colors text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              Звіт для лікаря
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
          
          {/* TOAST ON SUCCESS */}
          {saveSuccess && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white py-3.5 px-6 rounded-2xl font-bold text-base shadow-2xl flex items-center gap-2 animate-bounce border border-emerald-500">
              <Check className="w-5 h-5 stroke-[3]" />
              Запис успішно збережено!
            </div>
          )}

          {/* DYNAMIC SMART ALERTS (IN ENTRY MODE) */}
          {activeTab === "entry" && (isTempCritical || isSatCritical) && (
            <div className="space-y-3 mb-6">
              {isTempCritical && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-2xl shadow-sm critical-alert">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-red-950 font-black text-base">Увага! Ризик нейтропенії!</h3>
                      <p className="text-red-900 text-xs mt-1 font-semibold leading-relaxed">
                        Температура 37.5°C і вище може бути ознакою фебрильної нейтропенії — небезпечного стану зниження імунітету. 
                        <strong> Не приймайте Німесил або інші жарознижувальні без призначення лікаря!</strong> Тільки Парацетамол 500 мг за погодженням з лікарем!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isSatCritical && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-2xl shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-rose-950 font-black text-base">Увага! Низький рівень кисню!</h3>
                      <p className="text-rose-900 text-xs mt-1 font-semibold leading-relaxed">
                        Сатурація нижче 92% свідчить про гіпоксію. Посадіть пацієнта напівсидячи, відкрийте вікно для свіжого повітря. 
                        Дайте кисневий концентратор. Якщо показник впаде нижче 90% — негайно викликайте <strong>Швидку допомогу (103)</strong>!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: FORM ENTRY */}
          {activeTab === "entry" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Form panel */}
              <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-5">
                
                {/* 1. TEMPERATURE CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-slate-700 font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <Thermometer className="w-4 h-4 text-red-500" />
                      1. Температура (°C)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Норма: 36.0 - 37.2 °C</span>
                      {temperature !== "" && (
                        <button
                          type="button"
                          onClick={() => setTemperature("")}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Скинути цей замір"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {temperature === "" ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <span className="text-slate-400 text-xs font-bold mb-2">Замір температури не проводився</span>
                      <button
                        type="button"
                        onClick={() => setTemperature(36.6)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Внести замір температури
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => adjustTemp(-0.1)}
                          className="w-14 h-14 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xl font-black rounded-xl border border-slate-200/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                        >
                          -0.1
                        </button>
                        
                        <div className="text-center">
                          <span className={`text-4xl font-extrabold font-mono tracking-tight ${temperature >= 37.5 ? 'text-red-600' : 'text-slate-900'}`}>
                            {temperature.toFixed(1)}
                          </span>
                          <span className="text-lg text-slate-400 font-bold ml-1">°C</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => adjustTemp(0.1)}
                          className="w-14 h-14 bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 text-xl font-black rounded-xl border border-red-100/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                        >
                          +0.1
                        </button>
                      </div>

                      {/* Temperature slider for easy sliding */}
                      <div className="mt-4">
                        <input
                          type="range"
                          min="34.0"
                          max="42.0"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                          <span>34.0 °C</span>
                          <span>36.6 °C</span>
                          <span>38.0 °C</span>
                          <span>42.0 °C</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. OXYGEN / SATURATION CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-slate-700 font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-sky-500" />
                      2. Кисень / Сатурація (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Норма: 95 - 100%</span>
                      {saturation !== "" && (
                        <button
                          type="button"
                          onClick={() => setSaturation("")}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Скинути цей замір"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {saturation === "" ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <span className="text-slate-400 text-xs font-bold mb-2">Замір сатурації не проводився</span>
                      <button
                        type="button"
                        onClick={() => setSaturation(97)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Внести замір сатурації
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => adjustSaturation(-1)}
                          className="w-14 h-14 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xl font-black rounded-xl border border-slate-200/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                        >
                          -1%
                        </button>

                        <div className="text-center">
                          <span className={`text-4xl font-extrabold font-mono tracking-tight ${saturation < 92 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                            {saturation}
                          </span>
                          <span className="text-lg text-slate-400 font-bold ml-1">%</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => adjustSaturation(1)}
                          className="w-14 h-14 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 text-xl font-black rounded-xl border border-sky-100/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                        >
                          +1%
                        </button>
                      </div>

                      {/* Range slider for saturation */}
                      <div className="mt-4">
                        <input
                          type="range"
                          min="70"
                          max="100"
                          step="1"
                          value={saturation}
                          onChange={(e) => setSaturation(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                          <span>70%</span>
                          <span>92% (Попередження)</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. PULSE CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-slate-700 font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      3. Пульс (удари в хвилину)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Норма: 60 - 90 уд/хв</span>
                      {pulse !== "" && (
                        <button
                          type="button"
                          onClick={() => setPulse("")}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Скинути цей замір"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {pulse === "" ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <span className="text-slate-400 text-xs font-bold mb-2">Замір пульсу не проводився</span>
                      <button
                        type="button"
                        onClick={() => setPulse(75)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Внести замір пульсу
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => adjustPulse(-5)}
                        className="w-14 h-14 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-lg font-black rounded-xl border border-slate-200/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                      >
                        -5
                      </button>

                      <div className="text-center">
                        <span className={`text-4xl font-extrabold font-mono tracking-tight ${(pulse >= 100 || pulse <= 55) ? 'text-amber-600' : 'text-slate-900'}`}>
                          {pulse}
                        </span>
                        <span className="text-lg text-slate-400 font-bold ml-1 font-sans">уд/хв</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => adjustPulse(5)}
                        className="w-14 h-14 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 text-lg font-black rounded-xl border border-emerald-100/80 flex items-center justify-center transition-all shadow-sm select-none shrink-0"
                      >
                        +5
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. PRESSURE CARD */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-slate-700 font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      🩺
                      4. Тиск (SYS / DIA)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Норма: 120/80 мм рт.ст.</span>
                      {(pressureSys !== "" || pressureDia !== "") && (
                        <button
                          type="button"
                          onClick={() => {
                            setPressureSys("");
                            setPressureDia("");
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Скинути цей замір"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {pressureSys === "" && pressureDia === "" ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <span className="text-slate-400 text-xs font-bold mb-2">Замір тиску не проводився</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPressureSys(120);
                          setPressureDia(80);
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Внести замір тиску
                      </button>
                    </div>
                  ) : (
                    <div className="animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* SYS */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Систолічний (SYS)</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adjustPressureSys(-5)}
                              className="w-11 h-11 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 font-bold border border-slate-200 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0"
                            >
                              -5
                            </button>
                            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-red-500 focus-within:bg-white transition-all">
                              <input
                                type="number"
                                inputMode="numeric"
                                value={pressureSys}
                                onChange={(e) => setPressureSys(e.target.value === "" ? "" : parseInt(e.target.value))}
                                className="w-full text-center bg-transparent border-none outline-none text-lg font-extrabold text-slate-800"
                                placeholder="120"
                              />
                              <span className="text-xs text-slate-400 font-bold shrink-0 ml-1">мм</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => adjustPressureSys(5)}
                              className="w-11 h-11 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-bold border border-red-100 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0"
                            >
                              +5
                            </button>
                          </div>
                        </div>

                        {/* DIA */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Діастолічний (DIA)</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adjustPressureDia(-5)}
                              className="w-11 h-11 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 font-bold border border-slate-200 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0"
                            >
                              -5
                            </button>
                            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-sky-500 focus-within:bg-white transition-all">
                              <input
                                type="number"
                                inputMode="numeric"
                                value={pressureDia}
                                onChange={(e) => setPressureDia(e.target.value === "" ? "" : parseInt(e.target.value))}
                                className="w-full text-center bg-transparent border-none outline-none text-lg font-extrabold text-slate-800"
                                placeholder="80"
                              />
                              <span className="text-xs text-slate-400 font-bold shrink-0 ml-1">мм</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => adjustPressureDia(5)}
                              className="w-11 h-11 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 font-bold border border-sky-100 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none shrink-0"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-2 mt-3.5 pt-3.5 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center mr-1">Пресети:</span>
                        {["110/70", "120/80", "130/85", "140/90"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPressurePreset(preset)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-600 border border-slate-200/60 active:scale-95 transition-all cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. ADDED MEDICAL METRICS (BLOOD SUGAR & WEIGHT) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-slate-700 font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5">
                      📊
                      5. Цукор та Вага (Додатково)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Sugar */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Цукор крові (ммоль/л)</span>
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-amber-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={bloodSugar}
                          onChange={(e) => setBloodSugar(e.target.value === "" ? "" : parseFloat(e.target.value))}
                          className="w-full text-center bg-transparent border-none outline-none font-bold text-slate-800"
                          placeholder="Не вимірювався"
                        />
                        <span className="text-xs text-slate-400 font-bold shrink-0 ml-1">ммоль/л</span>
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Вага тіла (кг)</span>
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value === "" ? "" : parseFloat(e.target.value))}
                          className="w-full text-center bg-transparent border-none outline-none font-bold text-slate-800"
                          placeholder="Не вимірювалась"
                        />
                        <span className="text-xs text-slate-400 font-bold shrink-0 ml-1">кг</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. COMPLAINTS CHECKBOXES */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <label className="block text-slate-700 font-extrabold text-xs tracking-wider uppercase mb-3.5">
                    6. Скарги та симптоми сьогодні:
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {COMPLAINT_OPTIONS.map((c) => {
                      const isSelected = selectedComplaints.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleComplaint(c.id)}
                          className={`w-full flex items-center justify-between text-left p-3.5 rounded-xl border-2 transition-all select-none cursor-pointer h-12 ${
                            isSelected
                              ? "border-red-500 bg-red-50/40 text-red-950 font-bold shadow-sm"
                              : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-lg">{c.emoji}</span> {c.label}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${
                              isSelected
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-4 h-4 stroke-[3.5]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. MEDICATIONS */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <label className="block text-slate-700 font-extrabold text-xs tracking-wider uppercase mb-2">
                    7. Прийняті медичні препарати:
                  </label>
                  
                  <input
                    type="text"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="Наприклад: Алмагель, Дексаметазон, Парацетамол"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-border-slate-800 focus:bg-white focus:outline-none mb-3 font-semibold text-slate-800"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {MEDICATION_SUGGESTIONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleMedicationPreset(preset)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-[11px] font-bold rounded-lg text-slate-600 transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 8. COMMENT */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
                  <label className="block text-slate-700 font-extrabold text-xs tracking-wider uppercase mb-2">
                    8. Нотатки про самопочуття (Коментар):
                  </label>

                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Опишіть самопочуття своїми словами..."
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-slate-800 focus:bg-white focus:outline-none mb-3 font-semibold text-slate-800"
                  ></textarea>

                  <div className="flex flex-wrap gap-1.5">
                    {COMMENT_SUGGESTIONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleCommentPreset(preset)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-[11px] font-bold rounded-lg text-slate-600 transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 active:scale-[0.99] text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer h-14 shadow-rose-200"
                >
                  💾 Зберегти запис у щоденник
                </button>

              </form>

              {/* Sidebar Quick-Guideline panel */}
              <div className="lg:col-span-4 space-y-5">
                {/* Real-time status display */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 text-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">ОЦІНКА СТАНУ</span>
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl">
                      💓
                    </div>
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">Поточний сеанс введення</h3>
                  <p className="text-xs text-slate-500 mt-1">На основі введених фізіологічних показників:</p>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs border-b border-slate-55 pb-2">
                      <span className="text-slate-500">Статус:</span>
                      {(() => {
                        const s = calculateStatus(temperature, saturation, pulse, pressureSys);
                        if (s === "critical") {
                          return <span className="bg-red-100 text-red-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">Критичний</span>;
                        } else if (s === "warning") {
                          return <span className="bg-amber-100 text-amber-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">Попередження</span>;
                        }
                        return <span className="bg-emerald-100 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">Норма</span>;
                      })()}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Кількість скарг:</span>
                      <span className="font-bold text-slate-800">{selectedComplaints.length}</span>
                    </div>
                  </div>
                </div>

                {/* Important oncology guidance rules */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
                  <h3 className="font-black text-white text-sm tracking-wide uppercase flex items-center gap-1.5 mb-3">
                    <Info className="w-4 h-4 text-rose-400" />
                    Особливі інструкції
                  </h3>
                  
                  <ul className="space-y-3.5 text-xs text-slate-300">
                    <li className="flex gap-2 leading-relaxed">
                      <span className="text-rose-400 shrink-0 mt-0.5">▪</span>
                      <span>
                        <strong>Контроль температури:</strong> Вимірюйте тричі на день. Будь-яке підвищення до <strong>37.5 °C і вище</strong> вимагає негайного зв'язку з лікарем.
                      </span>
                    </li>
                    <li className="flex gap-2 leading-relaxed">
                      <span className="text-rose-400 shrink-0 mt-0.5">▪</span>
                      <span>
                        <strong>Питний баланс:</strong> Пийте не менше 2 літрів чистої води на день (або Регідрону), щоб виводити токсини хіміотерапії.
                      </span>
                    </li>
                    <li className="flex gap-2 leading-relaxed">
                      <span className="text-rose-400 shrink-0 mt-0.5">▪</span>
                      <span>
                        <strong>Нудота / Блювання:</strong> Приймайте призначений протиблювотний засіб (наприклад, Ондансетрон за 30-40 хвилин до їди).
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INTERACTIVE DASHBOARD & GRAPHICS */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* STATISTICS GRID */}
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Mean Temp */}
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-lg shrink-0">
                      🌡
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Середня темп.</p>
                      <p className="text-xl font-extrabold text-slate-800 mt-0.5 font-mono">{stats.avgTemp} °C</p>
                    </div>
                  </div>

                  {/* Mean Oxygen */}
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center text-lg shrink-0">
                      💨
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Середній O2</p>
                      <p className="text-xl font-extrabold text-slate-800 mt-0.5 font-mono">{stats.avgSat != "—" ? stats.avgSat + "%" : "—"}</p>
                    </div>
                  </div>

                  {/* Mean Pulse */}
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg shrink-0">
                      💓
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Середній Пульс</p>
                      <p className="text-xl font-extrabold text-slate-800 mt-0.5 font-mono">{stats.avgPulse} {stats.avgPulse != "—" ? "уд/хв" : ""}</p>
                    </div>
                  </div>

                  {/* Critical warnings */}
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${stats.criticalCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                      ⚠
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Критичні піки</p>
                      <p className={`text-xl font-extrabold mt-0.5 ${stats.criticalCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.criticalCount} разів</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TIMEFRAME SELECTOR */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-rose-500" />
                  Часовий діапазон графіків:
                </span>
                
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[
                    { id: "all", label: "За весь час" },
                    { id: "week", label: "Останній тиждень" },
                    { id: "month", label: "Останній місяць" }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTimeFilter(filter.id as any)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        timeFilter === filter.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* RECHARTS PLOTS */}
              {chartData.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold text-lg">Недостатньо даних для побудови графіків.</p>
                  <p className="text-slate-400 text-xs mt-1">Додайте хоча б один запис у вкладці «Введення даних»!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* CHART 1: TEMPERATURE AND OXYGEN OVER TIME */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-red-500" />
                      Температура (°C) та Насичення киснем (%)
                    </h3>
                    
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="tempColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="oxygenColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="shortDate" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                          <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#94a3b8" fontSize={11} fontWeight={600} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(15, 23, 42, 0.95)",
                              borderRadius: "12px",
                              border: "none",
                              color: "#fff",
                              fontSize: "12px",
                              fontFamily: "sans-serif"
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                          <Area
                            name="Температура (°C)"
                            type="monotone"
                            dataKey="temperature"
                            stroke="#ef4444"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#tempColor)"
                          />
                          <Area
                            name="Сатурація (%)"
                            type="monotone"
                            dataKey="saturation"
                            stroke="#0ea5e9"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#oxygenColor)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CHART 2: PRESSURE & PULSE */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
                    <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      Тиск (SYS / DIA) та Пульс (уд/хв)
                    </h3>

                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="shortDate" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                          <YAxis domain={['dataMin - 10', 'dataMax + 10']} stroke="#94a3b8" fontSize={11} fontWeight={600} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(15, 23, 42, 0.95)",
                              borderRadius: "12px",
                              border: "none",
                              color: "#fff",
                              fontSize: "12px",
                              fontFamily: "sans-serif"
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                          <Line
                            name="Систолічний (SYS)"
                            type="monotone"
                            dataKey="pressureSys"
                            stroke="#dc2626"
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                          />
                          <Line
                            name="Діастолічний (DIA)"
                            type="monotone"
                            dataKey="pressureDia"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                          <Line
                            name="Пульс (уд/хв)"
                            type="monotone"
                            dataKey="pulse"
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: DIARY HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-5">
              
              {/* FILTERS TOOLBAR */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Total Counter & Mobile Report Trigger */}
                <div className="flex justify-between items-center w-full md:w-auto gap-3">
                  <div className="text-slate-500 font-extrabold text-xs tracking-wider uppercase">
                    Всього відфільтровано записів: <span className="text-slate-800 font-black text-sm">{filteredRecords.length}</span>
                  </div>
                  
                  {/* Doctor Report Button specifically for Mobile/Tablet layout */}
                  <button
                    onClick={() => setIsExporting(true)}
                    className="flex md:hidden items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 transition-colors text-rose-700 font-extrabold text-[11px] rounded-lg border border-rose-200 shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Звіт
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {/* Status filter selection */}
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Фільтр ризику:</span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    {[
                      { id: "all", label: "Всі" },
                      { id: "normal", label: "Норма" },
                      { id: "warning", label: "Попередження" },
                      { id: "critical", label: "Критичні" }
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setStatusFilter(btn.id as any)}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          statusFilter === btn.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setTimeFilter("all");
                      setStatusFilter("all");
                    }}
                    className="text-slate-500 hover:text-slate-800 text-[11px] font-bold px-2.5 py-1.5 bg-slate-50 border rounded-lg transition-colors"
                  >
                    Скинути
                  </button>
                </div>

              </div>

              {/* LIST RECORDS */}
              {isLoading ? (
                <div className="bg-white p-12 rounded-2xl text-center border shadow-sm">
                  <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-500 font-bold">Йде завантаження записів...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold text-lg">Записів у щоденнику не знайдено.</p>
                  <p className="text-slate-400 text-xs mt-1">Додайте новий запис або змініть фільтри в панелі вище!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecords.map((rec) => {
                    const hasHighTemp = typeof rec.temperature === "number" && rec.temperature >= 37.5;
                    const hasLowOxygen = typeof rec.saturation === "number" && rec.saturation < 92;
                    
                    return (
                      <div
                        key={rec.id}
                        className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                      >
                        {/* Status bar indication */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            rec.status === "critical"
                              ? "bg-red-500"
                              : rec.status === "warning"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />

                        {/* Top Info */}
                        <div className="flex justify-between items-center mb-3.5 pl-1.5">
                          <span className="text-xs font-extrabold text-slate-400 font-mono tracking-tight flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {rec.timestamp}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            {rec.status === "critical" ? (
                              <span className="bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Критичний</span>
                            ) : rec.status === "warning" ? (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Попередження</span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Норма</span>
                            )}

                            <button
                              type="button"
                              onClick={() => setRecordToDelete(rec)}
                              className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Видалити запис"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* METRICS ROW */}
                        <div className="grid grid-cols-2 gap-2 pl-1.5 mb-3.5">
                          {/* Temp */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                            <span className="text-base shrink-0">🌡</span>
                            <div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Темп.</p>
                              <p className="text-sm font-black text-slate-800 font-mono">
                                {rec.temperature != null ? `${rec.temperature.toFixed(1)}°C` : "—"}
                              </p>
                            </div>
                          </div>

                          {/* Oxygen */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                            <span className="text-base shrink-0">💨</span>
                            <div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Кисень</p>
                              <p className="text-sm font-black text-slate-800 font-mono">
                                {rec.saturation != null ? `${rec.saturation}%` : "—"}
                              </p>
                            </div>
                          </div>

                          {/* Pulse */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                            <span className="text-base shrink-0">💓</span>
                            <div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Пульс</p>
                              <p className="text-sm font-black text-slate-800 font-mono">
                                {rec.pulse != null ? `${rec.pulse} уд` : "—"}
                              </p>
                            </div>
                          </div>

                          {/* Pressure */}
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                            <span className="text-base shrink-0">🩺</span>
                            <div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Тиск</p>
                              <p className="text-sm font-black text-slate-800 font-mono">
                                {rec.pressureSys && rec.pressureDia ? `${rec.pressureSys}/${rec.pressureDia}` : "—"}
                              </p>
                            </div>
                          </div>

                          {/* Sugar (if provided) */}
                          {rec.bloodSugar != null && (
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                              <span className="text-base shrink-0">🩸</span>
                              <div>
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Цукор</p>
                                <p className="text-sm font-black text-slate-800 font-mono">
                                  {rec.bloodSugar} ммоль
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Weight (if provided) */}
                          {rec.weight != null && (
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center gap-2">
                              <span className="text-base shrink-0">⚖</span>
                              <div>
                                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Вага</p>
                                <p className="text-sm font-black text-slate-800 font-mono">
                                  {rec.weight} кг
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Critical oncology warnings */}
                        {hasHighTemp && (
                          <div className="bg-red-50 border border-red-100 text-red-950 p-2.5 rounded-lg text-[11px] font-bold mb-3 pl-2.5">
                            ⚠ Ризик фебрильної нейтропенії! Тільки Парацетамол!
                          </div>
                        )}
                        {hasLowOxygen && (
                          <div className="bg-rose-50 border border-rose-100 text-rose-950 p-2.5 rounded-lg text-[11px] font-bold mb-3 pl-2.5">
                            ⚠ Сатурація критично низька! Забезпечити кисень!
                          </div>
                        )}

                        {/* Meds */}
                        <div className="mb-2 pl-1.5">
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Прийняті препарати:</p>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{rec.medications || "Немає"}</p>
                        </div>

                        {/* Complaints */}
                        <div className="mb-2 pl-1.5">
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Скарги пацієнта:</p>
                          {rec.complaints && rec.complaints.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {rec.complaints.map((cId) => {
                                const match = COMPLAINT_OPTIONS.find((o) => o.id === cId) || {
                                  label: cId,
                                  emoji: "⚠️"
                                };
                                return (
                                  <span
                                    key={cId}
                                    className="bg-red-50 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100/60 inline-flex items-center gap-1"
                                  >
                                    <span>{match.emoji}</span> {match.label}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Скарг немає</p>
                          )}
                        </div>

                        {/* Comment */}
                        <div className="mt-3.5 pt-3.5 border-t border-slate-100 pl-1.5">
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Коментар:</p>
                          <p className="text-xs font-medium text-slate-600 mt-1 italic">
                            "{rec.comment || "Без коментаря"}"
                          </p>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* MODAL: EXPORT FOR DOCTOR */}
      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center text-white">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Зведений звіт для лікуючого онколога</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Автоматичний збір клінічних показників</p>
                </div>
              </div>
              <button
                onClick={() => setIsExporting(false)}
                className="text-slate-400 hover:text-white font-extrabold text-sm p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Згенеровано детальний текстову виписку щоденника здоров'я. Ви можете скопіювати її в WhatsApp/Viber, відправити електронною поштою або роздрукувати на принтері.
              </p>

              {/* Text Preview Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[300px] overflow-y-auto">
                <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {exportSummaryText}
                </pre>
              </div>

              {/* Action triggers */}
              <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyReport}
                    className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      copiedText
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedText ? "Скопійовано!" : "Копіювати текст"}
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Роздрукувати звіт
                  </button>
                </div>

                <button
                  onClick={() => setIsExporting(false)}
                  className="px-4 py-2.5 text-xs font-extrabold text-slate-500 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Закрити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all">
            {/* Modal Header */}
            <div className="bg-red-50 px-6 py-5 border-b border-red-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-red-950 text-base leading-tight">
                  Підтвердження видалення
                </h3>
                <p className="text-[10px] font-bold text-red-700/80 mt-0.5">
                  Цей запис неможливо буде відновити
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-slate-600 text-sm font-semibold">
                Ви дійсно хочете остаточно видалити запис від <span className="font-black text-slate-900">{recordToDelete.timestamp}</span>?
              </p>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Видалення..." : "Так, видалити"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

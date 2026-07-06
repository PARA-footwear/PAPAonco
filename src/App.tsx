/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Thermometer,
  Wind,
  Activity,
  AlertTriangle,
  History,
  PlusCircle,
  Check,
  Trash2,
  Heart
} from "lucide-react";

// Helper to format date as DD.MM.YYYY HH:MM
const formatCurrentDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

interface HealthRecord {
  id?: string;
  timestamp: string; // DD.MM.YYYY HH:MM
  createdAtMs: number;
  temperature?: number | null;
  saturation?: number | null;
  pulse?: number | null;
  pressure?: string | null;
  complaints: string[];
  medications: string;
  comment: string;
}

const COMPLAINT_OPTIONS = [
  { id: "stomach_burn", label: "Печія у шлунку", emoji: "🤢" },
  { id: "nosebleed", label: "Кров з носа", emoji: "🩸" },
  { id: "nausea", label: "Нудота", emoji: "🤢" },
  { id: "weakness", label: "Слабкість / Хиткість", emoji: "😵‍💫" },
  { id: "bone_pain", label: "Біль у кістках", emoji: "🦴" }
];

const MEDICATION_SUGGESTIONS = [
  "Нічого не приймав(ла)",
  "Парацетамол 500мг",
  "Альмагель",
  "Ондансетрон 4мг",
  "Дексаметазон",
  "Парацетамол 500мг, Альмагель"
];

const COMMENT_SUGGESTIONS = [
  "Почуваюся нормально",
  "Гарний апетит, багато сплю",
  "Є невелика втома",
  "Температура в нормі, нудоти немає",
  "Важко стояти на ногах"
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"entry" | "history">("entry");

  // Form states - initialized to empty strings by default
  const [temperature, setTemperature] = useState<number | "">("");
  const [saturation, setSaturation] = useState<number | "">("");
  const [pulse, setPulse] = useState<number | "">("");
  const [pressureSys, setPressureSys] = useState<number | "">("");
  const [pressureDia, setPressureDia] = useState<number | "">("");
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [medications, setMedications] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // Status and notification states
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [recordToDelete, setRecordToDelete] = useState<HealthRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch all health records from our backend
  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/records");
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      console.error("Error fetching records:", e);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Adjusters starting from normal physiological values if currently empty
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
      const current = typeof prev === "number" ? prev : 100;
      const next = current + amount;
      if (next < 40) return 40;
      if (next > 250) return 250;
      return next;
    });
  };

  const adjustPressureDia = (amount: number) => {
    setPressureDia((prev) => {
      const current = typeof prev === "number" ? prev : 70;
      const next = current + amount;
      if (next < 30) return 30;
      if (next > 180) return 180;
      return next;
    });
  };

  const toggleComplaint = (label: string) => {
    setSelectedComplaints((prev) => {
      if (prev.includes(label)) {
        return prev.filter((item) => item !== label);
      } else {
        return [...prev, label];
      }
    });
  };

  // Submit new record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const timestampStr = formatCurrentDate(new Date());
    const createdAtMs = Date.now();

    // Require at least one field to be supplied before saving
    const hasAnyValue =
      temperature !== "" ||
      saturation !== "" ||
      pulse !== "" ||
      pressureSys !== "" ||
      pressureDia !== "" ||
      selectedComplaints.length > 0 ||
      medications.trim() !== "" ||
      comment.trim() !== "";

    if (!hasAnyValue) {
      alert("Будь ласка, введіть хоча б один показник або скаргу перед збереженням!");
      return;
    }

    // Format blood pressure
    let finalPressure: string | null = null;
    if (pressureSys !== "" || pressureDia !== "") {
      const sysVal = pressureSys !== "" ? pressureSys : "—";
      const diaVal = pressureDia !== "" ? pressureDia : "—";
      finalPressure = `${sysVal}/${diaVal}`;
    }

    const newRecord: Partial<HealthRecord> = {
      timestamp: timestampStr,
      createdAtMs: createdAtMs,
      temperature: temperature !== "" ? Number(temperature) : null,
      saturation: saturation !== "" ? Number(saturation) : null,
      pulse: pulse !== "" ? Number(pulse) : null,
      pressure: finalPressure,
      complaints: selectedComplaints,
      medications: medications || "Немає даних",
      comment: comment || "Без коментаря"
    };

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Reset form inputs back to blank
        setTemperature("");
        setSaturation("");
        setPulse("");
        setPressureSys("");
        setPressureDia("");
        setSelectedComplaints([]);
        setMedications("");
        setComment("");

        // Refresh records list
        fetchRecords();

        // Scroll page up smoothly
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert("Помилка при збереженні запису.");
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Не вдалося з'єднатися з сервером для збереження запису.");
    }
  };

  // Delete specific record (opens modal)
  const handleDeleteRecord = (record: HealthRecord) => {
    setRecordToDelete(record);
  };

  // Confirmed delete record execution
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      const id = recordToDelete.id || recordToDelete.createdAtMs;
      const res = await fetch(`/api/records/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setRecordToDelete(null);
        fetchRecords();
      } else {
        alert("Помилка при видаленні запису з сервера.");
      }
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Не вдалося видалити запис.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Check alert thresholds on current live inputs
  const isTempCritical = typeof temperature === "number" && temperature >= 37.5;
  const isSatCritical = typeof saturation === "number" && saturation < 92;

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-16 text-slate-800 font-sans">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-sm">
            +
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">
            МедТрекер Після Хіміотерапії
          </h1>
        </div>
        <div className="text-center sm:text-right">
          <div className="text-sm font-semibold text-slate-600">
            Пацієнт: Тіщенко Павло Володимирович
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            Діагноз: Плоскоклітинний рак, стадія 3С
          </div>
        </div>
      </header>

      {/* NAVBAR */}
      <nav className="bg-white flex px-6 sm:px-8 border-b border-slate-200 gap-8 overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab("entry")}
          className={`py-4 text-base sm:text-lg font-bold transition-all border-b-4 cursor-pointer whitespace-nowrap ${
            activeTab === "entry"
              ? "border-red-500 text-red-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Введення даних
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`py-4 text-base sm:text-lg font-bold transition-all border-b-4 cursor-pointer whitespace-nowrap ${
            activeTab === "history"
              ? "border-red-500 text-red-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Історія записів
        </button>
      </nav>

      {/* MAIN CONTAINER */}
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* SUCCESS MESSAGE TOAST */}
        {saveSuccess && (
          <div className="fixed top-6 left-4 right-4 z-50 bg-emerald-500 text-white py-4 px-6 rounded-xl text-center font-bold text-lg shadow-xl flex items-center justify-center gap-2 animate-bounce max-w-md mx-auto">
            <Check className="w-6 h-6 stroke-[3]" />
            Запис успішно збережено!
          </div>
        )}

        {/* TAB 1: DATA ENTRY */}
        {activeTab === "entry" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: CRITICAL WARNINGS & FORM */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* CRITICAL WARNINGS */}
              {(isTempCritical || isSatCritical) && (
                <div className="space-y-3">
                  {isTempCritical && (
                    <div className="bg-red-50 border-l-8 border-red-500 p-4 rounded-r-lg shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-red-800 font-bold text-base">УВАГА! Ризик нейтропенії</h3>
                          <p className="text-red-700 text-sm mt-0.5">
                            Терміново контролюйте температуру. Не приймайте Німесил! Тільки Парацетамол 500 мг за погодженням з лікарем.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSatCritical && (
                    <div className="bg-rose-50 border-l-8 border-rose-500 p-4 rounded-r-lg shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-rose-800 font-bold text-base">УВАГА! Низька сатурація</h3>
                          <p className="text-rose-700 text-sm mt-0.5">
                            Посадіть пацієнта напівсидячи, забезпечте свіже повітря. Дайте кисень. Якщо рівень нижче 90% — негайно викликайте 103!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MEDICAL FORM CARD */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50">
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* 1. TEMPERATURE */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Температура (°C) <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => adjustTemp(-0.1)}
                        className="w-14 h-14 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        -0.1
                      </button>
                      <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-1 focus-within:border-red-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                            setTemperature(val);
                          }}
                          className="w-full text-center bg-transparent border-none outline-none text-3xl font-extrabold text-slate-800 focus:ring-0 focus:outline-none"
                          placeholder="—"
                        />
                        <span className="text-lg text-slate-400 font-bold">°C</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => adjustTemp(0.1)}
                        className="w-14 h-14 bg-red-50 border border-red-100 hover:bg-red-100 active:bg-red-200 text-red-600 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        +0.1
                      </button>
                    </div>
                  </div>

                  {/* 2. SATURATION */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Сатурація (O2 %) <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => adjustSaturation(-1)}
                        className="w-14 h-14 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        -1%
                      </button>
                      <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-1 focus-within:border-sky-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          value={saturation}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : parseInt(e.target.value);
                            setSaturation(val);
                          }}
                          className="w-full text-center bg-transparent border-none outline-none text-3xl font-extrabold text-slate-800 focus:ring-0 focus:outline-none"
                          placeholder="—"
                        />
                        <span className="text-lg text-slate-400 font-bold">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => adjustSaturation(1)}
                        className="w-14 h-14 bg-sky-50 border border-sky-100 hover:bg-sky-100 active:bg-sky-200 text-sky-700 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        +1%
                      </button>
                    </div>
                  </div>

                  {/* 3. PULSE */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Пульс (уд/хв) <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => adjustPulse(-5)}
                        className="w-14 h-14 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        -5
                      </button>
                      <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-1 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          value={pulse}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : parseInt(e.target.value);
                            setPulse(val);
                          }}
                          className="w-full text-center bg-transparent border-none outline-none text-3xl font-extrabold text-slate-800 focus:ring-0 focus:outline-none"
                          placeholder="—"
                        />
                        <span className="text-lg text-slate-400 font-bold">уд/хв</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => adjustPulse(5)}
                        className="w-14 h-14 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 text-xl font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* 4. BLOOD PRESSURE */}
                  <div className="space-y-3">
                    <label className="block font-bold text-slate-700">
                      Тиск (SYS / DIA) <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* SYS Block */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Систолічний (SYS)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustPressureSys(-1)}
                            className="w-12 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-base font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none shrink-0"
                          >
                            -1
                          </button>
                          <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-red-500 focus-within:bg-white transition-all">
                            <input
                              type="number"
                              value={pressureSys}
                              onFocus={() => {
                                if (pressureSys === "") setPressureSys(100);
                              }}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                setPressureSys(val);
                              }}
                              placeholder="100"
                              className="w-full text-center bg-transparent border-none outline-none text-xl font-extrabold text-slate-800 focus:ring-0 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400 font-bold shrink-0">мм</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustPressureSys(1)}
                            className="w-12 h-12 bg-red-50 border border-red-100 hover:bg-red-100 active:bg-red-200 text-red-600 text-base font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none shrink-0"
                          >
                            +1
                          </button>
                        </div>
                      </div>

                      {/* DIA Block */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Діастолічний (DIA)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustPressureDia(-1)}
                            className="w-12 h-12 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-base font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none shrink-0"
                          >
                            -1
                          </button>
                          <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-sky-500 focus-within:bg-white transition-all">
                            <input
                              type="number"
                              value={pressureDia}
                              onFocus={() => {
                                if (pressureDia === "") setPressureDia(70);
                              }}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                setPressureDia(val);
                              }}
                              placeholder="70"
                              className="w-full text-center bg-transparent border-none outline-none text-xl font-extrabold text-slate-800 focus:ring-0 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400 font-bold shrink-0">мм</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustPressureDia(1)}
                            className="w-12 h-12 bg-sky-50 border border-sky-100 hover:bg-sky-100 active:bg-sky-200 text-sky-700 text-base font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none shrink-0"
                          >
                            +1
                          </button>
                        </div>
                      </div>

                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {["110/70", "120/80", "130/85"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const [sys, dia] = preset.split("/").map(Number);
                            setPressureSys(sys);
                            setPressureDia(dia);
                          }}
                          className="py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-lg text-slate-600 cursor-pointer transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. COMPLAINTS CHECKLIST */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Скарги пацієнта <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {COMPLAINT_OPTIONS.map((opt) => {
                        const isChecked = selectedComplaints.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleComplaint(opt.id)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border-2 text-sm font-bold transition-all cursor-pointer select-none ${
                              isChecked
                                ? "border-red-500 bg-red-50 text-red-900"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span>{opt.emoji}</span> {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 6. MEDICATIONS */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Прийняті препарати <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <input
                      type="text"
                      value={medications}
                      onChange={(e) => setMedications(e.target.value)}
                      placeholder="Прийняті препарати, дозування..."
                      className="w-full text-base bg-slate-50 border-2 border-slate-200 rounded-lg p-3 focus:border-red-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {MEDICATION_SUGGESTIONS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setMedications((prev) => (prev ? `${prev}, ${preset}` : preset));
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold rounded-lg text-slate-500 cursor-pointer transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 7. COMMENT */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      Коментар щодо самопочуття <span className="text-xs text-slate-400 font-normal">(необов'язково)</span>
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Загальний стан, апетит, сон тощо..."
                      className="w-full text-base bg-slate-50 border-2 border-slate-200 rounded-lg p-3 focus:border-red-500 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {COMMENT_SUGGESTIONS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setComment(preset)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold rounded-lg text-slate-500 cursor-pointer transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white py-4 rounded-xl text-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                  >
                    ЗБЕРЕГТИ ЗАПИС
                  </button>

                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: RECENT SUMMARY */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 p-5">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  Останній запис:
                </h3>
                {records.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="border-l-4 border-red-500 pl-3">
                      <p className="text-xs font-bold text-slate-400">{records[0].timestamp}</p>
                      <div className="flex gap-4 mt-1">
                        <span className="text-xs font-semibold text-slate-700">
                          🌡️ {records[0].temperature !== undefined && records[0].temperature !== null ? `${records[0].temperature}°C` : "—"}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          💨 O2 {records[0].saturation !== undefined && records[0].saturation !== null ? `${records[0].saturation}%` : "—"}
                        </span>
                      </div>
                      <p className="text-xs italic text-slate-500 mt-1 line-clamp-2">
                        "{records[0].comment}"
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("history")}
                      className="w-full text-center text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition-colors cursor-pointer mt-2"
                    >
                      Переглянути всю історію
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-400 italic">Немає збережених записів</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-4">
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">
                Всього записів: <span className="text-slate-800 font-black">{records.length}</span>
              </span>
            </div>

            {records.length === 0 ? (
              <div className="bg-white p-8 rounded-xl text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold text-lg">Записів поки немає.</p>
                <p className="text-slate-400 text-xs mt-1">
                  Додайте перший запис у вкладці «Введення даних»!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {records.map((rec, idx) => {
                  const hasHighTemp = typeof rec.temperature === "number" && rec.temperature >= 37.5;
                  const hasLowOxygen = typeof rec.saturation === "number" && rec.saturation < 92;

                  return (
                    <div
                      key={rec.id || idx}
                      className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200/50 relative hover:shadow-md transition-all border-l-4 ${
                        hasHighTemp
                          ? "border-l-red-500"
                          : hasLowOxygen
                          ? "border-l-rose-500"
                          : "border-l-slate-300"
                      }`}
                    >
                      {/* DateTime Header & Delete Button */}
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                        <span className="text-sm font-bold text-slate-700">{rec.timestamp}</span>
                        <button
                          onClick={() => handleDeleteRecord(rec)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                          title="Видалити запис"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Vitals Grid */}
                      <div className="grid grid-cols-2 gap-2.5 mb-4">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 flex items-center gap-2.5">
                          <Thermometer className={`w-6 h-6 ${hasHighTemp ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"}`} />
                          <div>
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Темп.</p>
                            <p className={`text-sm font-black ${hasHighTemp ? "text-red-600 font-extrabold" : "text-slate-800"}`}>
                              {rec.temperature !== undefined && rec.temperature !== null ? `${rec.temperature} °C` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 flex items-center gap-2.5">
                          <Wind className={`w-6 h-6 ${hasLowOxygen ? "text-rose-500 shrink-0" : "text-slate-400 shrink-0"}`} />
                          <div>
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Кисень</p>
                            <p className={`text-sm font-black ${hasLowOxygen ? "text-rose-600 font-extrabold" : "text-slate-800"}`}>
                              {rec.saturation !== undefined && rec.saturation !== null ? `${rec.saturation} %` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 flex items-center gap-2.5">
                          <Activity className="w-6 h-6 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Пульс</p>
                            <p className="text-sm font-black text-slate-800">
                              {rec.pulse !== undefined && rec.pulse !== null ? `${rec.pulse} уд/хв` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 flex items-center gap-2.5">
                          <span className="text-lg shrink-0">🩺</span>
                          <div>
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Тиск</p>
                            <p className="text-sm font-black text-slate-800">
                              {rec.pressure ? rec.pressure : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Warnings */}
                      {hasHighTemp && (
                        <div className="bg-red-50 border border-red-100 text-red-950 p-2.5 rounded-lg text-[11px] font-bold mb-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>Ризик нейтропенії! Не давати Німесил! Тільки Парацетамол.</span>
                        </div>
                      )}

                      {hasLowOxygen && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-950 p-2.5 rounded-lg text-[11px] font-bold mb-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>Сатурація низька! Дайте кисень. При &lt; 90 викликайте 103!</span>
                        </div>
                      )}

                      {/* Medications */}
                      <div className="mb-2">
                        <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Прийняті препарати:</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{rec.medications || "Немає"}</p>
                      </div>

                      {/* Complaints */}
                      <div className="mb-2">
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
                                  className="bg-red-50 text-red-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-100 inline-flex items-center gap-1"
                                >
                                  <span>{match.emoji}</span> {match.label}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Скарг немає</div>
                        )}
                      </div>

                      {/* Comment */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-50">
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

      </div>

      {/* CUSTOM CONFIRMATION MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all duration-300">
            {/* Modal Header */}
            <div className="bg-rose-50 px-6 py-5 border-b border-rose-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-rose-950 text-lg leading-tight">
                  Підтвердження видалення
                </h3>
                <p className="text-xs font-semibold text-rose-700/80 mt-0.5">
                  Цю дію неможливо скасувати
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm font-semibold">
                Ви дійсно бажаєте остаточно видалити медичний запис пацієнта від:
              </p>
              
              {/* Record Summary Card */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Дата і час: <span className="text-slate-700 font-bold">{recordToDelete.timestamp}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {recordToDelete.temperature && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 font-semibold text-slate-700">
                      🌡️ Темп: <span className="font-extrabold">{recordToDelete.temperature}°C</span>
                    </div>
                  )}
                  {recordToDelete.saturation && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 font-semibold text-slate-700">
                      💨 O2: <span className="font-extrabold">{recordToDelete.saturation}%</span>
                    </div>
                  )}
                  {recordToDelete.pulse && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 font-semibold text-slate-700">
                      💓 Пульс: <span className="font-extrabold">{recordToDelete.pulse} уд/хв</span>
                    </div>
                  )}
                  {recordToDelete.pressure && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 font-semibold text-slate-700">
                      🩺 Тиск: <span className="font-extrabold">{recordToDelete.pressure}</span>
                    </div>
                  )}
                </div>

                {recordToDelete.complaints && recordToDelete.complaints.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Скарги:</span>
                    <div className="flex flex-wrap gap-1">
                      {recordToDelete.complaints.map((cId) => {
                        const match = COMPLAINT_OPTIONS.find((o) => o.id === cId) || {
                          label: cId,
                          emoji: "⚠️"
                        };
                        return (
                          <span key={cId} className="bg-red-50 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100/60">
                            {match.emoji} {match.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recordToDelete.comment && recordToDelete.comment !== "Без коментаря" && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Коментар:</span>
                    <p className="text-xs text-slate-600 font-medium italic">
                      "{recordToDelete.comment}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Видалення...
                  </>
                ) : (
                  "Так, видалити"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

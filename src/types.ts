/**
 * Medical Tracker Types
 */

export type IndicatorStatus = 'normal' | 'warning' | 'critical';

export interface ComplaintOption {
  id: string;
  label: string;
  emoji: string;
}

export interface MedicalRecord {
  id: string;
  userId?: string;
  timestamp: string;      // Formatted date DD.MM.YYYY HH:MM
  createdAtMs: number;     // Milliseconds timestamp for sorting
  temperature?: number | null;
  saturation?: number | null;
  pulse?: number | null;
  pressureSys?: number | null; // Systolic (верхнее)
  pressureDia?: number | null; // Diastolic (нижнее)
  bloodSugar?: number | null;  // Blood sugar level (mmol/L)
  weight?: number | null;      // Body weight (kg)
  complaints: string[];        // IDs of complaints
  medications: string;         // Taken medications
  comment: string;             // Additional comments/notes
  status: IndicatorStatus;     // Calculated overall safety status
}

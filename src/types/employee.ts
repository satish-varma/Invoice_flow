import { SiteId } from './site';

export type NewRelicLocation = 'hyderabad' | 'bangalore';

export interface EmployeeShiftTiming {
  expectedStart?: string; // e.g. "06:00"
  cutoff?: string;        // e.g. "06:30" (check-in deadline)
  expectedEnd?: string;   // e.g. "18:00"
  minWorkHours?: number;  // e.g. 4 (minimum hours required before checkout is allowed)
}

export interface NewRelicEmployee {
  id?: string;
  siteId?: SiteId;          // defaults to 'newrelic'
  employeeId: string;       // e.g. NR-HYD-001 or DSM-HYD-001
  userId?: string;          // Firestore doc ID from the 'users' collection (links login account)
  name: string;
  email?: string;
  phone?: string;
  designation: string;
  location: 'hyderabad' | 'bangalore';
  monthlySalary: number;    // gross monthly salary in INR
  joinDate: string;         // ISO date string
  isActive: boolean;
  profilePhotoUrl?: string;
  shiftTiming?: EmployeeShiftTiming;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string | null;
}

/**
 * Universal active check for employee records.
 * Accurately excludes employees flagged as inactive across boolean, string, or status fields.
 */
export function isEmployeeActive(emp: any): boolean {
  if (!emp) return false;
  if (emp.isActive === false || emp.isActive === 'false' || emp.isActive === 0) return false;
  if (emp.status === 'inactive' || emp.status === 'disabled' || emp.status === 'resigned' || emp.status === 'terminated') return false;
  if (emp.isDeleted === true || emp.deleted === true) return false;
  return emp.isActive === true || emp.isActive === 'true' || emp.isActive !== false;
}

export interface NewRelicAttendance {
  id?: string;
  siteId?: SiteId;          // defaults to 'newrelic'
  employeeId: string;       // references NewRelicEmployee.id
  employeeDocId: string;    // Firestore doc ID of the employee
  employeeName: string;
  location: 'hyderabad' | 'bangalore';
  date: string;             // YYYY-MM-DD
  checkIn?: {
    time: string;           // ISO timestamp
    selfieUrl: string;      // Firebase Storage URL
    coordinates?: {
      lat: number;
      lng: number;
      accuracy?: number;
    };
  };
  checkOut?: {
    time: string;
    selfieUrl: string;
    coordinates?: {
      lat: number;
      lng: number;
      accuracy?: number;
    };
  };
  durationMinutes?: number; // calculated on checkOut
  status: 'present' | 'half-day' | 'absent' | 'missed-checkout';
  isLate?: boolean;
  lateMinutes?: number;
  isMissedCheckOut?: boolean;
  overtimeMinutes?: number;
  shiftExpectedStart?: string; // e.g. "06:00"
  isOfflineSynced?: boolean;
  syncedAt?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface NewRelicSalaryAdvance {
  id?: string;
  employeeDocId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM the advance applies to
  reason?: string;
  paymentMode: 'cash' | 'upi' | 'bank_transfer';
  status: 'pending' | 'deducted';
  createdAt?: any;
  createdBy?: string | null;
}

export interface NewRelicSalaryPayment {
  id?: string;
  employeeDocId: string;
  employeeId: string;
  employeeName: string;
  month: string; // YYYY-MM
  grossSalary: number;
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  paidDays: number; // present + 0.5 * halfDays
  attendanceEarned: number; // (paidDays / totalDays) * grossSalary
  advancesDeducted: number;
  netPaidAmount: number; // attendanceEarned - advancesDeducted
  paymentDate: string; // ISO or YYYY-MM-DD
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  referenceNote?: string;
  status: 'paid';
  createdAt?: any;
  createdBy?: string | null;
}

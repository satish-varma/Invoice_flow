import { SiteId } from './site';

export type LeaveType = 'casual' | 'sick' | 'paid' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface CompanyHoliday {
  id?: string;
  name: string; // e.g. "Republic Day", "Independence Day", "Diwali"
  date: string; // YYYY-MM-DD
  siteId: 'all' | SiteId;
  location: 'all' | 'hyderabad' | 'bangalore';
  isPaid: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface EmployeeLeave {
  id?: string;
  employeeDocId: string;
  employeeId: string;
  employeeName: string;
  siteId: SiteId;
  location: 'hyderabad' | 'bangalore';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  leaveType: LeaveType;
  status: LeaveStatus;
  reason?: string;
  approvedBy?: string;
  createdAt?: string;
}

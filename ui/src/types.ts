export type Role = 'admin' | 'manager' | 'viewer'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  active: boolean
  last_login_at?: string | null
  created_at?: string
}

export interface Employee {
  id: number
  user_id?: number | null
  full_name: string
  email?: string | null
  phone?: string | null
  bi_nif?: string | null
  biometric_id?: string | null
  photo_path?: string | null
  signature_path?: string | null
  position?: string | null
  department?: string | null
  bank_name?: string | null
  account_number?: string | null
  iban?: string | null
  base_salary: number | string
  food_allowance: number | string
  transport_allowance: number | string
  social_security_rate: number | string
  active: boolean
}

export interface SalarySlip {
  id: number
  employee_id: number
  employee?: Employee
  month: number
  year: number
  base_salary: string
  food_allowance: string
  transport_allowance: string
  overtime: string
  other_income: string
  irt_tax: string
  social_security: string
  other_deductions: string
  absence_days: number
  overtime_hours: string
  gross_salary: string
  total_deductions: string
  net_salary: string
  status: 'draft' | 'issued' | 'paid'
  issued_at?: string | null
  documents?: DocumentRef[]
}

export interface DocumentRef {
  id: number
  type: 'docx' | 'pdf' | 'xlsx'
  filename: string
  path: string
  generated_at: string
}

export interface Company {
  id: number
  name: string
  nif?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  bank_name?: string | null
  account_number?: string | null
  iban?: string | null
  default_debit_account?: string | null
  currency: string
  logo_path?: string | null
  active: boolean
}

export interface Bank {
  id: number
  name: string
  code?: string | null
  bic?: string | null
  active: boolean
}

export interface Department {
  id: number
  name: string
  code?: string | null
  description?: string | null
  active: boolean
}

export interface PaymentOrderItem {
  id?: number
  employee_id?: number | null
  beneficiary: string
  iban?: string | null
  bank?: string | null
  amount: number | string
}

export interface PaymentOrder {
  id: number
  reference_number: string
  month: number
  year: number
  bank_id?: number | null
  bank?: Bank | null
  debit_account?: string | null
  total_amount: string
  status: 'draft' | 'approved' | 'sent'
  approved_by?: number | null
  approver?: { id: number; name: string } | null
  approved_at?: string | null
  sent_at?: string | null
  notes?: string | null
  items?: PaymentOrderItem[]
  items_count?: number
  documents?: DocumentRef[]
}

export interface IrtBracket {
  limit: number
  rate: number
}

export interface Settings {
  irt_brackets: IrtBracket[]
  irt_exempt_allowances: boolean
  inss_employee_rate: number
  inss_company_rate: number
  attendance_entry_limit: string
  payroll_use_attendance: boolean
  standard_working_days: number
  standard_daily_hours: number
  overtime_multiplier: number
  shift_rest_after_night_hours: number
  shift_max_consecutive_days: number
  shift_weekly_hours_limit: number
  vacation_days_per_year: number
  vacation_carry_over_max: number
  vacation_holidays: string[]
}

export type AttendanceStatus =
  | 'present' | 'late' | 'absent' | 'justified' | 'vacation' | 'sick' | 'holiday'

export interface Attendance {
  id: number
  employee_id: number
  date: string
  status: AttendanceStatus
  check_in?: string | null
  check_out?: string | null
  worked_hours?: string | null
  notes?: string | null
}

export interface AttendanceMonth {
  year: number
  month: number
  days_in_month: number
  employees: { id: number; full_name: string; department?: string | null }[]
  attendances: Attendance[]
}

export interface AttendanceSummaryRow {
  employee_id: number
  full_name: string
  department?: string | null
  present: number
  late: number
  absent: number
  justified: number
  vacation: number
  sick: number
  holiday: number
  worked_hours: number
  rate: number | null
}

export type VacationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface VacationRequest {
  id: number
  employee_id: number
  employee?: { id: number; full_name: string; department?: string | null }
  start_date: string
  end_date: string
  working_days: number
  reason?: string | null
  status: VacationStatus
  approved_by?: number | null
  approver?: { id: number; name: string } | null
  approved_at?: string | null
  rejection_reason?: string | null
  created_at?: string
}

export interface VacationBalanceRow {
  employee_id: number
  full_name: string
  department?: string | null
  year: number
  entitled_days: number
  carried_over: number
  extra_days: number
  total_days: number
  used_days: number
  remaining: number
}

export type ShiftType = 'regular' | 'oncall' | 'rest' | 'holiday'

export interface Shift {
  id: number
  name: string
  code: string
  type: ShiftType
  start_time?: string | null
  end_time?: string | null
  duration_hours: number
  crosses_midnight: boolean
  color: string
  counts_as_worked: boolean
  active: boolean
  sort_order: number
}

export interface ShiftScheduleEntry {
  id: number
  employee_id: number
  shift_id: number
  date: string
  notes?: string | null
  shift?: Shift
}

export interface ShiftMonth {
  year: number
  month: number
  days_in_month: number
  employees: { id: number; full_name: string; department?: string | null }[]
  schedules: ShiftScheduleEntry[]
  shifts: Shift[]
  departments: string[]
}

export interface ShiftSummaryRow {
  employee_id: number
  full_name: string
  department?: string | null
  total_shifts: number
  total_hours: number
  night_shifts: number
  oncall_shifts: number
  rest_days: number
  holiday_days: number
}

export interface ShiftViolation {
  employee_id: number
  date: string
  rule: string
  message: string
}

export interface BiometricDevice {
  id: number
  name: string
  brand?: string | null
  model?: string | null
  ip_address?: string | null
  port: number
  location?: string | null
  active: boolean
  last_sync_at?: string | null
}

export interface BiometricImportResult {
  punches: number
  matched: number
  attendances: number
  days: number
  unmatched: string[]
}

export interface Paginated<T> {
  data: T[]
  total: number
  current_page: number
  last_page: number
  per_page: number
}

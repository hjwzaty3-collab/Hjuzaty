export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PROMOTER';

export interface Specialty {
  id: string;
  name: string;
  icon?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  wallet_balance: number;
  specialty_id?: string;
  specialization?: string;
  bio?: string;
  price: number;
  status: 'active' | 'inactive';
  governorate?: string;
  created_at: string;
  updated_at: string;
  added_by_promoter_id?: string; // Kept for compatibility with previous logic if needed, though not in provided SQL
}

export interface Clinic {
  id: string;
  doctor_id: string;
  name: string;
  address?: string;
  phone?: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id?: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  price: number;
  notes?: string;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis?: string;
  prescription?: string;
  notes?: string;
  next_visit?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  description?: string;
  created_at: string;
}

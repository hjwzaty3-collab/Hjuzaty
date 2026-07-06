-- ============================================================
--  Hjuzati – Supabase RLS Fix (v3 – Full Admin Access)
--  Run ALL of this in the Supabase SQL Editor
-- ============================================================

-- ── STEP 1: Drop ALL existing SELECT policies on users ─────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- ── STEP 2: Users table – role-based policies ──────────────────────────────

-- Admins can read ALL users
CREATE POLICY "admins_read_all_users"
  ON public.users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = auth.uid() AND me.role = 'ADMIN'
    )
  );

-- Admins can update ALL users
CREATE POLICY "admins_update_all_users"
  ON public.users FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = auth.uid() AND me.role = 'ADMIN'
    )
  );

-- Admins can delete users
CREATE POLICY "admins_delete_users"
  ON public.users FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = auth.uid() AND me.role = 'ADMIN'
    )
  );

-- Admins can insert users
CREATE POLICY "admins_insert_users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = auth.uid() AND me.role = 'ADMIN'
    )
  );

-- Patients and Doctors can read their own profile
CREATE POLICY "users_read_own_profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Anyone authenticated can read DOCTOR profiles (for booking/listing)
CREATE POLICY "anyone_read_doctors"
  ON public.users FOR SELECT TO authenticated
  USING (role = 'DOCTOR');

-- ── STEP 3: Bookings table – admin full access ─────────────────────────────
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', pol.policyname);
  END LOOP;
END $$;

-- Admins: full access
CREATE POLICY "admins_full_bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Patients: read/insert own bookings
CREATE POLICY "patients_own_bookings_select"
  ON public.bookings FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "patients_insert_bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Doctors: read bookings where they are the doctor
CREATE POLICY "doctors_read_their_bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (doctor_id = auth.uid());

-- Patients can check booked slots (read doctor_id + date + time)
CREATE POLICY "patients_check_slots"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    doctor_id IN (SELECT id FROM public.users WHERE role = 'DOCTOR')
  );

-- ── STEP 4: Clinics – admin full access, everyone can read ─────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clinics'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinics', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "admins_full_clinics"
  ON public.clinics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "anyone_read_clinics"
  ON public.clinics FOR SELECT TO authenticated
  USING (true);

-- ── STEP 5: Doctor schedules – admin full access, everyone can read ─────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doctor_schedules'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.doctor_schedules', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "admins_full_schedules"
  ON public.doctor_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "anyone_read_schedules"
  ON public.doctor_schedules FOR SELECT TO authenticated
  USING (true);

-- ── STEP 6: SECURITY DEFINER function – fetch any user by ID (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_id uuid)
RETURNS SETOF public.users
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.users WHERE id = p_id LIMIT 1; $$;

-- Grant to BOTH anon and authenticated:
-- Patients log in via custom RPC (not Supabase Auth), so auth.uid() = null
-- and they hold the 'anon' Supabase role, not 'authenticated'.
GRANT EXECUTE ON FUNCTION public.get_user_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(uuid) TO authenticated;

-- SECURITY DEFINER function – admin: fetch all users (bypasses RLS)
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS SETOF public.users
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.users ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
-- (admin only – intentionally NOT granted to anon)

-- SECURITY DEFINER function – admin: fetch all bookings with joins
CREATE OR REPLACE FUNCTION public.admin_get_all_bookings()
RETURNS TABLE (
  id uuid, status text, booking_date date, start_time time,
  price numeric, platform_fee numeric, created_at timestamptz,
  patient_id uuid, doctor_id uuid,
  patient_name text, doctor_name text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT b.id, b.status::text, b.booking_date, b.start_time, b.price, COALESCE(b.platform_fee, 0) AS platform_fee, b.created_at,
         b.patient_id, b.doctor_id,
         p.name AS patient_name, d.name AS doctor_name
  FROM public.bookings b
  LEFT JOIN public.users p ON p.id = b.patient_id
  LEFT JOIN public.users d ON d.id = b.doctor_id
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_bookings() TO authenticated;
-- (admin only – intentionally NOT granted to anon)

-- ── STEP 7: Booking conflict-check for anon patients ───────────────────────
-- Patients need to see booked slots to avoid double-booking.
-- Allow anon to read just the columns needed for conflict checking.
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_doctor_id uuid, p_date date)
RETURNS TABLE (start_time time)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT start_time FROM public.bookings
  WHERE doctor_id = p_doctor_id
    AND booking_date = p_date
    AND status <> 'cancelled';
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date) TO authenticated;

-- Allow anon to INSERT bookings (patient books without Supabase Auth session)
DROP POLICY IF EXISTS "anon_insert_bookings" ON public.bookings;
CREATE POLICY "anon_insert_bookings"
  ON public.bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read doctor profiles directly (fallback if RPC fails)
DROP POLICY IF EXISTS "anon_read_doctors" ON public.users;
CREATE POLICY "anon_read_doctors"
  ON public.users FOR SELECT
  TO anon
  USING (role = 'DOCTOR');

-- Allow anon to read clinics and schedules
DROP POLICY IF EXISTS "anon_read_clinics" ON public.clinics;
CREATE POLICY "anon_read_clinics"
  ON public.clinics FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_schedules" ON public.doctor_schedules;
CREATE POLICY "anon_read_schedules"
  ON public.doctor_schedules FOR SELECT TO anon USING (true);

-- ── STEP 8: Clinic management for doctors (anon role) ──────────────────────
-- Doctors use custom login (no Supabase Auth), so auth.uid() = null.
-- We need SECURITY DEFINER functions for their clinic CRUD.

-- Get clinics for a doctor
CREATE OR REPLACE FUNCTION public.get_doctor_clinics(p_doctor_id uuid)
RETURNS SETOF public.clinics
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.clinics WHERE doctor_id = p_doctor_id ORDER BY created_at; $$;

GRANT EXECUTE ON FUNCTION public.get_doctor_clinics(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_clinics(uuid) TO authenticated;

-- Add google_maps_link column if not exists
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_maps_link text;

-- Add a clinic
CREATE OR REPLACE FUNCTION public.add_clinic(
  p_doctor_id uuid, p_name text, p_address text DEFAULT '', p_phone text DEFAULT '', p_google_maps_link text DEFAULT NULL
)
RETURNS SETOF public.clinics
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_clinic public.clinics;
BEGIN
  INSERT INTO public.clinics (doctor_id, name, address, phone, google_maps_link)
  VALUES (p_doctor_id, p_name, p_address, p_phone, p_google_maps_link)
  RETURNING * INTO v_clinic;
  RETURN NEXT v_clinic;
END; $$;

GRANT EXECUTE ON FUNCTION public.add_clinic(uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_clinic(uuid, text, text, text, text) TO authenticated;

-- Delete a clinic
CREATE OR REPLACE FUNCTION public.delete_clinic(p_clinic_id uuid, p_doctor_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.clinics WHERE id = p_clinic_id AND doctor_id = p_doctor_id;
$$;

GRANT EXECUTE ON FUNCTION public.delete_clinic(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_clinic(uuid, uuid) TO authenticated;

-- ── STEP 9: Schedule management for doctors (anon role) ────────────────────

-- Get schedule for a doctor
CREATE OR REPLACE FUNCTION public.get_doctor_schedule(p_doctor_id uuid)
RETURNS SETOF public.doctor_schedules
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.doctor_schedules WHERE doctor_id = p_doctor_id ORDER BY id; $$;

GRANT EXECUTE ON FUNCTION public.get_doctor_schedule(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_schedule(uuid) TO authenticated;

-- Upsert a schedule row (insert or update)
CREATE OR REPLACE FUNCTION public.upsert_schedule(
  p_doctor_id uuid, p_day text, p_is_open boolean,
  p_start_time text DEFAULT '09:00', p_end_time text DEFAULT '17:00'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.doctor_schedules (doctor_id, day_of_week, is_open, start_time, end_time)
  VALUES (p_doctor_id, p_day, p_is_open, p_start_time::time, p_end_time::time)
  ON CONFLICT (doctor_id, day_of_week)
  DO UPDATE SET is_open = EXCLUDED.is_open,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time;
END; $$;

GRANT EXECUTE ON FUNCTION public.upsert_schedule(uuid, text, boolean, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_schedule(uuid, text, boolean, text, text) TO authenticated;

-- ── STEP 10: Clean up old broken RPC ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_profile(uuid);

-- ── STEP 11: Redeem Codes & Platform Fee system ─────────────────────────────

-- Platform settings (single-row config table)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id       int PRIMARY KEY DEFAULT 1,
  platform_fee numeric NOT NULL DEFAULT 0,
  CHECK (id = 1)   -- enforce single row
);
INSERT INTO public.platform_settings (id, platform_fee)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Redeem codes table
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  amount     numeric NOT NULL,
  is_used    boolean NOT NULL DEFAULT false,
  used_by    uuid REFERENCES public.users(id),
  used_at    timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Transactions table (if not exists)
CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id),
  amount      numeric NOT NULL,
  type        text,
  description text,
  status      text DEFAULT 'Completed',
  created_at  timestamptz DEFAULT now()
);

-- RLS for redeem_codes (admin full, anon can redeem)
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_redeem_codes" ON public.redeem_codes;
CREATE POLICY "admin_full_redeem_codes"
  ON public.redeem_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'));

-- RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_transactions" ON public.transactions;
CREATE POLICY "admin_full_transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'));
DROP POLICY IF EXISTS "users_own_transactions" ON public.transactions;
CREATE POLICY "users_own_transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Function: get current platform fee (public) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_platform_fee()
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT platform_fee FROM public.platform_settings WHERE id = 1; $$;

GRANT EXECUTE ON FUNCTION public.get_platform_fee() TO anon;
GRANT EXECUTE ON FUNCTION public.get_platform_fee() TO authenticated;

-- ── Function: set platform fee (admin only by convention) ───────────────────
CREATE OR REPLACE FUNCTION public.set_platform_fee(p_fee numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.platform_settings SET platform_fee = p_fee WHERE id = 1; $$;

GRANT EXECUTE ON FUNCTION public.set_platform_fee(numeric) TO authenticated;

-- ── Function: create batch of redeem codes ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_redeem_codes(
  p_amount    numeric,
  p_quantity  int,
  p_created_by uuid
)
RETURNS SETOF public.redeem_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  i int;
  v_code text;
  v_row public.redeem_codes;
BEGIN
  FOR i IN 1..p_quantity LOOP
    -- Generate unique 12-char alphanumeric code
    LOOP
      v_code := upper(substring(md5(random()::text || clock_timestamp()::text) for 12));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.redeem_codes WHERE code = v_code);
    END LOOP;

    INSERT INTO public.redeem_codes (code, amount, created_by)
    VALUES (v_code, p_amount, p_created_by)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_redeem_codes(numeric, int, uuid) TO authenticated;

-- ── Function: get all redeem codes (admin) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_redeem_codes()
RETURNS SETOF public.redeem_codes
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.redeem_codes ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION public.get_redeem_codes() TO authenticated;

-- ── Function: redeem a code (patient) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text, p_patient_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code public.redeem_codes;
  v_balance numeric;
BEGIN
  -- Lock and fetch the code
  SELECT * INTO v_code FROM public.redeem_codes
  WHERE upper(trim(code)) = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'CODE_NOT_FOUND');
  END IF;
  IF v_code.is_used THEN
    RETURN json_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  -- Mark as used
  UPDATE public.redeem_codes
  SET is_used = true, used_by = p_patient_id, used_at = now()
  WHERE id = v_code.id;

  -- Add to patient wallet
  UPDATE public.users
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_code.amount
  WHERE id = p_patient_id
  RETURNING wallet_balance INTO v_balance;

  -- Record transaction
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_patient_id, v_code.amount, 'deposit', 'شحن رصيد - كود استرداد', 'Completed');

  RETURN json_build_object(
    'success', true,
    'amount', v_code.amount,
    'new_balance', v_balance
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.redeem_code(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text, uuid) TO authenticated;

-- ── Function: process booking payment (split doctor + platform fee) ──────────
CREATE OR REPLACE FUNCTION public.process_booking_payment(
  p_patient_id  uuid,
  p_doctor_id   uuid,
  p_amount      numeric,    -- doctor's fee
  p_platform_fee numeric,   -- platform fee (goes to admin)
  p_booking_date date,
  p_start_time  text,
  p_clinic_id   uuid DEFAULT NULL,
  p_notes       text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total      numeric;
  v_balance    numeric;
  v_booking_id uuid;
  v_admin_id   uuid;
BEGIN
  v_total := p_amount + p_platform_fee;

  -- Check patient balance
  SELECT COALESCE(wallet_balance, 0) INTO v_balance
  FROM public.users WHERE id = p_patient_id;

  IF v_balance < v_total THEN
    RETURN json_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE',
      'balance', v_balance, 'required', v_total);
  END IF;

  -- Deduct from patient
  UPDATE public.users
  SET wallet_balance = wallet_balance - v_total
  WHERE id = p_patient_id;

  -- Credit doctor immediately (without platform fee)
  UPDATE public.users
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_doctor_id;

  -- Create booking
  INSERT INTO public.bookings (
    patient_id, doctor_id, booking_date, start_time, end_time,
    price, platform_fee, status, notes, clinic_id
  )
  VALUES (
    p_patient_id, p_doctor_id, p_booking_date, p_start_time::time, p_start_time::time,
    p_amount, p_platform_fee, 'confirmed', p_notes,
    p_clinic_id
  )
  RETURNING id INTO v_booking_id;

  -- Patient debit transaction
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_patient_id, -v_total, 'payment',
    'حجز موعد - رسوم الكشفية ' || p_amount || ' + رسوم الخدمة ' || p_platform_fee, 'Completed');

  -- Doctor credit transaction
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_doctor_id, p_amount, 'income', 'إيراد كشفية - حجز #' || v_booking_id, 'Completed');

  -- Credit admin immediately (with platform fee)
  SELECT id INTO v_admin_id FROM public.users WHERE role = 'ADMIN' LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    UPDATE public.users
    SET wallet_balance = COALESCE(wallet_balance, 0) + p_platform_fee
    WHERE id = v_admin_id;

    -- Admin transaction
    INSERT INTO public.transactions (user_id, amount, type, description, status)
    VALUES (v_admin_id, p_platform_fee, 'income', 'رسوم خدمة المنصة - حجز #' || v_booking_id, 'Completed');
  END IF;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'total_paid', v_total,
    'doctor_fee', p_amount,
    'platform_fee', p_platform_fee
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.process_booking_payment(uuid, uuid, numeric, numeric, date, text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.process_booking_payment(uuid, uuid, numeric, numeric, date, text, uuid, text) TO authenticated;

-- Get patient transactions (for anon patients)
CREATE OR REPLACE FUNCTION public.get_my_transactions(p_user_id uuid)
RETURNS SETOF public.transactions
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT * FROM public.transactions WHERE user_id = p_user_id ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION public.get_my_transactions(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_transactions(uuid) TO authenticated;

-- Get patient wallet balance (for anon patients)
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT COALESCE(wallet_balance, 0) FROM public.users WHERE id = p_user_id; $$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;

-- ── STEP 12: Doctor profile update (anon-safe) ─────────────────────────────
-- Doctors use custom login → anon role → .update().select().single() fails RLS
CREATE OR REPLACE FUNCTION public.update_doctor_profile(
  p_doctor_id      uuid,
  p_name           text,
  p_email          text DEFAULT NULL,
  p_phone          text DEFAULT NULL,
  p_specialization text DEFAULT NULL,
  p_price          numeric DEFAULT NULL,
  p_bio            text DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    name           = COALESCE(p_name, name),
    email          = COALESCE(p_email, email),
    phone          = COALESCE(p_phone, phone),
    specialization = COALESCE(p_specialization, specialization),
    price          = COALESCE(p_price, price),
    bio            = COALESCE(p_bio, bio),
    updated_at     = now()
  WHERE id = p_doctor_id;

  RETURN QUERY SELECT * FROM public.users WHERE id = p_doctor_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.update_doctor_profile(uuid, text, text, text, text, numeric, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_doctor_profile(uuid, text, text, text, text, numeric, text) TO authenticated;

-- ── STEP 13: Booking visibility RPCs (anon-safe) ────────────────────────────

-- Patient: get their own bookings with doctor and clinic info
CREATE OR REPLACE FUNCTION public.get_patient_bookings(p_patient_id uuid)
RETURNS TABLE (
  id                      uuid,
  status                  text,
  booking_date            date,
  start_time              time,
  price                   numeric,
  notes                   text,
  created_at              timestamptz,
  doctor_id               uuid,
  doctor_name             text,
  doctor_spec             text,
  doctor_bio              text,
  clinic_id               uuid,
  clinic_name             text,
  clinic_address          text,
  clinic_phone            text,
  clinic_google_maps_link text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    b.id, b.status, b.booking_date, b.start_time, b.price, b.notes, b.created_at,
    b.doctor_id,
    u.name                   AS doctor_name,
    u.specialization         AS doctor_spec,
    u.bio                    AS doctor_bio,
    b.clinic_id,
    c.name                   AS clinic_name,
    c.address                AS clinic_address,
    c.phone                  AS clinic_phone,
    c.google_maps_link       AS clinic_google_maps_link
  FROM public.bookings b
  LEFT JOIN public.users u ON u.id = b.doctor_id
  LEFT JOIN public.clinics c ON c.id = b.clinic_id
  WHERE b.patient_id = p_patient_id
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_bookings(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_patient_bookings(uuid) TO authenticated;

-- Doctor: get their own bookings with patient info
CREATE OR REPLACE FUNCTION public.get_doctor_bookings(p_doctor_id uuid)
RETURNS TABLE (
  id            uuid,
  status        text,
  booking_date  date,
  start_time    time,
  price         numeric,
  notes         text,
  created_at    timestamptz,
  patient_id    uuid,
  patient_name  text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    b.id, b.status, b.booking_date, b.start_time, b.price, b.notes, b.created_at,
    b.patient_id,
    u.name AS patient_name
  FROM public.bookings b
  LEFT JOIN public.users u ON u.id = b.patient_id
  WHERE b.doctor_id = p_doctor_id
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_bookings(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_bookings(uuid) TO authenticated;

-- Get doctor dashboard stats securely (RLS-bypass)
CREATE OR REPLACE FUNCTION public.get_doctor_dashboard_stats(p_doctor_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date;
  v_today_bookings_count bigint;
  v_pending_count bigint;
  v_revenue numeric;
  v_patient_count bigint;
  v_day1_count bigint;
  v_day2_count bigint;
  v_day3_count bigint;
BEGIN
  v_today := current_date;

  -- 1. Today's bookings count
  SELECT COUNT(*) INTO v_today_bookings_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND booking_date = v_today;

  -- 2. Pending requests count
  SELECT COUNT(*) INTO v_pending_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND status = 'pending';

  -- 3. Total revenue (sum of prices for completed bookings)
  SELECT COALESCE(SUM(price), 0) INTO v_revenue
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND status = 'completed';

  -- 4. Total unique patients
  SELECT COUNT(DISTINCT patient_id) INTO v_patient_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id;

  -- 5. Upcoming bookings count for the next 3 days
  SELECT COUNT(*) INTO v_day1_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND booking_date = v_today + INTERVAL '1 day';

  SELECT COUNT(*) INTO v_day2_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND booking_date = v_today + INTERVAL '2 days';

  SELECT COUNT(*) INTO v_day3_count
  FROM public.bookings
  WHERE doctor_id = p_doctor_id AND booking_date = v_today + INTERVAL '3 days';

  RETURN json_build_object(
    'today_bookings_count', v_today_bookings_count,
    'pending_count', v_pending_count,
    'revenue', v_revenue,
    'patient_count', v_patient_count,
    'upcoming_day1_count', v_day1_count,
    'upcoming_day2_count', v_day2_count,
    'upcoming_day3_count', v_day3_count
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_doctor_dashboard_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_dashboard_stats(uuid) TO authenticated;

-- Get doctor's today bookings list securely (RLS-bypass)
CREATE OR REPLACE FUNCTION public.get_doctor_today_bookings(p_doctor_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  start_time time,
  notes text,
  patient_id uuid,
  patient_name text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT 
    b.id,
    b.status::text,
    b.start_time,
    b.notes,
    u.id AS patient_id,
    u.name AS patient_name
  FROM public.bookings b
  JOIN public.users u ON u.id = b.patient_id
  WHERE b.doctor_id = p_doctor_id AND b.booking_date = current_date
  ORDER BY b.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_today_bookings(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_today_bookings(uuid) TO authenticated;

-- Cancel booking (patient cancels)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_patient_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_admin_id uuid;
BEGIN
  -- 1. Fetch booking details
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND patient_id = p_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. If booking is active and not already cancelled
  IF v_booking.status <> 'cancelled' AND v_booking.status <> 'completed' THEN
    -- Update booking status
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE id = p_booking_id;

    -- Refund patient (if paid via wallet: notes does not contain cash or zaincash)
    IF v_booking.notes IS NULL OR (v_booking.notes NOT LIKE '%كاش في العيادة%' AND v_booking.notes NOT LIKE '%زين كاش%') THEN
      UPDATE public.users
      SET wallet_balance = COALESCE(wallet_balance, 0) + (v_booking.price + COALESCE(v_booking.platform_fee, 0))
      WHERE id = p_patient_id;

      -- Record refund transaction
      INSERT INTO public.transactions (user_id, amount, type, description, status)
      VALUES (p_patient_id, v_booking.price + COALESCE(v_booking.platform_fee, 0), 'refund', 'استرجاع رسوم - إلغاء حجز #' || p_booking_id, 'Completed');

      -- Claw back from doctor
      UPDATE public.users
      SET wallet_balance = wallet_balance - v_booking.price
      WHERE id = v_booking.doctor_id;

      -- Doctor transaction
      INSERT INTO public.transactions (user_id, amount, type, description, status)
      VALUES (v_booking.doctor_id, -v_booking.price, 'payment', 'إلغاء حجز واسترجاع رسوم موعد #' || p_booking_id, 'Completed');

      -- Claw back from admin
      SELECT id INTO v_admin_id FROM public.users WHERE role = 'ADMIN' LIMIT 1;
      IF v_admin_id IS NOT NULL THEN
        UPDATE public.users
        SET wallet_balance = wallet_balance - COALESCE(v_booking.platform_fee, 0)
        WHERE id = v_admin_id;

        -- Admin transaction
        INSERT INTO public.transactions (user_id, amount, type, description, status)
        VALUES (v_admin_id, -COALESCE(v_booking.platform_fee, 0), 'payment', 'إلغاء حجز واسترجاع رسوم خدمة موعد #' || p_booking_id, 'Completed');
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, uuid) TO authenticated;

-- Update booking status (doctor confirms/cancels/completes)
CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_doctor_id  uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_admin_id uuid;
BEGIN
  -- 1. Fetch booking details
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND doctor_id = p_doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. If status is changing to completed
  IF lower(p_status) = 'completed' AND v_booking.status <> 'completed' THEN
    -- Update booking status
    UPDATE public.bookings
    SET status = 'completed'
    WHERE id = p_booking_id;

    -- Note: Wallet balances for doctor and admin were already credited immediately at payment creation time.
    -- No need to credit them here to avoid double-payment.

  -- 3. If status is changing to cancelled
  ELSIF lower(p_status) = 'cancelled' AND v_booking.status <> 'cancelled' AND v_booking.status <> 'completed' THEN
    -- Update booking status
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE id = p_booking_id;

    -- Refund patient (if paid via wallet: notes does not contain cash or zaincash)
    IF v_booking.notes IS NULL OR (v_booking.notes NOT LIKE '%كاش في العيادة%' AND v_booking.notes NOT LIKE '%زين كاش%') THEN
      UPDATE public.users
      SET wallet_balance = COALESCE(wallet_balance, 0) + (v_booking.price + COALESCE(v_booking.platform_fee, 0))
      WHERE id = v_booking.patient_id;

      -- Record refund transaction
      INSERT INTO public.transactions (user_id, amount, type, description, status)
      VALUES (v_booking.patient_id, v_booking.price + COALESCE(v_booking.platform_fee, 0), 'refund', 'استرجاع رسوم - إلغاء حجز #' || p_booking_id, 'Completed');

      -- Claw back from doctor
      UPDATE public.users
      SET wallet_balance = wallet_balance - v_booking.price
      WHERE id = p_doctor_id;

      -- Doctor transaction
      INSERT INTO public.transactions (user_id, amount, type, description, status)
      VALUES (p_doctor_id, -v_booking.price, 'payment', 'إلغاء حجز واسترجاع رسوم موعد #' || p_booking_id, 'Completed');

      -- Claw back from admin
      SELECT id INTO v_admin_id FROM public.users WHERE role = 'ADMIN' LIMIT 1;
      IF v_admin_id IS NOT NULL THEN
        UPDATE public.users
        SET wallet_balance = wallet_balance - COALESCE(v_booking.platform_fee, 0)
        WHERE id = v_admin_id;

        -- Admin transaction
        INSERT INTO public.transactions (user_id, amount, type, description, status)
        VALUES (v_admin_id, -COALESCE(v_booking.platform_fee, 0), 'payment', 'إلغاء حجز واسترجاع رسوم خدمة موعد #' || p_booking_id, 'Completed');
      END IF;
    END IF;

  ELSE
    -- General status update (e.g. pending -> confirmed)
    UPDATE public.bookings
    SET status = lower(p_status)::booking_status
    WHERE id = p_booking_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, uuid, text) TO authenticated;

-- ── STEP 16: Medical Complexes Schema ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_complexes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  address          text,
  phone            text,
  google_maps_link text,
  created_at       timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medical_complexes ENABLE ROW LEVEL SECURITY;

-- Policies for medical complexes
DROP POLICY IF EXISTS "anyone_read_medical_complexes" ON public.medical_complexes;
CREATE POLICY "anyone_read_medical_complexes"
  ON public.medical_complexes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_all_medical_complexes" ON public.medical_complexes;
CREATE POLICY "admin_all_medical_complexes"
  ON public.medical_complexes FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Link users (doctors) to medical complexes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS complex_id uuid REFERENCES public.medical_complexes(id) ON DELETE SET NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_complexes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_complexes TO authenticated;

-- RPC functions for medical complexes to support custom sessions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_medical_complexes()
RETURNS SETOF public.medical_complexes
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT * FROM public.medical_complexes ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_medical_complexes() TO anon;
GRANT EXECUTE ON FUNCTION public.get_medical_complexes() TO authenticated;

CREATE OR REPLACE FUNCTION public.add_medical_complex(
  p_name             text,
  p_address          text,
  p_phone            text,
  p_google_maps_link text
)
RETURNS SETOF public.medical_complexes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_complex public.medical_complexes;
BEGIN
  INSERT INTO public.medical_complexes (name, address, phone, google_maps_link)
  VALUES (p_name, p_address, p_phone, p_google_maps_link)
  RETURNING * INTO v_complex;
  
  RETURN NEXT v_complex;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_medical_complex(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_medical_complex(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_medical_complex(
  p_id               uuid,
  p_name             text,
  p_address          text,
  p_phone            text,
  p_google_maps_link text
)
RETURNS SETOF public.medical_complexes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_complex public.medical_complexes;
BEGIN
  UPDATE public.medical_complexes
  SET name = p_name,
      address = p_address,
      phone = p_phone,
      google_maps_link = p_google_maps_link
  WHERE id = p_id
  RETURNING * INTO v_complex;
  
  RETURN NEXT v_complex;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_medical_complex(uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_medical_complex(uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_medical_complex(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.medical_complexes WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.delete_medical_complex(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_medical_complex(uuid) TO authenticated;

-- Admin RPC to upsert doctor details securely bypassing RLS
CREATE OR REPLACE FUNCTION public.admin_upsert_doctor(
  p_id         uuid,
  p_name       text,
  p_email      text,
  p_phone      text,
  p_bio        text,
  p_complex_id uuid
)
RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user public.users;
BEGIN
  IF p_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN
    -- Insert
    INSERT INTO public.users (name, email, phone, bio, complex_id, role, status, wallet_balance)
    VALUES (p_name, p_email, p_phone, p_bio, p_complex_id, 'DOCTOR', 'active', 0)
    RETURNING * INTO v_user;
  ELSE
    -- Update
    UPDATE public.users
    SET name = p_name,
        email = p_email,
        phone = p_phone,
        bio = p_bio,
        complex_id = p_complex_id,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_user;
  END IF;
  
  RETURN NEXT v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_doctor(uuid, text, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_doctor(uuid, text, text, text, text, uuid) TO authenticated;

-- Add governorate columns to users and medical complexes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS governorate text;
ALTER TABLE public.medical_complexes ADD COLUMN IF NOT EXISTS governorate text;

-- RPC to update user governorate
CREATE OR REPLACE FUNCTION public.update_user_governorate(
  p_user_id     uuid,
  p_governorate text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET governorate = p_governorate,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_governorate(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_governorate(uuid, text) TO authenticated;

-- Drop and recreate admin_upsert_doctor with governorate support
DROP FUNCTION IF EXISTS public.admin_upsert_doctor(uuid, text, text, text, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_upsert_doctor(
  p_id           uuid,
  p_name         text,
  p_email        text,
  p_phone        text,
  p_bio          text,
  p_complex_id   uuid,
  p_governorate  text
)
RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user public.users;
BEGIN
  IF p_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN
    -- Insert
    INSERT INTO public.users (name, email, phone, bio, complex_id, governorate, role, status, wallet_balance)
    VALUES (p_name, p_email, p_phone, p_bio, p_complex_id, p_governorate, 'DOCTOR', 'active', 0)
    RETURNING * INTO v_user;
  ELSE
    -- Update
    UPDATE public.users
    SET name = p_name,
        email = p_email,
        phone = p_phone,
        bio = p_bio,
        complex_id = p_complex_id,
        governorate = p_governorate,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_user;
  END IF;
  
  RETURN NEXT v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_doctor(uuid, text, text, text, text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_doctor(uuid, text, text, text, text, uuid, text) TO authenticated;

-- Drop and recreate add_medical_complex with governorate support
DROP FUNCTION IF EXISTS public.add_medical_complex(text, text, text, text);
CREATE OR REPLACE FUNCTION public.add_medical_complex(
  p_name             text,
  p_address          text,
  p_phone            text,
  p_google_maps_link text,
  p_governorate      text
)
RETURNS SETOF public.medical_complexes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_complex public.medical_complexes;
BEGIN
  INSERT INTO public.medical_complexes (name, address, phone, google_maps_link, governorate)
  VALUES (p_name, p_address, p_phone, p_google_maps_link, p_governorate)
  RETURNING * INTO v_complex;
  
  RETURN NEXT v_complex;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_medical_complex(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_medical_complex(text, text, text, text, text) TO authenticated;

-- Drop and recreate update_medical_complex with governorate support
DROP FUNCTION IF EXISTS public.update_medical_complex(uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_medical_complex(
  p_id               uuid,
  p_name             text,
  p_address          text,
  p_phone            text,
  p_google_maps_link text,
  p_governorate      text
)
RETURNS SETOF public.medical_complexes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_complex public.medical_complexes;
BEGIN
  UPDATE public.medical_complexes
  SET name = p_name,
      address = p_address,
      phone = p_phone,
      google_maps_link = p_google_maps_link,
      governorate = p_governorate
  WHERE id = p_id
  RETURNING * INTO v_complex;
  
  RETURN NEXT v_complex;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_medical_complex(uuid, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_medical_complex(uuid, text, text, text, text, text) TO authenticated;

-- Drop and recreate update_doctor_profile with governorate support
DROP FUNCTION IF EXISTS public.update_doctor_profile(uuid, text, text, text, text, numeric, text);
CREATE OR REPLACE FUNCTION public.update_doctor_profile(
  p_doctor_id      uuid,
  p_name           text,
  p_email          text DEFAULT NULL,
  p_phone          text DEFAULT NULL,
  p_specialization text DEFAULT NULL,
  p_price          numeric DEFAULT NULL,
  p_bio            text DEFAULT NULL,
  p_governorate    text DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    name           = COALESCE(p_name, name),
    email          = COALESCE(p_email, email),
    phone          = COALESCE(p_phone, phone),
    specialization = COALESCE(p_specialization, specialization),
    price          = COALESCE(p_price, price),
    bio            = COALESCE(p_bio, bio),
    governorate    = COALESCE(p_governorate, governorate),
    updated_at     = now()
  WHERE id = p_doctor_id;

  RETURN QUERY SELECT * FROM public.users WHERE id = p_doctor_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.update_doctor_profile(uuid, text, text, text, text, numeric, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_doctor_profile(uuid, text, text, text, text, numeric, text, text) TO authenticated;

-- ============================================================
-- ── STEP 10: USER MANAGEMENT, BLACKLISTING & NOTIFICATIONS
-- ============================================================

-- Create blocked_numbers table
CREATE TABLE IF NOT EXISTS public.blocked_numbers (
  phone text PRIMARY KEY,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on blocked_numbers
ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blocked_numbers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blocked_numbers', pol.policyname);
  END LOOP;
END $$;

-- Admins can do everything on blocked_numbers
CREATE POLICY "admins_all_blocked_numbers" ON public.blocked_numbers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN'));

-- Allow anon to read blocked numbers (for client check if needed, though RPC runs SECURITY DEFINER)
CREATE POLICY "anyone_read_blocked_numbers" ON public.blocked_numbers
  FOR SELECT TO anon, authenticated
  USING (true);

-- Add soon_notified column to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS soon_notified boolean DEFAULT false;

-- Admin RPC to adjust wallet balance securely
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_type text DEFAULT 'credit'
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Update users wallet_balance
  UPDATE public.users
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Insert a corresponding row in transactions table
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (p_user_id, p_amount, p_type, p_description, 'Completed');

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text) TO authenticated;

-- Admin RPC to block phone number and deactivate accounts
CREATE OR REPLACE FUNCTION public.admin_block_phone_number(
  p_phone text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into blocked_numbers
  INSERT INTO public.blocked_numbers (phone, reason, created_at)
  VALUES (p_phone, p_reason, now())
  ON CONFLICT (phone) DO UPDATE
  SET reason = EXCLUDED.reason,
      created_at = now();

  -- Update user status to inactive for matching phone
  UPDATE public.users
  SET status = 'inactive',
      updated_at = now()
  WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_block_phone_number(text, text) TO authenticated;

-- Admin RPC to unblock phone number
CREATE OR REPLACE FUNCTION public.admin_unblock_phone_number(
  p_phone text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Delete from blocked_numbers
  DELETE FROM public.blocked_numbers
  WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '');

  -- Restore matching users to active
  UPDATE public.users
  SET status = 'active',
      updated_at = now()
  WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unblock_phone_number(text) TO authenticated;

-- Admin RPC to safely delete user accounts cascadingly
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Delete bookings first
  DELETE FROM public.bookings WHERE patient_id = p_user_id OR doctor_id = p_user_id;
  -- Delete schedules if doctor
  DELETE FROM public.doctor_schedules WHERE doctor_id = p_user_id;
  -- Delete transactions
  DELETE FROM public.transactions WHERE user_id = p_user_id;
  -- Delete notifications
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  -- Finally delete the user
  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Recreate login_by_phone with block checks
CREATE OR REPLACE FUNCTION public.login_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_blocked boolean;
BEGIN
  -- Check if the phone is blocked
  SELECT EXISTS(
    SELECT 1 FROM public.blocked_numbers
    WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '')
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'ACCOUNT_BLOCKED';
  END IF;

  -- Find the user
  SELECT * INTO v_user FROM public.users
  WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if the user is inactive
  IF v_user.status = 'inactive' THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE';
  END IF;

  RETURN row_to_json(v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_by_phone(text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_by_phone(text) TO authenticated;

-- Recreate register_user with block checks
CREATE OR REPLACE FUNCTION public.register_user(
  p_name text,
  p_phone text,
  p_role text DEFAULT 'PATIENT'
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_blocked boolean;
BEGIN
  -- Check if the phone is blocked
  SELECT EXISTS(
    SELECT 1 FROM public.blocked_numbers
    WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '')
  ) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION 'PHONE_BLOCKED';
  END IF;

  -- Check if user already exists
  SELECT * INTO v_user FROM public.users
  WHERE phone = p_phone OR REPLACE(phone, ' ', '') = REPLACE(p_phone, ' ', '')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PHONE_EXISTS';
  END IF;

  -- Create user
  INSERT INTO public.users (name, phone, role, status, wallet_balance, price)
  VALUES (p_name, p_phone, p_role::user_role, 'active', 0, 0)
  RETURNING * INTO v_user;

  RETURN row_to_json(v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO authenticated;

-- RPC to create notification securely
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_notify_admin boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Insert primary notification
  INSERT INTO public.notifications (user_id, title, message, body, type, is_read, created_at)
  VALUES (p_user_id, p_title, p_message, p_message, p_type, false, now());

  -- If notify_admin is true, copy to admins
  IF p_notify_admin THEN
    FOR v_admin_id IN
      SELECT id FROM public.users WHERE role = 'ADMIN'
    LOOP
      -- Avoid duplicate notification for admin if user_id is already this admin
      IF v_admin_id <> p_user_id THEN
        INSERT INTO public.notifications (user_id, title, message, body, type, is_read, created_at)
        VALUES (v_admin_id, p_title || ' (إشعار الإدارة)', p_message, p_message, p_type, false, now());
      END IF;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, boolean) TO authenticated;

-- RPC to get upcoming bookings for a user
CREATE OR REPLACE FUNCTION public.get_user_upcoming_bookings(p_user_id uuid, p_role text)
RETURNS TABLE (
  id uuid,
  patient_id uuid,
  doctor_id uuid,
  booking_date date,
  start_time time,
  status text,
  soon_notified boolean,
  doctor_name text,
  patient_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF p_role = 'DOCTOR' THEN
    RETURN QUERY
    SELECT b.id, b.patient_id, b.doctor_id, b.booking_date, b.start_time, b.status::text, b.soon_notified,
           d.name AS doctor_name, p.name AS patient_name
    FROM public.bookings b
    LEFT JOIN public.users p ON p.id = b.patient_id
    LEFT JOIN public.users d ON d.id = b.doctor_id
    WHERE b.doctor_id = p_user_id AND b.booking_date >= CURRENT_DATE;
  ELSE
    RETURN QUERY
    SELECT b.id, b.patient_id, b.doctor_id, b.booking_date, b.start_time, b.status::text, b.soon_notified,
           d.name AS doctor_name, p.name AS patient_name
    FROM public.bookings b
    LEFT JOIN public.users p ON p.id = b.patient_id
    LEFT JOIN public.users d ON d.id = b.doctor_id
    WHERE b.patient_id = p_user_id AND b.booking_date >= CURRENT_DATE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_upcoming_bookings(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_upcoming_bookings(uuid, text) TO authenticated;

-- RPC to mark a booking as soon_notified
CREATE OR REPLACE FUNCTION public.mark_booking_soon_notified(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET soon_notified = true
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_booking_soon_notified(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_soon_notified(uuid) TO authenticated;


-- ============================================================
-- ── STEP 17: RLS POLICIES FOR MEDICAL RECORDS & NOTIFICATIONS
-- ============================================================

-- 1. MEDICAL RECORDS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'medical_records'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.medical_records', pol.policyname);
  END LOOP;
END $$;

-- Doctors can insert records where they are the doctor_id
CREATE POLICY "doctors_insert_medical_records" ON public.medical_records
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    doctor_id = auth.uid() OR 
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = doctor_id AND role = 'DOCTOR'))
  );

-- Doctors and admins can select medical records
CREATE POLICY "doctors_select_medical_records" ON public.medical_records
  FOR SELECT TO anon, authenticated
  USING (
    doctor_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = doctor_id AND role = 'DOCTOR')) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Patients can select medical records belonging to them
CREATE POLICY "patients_select_medical_records" ON public.medical_records
  FOR SELECT TO anon, authenticated
  USING (
    patient_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = patient_id))
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO authenticated;


-- 2. NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- Allow anon and authenticated to select notifications matching their user_id
CREATE POLICY "users_select_own_notifications" ON public.notifications
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = user_id)) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Allow anon and authenticated to update notifications matching their user_id (e.g. marking as read)
CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE TO anon, authenticated
  USING (
    user_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = user_id)) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  )
  WITH CHECK (
    user_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = user_id)) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Allow anon and authenticated to delete notifications matching their user_id
CREATE POLICY "users_delete_own_notifications" ON public.notifications
  FOR DELETE TO anon, authenticated
  USING (
    user_id = auth.uid() OR
    (auth.uid() IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = user_id)) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Allow anon and authenticated to insert notifications (fallback)
CREATE POLICY "users_insert_own_notifications" ON public.notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;


-- ============================================================
-- ── STEP 18: Doctor Patient & Medical Record RPCs
-- ============================================================

-- Returns all unique patients who booked with this doctor,
-- with visit counts, last visit date, and basic patient info.
CREATE OR REPLACE FUNCTION public.get_doctor_patients(p_doctor_id uuid)
RETURNS TABLE (
  patient_id        uuid,
  patient_name      text,
  patient_phone     text,
  patient_email     text,
  total_bookings    bigint,
  completed_visits  bigint,
  last_visit_date   date,
  first_visit_date  date,
  record_count      bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    u.id                                              AS patient_id,
    u.name                                            AS patient_name,
    u.phone                                           AS patient_phone,
    u.email                                           AS patient_email,
    COUNT(b.id)                                       AS total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'completed') AS completed_visits,
    MAX(b.booking_date)                               AS last_visit_date,
    MIN(b.booking_date)                               AS first_visit_date,
    COUNT(mr.id)                                      AS record_count
  FROM public.bookings b
  JOIN public.users u ON u.id = b.patient_id
  LEFT JOIN public.medical_records mr
    ON mr.patient_id = b.patient_id AND mr.doctor_id = p_doctor_id
  WHERE b.doctor_id = p_doctor_id
  GROUP BY u.id, u.name, u.phone, u.email
  ORDER BY MAX(b.booking_date) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_patients(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_patients(uuid) TO authenticated;


-- Returns all medical records this doctor wrote for a specific patient,
-- also joins booking info so we can show visit date/time.
CREATE OR REPLACE FUNCTION public.get_patient_records_for_doctor(
  p_doctor_id  uuid,
  p_patient_id uuid
)
RETURNS TABLE (
  record_id      uuid,
  created_at     timestamptz,
  diagnosis      text,
  prescription   text,
  notes          text,
  next_visit     text,
  booking_id     uuid,
  booking_date   date,
  start_time     time
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    mr.id            AS record_id,
    mr.created_at,
    mr.diagnosis,
    mr.prescription,
    mr.notes,
    mr.next_visit,
    mr.booking_id,
    b.booking_date,
    b.start_time
  FROM public.medical_records mr
  LEFT JOIN public.bookings b ON b.id = mr.booking_id
  WHERE mr.doctor_id  = p_doctor_id
    AND mr.patient_id = p_patient_id
  ORDER BY mr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_records_for_doctor(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_patient_records_for_doctor(uuid, uuid) TO authenticated;

-- ============================================================
-- ── STEP 19: Messaging System
-- ============================================================

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_sender_idx   ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS messages_created_idx  ON public.messages (created_at);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname); END LOOP;
END $$;

-- Allow anyone (anon or authenticated) to select/insert — security enforced by RPCs
CREATE POLICY "messages_open" ON public.messages
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;


-- ── RPC: send a message ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_message(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_body        text
)
RETURNS SETOF public.messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.messages;
BEGIN
  INSERT INTO public.messages (sender_id, receiver_id, body)
  VALUES (p_sender_id, p_receiver_id, p_body)
  RETURNING * INTO v_row;
  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text) TO authenticated;


-- ── RPC: get full conversation between two users ────────────
CREATE OR REPLACE FUNCTION public.get_conversation(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS TABLE (
  id          uuid,
  sender_id   uuid,
  receiver_id uuid,
  body        text,
  is_read     boolean,
  created_at  timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT id, sender_id, receiver_id, body, is_read, created_at
  FROM public.messages
  WHERE (sender_id = p_user_a AND receiver_id = p_user_b)
     OR (sender_id = p_user_b AND receiver_id = p_user_a)
  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_conversation(uuid, uuid) TO authenticated;


-- ── RPC: mark messages in a conversation as read ───────────
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_reader_id  uuid,
  p_sender_id  uuid
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.messages
  SET is_read = true
  WHERE receiver_id = p_reader_id
    AND sender_id   = p_sender_id
    AND is_read     = false;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO authenticated;


-- ── RPC: get conversation list (inbox) for a user ──────────
-- Returns one row per unique conversation partner with the latest message.
CREATE OR REPLACE FUNCTION public.get_conversations(p_user_id uuid)
RETURNS TABLE (
  other_user_id   uuid,
  other_user_name text,
  other_user_role text,
  last_message    text,
  last_message_at timestamptz,
  unread_count    bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH pairs AS (
    SELECT
      CASE WHEN sender_id = p_user_id THEN receiver_id ELSE sender_id END AS other_id,
      body,
      created_at,
      CASE WHEN receiver_id = p_user_id AND is_read = false THEN 1 ELSE 0 END AS unread
    FROM public.messages
    WHERE sender_id = p_user_id OR receiver_id = p_user_id
  ),
  ranked AS (
    SELECT
      other_id,
      body,
      created_at,
      unread,
      ROW_NUMBER() OVER (PARTITION BY other_id ORDER BY created_at DESC) AS rn
    FROM pairs
  )
  SELECT
    r.other_id                        AS other_user_id,
    u.name                            AS other_user_name,
    u.role                            AS other_user_role,
    r.body                            AS last_message,
    r.created_at                      AS last_message_at,
    SUM(p.unread)                     AS unread_count
  FROM ranked r
  JOIN public.users u ON u.id = r.other_id
  JOIN pairs p ON p.other_id = r.other_id
  WHERE r.rn = 1
  GROUP BY r.other_id, u.name, u.role, r.body, r.created_at
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversations(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_conversations(uuid) TO authenticated;

-- Enforce patient-only registration for public users
CREATE OR REPLACE FUNCTION public.register_user(
  p_name text, p_phone text, p_role text DEFAULT 'PATIENT'
)
RETURNS json LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user users%ROWTYPE;
BEGIN
  IF p_role <> 'PATIENT' THEN
    RAISE EXCEPTION 'Only PATIENT accounts can be created via registration';
  END IF;
  SELECT * INTO v_user FROM users WHERE phone = p_phone LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'PHONE_EXISTS'; END IF;
  INSERT INTO users (name, phone, role, status, wallet_balance, price)
  VALUES (p_name, p_phone, p_role::user_role, 'active', 0, 0)
  RETURNING * INTO v_user;
  RETURN row_to_json(v_user);
END; $$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO authenticated;

-- Create OTP verification table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  phone text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Bypasses RLS to write OTP codes securely
CREATE OR REPLACE FUNCTION public.save_otp_code(p_phone text, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.otp_codes (phone, code, expires_at)
  VALUES (p_phone, p_code, now() + interval '10 minutes')
  ON CONFLICT (phone) DO UPDATE
  SET code = p_code, expires_at = now() + interval '10 minutes';
END; $$;

GRANT EXECUTE ON FUNCTION public.save_otp_code(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.save_otp_code(text, text) TO authenticated;

-- Bypasses RLS to verify OTP codes securely
CREATE OR REPLACE FUNCTION public.verify_otp_code(p_phone text, p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.otp_codes
    WHERE phone = p_phone AND code = p_code AND expires_at > now()
  ) INTO v_valid;
  
  IF v_valid THEN
    DELETE FROM public.otp_codes WHERE phone = p_phone;
  END IF;
  
  RETURN v_valid;
END; $$;

GRANT EXECUTE ON FUNCTION public.verify_otp_code(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_otp_code(text, text) TO authenticated;

-- Create System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Insert default value for twoFactor
INSERT INTO public.system_settings (key, value)
VALUES ('two_factor_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Security definer functions to get and set 2FA state securely
CREATE OR REPLACE FUNCTION public.is_two_factor_enabled()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_val jsonb;
BEGIN
  SELECT value INTO v_val FROM public.system_settings WHERE key = 'two_factor_enabled';
  IF NOT FOUND THEN
    RETURN TRUE; -- default to true
  END IF;
  RETURN (v_val->>0)::boolean;
END; $$;

CREATE OR REPLACE FUNCTION public.set_two_factor_enabled(p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.system_settings (key, value)
  VALUES ('two_factor_enabled', to_jsonb(p_enabled))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END; $$;

GRANT EXECUTE ON FUNCTION public.is_two_factor_enabled() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_two_factor_enabled(boolean) TO authenticated;

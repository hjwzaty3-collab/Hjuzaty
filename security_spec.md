# Firebase Security Specification - Hijozati App

## 1. Data Invariants
- **User Ownership**: A user document in `/users/{uid}` MUST be owned by the user with the matching `request.auth.uid`.
- **Role Integrity**: Users cannot change their own `role` once it is set. `PATIENT` cannot become `ADMIN`.
- **Appointment Privacy**: An appointment must have a `patientId` and `doctorId`. ONLY the patient and the doctor in the record (and admins) can read the appointment.
- **Medical Record Integrity**: ONLY the doctor who wrote the record or the patient it belongs to can read it. ONLY a doctor can create a medical record for a patient.
- **Transaction Security**: ONLY the user who owns the transaction can read it. Transactions must match the user's `walletBalance` logic (though for simplicity in rules we enforce ownership).
- **Immutable Fields**: `createdAt`, `uid`, `patientId`, `doctorId`, `userId` are immutable after creation.

## 2. The "Dirty Dozen" Payloads (Deny Test Cases)
1. **Identity Theft**: User A tries to create a profile in `/users/UserB`.
2. **Privilege Escalation**: User A (Patient) tries to update their own role to `ADMIN`.
3. **Appointment Peeking**: User A tries to list all appointments from `/appointments` without filters, or User A tries to read User B's appointment.
4. **Shadow Field Injection**: User A adds `isVerified: true` to their user profile when it's not in the schema.
5. **Orphaned Appointment**: Creating an appointment with a `patientId` that doesn't match the current user.
6. **Malicious ID**: Using a 2MB string as a document ID to exhaust resources.
7. **Cross-User Medical Record**: Patient A tries to read Patient B's medical records.
8. **Doctor Spoofing**: Patient A tries to create a medical record claiming to be Doctor B.
9. **Wallet Tampering**: Patient A tries to update their `walletBalance` directly without a transaction.
10. **Transaction Forgery**: User B tries to creating a `Top-up` transaction for User A.
11. **Status Skipping**: Trying to move an appointment from `PENDING` directly to `COMPLETED` without being the doctor.
12. **System Field Overwrite**: Trying to manually set `createdAt` to a date in the past instead of `request.time`.

## 3. Test Runner (Draft Requirements)
- Verify `PERMISSION_DENIED` for all above.
- Verify `ALLOW` for:
  - Patient reading their own profile.
  - Doctor reading their own profile.
  - Patient reading their own appointments.
  - Doctor reading appointments where they are the `doctorId`.
  - Public reading doctor profiles (subset of fields).

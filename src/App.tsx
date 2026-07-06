import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuthStore } from '@/store/useAuthStore';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { AuthProvider } from '@/components/SupabaseProvider';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import VerifyCodePage from '@/pages/auth/VerifyCodePage';
import PatientHomePage from '@/pages/patient/PatientHomePage';
import DoctorsListPage from '@/pages/patient/DoctorsListPage';
import DoctorProfilePage from '@/pages/patient/DoctorProfilePage';
import BookingPage from '@/pages/patient/BookingPage';
import PaymentPage from '@/pages/patient/PaymentPage';
import MyBookingsPage from '@/pages/patient/MyBookingsPage';
import MedicalRecordsPage from '@/pages/patient/MedicalRecordsPage';
import WalletPage from '@/pages/patient/WalletPage';
import MedicalComplexesPage from '@/pages/patient/MedicalComplexesPage';

// Doctor Pages
import DoctorDashboardPage from '@/pages/doctor/DoctorDashboardPage';
import ScheduleManagementPage from '@/pages/doctor/ScheduleManagementPage';
import ClinicsPage from '@/pages/doctor/ClinicsPage';
import DoctorBookingsPage from '@/pages/doctor/DoctorBookingsPage';
import PatientsPage from '@/pages/doctor/PatientsPage';
import DoctorMedicalRecordsPage from '@/pages/doctor/DoctorMedicalRecordsPage';
import DoctorProfileSettingsPage from '@/pages/doctor/DoctorProfileSettingsPage';
import MessagesPage from '@/pages/MessagesPage';

// Admin Pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminDoctorsPage from '@/pages/admin/AdminDoctorsPage';
import AdminPatientsPage from '@/pages/admin/AdminPatientsPage';
import AdminBookingsPage from '@/pages/admin/AdminBookingsPage';
import AdminFinancialPage from '@/pages/admin/AdminFinancialPage';
import AdminPromotersPage from '@/pages/admin/AdminPromotersPage';
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminRedeemCodesPage from '@/pages/admin/AdminRedeemCodesPage';
import AdminComplexesPage from '@/pages/admin/AdminComplexesPage';

// Promoter Pages
import PromoterDashboardPage from '@/pages/promoter/PromoterDashboardPage';
import PromoterAddDoctorPage from '@/pages/promoter/PromoterAddDoctorPage';
import PromoterMyDoctorsPage from '@/pages/promoter/PromoterMyDoctorsPage';
import PromoterRewardsPage from '@/pages/promoter/PromoterRewardsPage';

// Temporary placeholder components for routing setup
const Register = () => <div className="p-8">Registration Form</div>;
const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
    <h1 className="text-6xl font-bold text-primary">404</h1>
    <h2 className="text-2xl font-bold text-neutral-900">Page Not Found</h2>
    <p className="text-neutral-500 max-w-md">The page you are looking for doesn't exist or has been moved.</p>
    <Link to="/">
      <Button className="rounded-xl px-8">Back to Home</Button>
    </Link>
  </div>
);

function HomeRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) {
    return <PatientHomePage />;
  }
  if (user.role === 'DOCTOR') {
    return <Navigate to="/doctor" replace />;
  }
  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  if (user.role === 'PROMOTER') {
    return <Navigate to="/promoter" replace />;
  }
  return <PatientHomePage />;
}

export default function App() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/verify-code" element={!isAuthenticated ? <VerifyCodePage /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
          </Route>

          {/* Main App Routes (Dashboard Layout) */}
          <Route element={<DashboardLayout />}>
            {/* Public Patient Routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/doctors" element={<DoctorsListPage />} />
            <Route path="/doctors/:id" element={<DoctorProfilePage />} />
            <Route path="/complexes" element={<MedicalComplexesPage />} />

            {/* Protected Patient Routes */}
            <Route path="/book/:id" element={isAuthenticated ? <BookingPage /> : <Navigate to="/login" />} />
            <Route path="/payment" element={isAuthenticated ? <PaymentPage /> : <Navigate to="/login" />} />
            <Route path="/bookings" element={isAuthenticated ? <MyBookingsPage /> : <Navigate to="/login" />} />
            <Route path="/medical-records" element={isAuthenticated ? <MedicalRecordsPage /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={isAuthenticated ? <WalletPage /> : <Navigate to="/login" />} />
            <Route path="/messages" element={isAuthenticated ? <MessagesPage /> : <Navigate to="/login" />} />

            {/* Protected Doctor Routes */}
            <Route path="/doctor" element={isAuthenticated && user?.role === 'DOCTOR' ? <DoctorDashboardPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/schedule" element={isAuthenticated && user?.role === 'DOCTOR' ? <ScheduleManagementPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/clinics" element={isAuthenticated && user?.role === 'DOCTOR' ? <ClinicsPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/bookings" element={isAuthenticated && user?.role === 'DOCTOR' ? <DoctorBookingsPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/patients" element={isAuthenticated && user?.role === 'DOCTOR' ? <PatientsPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/medical-records" element={isAuthenticated && user?.role === 'DOCTOR' ? <DoctorMedicalRecordsPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/profile" element={isAuthenticated && user?.role === 'DOCTOR' ? <DoctorProfileSettingsPage /> : <Navigate to="/login" />} />
            <Route path="/doctor/messages" element={isAuthenticated && user?.role === 'DOCTOR' ? <MessagesPage /> : <Navigate to="/login" />} />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminDashboardPage /> : <Navigate to="/login" />} />
            <Route path="/admin/doctors" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminDoctorsPage /> : <Navigate to="/login" />} />
            <Route path="/admin/patients" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminPatientsPage /> : <Navigate to="/login" />} />
            <Route path="/admin/bookings" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminBookingsPage /> : <Navigate to="/login" />} />
            <Route path="/admin/financials" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminFinancialPage /> : <Navigate to="/login" />} />
            <Route path="/admin/promoters" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminPromotersPage /> : <Navigate to="/login" />} />
            <Route path="/admin/notifications" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminNotificationsPage /> : <Navigate to="/login" />} />
            <Route path="/admin/settings" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminSettingsPage /> : <Navigate to="/login" />} />
            <Route path="/admin/redeem-codes" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminRedeemCodesPage /> : <Navigate to="/login" />} />
            <Route path="/admin/complexes" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminComplexesPage /> : <Navigate to="/login" />} />

            {/* Protected Promoter Routes */}
            <Route path="/promoter" element={isAuthenticated && user?.role === 'PROMOTER' ? <PromoterDashboardPage /> : <Navigate to="/login" />} />
            <Route path="/promoter/add-doctor" element={isAuthenticated && user?.role === 'PROMOTER' ? <PromoterAddDoctorPage /> : <Navigate to="/login" />} />
            <Route path="/promoter/my-doctors" element={isAuthenticated && user?.role === 'PROMOTER' ? <PromoterMyDoctorsPage /> : <Navigate to="/login" />} />
            <Route path="/promoter/rewards" element={isAuthenticated && user?.role === 'PROMOTER' ? <PromoterRewardsPage /> : <Navigate to="/login" />} />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    <Toaster position="top-center" />
  </QueryClientProvider>
  );
}

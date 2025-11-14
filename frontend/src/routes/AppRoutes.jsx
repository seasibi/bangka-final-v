import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import LoginPage from '../pages/LoginPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import ChangePasswordRequired from '../pages/ChangePasswordRequired'

import AdminLayout from '../layouts/AdminLayout'
import ProvincialLayout from '../layouts/ProvincialLayout'
import MunicipalLayout from '../layouts/MunicipalLayout'

import AdminDashboard from '../pages/admin/Dashboard'
import ProvincialDashboard from '../pages/provincial/Dashboard'
import MunicipalDashboard from '../pages/municipal/Dashboard'
import AdminUserProfiles from '../components/UserManagement/UserProfile'
import AdminFisherfolkManagement from '../pages/admin/FisherfolkManagement'
import AdminMunicipalAgriManagement from '../pages/admin/MunicipalAgriculturistManagement'
import AdminProvincialAgriManagement from '../pages/admin/ProvincialAgriculturistManagement'
import AdminBoatRegistryManagement from '../pages/admin/BoatRegistryManagement'
import MunicipalityManagement from '../pages/admin/MunicipalityManagement'
import BarangayVerifierManagement from '../pages/admin/BarangayVerifierManagement'
import SignatoriesManagement from '../pages/admin/SignatoriesManagement'

import TrackerManagement from '../pages/admin/TrackerManagement'
import AdminBirukBilugTracking from '../pages/admin/BirukBilugTracking'
import AdminReportGeneration from '../pages/admin/ReportGeneration'
import ActivityLogRep from '../pages/admin/ActivityLogRep'
import PAgriBoatRegistryManagement from '../pages/provincial/BoatRegistryManagement'
import PAFisherfolkManagement from '../pages/provincial/FisherfolkManagement'
import PABirukBilugTracking from '../pages/provincial/BirukBilugTracking'
import PATrackerManagement from '../pages/provincial/TrackerManagement'
import PAReportGeneration from '../pages/provincial/ReportGeneration'
import PAUtility from '../pages/provincial/Utility'

import MAFisherfolkManagement from '../pages/municipal/FisherfolkManagement'
import MABoatRegistryManagement from '../pages/municipal/BoatRegistryManagement'
import MATrackerManagement from '../pages/municipal/TrackerManagement'
import MABirukBilugTracking from '../pages/municipal/BirukBilugTracking'
import MAReportGeneration from '../pages/municipal/ReportGeneration'
import MAUtility from '../pages/municipal/Utitlity'
import MAAddFisherfolk from '../pages/municipal/AddFisherfolk'
import MAAddBoat from '../pages/municipal/AddBoat'
import MATrackerView from '../pages/municipal/TrackerView'
import MAEditBoat from '../pages/municipal/EditBoat'

import AdminUserManagement from '../pages/admin/UserManagement'
import AddBoat from '../pages/admin/AddBoat'
import EditBoat from '../pages/admin/EditBoat'
import AddUser from '../pages/admin/AddUser'
import EditUser from '../pages/admin/EditUser'
import AddFisherfolk from '../pages/admin/AddFisherfolk'
import EditFisherfolk from '../pages/admin/EditFisherfolk'
import EditMunicipalAgriculturist from '../pages/admin/EditMunicipalAgriculturist'
import EditProvincialAgriculturist from '../pages/admin/EditProvincialAgriculturist'
import AddTracker from '../pages/admin/AddTracker'
import TrackerView from '../pages/admin/TrackerView'
import ExcelImport from '../pages/admin/ExcelImport'
import Notifications from '../pages/Notifications'

import BoundaryEditor from '../pages/admin/BoundaryEditor'
import BackupRestore from '../pages/admin/BackupRestore'
import HelpCenter from '../pages/admin/HelpCenter'
import UtilityHelp from '../pages/admin/UtilityHelp'
import Utility from '../pages/admin/Utility'

import InstallingDependencies from '../pages/admin/InstallingDependencies'
import LoginHelp from '../pages/admin/LoginHelp'
import DashboardHelp from '../pages/admin/DashboardHelp'
import FisherfolkHelp from '../pages/admin/FisherfolkHelp'
import BoatRegistryHelp from '../pages/admin/BoatRegistryHelp'
import BirukBilugHelp from '../pages/admin/BirukBilugHelp'
import UserManagementHelp from '../pages/admin/UserManagementHelp'
import NotificationsHelp from '../pages/admin/NotificationsHelp'
import ReportGenerationHelp from '../pages/admin/ReportGenerationHelp'
import ImportsHelp from '../pages/admin/ImportsHelp'
import BoundaryEditorHelp from '../pages/admin/BoundaryEditorHelp'
import BackupRestoreHelp from '../pages/admin/BackupRestoreHelp'
import HelpCenterHelp from '../pages/admin/HelpCenterHelp'

import FisherfolkProfile from '../components/FisherfolkManagement/FisherfolkProfile'
import BoatProfile from '../components/BoatRegistry/BoatProfile'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
      <Route path="/change-password-required" element={<PrivateRoute element={<ChangePasswordRequired />} />} />

      {/* Admin Routes */}
      <Route path="/admin/*" element={<AdminLayout />}>
        <Route path="dashboard" element={<PrivateRoute element={<AdminDashboard />} />} />
        <Route path="fisherfolkManagement" element={<PrivateRoute element={<AdminFisherfolkManagement />} />} />
        <Route path="municipalAgriManagement" element={<PrivateRoute element={<AdminMunicipalAgriManagement />} />} />
        <Route path="provincialAgriManagement" element={<PrivateRoute element={<AdminProvincialAgriManagement />} />} />
        <Route path="boatRegistryManagement" element={<PrivateRoute element={<AdminBoatRegistryManagement />} />} />
        <Route path="boat-registry/add" element={<PrivateRoute element={<AddBoat />} />} />
        <Route path="boat-registry/profile/:id" element={<PrivateRoute element={<BoatProfile />} />} />
        <Route path="boat-registry/edit/:id" element={<PrivateRoute element={<EditBoat />} />} />
        <Route path="TrackerManagement" element={<PrivateRoute element={<TrackerManagement />} />} />
<Route path="TrackerManagement/add" element={<PrivateRoute element={<AddTracker />} />} />
        <Route path="TrackerManagement/view/:id" element={<PrivateRoute element={<TrackerView />} />} />
        <Route path="municipalManagement" element={<PrivateRoute element={<MunicipalityManagement />} />} />
        <Route path="barangayVerifierManagement" element={<PrivateRoute element={<BarangayVerifierManagement />} />} />
        <Route path="signatories" element={<PrivateRoute element={<SignatoriesManagement />} />} />
        <Route path="birukbilugTracking" element={<PrivateRoute element={<AdminBirukBilugTracking />} />} />
        <Route path="userManagement" element={<PrivateRoute element={<AdminUserManagement />} />} />
        <Route path="reportGeneration" element={<PrivateRoute element={<AdminReportGeneration />} />} />
        {/* Legacy Activity Log report path -> redirect to Utility */}
        <Route path="reportGeneration/activityLogRep" element={<Navigate to="/admin/utility/activityLog" replace />} />
        <Route path="users" element={<PrivateRoute element={<AdminUserManagement />} />} />
        <Route path="users/profile/:id" element={<PrivateRoute element={<AdminUserProfiles />} />} />
        <Route path="users/add" element={<PrivateRoute element={<AddUser />} />} />
        <Route path="users/edit/:id" element={<PrivateRoute element={<EditUser />} />} />
        <Route path="fisherfolk" element={<PrivateRoute element={<AdminFisherfolkManagement />} />} />
        <Route path="fisherfolk/add" element={<PrivateRoute element={<AddFisherfolk />} />} />
        <Route path="fisherfolk/profile/:id" element={<FisherfolkProfile/>} />
        <Route path="fisherfolk/edit/:id" element={<PrivateRoute element={<EditFisherfolk />} />} />
        <Route path="municipal-agriculturist/edit/:id" element={<PrivateRoute element={<EditMunicipalAgriculturist />} />} />
        <Route path="provincial-agriculturist/edit/:id" element={<PrivateRoute element={<EditProvincialAgriculturist />} />} />
        <Route path="boatExcelImport" element={<PrivateRoute element={<ExcelImport />} />} />
        <Route path="fisherfolkExcelImport" element={<PrivateRoute element={<ExcelImport />} />} />
        <Route path="excelImport" element={<PrivateRoute element={<ExcelImport />} />} />
        <Route path="notifications" element={<PrivateRoute element={<Notifications />} />} />
        <Route path="boundaryEditor" element={<PrivateRoute element={<BoundaryEditor />} />} />
        <Route path="utility" element={<PrivateRoute element={<Utility />} />} />
        {/* Utility: Activity Log */}
        <Route path="utility/activityLog" element={<PrivateRoute element={<ActivityLogRep />} />} />
        {/* Support both sidebar path and legacy path */}
        <Route path="backupRestore" element={<PrivateRoute element={<BackupRestore />} />} />
        <Route path="utility/backupRestore" element={<PrivateRoute element={<BackupRestore />} />} />
        <Route path="helpCenter" element={<PrivateRoute element={<HelpCenter />} />} />
        <Route path="help/installing-dependencies" element={<PrivateRoute element={<InstallingDependencies />} />} />
    <Route path="help/login" element={<PrivateRoute element={<LoginHelp />} />} />
    <Route path="help/dashboard" element={<PrivateRoute element={<DashboardHelp />} />} />
    <Route path="help/fisherfolk" element={<PrivateRoute element={<FisherfolkHelp />} />} />
    <Route path="help/boat-registry" element={<PrivateRoute element={<BoatRegistryHelp />} />} />
    <Route path="help/birukbilug" element={<PrivateRoute element={<BirukBilugHelp />} />} />
    <Route path="help/user-management" element={<PrivateRoute element={<UserManagementHelp />} />} />
    <Route path="help/notifications" element={<PrivateRoute element={<NotificationsHelp />} />} />
    <Route path="help/reports" element={<PrivateRoute element={<ReportGenerationHelp />} />} />
    <Route path="help/imports" element={<PrivateRoute element={<ImportsHelp />} />} />
    <Route path="help/boundary-editor" element={<PrivateRoute element={<BoundaryEditorHelp />} />} />
    <Route path="help/backup-restore" element={<PrivateRoute element={<BackupRestoreHelp />} />} />
    <Route path="help/help-center" element={<PrivateRoute element={<HelpCenterHelp />} />} />
  <Route path="help/utility" element={<PrivateRoute element={<UtilityHelp />} />} />
      </Route>

      {/* Provincial Routes */}
  <Route path="/provincial_agriculturist/*" element={<ProvincialLayout />}>
    <Route path="dashboard" element={<PrivateRoute element={<ProvincialDashboard />} />} />
    <Route path="fisherfolkManagement" element={<PrivateRoute element={<PAFisherfolkManagement />} />} />
    <Route path="boatRegistryManagement" element={<PrivateRoute element={<PAgriBoatRegistryManagement />} />} />
    <Route path="birukbilugTracking" element={<PrivateRoute element={<PABirukBilugTracking />} />} />
    <Route path="TrackerManagement" element={<PrivateRoute element={<PATrackerManagement />} />} />
    <Route path="notifications" element={<PrivateRoute element={<Notifications />} />} />
    <Route path="reportGeneration" element={<PrivateRoute element={< PAReportGeneration/>} />} />
    {/* Provincial Utilities */}
    <Route path="utility" element={<PrivateRoute element={<PAUtility />} />} />
    <Route path="helpCenter" element={<PrivateRoute element={<HelpCenter />} />} />
    <Route path="excelImport" element={<PrivateRoute element={<ExcelImport />} />} />
  </Route>

      {/* Agriculturist Routes */}
      <Route path="/municipal_agriculturist/*" element={<MunicipalLayout/>}>
        <Route path="dashboard" element={<PrivateRoute element={<MunicipalDashboard />} />} />
         <Route path="fisherfolkManagement" element={<PrivateRoute element={<MAFisherfolkManagement />} />} />
         <Route path="fisherfolkManagement/add" element={<PrivateRoute element={<MAAddFisherfolk />} />} />
         <Route path="boatRegistryManagement" element={<PrivateRoute element={<MABoatRegistryManagement />} />} />
          <Route path="boat-registry/add" element={<PrivateRoute element={<MAAddBoat />} />} />
         <Route path="boat-registry/profile/:id" element={<PrivateRoute element={<BoatProfile editBasePath="/municipal_agriculturist" />} />} />
         <Route path="boat-registry/edit/:id" element={<PrivateRoute element={<MAEditBoat />} />} />
         <Route path="birukbilugTracking" element={<PrivateRoute element={<MABirukBilugTracking />} />} />
         <Route path="TrackerManagement" element={<PrivateRoute element={<MATrackerManagement />} />} />
         <Route path="TrackerManagement/view/:id" element={<PrivateRoute element={<MATrackerView />} />} />
         <Route path="notifications" element={<PrivateRoute element={<Notifications />} />} />
         <Route path="reportGeneration" element={<PrivateRoute element={<MAReportGeneration />} />} />
         <Route path="utility" element={<PrivateRoute element={<MAUtility />} />} />
         <Route path="excelImport" element={<PrivateRoute element={<ExcelImport />} />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes

import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
    canActivate: [loginGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [authGuard]
  },

  {
    path: 'user-management',
    loadComponent: () => import('./user-management/user-management.page').then((m) => m.UserManagementPage),
    canActivate: [authGuard],
    data: { permission: 'USER_MANAGEMENT.LISTING' }
  },
  {
    path: 'role-management',
    loadComponent: () => import('./role-management/role-management.page').then((m) => m.RoleManagementPage),
    canActivate: [authGuard],
    data: { permission: 'ROLE_MANAGEMENT.LISTING' }
  },
  {
    path: 'role-permission',
    loadComponent: () => import('./role-permission/role-permission.page').then((m) => m.RolePermissionPage),
    canActivate: [authGuard],
    data: { permission: 'ROLE_PERMISSION.LISTING' }
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'smart-solar/dashboard',
    loadComponent: () => import('./smart-solar/dashboard/dashboard.page').then(m => m.SolarDashboardPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_SOLAR.LISTING' }
  },
  {
    path: 'smart-solar/registry',
    loadComponent: () => import('./smart-solar/registry/registry.page').then(m => m.SolarRegistryPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_SOLAR.LISTING' }
  },
  {
    path: 'smart-solar/monitoring',
    loadComponent: () => import('./smart-solar/monitoring/monitoring.page').then(m => m.SolarMonitoringPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_SOLAR.LISTING' }
  },
  {
    path: 'smart-solar/history',
    loadComponent: () => import('./smart-solar/history/history.page').then( m => m.HistoryPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_SOLAR.LISTING' }
  },

  {
    path: 'smart-led/registry',
    loadComponent: () => import('./smart-led/registry/registry.page').then( m => m.RegistryPage),
    canActivate: [authGuard]
  },
  {
    path: 'smart-led/monitoring',
    loadComponent: () => import('./smart-led/monitoring/monitoring.page').then( m => m.MonitoringPage),
    canActivate: [authGuard]
  },
  {
    path: 'smart-led/dashboard',
    loadComponent: () => import('./smart-led/dashboard/dashboard.page').then( m => m.DashboardPage),
    canActivate: [authGuard]
  },
  {
    path: 'smart-led/history',
    loadComponent: () => import('./smart-led/history/history.page').then( m => m.HistoryPage),
    canActivate: [authGuard]
  },
  {
    path: 'project-management',
    loadComponent: () => import('./project-management/project-management.page').then( m => m.ProjectManagementPage),
    canActivate: [authGuard],
    data: { permission: 'USER_MANAGEMENT.LISTING' }
  },
  {
    path: 'smart-solar/alarms',
    loadComponent: () => import('./alarms-center/alarms-center.page').then( m => m.AlarmsCenterPage)
  },
  {
    path: 'smart-led/alarms',
    loadComponent: () => import('./alarms-center/alarms-center.page').then( m => m.AlarmsCenterPage)
  },
  {
    path: 'notification-settings',
    loadComponent: () => import('./notification-settings/notification-settings.page').then( m => m.NotificationSettingsPage)
  },
  {
    path: 'notification-settings/whatsapp-setup',
    loadComponent: () => import('./notification-settings/whatsapp-setup/whatsapp-setup.page').then(m => m.WhatsappSetupPage),
    canActivate: [authGuard],
    data: { permission: 'NOTIFICATION_SETUP.LISTING' }
  },
  {
    path: 'bertam/dashboard',
    loadComponent: () => import('./bertam/dashboard/dashboard.page').then(m => m.BertamDashboardPage),
    canActivate: [authGuard]
  },
  {
    path: 'bertam/monitoring',
    loadComponent: () => import('./bertam/monitoring/monitoring.page').then(m => m.BertamMonitoringPage),
    canActivate: [authGuard]
  },
  {
    path: 'bertam/history',
    loadComponent: () => import('./bertam/history/history.page').then(m => m.BertamHistoryPage),
    canActivate: [authGuard]
  },
  {
    path: 'uc100/dashboard',
    loadComponent: () => import('./uc100/dashboard/dashboard.page').then(m => m.Uc100DashboardPage),
    canActivate: [authGuard],
    data: { permission: 'UC100_SOLAR.LISTING' }
  },
  {
    path: 'uc100/monitoring',
    loadComponent: () => import('./uc100/monitoring/monitoring.page').then(m => m.Uc100MonitoringPage),
    canActivate: [authGuard],
    data: { permission: 'UC100_SOLAR.LISTING' }
  },
  {
    path: 'uc100/history',
    loadComponent: () => import('./uc100/history/history.page').then(m => m.Uc100HistoryPage),
    canActivate: [authGuard],
    data: { permission: 'UC100_SOLAR.LISTING' }
  },
  {
    path: 'uc100/registry',
    loadComponent: () => import('./uc100/registry/registry.page').then(m => m.Uc100RegistryPage),
    canActivate: [authGuard],
    data: { permission: 'UC100_SOLAR.LISTING' }
  },
  {
    path: 'smart-pole/cctv/monitoring',
    loadComponent: () => import('./SmartPole/cctv/cctv.page').then(m => m.CctvPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_CITY_POLE.LISTING' }
  },
  {
    path: 'smart-pole/environmental/monitoring',
    loadComponent: () => import('./SmartPole/environmental/environmental.page').then(m => m.EnvironmentalPage),
    canActivate: [authGuard],
    data: { permission: 'SMART_CITY_POLE.LISTING' }
  },
  {
    path: 'smart-pole/panic-button',
    loadComponent: () => import('./SmartPole/panic-button/panic-button.page').then(m => m.PanicButtonPage),
    canActivate: [authGuard]
  },
  {
    path: 'smart-pole/panic-button/monitoring',
    loadComponent: () => import('./SmartPole/panic-button/panic-button.page').then(m => m.PanicButtonPage),
    canActivate: [authGuard]
  }
];

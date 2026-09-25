import { Component } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';
import { environment } from '../../environments/environment';

type Role = {
  id: number;
  name: string;
  description?: string;
};

type Permission = {
  id: number;
  code: string;
  description?: string;
};

type RolePermission = {
  id: number;
  roleId: number;
  permissionId: number;
  role?: Role;
  permission?: Permission;
};

@Component({
  selector: 'app-role-permission',
  templateUrl: './role-permission.page.html',
  styleUrls: ['./role-permission.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    CustomHeaderComponent
  ]
})
export class RolePermissionPage {
  permissionsMaster: Permission[] = [];
  roles: Role[] = [];

  apiUrl = `${environment.apiUrl}/role-permissions`;
  rolesUrl = `${environment.apiUrl}/roles`;
  permissionsUrl = `${environment.apiUrl}/permissions`;

  searchRole: number | null = null;
  searchPermission = '';

  assignedSet: Set<number> = new Set();
  originalAssigned: Set<number> = new Set();
  isDirty = false;

  modules = [
    { name: 'User Management', key: 'USER_MANAGEMENT' },
    { name: 'Role Management', key: 'ROLE_MANAGEMENT' },
    { name: 'Role Permission', key: 'ROLE_PERMISSION' },
    { name: 'Smart LED Streetlight', key: 'SMART_LED_STREETLIGHT' },
    { name: 'Smart Solar', key: 'SMART_SOLAR' },
    { name: 'UC100 Solar', key: 'UC100_SOLAR' },
    // { name: 'Smart City Pole', key: 'SMART_CITY_POLE' },
    { name: 'Notification Setup', key: 'NOTIFICATION_SETUP' },
  ];

  constructor(private http: HttpClient, private toastController: ToastController) {}

  ionViewWillEnter() {
    this.loadRoles();
    this.loadPermissionsMaster();
  }

  loadRoles() {
    this.http.get<Role[]>(this.rolesUrl).subscribe({
      next: (data) => {
        this.roles = data;
        if (!this.searchRole && this.roles.length) {
          this.searchRole = this.roles[0].id;
          this.loadAssignedForRole(this.searchRole);
        }
      },
      error: (err) => {
        console.error('Failed to load roles', err);
      }
    });
  }

  loadPermissionsMaster() {
    this.http.get<Permission[]>(this.permissionsUrl).subscribe({
      next: (data) => {
        this.permissionsMaster = data;
      },
      error: (err) => {
        console.error('Failed to load permissions master list', err);
      }
    });
  }

  onSearch() {
    if (this.searchRole) {
      this.loadAssignedForRole(this.searchRole);
    } else {
      this.assignedSet = new Set();
      this.originalAssigned = new Set();
      this.isDirty = false;
    }
  }

  filteredModules() {
    const kw = (this.searchPermission || '').toLowerCase();
    if (!kw) return this.modules;
    return this.modules.filter(m => 
      m.name.toLowerCase().includes(kw) || 
      m.key.toLowerCase().includes(kw)
    );
  }

  loadAssignedForRole(roleId: number) {
    this.http.get<RolePermission[]>(`${this.apiUrl}/role/${roleId}`).subscribe({
      next: (data) => {
        this.assignedSet = new Set(data.map((item) => item.permissionId));
        this.originalAssigned = new Set(this.assignedSet);
        this.isDirty = false;
      },
      error: (err) => console.error('Failed to load assigned permissions', err)
    });
  }

  getPermissionByCode(code: string): Permission | undefined {
    return this.permissionsMaster.find(p => p.code === code);
  }

  getPermissionCode(moduleKey: string, action: string): string | null {
    if (action === 'LISTING' || action === 'VIEW') {
      if (this.getPermissionByCode(`${moduleKey}.LISTING`)) {
        return `${moduleKey}.LISTING`;
      }
      if (this.getPermissionByCode(`${moduleKey}.VIEW`)) {
        return `${moduleKey}.VIEW`;
      }
      return null;
    }

    // Special mapping: UPDATE column shows WHATSAPP_MANAGE for NOTIFICATION_SETUP
    if (action === 'UPDATE' && moduleKey === 'NOTIFICATION_SETUP') {
      const code = `${moduleKey}.WHATSAPP_MANAGE`;
      return this.getPermissionByCode(code) ? code : null;
    }

    const code = `${moduleKey}.${action}`;
    return this.getPermissionByCode(code) ? code : null;
  }

  togglePermission(code: string, checked: boolean) {
    const perm = this.getPermissionByCode(code);
    if (!perm) return;
    if (checked) {
      this.assignedSet.add(perm.id);
    } else {
      this.assignedSet.delete(perm.id);
    }
    this.isDirty = !this.setsEqual(this.assignedSet, this.originalAssigned);
  }

  isPermissionChecked(code: string): boolean {
    const perm = this.getPermissionByCode(code);
    return perm ? this.assignedSet.has(perm.id) : false;
  }

  toggleAllForModule(moduleKey: string) {
    const actions = ['LISTING', 'VIEW', 'CREATE', 'UPDATE', 'DELETE'];
    // Also include custom actions for specific modules
    if (moduleKey === 'NOTIFICATION_SETUP') actions.push('WHATSAPP_MANAGE');

    const codes: string[] = [];
    for (const action of actions) {
      const code = this.getPermissionCode(moduleKey, action);
      if (code) codes.push(code);
    }

    const allChecked = this.isAllModuleChecked(moduleKey);
    for (const code of codes) {
      const perm = this.getPermissionByCode(code);
      if (perm) {
        if (allChecked) {
          this.assignedSet.delete(perm.id);
        } else {
          this.assignedSet.add(perm.id);
        }
      }
    }
    this.isDirty = !this.setsEqual(this.assignedSet, this.originalAssigned);
  }

  isAllModuleChecked(moduleKey: string): boolean {
    const actions = ['LISTING', 'VIEW', 'CREATE', 'UPDATE', 'DELETE'];
    if (moduleKey === 'NOTIFICATION_SETUP') actions.push('WHATSAPP_MANAGE');

    let hasAnyApplicable = false;
    for (const action of actions) {
      const code = this.getPermissionCode(moduleKey, action);
      if (code) {
        hasAnyApplicable = true;
        const perm = this.getPermissionByCode(code);
        if (perm && !this.assignedSet.has(perm.id)) {
          return false;
        }
      }
    }
    return hasAnyApplicable;
  }

  setsEqual(a: Set<number>, b: Set<number>) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  saveAssignedRolePermissions() {
    if (!this.searchRole) return;
    const payload = {
      roleId: this.searchRole,
      permissionIds: Array.from(this.assignedSet)
    };

    this.http.post(`${this.apiUrl}/bulk`, payload).subscribe({
      next: async () => {
        this.originalAssigned = new Set(this.assignedSet);
        this.isDirty = false;
        
        const toast = await this.toastController.create({
          message: 'Permissions successfully applied.',
          duration: 2000,
          position: 'top',
          color: 'success'
        });
        toast.present();
      },
      error: async (err) => {
        console.error('Failed to save assigned permissions', err);
        const toast = await this.toastController.create({
          message: 'Failed to apply permissions.',
          duration: 3000,
          position: 'top',
          color: 'danger'
        });
        toast.present();
      }
    });
  }

  cancelAssignedChanges() {
    this.assignedSet = new Set(this.originalAssigned);
    this.isDirty = false;
  }
}

import { Component, OnInit } from '@angular/core';
import {
  IonButton, IonContent, IonHeader, IonToolbar, IonTitle,
  IonModal, IonIcon, IonBadge, AlertController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

interface User {
  id?: number;
  username: string;
  name?: string;
  password?: string;
  userRole: string;
  projectId: number | null;
  project?: { id: number; name: string };
  createdDatetime?: Date;
  updatedDatetime?: Date;
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.page.html',
  styleUrls: ['./user-management.page.scss'],
  standalone: true,
  imports: [
    IonButton, IonContent, IonHeader, IonToolbar, IonTitle,
    IonModal, IonIcon, IonBadge,
    CommonModule, FormsModule, CustomHeaderComponent
  ]
})
export class UserManagementPage implements OnInit {
  allUsers: any[] = [];
  users: any[] = [];
  pagedUsers: any[] = [];
  roles: any[] = [];
  apiUrl = `${environment.apiUrl}/users`;
  rolesUrl = `${environment.apiUrl}/roles`;

  searchUsername = '';
  searchRole = '';
  projects: any[] = [];
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  isModalOpen = false;
  isEditMode = false;
  currentUser: User = { username: '', name: '', password: '', userRole: 'Admin', projectId: null };

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private authService: AuthService
  ) {}

  get isCurrentUserSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  ngOnInit() {
    this.loadRoles();
    this.loadUsers();
    this.loadProjects();
  }

  loadProjects() {
    this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
      next: (data) => { this.projects = data; },
      error: (err) => console.error('Failed to load projects', err)
    });
  }

  loadRoles() {
    this.http.get<any[]>(this.rolesUrl).subscribe({
      next: (data) => {
        this.roles = data;
      },
      error: (err) => {
        console.error('Failed to load roles', err);
      }
    });
  }

  loadUsers() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.allUsers = data;
        this.onSearch();
      },
      error: (err) => {
        console.error('Failed to load users', err);
      }
    });
  }

  onSearch() {
    this.users = this.allUsers.filter(u => {
      const matchUsername = u.username?.toLowerCase().includes(this.searchUsername.toLowerCase()) ?? true;
      const matchRole = this.searchRole ? u.userRole === this.searchRole : true;
      return matchUsername && matchRole;
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.users.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedUsers = this.users.slice(start, start + this.pageSize);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  setPageSize(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePagination();
  }

  openModal(user?: any) {
    if (!this.roles.length) {
      this.loadRoles();
    }

    if (user) {
      this.isEditMode = true;
      this.currentUser = {
        id: user.id,
        username: user.username,
        name: user.name || '',
        userRole: user.userRole,
        projectId: user.project?.id || null
      };
    } else {
      this.isEditMode = false;
      this.currentUser = {
        username: '',
        name: '',
        password: '',
        userRole: this.roles[0]?.name ?? '',
        projectId: null,
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveUser() {
    if (this.isEditMode) {
      this.http.put(`${this.apiUrl}/${this.currentUser.id}`, this.currentUser).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
        },
        error: (err) => console.error('Failed to update user', err)
      });
    } else {
      this.http.post(this.apiUrl, this.currentUser).subscribe({
        next: () => {
          this.loadUsers();
          this.closeModal();
        },
        error: (err) => console.error('Failed to add user', err)
      });
    }
  }

  async deleteUser(id: number) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this user?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.http.delete(`${this.apiUrl}/${id}`).subscribe({
              next: () => this.loadUsers(),
              error: (err) => console.error('Failed to delete user', err)
            });
          }
        }
      ]
    });

    await alert.present();
  }
}

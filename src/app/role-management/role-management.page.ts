import { Component, OnInit } from '@angular/core';
import {
  IonButton, IonContent, IonHeader, IonToolbar, IonTitle,
  IonModal, IonIcon, AlertController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-role-management',
  templateUrl: './role-management.page.html',
  styleUrls: ['./role-management.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonModal,
    IonIcon,
    CommonModule,
    FormsModule,
    CustomHeaderComponent,
  ],
})
export class RoleManagementPage implements OnInit {
  allRoles: any[] = [];
  roles: any[] = [];
  pagedRoles: any[] = [];
  apiUrl = `${environment.apiUrl}/roles`;

  searchKeyword = '';
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  isModalOpen = false;
  isEditMode = false;
  currentRole: any = { name: '', description: '' };

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
  ) {}

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.allRoles = data;
        this.onSearch();
      },
      error: (err) => {
        console.error('Failed to load roles', err);
      }
    });
  }

  onSearch() {
    const keyword = this.searchKeyword?.toLowerCase() ?? '';
    this.roles = this.allRoles.filter((role) => {
      return (
        role.name?.toLowerCase().includes(keyword) ||
        role.description?.toLowerCase().includes(keyword)
      );
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.roles.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedRoles = this.roles.slice(start, start + this.pageSize);
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

  openModal(role?: any) {
    if (role) {
      this.isEditMode = true;
      this.currentRole = { ...role };
    } else {
      this.isEditMode = false;
      this.currentRole = { name: '', description: '' };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveRole() {
    const payload = {
      name: this.currentRole.name?.trim(),
      description: this.currentRole.description?.trim(),
    };

    if (!payload.name) {
      return;
    }

    if (this.isEditMode) {
      this.http.put(`${this.apiUrl}/${this.currentRole.id}`, payload).subscribe({
        next: () => {
          this.loadRoles();
          this.closeModal();
        },
        error: (err) => {
          console.error('Failed to update role', err);
        }
      });
    } else {
      this.http.post(this.apiUrl, payload).subscribe({
        next: () => {
          this.loadRoles();
          this.closeModal();
        },
        error: (err) => {
          console.error('Failed to create role', err);
        }
      });
    }
  }

  async deleteRole(id: number) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this role?',
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
              next: () => this.loadRoles(),
              error: (err) => {
                console.error('Failed to delete role', err);
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }
}

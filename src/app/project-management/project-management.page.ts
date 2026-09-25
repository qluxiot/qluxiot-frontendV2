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
  selector: 'app-project-management',
  templateUrl: './project-management.page.html',
  styleUrls: ['./project-management.page.scss'],
  standalone: true,
  imports: [
    IonButton, IonContent, IonHeader, IonToolbar, IonTitle,
    IonModal, IonIcon,
    CommonModule, FormsModule, CustomHeaderComponent
  ]
})
export class ProjectManagementPage implements OnInit {
  allProjects: any[] = [];
  projects: any[] = [];
  pagedProjects: any[] = [];
  apiUrl = `${environment.apiUrl}/api/projects`;

  searchName = '';
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  isModalOpen = false;
  isEditMode = false;
  currentProject: any = { name: '', description: '', location: '' };

  constructor(
    private http: HttpClient,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.allProjects = data;
        this.onSearch();
      },
      error: (err) => {
        console.error('Failed to load projects', err);
      }
    });
  }

  onSearch() {
    this.projects = this.allProjects.filter(p => {
      return p.name?.toLowerCase().includes(this.searchName.toLowerCase()) ?? true;
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.projects.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedProjects = this.projects.slice(start, start + this.pageSize);
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

  openModal(project?: any) {
    if (project) {
      this.isEditMode = true;
      this.currentProject = { ...project };
    } else {
      this.isEditMode = false;
      this.currentProject = {
        name: '',
        description: '',
        location: '',
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  saveProject() {
    if (this.isEditMode) {
      this.http.put(`${this.apiUrl}/${this.currentProject.id}`, this.currentProject).subscribe({
        next: () => {
          this.loadProjects();
          this.closeModal();
        },
        error: (err) => console.error('Failed to update project', err)
      });
    } else {
      this.http.post(this.apiUrl, this.currentProject).subscribe({
        next: () => {
          this.loadProjects();
          this.closeModal();
        },
        error: (err) => console.error('Failed to add project', err)
      });
    }
  }

  async deleteProject(id: number) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this project? This could break relations for associated users and devices.',
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
              next: () => this.loadProjects(),
              error: (err) => console.error('Failed to delete project', err)
            });
          }
        }
      ]
    });

    await alert.present();
  }
}

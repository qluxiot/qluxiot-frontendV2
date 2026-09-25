import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonFooter,
  IonButtons, IonButton, IonIcon, IonModal, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, saveOutline, locationOutline, searchOutline } from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-uc100-registry',
  templateUrl: './registry.page.html',
  styleUrls: ['./registry.page.scss'],
  standalone: true,
  imports: [
    CustomHeaderComponent,
    IonContent, IonHeader, IonTitle, IonToolbar, IonFooter,
    IonButtons, IonButton, IonIcon, IonModal,
    CommonModule, FormsModule
  ]
})
export class Uc100RegistryPage implements OnInit {
  @ViewChild('deviceModal') deviceModal: any;

  devices: any[] = [];
  filteredDevices: any[] = [];
  searchTerm: string = '';
  currentDevice: any = {};
  projects: any[] = [];
  selectedProjectId: number | null = null;
  isSaving = false;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;

  readonly API = `${environment.apiUrl}/api/uc100`;

  get isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return !user?.projectId;
  }

  get paginatedDevices(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredDevices.slice(start, start + this.pageSize);
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {
    addIcons({ closeOutline, saveOutline, locationOutline, searchOutline });
  }

  ngOnInit() { this.loadDevices(); this.loadProjects(); }
  ionViewWillEnter() { this.loadDevices(); }

  loadProjects() {
    this.http.get<any[]>(`${this.API}/projects`).subscribe({
      next: (data) => { this.projects = data; },
      error: (err) => console.error('Error loading projects', err)
    });
  }

  loadDevices() {
    const user = this.authService.getCurrentUser();
    let url = `${this.API}/devices`;
    const targetProjectId = this.isAdmin ? this.selectedProjectId : user?.projectId;
    if (targetProjectId) url += `?projectId=${targetProjectId}`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        this.filterDevices();
      },
      error: (err) => console.error('Error loading UC100 devices', err)
    });
  }

  onProjectFilterChange() {
    this.loadDevices();
  }

  filterDevices() {
    const q = this.searchTerm.toLowerCase().trim();
    this.filteredDevices = q
      ? this.devices.filter(d =>
          d.name?.toLowerCase().includes(q) ||
          d.dev_eui?.toLowerCase().includes(q) ||
          d.location_name?.toLowerCase().includes(q)
        )
      : [...this.devices];
    this.totalPages = Math.max(1, Math.ceil(this.filteredDevices.length / this.pageSize));
    this.currentPage = 1;
  }

  openEditModal(device: any) {
    this.currentDevice = {
      id: device.id,
      dev_eui: device.dev_eui,
      name: device.name,
      location_name: device.location_name,
      latitude: device.latitude,
      longitude: device.longitude,
      status: device.status,
      projectId: device.project?.id ?? null,
    };
    this.deviceModal.present();
  }

  closeModal() {
    this.deviceModal.dismiss();
  }

  getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentDevice.latitude = pos.coords.latitude;
          this.currentDevice.longitude = pos.coords.longitude;
        },
        () => console.warn('Geolocation denied')
      );
    }
  }

  async saveDevice() {
    if (!this.currentDevice.id) return;
    this.isSaving = true;
    this.http.put(`${this.API}/devices/${this.currentDevice.id}`, {
      name: this.currentDevice.name,
      location_name: this.currentDevice.location_name,
      latitude: this.currentDevice.latitude ? Number(this.currentDevice.latitude) : null,
      longitude: this.currentDevice.longitude ? Number(this.currentDevice.longitude) : null,
      status: this.currentDevice.status,
      projectId: this.currentDevice.projectId ? Number(this.currentDevice.projectId) : null,
    }).subscribe({
      next: async () => {
        this.isSaving = false;
        this.closeModal();
        this.loadDevices();
        const toast = await this.toastCtrl.create({ message: '✅ Device updated successfully!', color: 'success', duration: 3000 });
        toast.present();
      },
      error: async (err) => {
        this.isSaving = false;
        const toast = await this.toastCtrl.create({ message: `❌ Failed to save: ${err.error?.message || 'Unknown error'}`, color: 'danger', duration: 4000 });
        toast.present();
      }
    });
  }

  prevPage() { if (this.currentPage > 1) this.currentPage--; }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  changePageSize(event: any) {
    this.pageSize = Number(event.target.value);
    this.totalPages = Math.max(1, Math.ceil(this.filteredDevices.length / this.pageSize));
    this.currentPage = 1;
  }

  formatDate(ts: string | null): string {
    if (!ts) return '--';
    return new Date(ts).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

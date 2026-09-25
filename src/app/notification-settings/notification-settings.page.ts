import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, trashOutline, saveOutline, save, refreshOutline,
  closeOutline, close, checkmarkCircleOutline, timeOutline,
  logoWhatsapp, mailOutline, filterOutline, informationCircle, chevronDownOutline, phonePortraitOutline
} from 'ionicons/icons';
import { HttpClient } from '@angular/common/http';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.page.html',
  styleUrls: ['./notification-settings.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonModal,
    CommonModule, FormsModule, CustomHeaderComponent
  ]
})
export class NotificationSettingsPage implements OnInit {
  channels: any[] = [];
  isLoading = false;
  isModalOpen = false;
  isSaving = false;

  // The logged-in user's project (null = Admin)
  userProjectId: number | null = null;
  userProjectName: string = '';

  // For the admin project filter dropdown
  isSuperAdmin = false;
  projects: any[] = [];
  selectedProjectId: number | null = null;

  newChannel: any = {
    name: '',
    channel_type: 'whatsapp',
    channel_address: '',
    project_id: null
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    addIcons({
      addOutline, trashOutline, saveOutline, save, refreshOutline,
      closeOutline, close, checkmarkCircleOutline, timeOutline,
      logoWhatsapp, mailOutline, filterOutline, informationCircle, chevronDownOutline, phonePortraitOutline
    });
  }

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.userProjectId = user.projectId;
    this.userProjectName = user.projectName || '';
    this.isSuperAdmin = this.authService.isSuperAdmin();

    if (this.isSuperAdmin) {
      this.loadProjects();
    }
  }

  ionViewWillEnter() {
    // This runs every time the view is opened (hard refresh for the data)
    this.loadChannels();
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  handleRefresh(event: any) {
    this.loadChannels(() => event.target.complete());
  }

  loadProjects() {
    this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
      next: (data) => { this.projects = data; },
      error: (err) => console.error('Failed to load projects', err)
    });
  }

  onProjectFilterChange() {
    this.loadChannels();
  }

  loadChannels(callback?: () => void) {
    this.isLoading = true;

    // Normal users: backend auto-scopes by their JWT
    // Admin: can filter via selectedProjectId query param
    let url = `${environment.apiUrl}/api/notification-channels`;
    if (this.isSuperAdmin && this.selectedProjectId) {
      url += `?projectId=${this.selectedProjectId}`;
    }

    this.http.get(url).subscribe({
      next: (res: any) => {
        this.channels = res;
        this.isLoading = false;
        if (callback) callback();
      },
      error: (err: any) => {
        console.error('Failed to load channels', err);
        this.isLoading = false;
        if (callback) callback();
      }
    });
  }

  openModal() {
    this.newChannel = { name: '', channel_type: 'whatsapp', channel_address: '', project_id: this.selectedProjectId || null };
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  get channelAddressPlaceholder(): string {
    return this.newChannel.channel_type === 'email' ? 'example@email.com' : '+60123456789';
  }

  get channelAddressLabel(): string {
    return this.newChannel.channel_type === 'email' ? 'Email Address' : 'WhatsApp Number';
  }

  getVerificationRate(): number {
    if (!this.channels || this.channels.length === 0) return 0;
    const verified = this.channels.filter(c => c.is_verified).length;
    return Math.round((verified / this.channels.length) * 100);
  }

  getProjectName(projectId: number | null): string {
    if (!projectId) return 'Global';
    if (!this.isSuperAdmin) return this.userProjectName || 'Unknown Project';
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : `ID: ${projectId}`;
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  }

  addChannel() {
    if (!this.newChannel.name || !this.newChannel.channel_address) {
      this.showToast('Please fill in all required fields.');
      return;
    }

    if (this.newChannel.channel_type === 'whatsapp') {
      if (!this.newChannel.channel_address.startsWith('+60')) {
        this.showToast('WhatsApp number must start with +60');
        return;
      }
    } else if (this.newChannel.channel_type === 'email') {
      const email = this.newChannel.channel_address;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        this.showToast('Please enter a valid email address (e.g. user@domain.com)');
        return;
      }
    }

    this.isSaving = true;
    const payload: any = { ...this.newChannel };

    // Normal user: backend will enforce their project from JWT


    this.http.post(`${environment.apiUrl}/api/notification-channels`, payload).subscribe({
      next: (res: any) => {
        this.channels.unshift(res);
        this.isSaving = false;
        this.closeModal();
      },
      error: (err: any) => {
        console.error('Failed to add channel', err);
        const errorMsg = err.error?.message || 'Failed to add channel. Please try again.';
        this.showToast(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        this.isSaving = false;
      }
    });
  }

  toggleActive(channel: any) {
    const updatedStatus = !channel.is_active;
    this.http.put(`${environment.apiUrl}/api/notification-channels/${channel.id}`, { is_active: updatedStatus }).subscribe({
      next: () => channel.is_active = updatedStatus,
      error: (err: any) => console.error('Failed to update channel', err)
    });
  }

  deleteChannel(id: number) {
    if (confirm('Are you sure you want to delete this channel?')) {
      this.http.delete(`${environment.apiUrl}/api/notification-channels/${id}`).subscribe({
        next: () => {
          this.channels = this.channels.filter(c => c.id !== id);
        },
        error: (err: any) => console.error('Failed to delete channel', err)
      });
    }
  }
}

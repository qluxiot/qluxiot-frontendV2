import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  videocamOutline, videocamOffOutline, locationOutline,
  expandOutline, playCircleOutline, alertCircleOutline,
  shieldCheckmarkOutline, eyeOutline, timeOutline
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';

import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface CctvCamera {
  id: number;
  name: string;
  location: string;
  poleId: string;
  projectId?: number | null;
  projectName?: string;
  isOnline: boolean;
  resolution: string;
  fps: number;
  detectionEnabled: boolean;
  lastMotion: string;
  motionCount: number;
  recordingStatus: 'recording' | 'standby' | 'offline';
  thumbnailGradient: string;
  overlayColor: string;
  streamUrl?: string;
  safeStreamUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-cctv',
  templateUrl: './cctv.page.html',
  styleUrls: ['./cctv.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    CustomHeaderComponent
  ]
})
export class CctvPage implements OnInit, OnDestroy {

  projects: any[] = [];
  selectedProjectId: number | null = null;

  selectedFilter: 'all' | 'online' | 'offline' = 'all';
  viewMode: 'grid' | 'list' = 'grid';
  private tickInterval: any;
  currentTime: string = '';

  allCameras: CctvCamera[] = [];

  get isSuperAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    const role = user?.role?.toLowerCase().replace(/\s/g, '');
    return this.authService.isSuperAdmin() || role === 'superadmin';
  }

  get cameras(): CctvCamera[] {
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;

    // Super Admin with "All Projects"
    if (this.isSuperAdmin && targetProjectId === null) {
      return this.allCameras;
    }

    // If logged in as Qlux Device Admin (or project name is strictly Qlux Device), show Qlux devices
    if (this.authService.isQluxDeviceAdmin || user?.projectName?.toLowerCase().trim() === 'qlux device') {
      return this.allCameras.filter(c => c.projectName === 'Qlux Device' || !c.projectId);
    }

    // When a specific project is selected (Super Admin) or user belongs to a specific project
    if (targetProjectId !== null && targetProjectId !== undefined) {
      const proj = this.projects.find(p => p.id === targetProjectId);
      const projName = (proj ? proj.name : (user?.projectName || '')).toLowerCase().trim();

      return this.allCameras.filter(c => {
        // Match by projectId if assigned
        if (c.projectId !== undefined && c.projectId !== null) {
          return Number(c.projectId) === Number(targetProjectId);
        }
        // Match by projectName
        if (c.projectName && projName) {
          return c.projectName.toLowerCase().trim() === projName;
        }
        return false;
      });
    }

    return [];
  }

  get filteredCameras(): CctvCamera[] {
    if (this.selectedFilter === 'online') return this.cameras.filter(c => c.isOnline);
    if (this.selectedFilter === 'offline') return this.cameras.filter(c => !c.isOnline);
    return this.cameras;
  }

  get totalCameras(): number { return this.cameras.length; }
  get onlineCameras(): number { return this.cameras.filter(c => c.isOnline).length; }
  get offlineCameras(): number { return this.cameras.filter(c => !c.isOnline).length; }
  get recordingCameras(): number { return this.cameras.filter(c => c.recordingStatus === 'recording').length; }

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {
    addIcons({
      videocamOutline, videocamOffOutline, locationOutline,
      expandOutline, playCircleOutline, alertCircleOutline,
      shieldCheckmarkOutline, eyeOutline, timeOutline
    });
  }

  ngOnInit() {
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 1000);
    this.loadProjects();
    this.loadCameras();
  }

  loadProjects() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; },
        error: (err) => console.error('Error loading projects', err)
      });
    }
  }

  onProjectFilterChange() {
    // Project filter changed by Super Admin
  }

  loadCameras() {
    this.http.get<CctvCamera[]>(`${environment.apiUrl}/cctv/cameras`).subscribe({
      next: (data) => {
        this.allCameras = data.map(cam => {
          if (cam.streamUrl) {
            cam.safeStreamUrl = this.sanitizer.bypassSecurityTrustResourceUrl(cam.streamUrl);
          }
          return cam;
        });
      },
      error: (error) => {
        console.error('Failed to load CCTV cameras:', error);
      }
    });
  }

  ngOnDestroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private tick() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  getRecordingBadgeClass(status: string): string {
    return {
      recording: 'badge-recording',
      standby: 'badge-standby',
      offline: 'badge-offline'
    }[status] || 'badge-offline';
  }

  getRecordingLabel(status: string): string {
    return {
      recording: '● REC',
      standby: '⏸ STANDBY',
      offline: '✕ OFFLINE'
    }[status] || '✕ OFFLINE';
  }
}

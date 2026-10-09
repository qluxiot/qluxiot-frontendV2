import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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

export interface CctvCamera {
  id: number;
  name: string;
  location: string;
  poleId: string;
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
    IonContent,
    IonIcon,
    CustomHeaderComponent
  ]
})
export class CctvPage implements OnInit, OnDestroy {

  selectedFilter: 'all' | 'online' | 'offline' = 'all';
  viewMode: 'grid' | 'list' = 'grid';
  private tickInterval: any;
  currentTime: string = '';

  cameras: CctvCamera[] = [];

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
    private sanitizer: DomSanitizer
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
    this.loadCameras();
  }

  loadCameras() {
    this.http.get<CctvCamera[]>(`${environment.apiUrl}/cctv/cameras`).subscribe({
      next: (data) => {
        this.cameras = data.map(cam => {
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

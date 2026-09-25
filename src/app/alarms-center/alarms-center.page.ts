import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  ViewWillEnter
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-alarms-center',
  templateUrl: './alarms-center.page.html',
  styleUrls: ['./alarms-center.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    CommonModule,
    FormsModule,
    CustomHeaderComponent,
    DatePipe
  ]
})
export class AlarmsCenterPage implements OnInit, ViewWillEnter {
  alarms: any[] = [];
  pageNumber: number = 1;
  pageSize: number = 50;
  totalRow: number = 0;
  isLoading = false;
  deviceType: string = '';

  projects: any[] = [];
  selectedProjectId: number | null = null;
  get isAdmin(): boolean { return this.authService.isAdmin(); }
  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin(); }

  constructor(
    private http: HttpClient, 
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; }
      });
    }
  }

  onProjectFilterChange() {
    this.pageNumber = 1;
    this.loadAlarms();
  }

  ionViewWillEnter() {
    const url = this.router.url;
    if (url.includes('smart-solar')) {
      this.deviceType = 'solar';
    } else if (url.includes('smart-led')) {
      this.deviceType = 'led';
    } else {
      this.deviceType = '';
    }
    this.loadAlarms();
  }

  handleRefresh(event: any) {
    this.loadAlarms(() => {
      event.target.complete();
    });
  }

  loadAlarms(callback?: () => void) {
    this.isLoading = true;
    let endpoint = `/api/alarms?pageNumber=${this.pageNumber}&pageSize=${this.pageSize}`;
    if (this.deviceType) {
      endpoint += `&deviceType=${this.deviceType}`;
    }

    const user = this.authService.getCurrentUser();
    const projectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (projectId) {
      endpoint += `&projectId=${projectId}`;
    }
    
    this.http.get(`${environment.apiUrl}${endpoint}`).subscribe({
      next: (res: any) => {
        if (res.code === 10000) {
          this.alarms = res.data.list;
          this.totalRow = res.data.totalRow;
        }
        this.isLoading = false;
        if (callback) callback();
      },
      error: (err: any) => {
        console.error('Failed to load alarms', err);
        this.isLoading = false;
        if (callback) callback();
      }
    });
  }

  resolveAlarm(id: number) {
    this.http.put(`${environment.apiUrl}/api/alarms/${id}/handle`, {}).subscribe({
      next: () => {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
          alarm.is_handle = 1;
        }
      },
      error: (err: any) => {
        console.error('Failed to resolve alarm', err);
      }
    });
  }
}

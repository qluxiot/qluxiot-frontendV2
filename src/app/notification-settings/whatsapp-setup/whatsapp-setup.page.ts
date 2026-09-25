import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import {
  IonContent, IonButton, IonIcon, IonCard, IonCardContent,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  logoWhatsapp, checkmarkCircleOutline, closeCircleOutline,
  refreshOutline, trashOutline, qrCodeOutline
} from 'ionicons/icons';

interface WhatsappStatus {
  connected: boolean;
  authenticated: boolean;
  needsQR: boolean;
  number: string | null;
}

interface WhatsappQR {
  qr: string | null;
  qrDataUri: string | null;
}

@Component({
  selector: 'app-whatsapp-setup',
  templateUrl: './whatsapp-setup.page.html',
  styleUrls: ['./whatsapp-setup.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CustomHeaderComponent,
    IonContent, IonIcon, IonSpinner
  ]
})
export class WhatsappSetupPage implements OnInit, OnDestroy {
  private readonly baseUrl = `${environment.apiUrl}/notification-setup/whatsapp`;

  status: WhatsappStatus = { connected: false, authenticated: false, needsQR: false, number: null };
  qrDataUri: string | null = null;
  isActionLoading = false;

  private pollSub: Subscription | null = null;

  constructor(
    private http: HttpClient, 
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {
    addIcons({ logoWhatsapp, checkmarkCircleOutline, closeCircleOutline, refreshOutline, trashOutline, qrCodeOutline });
  }

  ngOnInit() {
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.fetchStatus();
    this.pollSub = interval(3000).pipe(
      switchMap(() => this.http.get<WhatsappStatus>(`${this.baseUrl}/status`))
    ).subscribe({
      next: (s) => {
        this.status = s;
        if (s.needsQR) {
          this.fetchQR();
        } else {
          this.qrDataUri = null;
        }
      },
      error: () => {}
    });
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  fetchStatus() {
    this.http.get<WhatsappStatus>(`${this.baseUrl}/status`).subscribe({
      next: (s) => {
        this.status = s;
        if (s.needsQR) this.fetchQR();
      },
      error: () => {}
    });
  }

  fetchQR() {
    this.http.get<WhatsappQR>(`${this.baseUrl}/qr`).subscribe({
      next: (r) => { 
        if (r.qrDataUri) {
          this.qrDataUri = this.sanitizer.bypassSecurityTrustUrl(r.qrDataUri) as string; 
        } else {
          this.qrDataUri = null;
        }
      }
    });
  }

  refreshQR() {
    this.isActionLoading = true;
    this.http.post(`${this.baseUrl}/refresh-qr`, {}).subscribe({
      next: () => { this.isActionLoading = false; this.qrDataUri = null; },
      error: () => { this.isActionLoading = false; }
    });
  }

  resetConnection() {
    this.isActionLoading = true;
    this.http.post(`${this.baseUrl}/reset`, {}).subscribe({
      next: () => { this.isActionLoading = false; this.qrDataUri = null; },
      error: () => { this.isActionLoading = false; }
    });
  }

  logout() {
    this.isActionLoading = true;
    this.http.post(`${this.baseUrl}/logout`, {}).subscribe({
      next: () => { this.isActionLoading = false; },
      error: () => { this.isActionLoading = false; }
    });
  }

  get canManage(): boolean {
    return this.authService.hasPermission('NOTIFICATION_SETUP.WHATSAPP_MANAGE');
  }

  get connectedNumberClean(): string {
    if (!this.status.number) return '';
    return this.status.number.split(':')[0] + '@whatsapp';
  }
}

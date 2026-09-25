import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonSpinner, IonFooter, ModalController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, addOutline, trashOutline, saveOutline, createOutline } from 'ionicons/icons';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-manage-schedules-modal',
  templateUrl: './manage-schedules-modal.component.html',
  styleUrls: ['./manage-schedules-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons,
    IonContent, IonSpinner, IonFooter
  ]
})
export class ManageSchedulesModalComponent implements OnInit {
  @Input() moduleType!: 'solar' | 'led';

  schedules: any[] = [];
  isLoading = true;

  // For Creating/Editing
  isEditing = false;
  currentSchedule: any = {
    id: null,
    name: '',
    rules: []
  };

  constructor(
    private modalCtrl: ModalController,
    private http: HttpClient,
    private toastController: ToastController
  ) {
    addIcons({ closeOutline, addOutline, trashOutline, saveOutline, createOutline });
  }

  ngOnInit() {
    this.loadSchedules();
  }

  get isSolar(): boolean {
    return this.moduleType === 'solar';
  }

  get apiUrl() {
    return `${environment.apiUrl}/api/${this.moduleType}/schedules`;
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, color, duration: 2000, position: 'top' });
    toast.present();
  }

  loadSchedules() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.schedules = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading schedules', err);
        this.showToast('Failed to load schedules.', 'danger');
        this.isLoading = false;
      }
    });
  }

  startNewSchedule() {
    this.isEditing = true;
    if (this.isSolar) {
      // Solar: duration-based phases (hours since sunset + brightness)
      this.currentSchedule = {
        id: null,
        name: 'Solar Night Mode',
        rules: [
          { hours: 4, brightness: 100 },
          { hours: 2, brightness: 60 },
          { hours: 6, brightness: 40 },
        ]
      };
    } else {
      // LED: time-based rules (clock time + action + brightness)
      this.currentSchedule = {
        id: null,
        name: 'Standard Night Mode',
        rules: [
          { time: '19:00', action: 'ON', brightness: 100 },
          { time: '23:00', action: 'DIM', brightness: 60 },
          { time: '01:00', action: 'DIM', brightness: 40 },
          { time: '07:00', action: 'OFF', brightness: null }
        ]
      };
    }
  }

  editSchedule(schedule: any) {
    this.isEditing = true;
    this.currentSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
    if (!this.currentSchedule.rules) this.currentSchedule.rules = [];
  }

  cancelEdit() {
    this.isEditing = false;
  }

  addRule() {
    if (this.isSolar) {
      this.currentSchedule.rules.push({ hours: 2, brightness: 50 });
    } else {
      this.currentSchedule.rules.push({ time: '00:00', action: 'DIM', brightness: 50 });
    }
  }

  removeRule(index: number) {
    this.currentSchedule.rules.splice(index, 1);
  }

  saveSchedule() {
    if (!this.currentSchedule.name) {
      this.showToast('Please provide a name for the schedule.', 'danger');
      return;
    }

    // Validate rules
    for (const rule of this.currentSchedule.rules) {
      if (this.isSolar) {
        if (!rule.hours || rule.hours < 0.5 || rule.hours > 12) {
          this.showToast('Each phase must have a valid duration (0.5 to 12 hours).', 'danger');
          return;
        }
        if (rule.brightness === null || rule.brightness === undefined || rule.brightness < 1 || rule.brightness > 100) {
          this.showToast('Each phase must have a brightness between 1% and 100%.', 'danger');
          return;
        }
      } else {
        if (!rule.time) {
          this.showToast('Each stage must have a valid time.', 'danger');
          return;
        }
      }
    }

    if (this.currentSchedule.id) {
      // UPDATE
      this.http.put(`${this.apiUrl}/${this.currentSchedule.id}`, this.currentSchedule).subscribe({
        next: () => {
          this.showToast('Schedule updated!', 'success');
          this.isEditing = false;
          this.loadSchedules();
        },
        error: () => this.showToast('Failed to update schedule.', 'danger')
      });
    } else {
      // CREATE
      this.http.post(this.apiUrl, this.currentSchedule).subscribe({
        next: () => {
          this.showToast('Schedule created!', 'success');
          this.isEditing = false;
          this.loadSchedules();
        },
        error: () => this.showToast('Failed to create schedule.', 'danger')
      });
    }
  }

  deleteSchedule(id: number) {
    if (confirm('Are you sure you want to delete this schedule? Devices using it will be cleared.')) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe({
        next: () => {
          this.showToast('Schedule deleted.', 'success');
          this.loadSchedules();
        },
        error: () => this.showToast('Failed to delete schedule.', 'danger')
      });
    }
  }
}

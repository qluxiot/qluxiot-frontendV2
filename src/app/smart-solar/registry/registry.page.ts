import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonFooter, IonButtons, IonButton, IonIcon, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, createOutline, trashOutline, closeOutline, saveOutline,
  locationOutline, searchOutline, wifiOutline, cellularOutline,
  downloadOutline, cloudUploadOutline, checkmarkCircleOutline, alertCircleOutline
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export const DEVICE_TYPES = [
  { value: 'Zhaga4G',   label: 'Zhaga 4G' },
  { value: 'ZhagaLora', label: 'Zhaga LoRa' },
  { value: 'Gateway',   label: 'Gateway (LoRa)' },
];

@Component({
  selector: 'app-solar-registry',
  templateUrl: './registry.page.html',
  styleUrls: ['./registry.page.scss'],
  standalone: true,
  imports: [
    CustomHeaderComponent,
    IonContent, IonHeader, IonTitle, IonToolbar, IonFooter, IonButtons, IonButton, IonIcon, IonModal,
    CommonModule, FormsModule
  ]
})
export class SolarRegistryPage implements OnInit {
  @ViewChild('deviceModal') deviceModal: any;
  @ViewChild('bulkFileInput') bulkFileInput: any;

  devices: any[] = [];
  filteredDevices: any[] = [];
  searchTerm: string = '';
  isEditing = false;
  currentDevice: any = {};
  projects: any[] = [];
  selectedProjectId: number | null = null;
  gateways: any[] = [];

  // Bulk import state
  importProgress: { total: number; done: number; errors: string[] } | null = null;

  // Pagination state
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;

  readonly deviceTypes = DEVICE_TYPES;

  get isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return !user?.projectId; // null projectId = Admin
  }

  constructor(private http: HttpClient, private authService: AuthService) {
    addIcons({ addOutline, createOutline, trashOutline, closeOutline, saveOutline, locationOutline, searchOutline, wifiOutline, cellularOutline, downloadOutline, cloudUploadOutline, checkmarkCircleOutline, alertCircleOutline });
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  isGateway(device: any): boolean {
    return device?.device_type === 'Gateway';
  }

  getDeviceTypeLabel(value: string): string {
    return DEVICE_TYPES.find(t => t.value === value)?.label ?? value ?? 'Zhaga 4G';
  }

  ngOnInit() { this.loadDevices(); this.loadProjects(); }

  ionViewWillEnter() {
    this.loadDevices();
  }

  loadProjects() {
    if (this.isAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; },
        error: (err) => console.error('Error loading projects', err)
      });
    }
  }

  loadDevices() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/solar/devices`;
    const targetProjectId = this.isAdmin ? this.selectedProjectId : user.projectId;
    
    if (targetProjectId) {
      url += `?projectId=${targetProjectId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => { 
        this.devices = data; 
        this.gateways = this.devices.filter(d => d.device_type === 'Gateway' && d.status === 'Active');
        this.filterDevices(); 
      },
      error: (err) => console.error('Error fetching Solar devices', err)
    });
  }

  onProjectFilterChange() {
    this.loadDevices();
  }

  defaultDevice() {
    const user = this.authService.getCurrentUser();
    return {
      serial: '',
      name: '',
      device_type: 'Zhaga4G',
      status: 'Active',
      latitude: 0,
      longitude: 0,
      projectId: user?.projectId ?? null,
      gateway_serial: null
    };
  }

  getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentDevice.latitude = position.coords.latitude;
          this.currentDevice.longitude = position.coords.longitude;
        },
        (error) => {
          console.error('Error getting location', error);
          alert('Unable to get your location. Please ensure location services are enabled.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  filterDevices() {
    if (!this.searchTerm) {
      this.filteredDevices = [...this.devices];
    } else {
      const lower = this.searchTerm.toLowerCase();
      this.filteredDevices = this.devices.filter(d => 
        (d.serial && d.serial.toLowerCase().includes(lower)) ||
        (d.name && d.name.toLowerCase().includes(lower))
      );
    }
    
    // Pagination logic
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  calculateTotalPages() {
    this.totalPages = Math.ceil(this.filteredDevices.length / this.pageSize) || 1;
  }

  get paginatedDevices() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredDevices.slice(startIndex, startIndex + Number(this.pageSize));
  }

  changePageSize(event: any) {
    this.pageSize = event.target.value;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  openAddModal() {
    this.isEditing = false;
    this.currentDevice = this.defaultDevice();
    this.deviceModal.present();
  }

  openEditModal(device: any) {
    this.isEditing = true;
    this.currentDevice = { ...device, projectId: device.project?.id ?? null };
    this.deviceModal.present();
  }

  closeModal() {
    this.deviceModal.dismiss();
  }

  async saveDevice() {
    if (!this.currentDevice.serial || !this.currentDevice.name) {
      alert('Serial and Name are required.');
      return;
    }

    try {
      if (this.isEditing) {
        await this.http.put(`${environment.apiUrl}/api/solar/devices/${this.currentDevice.id}`, this.currentDevice).toPromise();
      } else {
        await this.http.post(`${environment.apiUrl}/api/solar/devices`, this.currentDevice).toPromise();
      }
      
      // Perform gateway binding if ZhagaLora and gateway is selected
      if (this.currentDevice.device_type === 'ZhagaLora' && this.currentDevice.gateway_serial) {
        await this.http.post(`${environment.apiUrl}/api/solar/devices/${this.currentDevice.serial}/bind-gateway`, {
          gatewaySerial: this.currentDevice.gateway_serial,
          action: 'add'
        }).toPromise();
      }
      
      this.loadDevices();
      this.closeModal();
    } catch (err) {
      console.error('Error saving device', err);
      alert('Error saving device. Please check the console.');
    }
  }

  deleteDevice(id: number) {
    if(confirm('Are you sure you want to delete this device? This will unbind it from Nengjia Cloud.')) {
      this.http.delete(`${environment.apiUrl}/api/solar/devices/${id}`).subscribe({
        next: () => this.loadDevices(),
        error: (err) => console.error('Error deleting device', err)
      });
    }
  }

  // ── Bulk Import ──────────────────────────────────────────────
  readonly VALID_DEVICE_TYPES = ['Zhaga4G', 'ZhagaLora', 'Nema4G', 'NemaLora', 'Gateway'];

  downloadTemplate() {
    const headers = ['Device Type', 'Device Name', 'Serial Number', 'Gateway Serial'];
    const sample1 = ['Zhaga4G', 'Solar Light A1', 'njAwHuI2lWOBWKXO2025050830838704', ''];
    const sample2 = ['ZhagaLora', 'Solar Light A2', 'njAwHuI2lWOBWKXO2025050830838705', 'GATEWAY-002'];
    const sample3 = ['Gateway', 'Solar Gateway', 'GATEWAY-002', ''];
    
    const csv = [headers.join(','), sample1.join(','), sample2.join(','), sample3.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solar_device_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerFileInput() {
    this.bulkFileInput.nativeElement.click();
  }

  async handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = ''; // reset so same file can be re-selected

    const text = await file.text();
    // Strip empty lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { alert('The file appears to be empty or only contains headers.'); return; }

    const headers = lines[0].split(',').map(h => h.trim());
    const typeIdx   = headers.findIndex(h => h.toLowerCase().includes('type'));
    const nameIdx   = headers.findIndex(h => h.toLowerCase().includes('name'));
    const serialIdx = headers.findIndex(h => h.toLowerCase().includes('serial'));
    const gatewayIdx = headers.findIndex(h => h.toLowerCase().includes('gateway'));

    if (nameIdx === -1 || serialIdx === -1 || typeIdx === -1) {
      alert('Could not find required columns. Please use the downloaded template.');
      return;
    }

    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      return {
        device_type: cols[typeIdx]   || 'Zhaga4G',
        name:        cols[nameIdx]   || '',
        serial:      cols[serialIdx] || '',
        gateway_serial: gatewayIdx !== -1 ? cols[gatewayIdx] : null,
        latitude:    0,
        longitude:   0,
        projectId:   this.authService.getCurrentUser()?.projectId ?? null
      };
    }).filter(r => r.serial && r.name);

    if (rows.length === 0) { alert('No valid device rows found in the file.'); return; }

    this.importProgress = { total: rows.length, done: 0, errors: [] };

    for (const row of rows) {
      try {
        await this.http.post(`${environment.apiUrl}/api/solar/devices`, row).toPromise();
        
        // Bind Gateway if ZhagaLora
        if (row.device_type === 'ZhagaLora' && row.gateway_serial) {
          await this.http.post(`${environment.apiUrl}/api/solar/devices/${row.serial}/bind-gateway`, {
            gatewaySerial: row.gateway_serial,
            action: 'add'
          }).toPromise();
        }

        this.importProgress.done++;
      } catch (err: any) {
        this.importProgress.errors.push(`${row.serial}: ${err?.error?.message || 'Failed'}`);
        this.importProgress.done++;
      }
    }

    this.loadDevices();

    const { errors, total } = this.importProgress;
    const ok = total - errors.length;
    if (errors.length === 0) {
      alert(`✅ Import complete! ${ok} of ${total} devices registered successfully.`);
    } else {
      alert(`⚠️ Import done. ${ok} of ${total} succeeded.\nFailed:\n${errors.join('\n')}`);
    }
    this.importProgress = null;
  }
}

import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';

import * as L from 'leaflet';
import { addIcons } from 'ionicons';
import { hardwareChipOutline, locationOutline, alertCircleOutline } from 'ionicons/icons';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    CustomHeaderComponent
  ],
})
export class HomePage implements OnInit, AfterViewInit {
  map: L.Map | undefined;
  devices: any[] = [];
  locatedDevicesCount = 0;
  
  projects: any[] = [];
  selectedProjectId: number | null = null;
  markers: L.Marker[] = [];

  get isSuperAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return !user?.projectId;
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ hardwareChipOutline, locationOutline, alertCircleOutline });
  }

  ngOnInit() {
    this.loadProjects();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
      this.fetchDevices();
    }, 200);
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
    this.fetchDevices();
  }

  initMap() {
    // Default center (Malaysia coordinates as placeholder)
    this.map = L.map('map').setView([4.2105, 101.9758], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Use a custom SVG icon for markers so we don't need external image assets
    const svgIcon = L.divIcon({
      html: `
        <div style="background-color: #1b2b3a; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="background-color: #2dd36f; width: 8px; height: 8px; border-radius: 50%;"></div>
        </div>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
    L.Marker.prototype.options.icon = svgIcon;

    // Force Leaflet to recalculate map size after Ionic finishes layout
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 500);
  }

  fetchDevices() {
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    const query = targetProjectId ? `?projectId=${targetProjectId}` : '';
    let isBertamTargeted = false;
    
    if (this.isSuperAdmin) {
      // Super Admin: check if the selected project drop-down is MBSP/Bertam, or if "All Projects" is selected (targetProjectId is null)
      const bertamProject = this.projects.find(p => 
        p.name?.toLowerCase().includes('bertam') || 
        p.name?.toLowerCase().includes('isurian') ||
        p.name?.toLowerCase().includes('mbsp')
      );
      isBertamTargeted = !targetProjectId || !!(bertamProject && targetProjectId === bertamProject.id);
    } else {
      // Normal User: check their assigned project name from auth token
      const projectName = user?.projectName?.toLowerCase() || '';
      isBertamTargeted = projectName.includes('bertam') || projectName.includes('isurian') || projectName.includes('mbsp');
    }

    const requests: any = {
      solar: this.http.get<any[]>(`${environment.apiUrl}/api/solar/devices${query}`),
      led: this.http.get<any[]>(`${environment.apiUrl}/api/led/devices${query}`)
    };

    if (isBertamTargeted) {
      requests.bertam = this.http.get<any[]>(`${environment.apiUrl}/api/bertam/devices${query}`);
    }

    forkJoin(requests).subscribe({
      next: (res: any) => {
        const solar = res.solar.map((d: any) => ({ ...d, moduleType: 'Solar' }));
        const led = res.led.map((d: any) => ({ ...d, moduleType: 'LED' }));
        const bertam = res.bertam ? res.bertam.map((d: any) => ({ ...d, moduleType: 'Bertam' })) : [];
        this.devices = [...solar, ...led, ...bertam];
        this.addMarkers();
      },
      error: (error) => {
        console.error('Failed to fetch devices for global map:', error);
      }
    });
  }

  addMarkers() {
    if (!this.map) return;
    
    // Clear old markers
    this.markers.forEach(m => m.remove());
    this.markers = [];
    
    let bounds = new L.LatLngBounds([]);
    this.locatedDevicesCount = 0;

    const gatewayIcon = L.divIcon({
      className: 'custom-gateway-marker',
      html: `<div style="background-color: #8b5cf6; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">G</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    this.devices.forEach(device => {
      const lat = Number(device.latitude);
      const lng = Number(device.longitude);
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        this.locatedDevicesCount++;
        const markerOptions = device.device_type === 'Gateway' ? { icon: gatewayIcon } : {};
        const marker = L.marker([lat, lng], markerOptions).addTo(this.map!);
        
        const isOnline = device.is_online !== undefined ? device.is_online : (device.status === 'Active');
        
        let extraInfo = '';
        if (device.moduleType === 'Solar') {
           extraInfo = `
             <div>🔋 Battery: <b>${device.battery_percent ?? '--'}%</b></div>
           `;
        } else if (device.moduleType === 'Bertam') {
           extraInfo = `
             <div>🔋 Battery: <b>${device.battery_percent ?? '--'}%</b></div>
             <div>💡 Brightness: <b>${device.brightness_code === 58368 || device.brightness_code === 100 ? '100%' : (device.brightness_code === 48128 || device.brightness_code === 60 ? '60%' : (device.brightness_code === 43008 || device.brightness_code === 40 ? '40%' : (device.brightness_code === 0 ? '0%' : '--')))}</b></div>
           `;
        } else {
           extraInfo = `
             <div>💡 Brightness: <b>${device.device_type === 'Gateway' ? '--' : (device.brightness ?? '--')}%</b></div>
           `;
        }
        
        const popupContent = `
          <div style="font-family: inherit;">
            <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
               <h4 style="margin: 0; font-weight: 600; color: #0f172a; font-size: 14px;">${device.name || device.serial}</h4>
               <span style="background: ${device.moduleType === 'Solar' ? '#f59e0b' : '#3b82f6'}; color:white; padding: 2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">${device.moduleType}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 13px;">
               <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${isOnline ? '#10b981' : '#ef4444'};"></span>
               <span>${isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div style="font-size: 13px;">
              ${extraInfo}
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        this.markers.push(marker);
        bounds.extend([device.latitude, device.longitude]);
      }
    });

    if (this.locatedDevicesCount > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

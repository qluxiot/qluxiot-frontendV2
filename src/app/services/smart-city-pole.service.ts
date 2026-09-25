import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SmartCityPoleService {
  private apiUrl = `${environment.apiUrl}/api/smart-city-pole`;

  constructor(private http: HttpClient) {}

  // Poles
  getPoles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/poles`);
  }
  getPole(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/poles/${id}`);
  }
  createPole(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/poles`, data);
  }
  updatePole(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/poles/${id}`, data);
  }
  deletePole(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/poles/${id}`);
  }

  // Components
  getComponents(): Observable<any> {
    return this.http.get(`${this.apiUrl}/components`);
  }
  getComponent(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/components/${id}`);
  }
  getComponentsByPoleId(poleId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/components/pole/${poleId}`);
  }
  createComponent(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/components`, data);
  }
  updateComponent(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/components/${id}`, data);
  }
  deleteComponent(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/components/${id}`);
  }

  // Alarms
  getAlarms(): Observable<any> {
    return this.http.get(`${this.apiUrl}/alarms`);
  }
  getAlarm(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alarms/${id}`);
  }
  getAlarmsByPoleId(poleId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/alarms/pole/${poleId}`);
  }
  createAlarm(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alarms`, data);
  }
  updateAlarm(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/alarms/${id}`, data);
  }
  deleteAlarm(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/alarms/${id}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedInStream: Observable<boolean> = this.isLoggedInSubject.asObservable();

  private usernameSubject = new BehaviorSubject<string | null>(localStorage.getItem('username'));
  public usernameStream: Observable<string | null> = this.usernameSubject.asObservable();

  private nameSubject = new BehaviorSubject<string | null>(localStorage.getItem('name'));
  public nameStream: Observable<string | null> = this.nameSubject.asObservable();

  private permissionsSubject = new BehaviorSubject<string[]>(this.getStoredPermissions());
  public permissionsStream: Observable<string[]> = this.permissionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  private getStoredPermissions(): string[] {
    const perms = localStorage.getItem('permissions');
    try {
      return perms ? JSON.parse(perms) : [];
    } catch {
      return [];
    }
  }

  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap(response => {
        if (response && response.success && response.data) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('username', response.data.username);
          if (response.data.name) {
            localStorage.setItem('name', response.data.name);
          } else {
            localStorage.removeItem('name');
          }
          localStorage.setItem('role', response.data.role || '');
          localStorage.setItem('permissions', JSON.stringify(response.data.permissions || []));
          localStorage.setItem('projectId', response.data.projectId != null ? String(response.data.projectId) : '');
          localStorage.setItem('projectName', response.data.projectName || '');
          this.isLoggedInSubject.next(true);
          this.usernameSubject.next(response.data.username);
          this.nameSubject.next(response.data.name || null);
          this.permissionsSubject.next(response.data.permissions || []);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('name');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    localStorage.removeItem('projectId');
    localStorage.removeItem('projectName');
    this.isLoggedInSubject.next(false);
    this.usernameSubject.next(null);
    this.nameSubject.next(null);
    this.permissionsSubject.next([]);
  }

  getUsername(): string | null {
    return this.usernameSubject.value;
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  getCurrentUser(): { username: string | null; role: string | null; projectId: number | null; projectName: string | null } {
    const projectIdStr = localStorage.getItem('projectId');
    return {
      username: localStorage.getItem('username'),
      role: localStorage.getItem('role'),
      projectId: projectIdStr ? parseInt(projectIdStr, 10) : null,
      projectName: localStorage.getItem('projectName'),
    };
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user.role?.toLowerCase() === 'admin' || user.projectId === null; // Admin access if role is admin or no project is assigned
  }

  isSuperAdmin(): boolean {
    const user = this.getCurrentUser();
    return user.projectId === null;
  }

  hasPermission(permission: string): boolean {
    return this.permissionsSubject.value.includes(permission);
  }

  get isMbsAdmin(): boolean {
    const username = this.getUsername();
    const name = localStorage.getItem('name');
    
    const isMatch = 
      (username && username.toLowerCase().trim() === 'mbs123456') || 
      (name && name.toLowerCase().trim() === 'majlis bandaraya seremban');
      
    return !!isMatch;
  }

  get isJkrShAdmin(): boolean {
    const username = this.getUsername();
    const name = localStorage.getItem('name');
    
    const isMatch = 
      (username && username.toLowerCase().trim() === 'jkrshadmin') || 
      (name && name.toLowerCase().trim() === 'jkr suria heights admin');
      
    return !!isMatch;
  }

  get isJohorPortAdmin(): boolean {
    const username = this.getUsername();
    const name = localStorage.getItem('name');
    
    const isMatch = 
      (username && username.toLowerCase().trim() === 'johorport') || 
      (name && name.toLowerCase().trim() === 'johorport');
      
    return !!isMatch;
  }

  readonly MBS_CLONE_MAPPING: { [key: string]: { name: string; serial: string } } = {
    'njLF5KOf8OuAT0Rm2025050817810531': { name: '2. Solar S1', serial: 'njpyH3OcPzON6UA22025050832921133' }
  };
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonitoringPage } from './monitoring.page';

describe('MonitoringPage', () => {
  let component: MonitoringPage;
  let fixture: ComponentFixture<MonitoringPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MonitoringPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

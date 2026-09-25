import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlarmsCenterPage } from './alarms-center.page';

describe('AlarmsCenterPage', () => {
  let component: AlarmsCenterPage;
  let fixture: ComponentFixture<AlarmsCenterPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AlarmsCenterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

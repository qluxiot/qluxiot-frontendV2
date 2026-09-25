import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistryPage } from './registry.page';

describe('RegistryPage', () => {
  let component: RegistryPage;
  let fixture: ComponentFixture<RegistryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

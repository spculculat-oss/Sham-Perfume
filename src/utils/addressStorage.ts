import { UserDetailedAddress } from '../types/address';

export const USER_ADDRESS_STORAGE_KEY = 'sham_perfume_user_detailed_address';

export const DEFAULT_DETAILED_ADDRESS: UserDetailedAddress = {
  facilityName: 'معمل ومختبر الشام للعطور الفاخرة',
  facilityType: 'boutique',
  countryCode: 'SA',
  countryNameAr: 'المملكة العربية السعودية',
  countryNameEn: 'Saudi Arabia',
  cityName: 'الرياض',
  districtName: 'حي العليا - شارع التحلية',
  streetAddress: 'مبنى أروما بلازا، الطابق 2، معمل رقم 204',
  postalCode: '12211',
  taxOrCommercialId: 'CR-1010884920',
  phone: '+966 50 123 4567',
  email: 'lab@shamperfumes.com',
};

export function loadDetailedAddress(): UserDetailedAddress {
  try {
    const raw = localStorage.getItem(USER_ADDRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.facilityName) {
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_DETAILED_ADDRESS;
}

export function saveDetailedAddress(address: UserDetailedAddress): void {
  try {
    localStorage.setItem(USER_ADDRESS_STORAGE_KEY, JSON.stringify(address));
  } catch (e) {}
}

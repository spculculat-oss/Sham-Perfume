export type FacilityType = 'home_studio' | 'boutique' | 'industrial_lab' | 'consultancy';

export interface UserDetailedAddress {
  facilityName: string;
  facilityType: FacilityType;
  countryCode: string;
  countryNameAr?: string;
  countryNameEn?: string;
  cityName: string;
  districtName: string;
  streetAddress: string;
  postalCode: string;
  taxOrCommercialId: string;
  phone: string;
  email: string;

  // Convenience aliases for various components
  labOrFacilityName?: string;
  city?: string;
  district?: string;
  street?: string;
  phoneNumber?: string;
  additionalNotes?: string;
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, { ar: string; en: string }> = {
  home_studio: { ar: 'مختبر منزلي / هاوي حرفي', en: 'Artisan Home Studio' },
  boutique: { ar: 'متجر عطور وبوتيك حرفي', en: 'Perfume Boutique' },
  industrial_lab: { ar: 'معمل ومصنع تصنيع معتمد', en: 'Industrial Manufacturing Lab' },
  consultancy: { ar: 'دار استشارات وتصميم عطور', en: 'Perfume Design Consultancy' },
};

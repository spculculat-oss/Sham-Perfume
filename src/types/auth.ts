export type CraftLevel = 'hobbyist' | 'perfumer' | 'master_lab';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  craftLevel: CraftLevel;
  createdAt: string;
  countryCode?: string;
  regionId?: string;
  facilityName?: string;
  craftLevelLabelAr?: string;
  savedFormulasCount?: number;
}

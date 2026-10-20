export const DESIGN_SPECIALTIES = [
  'brand_strategy',
  'brand_guidelines',
  'visual_identity',
  'graphic_design',
  'advertising_creative',
  'social_media',
  'web_design',
  'ui_ux',
  'mobile_app',
  'ecommerce_conversion',
  'design_systems',
  'packaging_label',
  'product_photography',
  'art_direction',
  'motion_video',
  'illustration',
  '3d_visualization',
  'editorial_print',
  'presentation',
  'infographics',
  'typography',
  'accessibility',
  'rtl_localization',
  'service_design',
  'retail_environment',
  'email_content',
  'design_audit',
  'industrial_product',
  'interior_spatial',
  'architecture_design',
  'landscape_design',
  'exhibition_event',
  'fashion_textile',
  'game_design',
  'immersive_ar_vr',
  'wayfinding_signage',
  'instructional_design',
  'user_research',
  'sound_design',
  'custom',
] as const;
export type DesignSpecialty = (typeof DESIGN_SPECIALTIES)[number];

/** Output surfaces span digital, physical, spatial and motion work; custom keeps the expert open-ended. */
export const DESIGN_PLATFORMS = [
  'instagram_post',
  'instagram_story',
  'facebook_post',
  'tiktok_video',
  'website_banner',
  'print_flyer',
  'brand_identity',
  'logo_system',
  'brand_guidelines',
  'website_page',
  'mobile_app_screen',
  'ecommerce_product_page',
  'packaging_label',
  'packaging_concept',
  'product_photo_shoot',
  'video_storyboard',
  'catalog_brochure',
  'presentation_deck',
  'email_campaign',
  'infographic',
  'store_signage',
  'industrial_product_concept',
  'design_system',
  'ux_audit',
  'responsive_prototype',
  'architecture_concept',
  'interior_spatial_concept',
  'landscape_concept',
  'exhibition_environment',
  'fashion_textile_concept',
  'game_interface_concept',
  'immersive_ar_vr_prototype',
  'wayfinding_signage_system',
  'service_blueprint',
  'instructional_design_module',
  'user_research_plan',
  'sound_design_brief',
  'custom_design',
] as const;
export type DesignPlatform = (typeof DESIGN_PLATFORMS)[number];

export const DESIGN_OBJECTIVES = [
  'awareness',
  'launch',
  'sales',
  'gift',
  'seasonal',
  'usability',
  'conversion',
  'consistency',
  'accessibility',
  'retention',
  'education',
  'custom',
] as const;
export type DesignObjective = (typeof DESIGN_OBJECTIVES)[number];
export type DesignLanguage = 'ar' | 'en';

export interface DesignBriefRequest {
  brief: string;
  specialty: DesignSpecialty;
  customSpecialty?: string;
  platform: DesignPlatform;
  customDeliverable?: string;
  objective: DesignObjective;
  audience?: string;
  language: DesignLanguage;
  productId?: string;
  includeRetailPrice?: boolean;
}

export interface DesignPaletteColor {
  name: string;
  hex: string;
  use: string;
}

/** A multidisciplinary direction and production-ready checklist; it is not a rendered or published asset. */
export interface DesignCreativeBrief {
  specialty: DesignSpecialty;
  /** Server-supplied display label for a merchant-defined specialty; never trusted from model output. */
  specialtyLabel?: string;
  title: string;
  concept: string;
  format: string;
  strategy: string;
  audience: string;
  visualDirection: string;
  informationArchitecture: string;
  layout: string;
  palette: DesignPaletteColor[];
  typography: string;
  experienceFlow: string;
  interactionNotes: string;
  headline?: string;
  caption?: string;
  cta?: string;
  assetDirection: string;
  assetSearchTerms: string[];
  imagePrompt: string;
  altText: string;
  responsiveNotes: string;
  accessibilityNotes: string;
  productionNotes: string;
  successCriteria: string;
  qualityChecklist: string[];
  /** Suggestions only; a human must approve and implement changes to Sham's site. */
  siteImprovementIdeas: string[];
}

export interface DesignCollaborationSource {
  id: string;
  nameAr: string;
  contributionAr: string;
  updatedAt?: string;
}

export interface DesignTeamMember {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface DesignBriefResponse {
  creative: DesignCreativeBrief;
  createdAt: string;
  retailPrice?: { amount: number; currency: string };
  /** The registered Shaheen team roster plus the real, redacted reports used for this brief. */
  collaboration: {
    /** Live AI tools and background bots registered under Shaheen; listed does not mean all were called. */
    team: DesignTeamMember[];
    sources: DesignCollaborationSource[];
    learning: { id: string; titleAr: string; principleAr: string };
    privacyNoteAr: string;
  };
}

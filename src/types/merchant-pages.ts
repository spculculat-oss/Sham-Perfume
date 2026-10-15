import { SupportedLanguage } from './i18n';

// Admin Merchant Management Page
export interface AdminMerchantManagementPageProps {
  onClose: () => void;
  currentLang: SupportedLanguage;
}

// Merchant Workspace (للتجار)
export interface MerchantWorkspaceProps {
  onClose: () => void;
  currentLang: SupportedLanguage;
  merchantId: string;
  isAdmin: boolean;
}

// Retailer/Product Catalog Page (للزبّان)
export interface ProductCatalogPageProps {
  onClose: () => void;
  currentLang: SupportedLanguage;
  retailerId: string;
  isAdmin: boolean;
}

// Order Detail Modal
export interface OrderDetailModalProps {
  orderId: string;
  currentLang: SupportedLanguage;
  onClose: () => void;
}

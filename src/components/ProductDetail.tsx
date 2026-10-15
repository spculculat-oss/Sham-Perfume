import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, ShoppingCart, Share2, Heart, Package, Shield, Truck, RotateCcw } from 'lucide-react';
import productsData from '../data/products.json';

const t = {
  ar: {
    back: 'رجوع',
    details: 'تفاصيل المنتج',
    description: 'الوصف',
    specs: 'المواصفات',
    related: 'منتجات ذات صلة',
    addToCart: 'أضف للسلة',
    inCart: 'موجود في السلة',
    qty: 'الكمية',
    outOfStock: 'نفد من inventory',
    reviews: 'التقييمات',
    writeReview: 'اكتب تقييم',
    brand: 'العلامة التجارية',
    category: 'الفئة',
    sku: 'رمز المنتج',
    price: 'السعر',
    supplierPrice: 'سعر التوريد',
    ourPrice: 'سعرنا',
    discount: 'خصم',
    shipping: 'شحن مجاني',
    delivery: 'توصيل خلال 3-5 أيام',
    guarantee: 'ضمان استرجاع 30 يوم',
    unit: 'الوحدة',
    ingredients: 'المكونات',
    notes: 'النقاط',
    top: '최고',
    middle: 'تظهر',
    base: 'أساسي',
    sillage: 'الرنين',
    longevity: 'البقاء',
    projection: 'الامتداد',
  },
  en: {
    back: 'Back',
    details: 'Product Details',
    description: 'Description',
    specs: 'Specifications',
    related: 'Related Products',
    addToCart: 'Add to Cart',
    inCart: 'In Cart',
    qty: 'Quantity',
    outOfStock: 'Out of Stock',
    reviews: 'Reviews',
    writeReview: 'Write Review',
    brand: 'Brand',
    category: 'Category',
    sku: 'SKU',
    price: 'Price',
    supplierPrice: 'Supplier Price',
    ourPrice: 'Our Price',
    discount: 'Discount',
    shipping: 'Free Shipping',
    delivery: 'Delivery in 3-5 days',
    guarantee: '30-day return guarantee',
    unit: 'Unit',
    ingredients: 'Ingredients',
    notes: 'Notes',
    top: 'Top',
    middle: 'Middle',
    base: 'Base',
    sillage: 'Sillage',
    longevity: 'Longevity',
    projection: 'Projection',
  }
};

interface Props {
  productId: number;
  currentLang: 'ar' | 'en';
  onClose?: () => void;
  onAddToCart?: (product: any) => void;
}

export const ProductDetail: React.FC<Props> = ({ productId, currentLang, onClose, onAddToCart }) => {
  const lang = t[currentLang];
  const product = productsData.products?.find(p => p.id === productId);
  
  const [qty, setQty] = useState(1);
  const [inCart, setInCart] = useState(false);
  
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">{lang.details}: not found</div>
      </div>
    );
  }
  
  const discount = product.supplierPrice 
    ? Math.round((1 - product.ourPrice / product.supplierPrice) * 100)
    : 0;
  
  const related = productsData.products?.filter(p => 
    p.id !== product.id && p.brand === product.brand
  ).slice(0, 4) || [];
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            {lang.back}
          </button>
          <h1 className="text-xl font-bold">{lang.details}</h1>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl overflow-hidden shadow-lg">
              <img 
                src={product.imageUrl || 'https://via.placeholder.com/500x500?text=No+Image'} 
                alt={product.nameAr || product.nameEn}
                className="w-full h-auto object-cover"
              />
            </div>
            {product.imageUrl && (
              <button className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                <Share2 className="w-5 h-5 mx-auto" />
              </button>
            )}
          </div>
          
          {/* Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Package className="w-4 h-4" />
                <span>{product.sku}</span>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                {currentLang === 'ar' ? product.nameAr : product.nameEn}
              </h2>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">{product.brand}</span>
                {product.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm">{product.rating}</span>
                    {product.reviewCount && (
                      <span className="text-sm text-gray-500">({product.reviewCount})</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Price */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">{product.ourPrice}</span>
                  <span className="text-lg text-gray-500">EGP</span>
                  {discount > 0 && (
                    <span className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded">
                      -{discount}%
                    </span>
                  )}
                </div>
                {product.supplierPrice && (
                  <div className="text-sm text-gray-500 mt-1">
                    {lang.supplierPrice}: {product.supplierPrice} EGP
                  </div>
                )}
              </div>
              
              {/* Stock and Actions */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                {product.stockStatus === 'in_stock' ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">{lang.qty}:</label>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            className="px-3 py-2 border rounded hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="py-2 min-w-[40px] text-center">{qty}</span>
                          <button 
                            onClick={() => setQty(qty + 1)}
                            className="px-3 py-2 border rounded hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        if (onAddToCart) {
                          onAddToCart(product);
                          setInCart(true);
                        }
                      }}
                      className={`
                        w-full py-3 px-6 rounded-lg font-semibold transition
                        ${inCart 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                        }
                      `}
                    >
                      {inCart ? lang.inCart : lang.addToCart}
                    </button>
                  </>
                ) : (
                  <button className="w-full py-3 px-6 rounded-lg font-semibold bg-gray-200 text-gray-500 cursor-not-allowed">
                    {lang.outOfStock}
                  </button>
                )}
              </div>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <Truck className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <div className="text-sm">{lang.shipping}</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <RotateCcw className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <div className="text-sm">{lang.guarantee}</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <Shield className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <div className="text-sm">{lang.delivery}</div>
              </div>
            </div>
            
            {/* Description */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-3">{lang.description}</h3>
              <div className="text-gray-600 leading-relaxed">
                {currentLang === 'ar' ? product.descriptionAr || 'عطر فاخر بجودة عالية وسعر مميز.' : product.descriptionEn || 'A luxurious perfume with high quality and special price.'}
              </div>
            </div>
            
            {/* Specs */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">{lang.specs}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang.brand}:</span>
                  <span className="font-medium">{product.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang.category}:</span>
                  <span className="font-medium">{product.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang.sku}:</span>
                  <span className="font-medium">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{lang.unit}:</span>
                  <span className="font-medium">{product.unit}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">{lang.related}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map(p => (
                <div 
                  key={p.id}
                  className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition cursor-pointer"
                  onClick={() => {
                    window.location.hash = `#product=${p.id}`;
                  }}
                >
                  <img 
                    src={p.imageUrl || 'https://via.placeholder.com/300x300?text=No+Image'} 
                    alt={p.nameAr || p.nameEn}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <div className="text-sm text-gray-500 mb-1">{p.brand}</div>
                    <h3 className="font-semibold mb-2">
                      {currentLang === 'ar' ? p.nameAr : p.nameEn}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{p.ourPrice}</span>
                      <span className="text-gray-500">EGP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

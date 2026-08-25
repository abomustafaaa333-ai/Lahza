export type PartnerGallerySource = {
  id: number;
  storeId?: number | null;
  storeCategory?: string | null;
  name?: string;
  text?: string;
  imageUrl?: string | null;
  productImageUrl?: string | null;
  partnerName?: string | null;
  storeName?: string | null;
  unitPrice?: number | null;
  productPrice?: number | null;
  offerPrice?: number | null;
  discountPercent?: number | null;
  storeOpen?: boolean | null;
  originalProductPrice?: number | null;
};

export type PartnerGallerySlide = {
  id: number;
  storeId?: number | null;
  storeCategory?: string | null;
  name: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  partnerName: string;
  unitPrice: number;
  originalProductPrice?: number | null;
  offerPrice?: number | null;
  discountPercent?: number | null;
  storeOpen?: boolean | null;
};

export function buildPartnerGallerySlides(items: PartnerGallerySource[]): PartnerGallerySlide[] {
  return items.flatMap(item => {
    const fallbackImages = ["/assets/lahza-offer-bakery.jpg", "/assets/lahza-offer-grocery.jpg", "/assets/lahza-offer-restaurant.jpg"];
    const candidateImageUrl = item.imageUrl?.trim() || item.productImageUrl?.trim();
    const imageUrl = candidateImageUrl && /^(https:\/\/|\/)/i.test(candidateImageUrl) ? candidateImageUrl : fallbackImages[Math.abs(item.id) % fallbackImages.length];
    return [{ id: item.id, ...(item.storeId != null ? { storeId: item.storeId } : {}), ...(item.storeCategory ? { storeCategory: item.storeCategory } : {}), name: item.name?.trim() || item.text?.trim() || "عرض متجر لحظة", imageUrl, ...(item.imageUrl?.trim() && item.productImageUrl?.trim() && item.imageUrl.trim() !== item.productImageUrl.trim() ? { fallbackImageUrl: item.productImageUrl.trim() } : {}), partnerName: item.storeName?.trim() || item.partnerName?.trim() || "متجر لحظة", unitPrice: Math.max(0, Number(item.offerPrice ?? item.productPrice ?? item.unitPrice ?? 0)), ...(item.originalProductPrice != null ? { originalProductPrice: Math.max(0, Number(item.originalProductPrice)) } : {}), ...(item.offerPrice != null ? { offerPrice: Math.max(0, Number(item.offerPrice)) } : {}), ...(Number(item.discountPercent ?? 0) > 0 ? { discountPercent: Number(item.discountPercent) } : {}), ...(item.storeOpen != null ? { storeOpen: item.storeOpen } : {}) }];
  });
}

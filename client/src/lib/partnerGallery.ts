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
};

export type PartnerGallerySlide = {
  id: number;
  storeId?: number | null;
  storeCategory?: string | null;
  name: string;
  imageUrl: string;
  partnerName: string;
  unitPrice: number;
  discountPercent?: number | null;
  storeOpen?: boolean | null;
};

export function buildPartnerGallerySlides(items: PartnerGallerySource[]): PartnerGallerySlide[] {
  const seenUrls = new Set<string>();
  return items.flatMap(item => {
    const imageUrl = item.imageUrl?.trim() || item.productImageUrl?.trim();
    if (!imageUrl || !/^(https:\/\/|\/)/i.test(imageUrl) || seenUrls.has(imageUrl)) return [];
    seenUrls.add(imageUrl);
    return [{ id: item.id, ...(item.storeId != null ? { storeId: item.storeId } : {}), ...(item.storeCategory ? { storeCategory: item.storeCategory } : {}), name: item.name?.trim() || item.text?.trim() || "عرض متجر لحظة", imageUrl, partnerName: item.storeName?.trim() || item.partnerName?.trim() || "متجر لحظة", unitPrice: Math.max(0, Number(item.offerPrice ?? item.productPrice ?? item.unitPrice ?? 0)), ...(Number(item.discountPercent ?? 0) > 0 ? { discountPercent: Number(item.discountPercent) } : {}), ...(item.storeOpen != null ? { storeOpen: item.storeOpen } : {}) }];
  });
}

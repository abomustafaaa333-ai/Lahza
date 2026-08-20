export type PartnerGallerySource = {
  id: number;
  name?: string;
  text?: string;
  imageUrl?: string | null;
  partnerName?: string | null;
  storeName?: string | null;
  unitPrice?: number | null;
};

export type PartnerGallerySlide = {
  id: number;
  name: string;
  imageUrl: string;
  partnerName: string;
  unitPrice: number;
};

export function buildPartnerGallerySlides(items: PartnerGallerySource[]): PartnerGallerySlide[] {
  const seenUrls = new Set<string>();
  return items.flatMap(item => {
    const imageUrl = item.imageUrl?.trim();
    if (!imageUrl || !/^https:\/\//i.test(imageUrl) || seenUrls.has(imageUrl)) return [];
    seenUrls.add(imageUrl);
    return [{ id: item.id, name: item.name?.trim() || item.text?.trim() || "عرض متجر لحظة", imageUrl, partnerName: item.storeName?.trim() || item.partnerName?.trim() || "متجر لحظة", unitPrice: Math.max(0, Number(item.unitPrice ?? 0)) }];
  });
}

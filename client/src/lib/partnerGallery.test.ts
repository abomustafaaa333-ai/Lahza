import { describe, expect, it } from "vitest";
import { buildPartnerGallerySlides } from "./partnerGallery";

describe("معرض صور عروض الشركاء", () => {
  it("يعرض كل عروض HTTPS ويحفظ بيانات العرض حتى عند تشابه الصور", () => {
    const slides = buildPartnerGallerySlides([
      { id: 1, name: "معمول", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000, storeOpen: false },
      { id: 2, name: "الصورة نفسها", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000 },
      { id: 3, name: "رابط غير آمن", imageUrl: "http://images.example.com/unsafe.jpg" },
    ]);

    expect(slides).toHaveLength(3);
    expect(slides[0]).toMatchObject({ id: 1, name: "معمول", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000, storeOpen: false });
    expect(slides[1]).toMatchObject({ id: 2, name: "الصورة نفسها", imageUrl: "https://images.example.com/maamoul.jpg" });
  });

  it("يستخدم صورة المنتج وسعر العرض ونسبة الخصم عند عدم رفع صورة إضافية", () => {
    expect(buildPartnerGallerySlides([{ id: 8, text: "عرض المعمول", productImageUrl: "/assets/maamoul.jpg", productPrice: 24000, discountPercent: 20 }])).toEqual([{ id: 8, name: "عرض المعمول", imageUrl: "/assets/maamoul.jpg", partnerName: "متجر لحظة", unitPrice: 24000, discountPercent: 20 }]);
  });

  it("يبقي العرض الذي لا يحتوي رابط صورة ويمنحه صورة افتراضية", () => {
    const slides = buildPartnerGallerySlides([{ id: 1, name: "بلا صورة" }, { id: 2, name: "صورة", imageUrl: "https://images.example.com/item.jpg" }]);
    expect(slides).toHaveLength(2);
    expect(slides[0].imageUrl).toMatch(/^\/assets\/lahza-offer-/);
  });
});

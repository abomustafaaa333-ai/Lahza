import { describe, expect, it } from "vitest";
import { buildPartnerGallerySlides } from "./partnerGallery";

describe("معرض صور عروض الشركاء", () => {
  it("يعرض صور HTTPS الفريدة فقط ويحفظ بيانات العرض", () => {
    const slides = buildPartnerGallerySlides([
      { id: 1, name: "معمول", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000, storeOpen: false },
      { id: 2, name: "الصورة نفسها", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000 },
      { id: 3, name: "رابط غير آمن", imageUrl: "http://images.example.com/unsafe.jpg" },
    ]);

    expect(slides).toEqual([{ id: 1, name: "معمول", imageUrl: "https://images.example.com/maamoul.jpg", partnerName: "حلويات الشام", unitPrice: 30000, storeOpen: false }]);
  });

  it("يتجاهل المنتجات التي لا تحتوي رابط صورة", () => {
    expect(buildPartnerGallerySlides([{ id: 1, name: "بلا صورة" }, { id: 2, name: "صورة", imageUrl: "https://images.example.com/item.jpg" }])).toHaveLength(1);
  });
});

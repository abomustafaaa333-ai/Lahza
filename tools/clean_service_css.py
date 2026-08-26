from pathlib import Path

path = Path('/home/ubuntu/Lahza/client/src/index.css')
text = path.read_text()
marker = '/* Full service hero background: the service slide replaces the old orange header surface. */'
start = text.find(marker)
if start < 0:
    raise SystemExit('CSS marker not found')
base = text[:start].rstrip()
block = '''
/* Full service hero background: the service slide replaces the old orange header surface. */
header.header-service-theme-0 { background: linear-gradient(145deg, #8f3517 0%, #c95422 54%, #f47a32 100%); border-bottom-color: rgba(255,248,241,.24); }
header.header-service-theme-1 { background: linear-gradient(145deg, #71301e 0%, #b94d28 52%, #ec7836 100%); border-bottom-color: rgba(255,248,241,.24); }
header.header-service-theme-2 { background: linear-gradient(145deg, #63301b 0%, #a94829 54%, #d96b32 100%); border-bottom-color: rgba(255,248,241,.24); }
header.header-service-theme-3 { background: linear-gradient(145deg, #7b321c 0%, #c15b25 54%, #f1843c 100%); border-bottom-color: rgba(255,248,241,.24); }
header[class*="header-service-theme-"] { transition: background 700ms ease, border-color 700ms ease; }
header[class*="header-service-theme-"] .service-intro-panel { width: 100%; min-height: 8rem; margin: .7rem 0 0; border: 0; border-radius: 0; padding: 1.1rem max(1.1rem, calc((100% - 760px) / 2 + 1.1rem)) 1.35rem; background: transparent; box-shadow: none; }
header[class*="header-service-theme-"] .current-location-label,
header[class*="header-service-theme-"] .header-cart-button { color: #fff; }
header[class*="header-service-theme-"] .header-cart-button { border-color: rgba(255,255,255,.72); background: #fff; color: #63301b; }
header[class*="header-service-theme-"] .header-search-button { border-color: rgba(255,255,255,.88); background: #fff; color: #6d625c; }
header[class*="header-service-theme-"] .service-intro-panel::after { background: rgba(255,248,241,.1); }
header[class*="header-service-theme-"] .service-intro-copy { max-width: 28rem; }
.home-offer-gallery { margin-top: 1.1rem; }
@media (max-width: 420px) {
  header[class*="header-service-theme-"] .service-intro-panel { min-height: 7.2rem; padding-top: .8rem; }
  .service-intro-copy strong { font-size: 1.02rem; }
  .service-intro-copy small { font-size: .63rem; }
}

.entry-gate-option { direction: rtl; }
.entry-gate-option > svg { margin-inline-start: auto; }
.entry-gate-option > span:nth-child(2) { text-align: right; }
.service-intro-copy { direction: rtl; }
.service-intro-icon { order: -1; }
.service-intro-dots { direction: ltr; }
.header-search-wrap { position: relative; z-index: 2; }
.header-cart-button { position: relative; z-index: 2; }
.current-location-button { position: relative; z-index: 2; }
@media (prefers-reduced-motion: reduce) {
  header[class*="header-service-theme-"] { transition: none; }
}

/* End of service hero background overrides. */
'''
path.write_text(base + '\n' + block)
print(f'cleaned {path}')
print(f'bytes={path.stat().st_size}')

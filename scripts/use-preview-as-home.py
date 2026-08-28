from pathlib import Path

path = Path('client/src/pages/Home.tsx')
text = path.read_text()
text = text.replace('      {screen === "home" ? <Header onSecret={() => setSecretOpen(true)} onCart={openCart} onSearch={() => setSearchOpen(true)} onExplore={openFeaturedOffers} cartCount={cart.length} searchPlaceholder={searchPlaceholder} /> : null}\n', '')
start = '          <section className="app-shell pb-10">'
end = '          </section>\n        </>\n      ) : null}'
start_i = text.index(start, text.index('{screen === "home" ? ('))
end_i = text.index(end, start_i) + len('          </section>')
replacement = '''          <section className="preview-home-replica" aria-label="واجهة لحظة">
            <img src="/assets/lahza-preview-home.png" alt="واجهة لحظة" />
            <button type="button" className="preview-hotspot preview-hotspot-cart" onClick={openCart} aria-label="فتح سلة التسوق" />
            <button type="button" className="preview-hotspot preview-hotspot-location" onClick={() => setLocation("/location")} aria-label="الموقع الحالي" />
            <button type="button" className="preview-hotspot preview-hotspot-search" onClick={() => setSearchOpen(true)} aria-label="البحث عن منتج" />
            <button type="button" className="preview-hotspot preview-hotspot-categories" onClick={() => setScreen("delivery")} aria-label="اكتشف ما تحتاجه" />
            <button type="button" className="preview-hotspot preview-hotspot-offer" onClick={openFeaturedOffers} aria-label="فتح العروض" />
            <button type="button" className="preview-hotspot preview-hotspot-stores" onClick={() => setScreen("delivery")} aria-label="فتح المتاجر" />
            <button type="button" className="preview-hotspot preview-hotspot-nav-home" onClick={goHome} aria-label="الرئيسية" />
            <button type="button" className="preview-hotspot preview-hotspot-nav-stores" onClick={() => setScreen("delivery")} aria-label="المتاجر" />
            <button type="button" className="preview-hotspot preview-hotspot-nav-offers" onClick={() => setScreen("offers")} aria-label="العروض" />
            <button type="button" className="preview-hotspot preview-hotspot-nav-orders" onClick={openMyOrder} aria-label="طلبي" />
          </section>'''
text = text[:start_i] + replacement + text[end_i:]
path.write_text(text)

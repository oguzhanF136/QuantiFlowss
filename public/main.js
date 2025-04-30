// Coinlerin sembollerini tanımla - Genişletilmiş Liste
const symbols = [
  "btcusdt", "ethusdt", "bnbusdt", "xrpusdt", "ltcusdt",
  "adausdt", "dogeusdt", "dotusdt", "solusdt", "maticusdt",
  "avaxusdt", "linkusdt", "trxusdt", "uniusdt", "atomusdt",
  "etcusdt", "xlmusdt", "vetusdt", "filusdt", "algousdt"
];

let lastCloseData = {};
let historicalData = {}; // Her sembol için geçmiş verileri saklayacak

document.addEventListener('DOMContentLoaded', function() {
  // Coinlere Göre Filtreleme Özelliği Ekleyelim
  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.placeholder = 'Coin ara...';
  filterInput.className = 'form-control mb-3';
  filterInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const rows = document.querySelectorAll('#prices tr');
    rows.forEach(row => {
      const symbol = row.id.toLowerCase();
      if (symbol.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  const timeframeParent = document.querySelector('#timeframe').parentElement.parentElement;
  timeframeParent.insertAdjacentElement('beforebegin', filterInput);

  // Tabloyu oluştur
  const tbody = document.querySelector("#prices");

  if (!tbody) {
    console.error("prices ID'li tablo bulunamadı!");
    return;
  }

  // Coin sayısını gösteren bilgi paneli
  const infoDiv = document.createElement('div');
  infoDiv.className = 'alert alert-info mb-3';
  infoDiv.innerHTML = `<strong>${symbols.length} coin</strong> izleniyor. Belirli bir coin'i aramak için yukarıdaki arama kutusunu kullanabilirsiniz.`;
  document.querySelector('.container').insertBefore(infoDiv, document.querySelector('table').parentElement);

  // Tabloya yükleniyor mesajı ekleyelim
  const loadingRow = document.createElement('tr');
  loadingRow.id = 'loading-row';
  loadingRow.innerHTML = `
    <td colspan="7" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Yükleniyor...</span>
      </div>
      <p class="mt-2">Coinler yükleniyor, lütfen bekleyin...</p>
    </td>
  `;
  tbody.appendChild(loadingRow);

  // Her bir coin için satır oluştur
  symbols.forEach((s, index) => {
    const base = s.replace("usdt", "").toLowerCase();
    const logoUrl = `https://cryptoicon-api.pages.dev/api/icon/${base}`;
    const tr = document.createElement("tr");
    tr.id = s.toUpperCase();
    tr.innerHTML = `
      <td><img src="${logoUrl}" alt="${base}" onerror="this.src='placeholder.png'" width="20" height="20"> ${s.toUpperCase()}</td>
      <td class="price">-</td>
      <td><span class="percent badge bg-secondary">-</span></td>
      <td class="high">-</td>
      <td class="low">-</td>
      <td class="volume">-</td>
      <td class="indicators">
        <button class="btn btn-sm btn-outline-primary indicator-summary" data-symbol="${s.toUpperCase()}" data-bs-toggle="modal" data-bs-target="#indicatorModal">
          Yükleniyor...
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    // API oranını aşmamak için coinleri gruplar halinde yükle
    // Her 5 coin için 1.5 saniye bekle
    setTimeout(() => {
      getHistoricalData(s.toUpperCase(), document.getElementById('timeframe').value || '1h');

      // Tüm coinler yüklendikten sonra yükleniyor mesajını kaldır
      if (index === symbols.length - 1) {
        setTimeout(() => {
          const loadingRow = document.getElementById('loading-row');
          if (loadingRow) loadingRow.remove();
        }, 2000);
      }
    }, Math.floor(index / 5) * 1500);
  });

  // Sayfa yüklendikten sonra WebSocket bağlantısını kur
  setupWebsocket();

  // İndikatörlerin görünürlüğünü kontrol et
  const showIndicatorsCheckbox = document.getElementById('showIndicators');
  if (showIndicatorsCheckbox) {
    showIndicatorsCheckbox.addEventListener('change', function() {
      const indicatorsColumn = document.querySelectorAll('.indicators-column, .indicators');
      indicatorsColumn.forEach(el => {
        el.style.display = this.checked ? '' : 'none';
      });
    });
  }

  // İndikatör detay modalı için
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('indicator-summary')) {
      const symbol = event.target.getAttribute('data-symbol');
      showIndicatorDetails(symbol);
    }
  });

  // Zaman dilimi değiştirildiğinde veriyi güncelle
  const timeframeSelect = document.getElementById('timeframe');
  if (timeframeSelect) {
    timeframeSelect.addEventListener('change', function() {
      const selectedTimeframe = this.value;

      // Yükleniyor mesajını tekrar göster
      const loadingRow = document.createElement('tr');
      loadingRow.id = 'loading-row';
      loadingRow.innerHTML = `
        <td colspan="7" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Yükleniyor...</span>
          </div>
          <p class="mt-2">Veriler güncelleniyor, lütfen bekleyin...</p>
        </td>
      `;

      const existingLoadingRow = document.getElementById('loading-row');
      if (!existingLoadingRow) {
        tbody.appendChild(loadingRow);
      }

      // API oranını aşmamak için kademeli olarak güncelle
      symbols.forEach((s, index) => {
        setTimeout(() => {
          getHistoricalData(s.toUpperCase(), selectedTimeframe);

          // Tüm coinler yüklendikten sonra yükleniyor mesajını kaldır
          if (index === symbols.length - 1) {
            setTimeout(() => {
              const loadingRow = document.getElementById('loading-row');
              if (loadingRow) loadingRow.remove();
            }, 2000);
          }
        }, Math.floor(index / 5) * 1500);
      });
    });
  }
});

// WebSocket bağlantısını kurma
function setupWebsocket() {
  // WebSocket bağlantısını 10 coin gruplarına bölelim (Binance sınırlamaları nedeniyle)
  const maxCoinsPerConnection = 10;

  for (let i = 0; i < symbols.length; i += maxCoinsPerConnection) {
    const symbolsChunk = symbols.slice(i, i + maxCoinsPerConnection);

    // Her grup için ayrı bir WebSocket bağlantısı kur
    const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${symbolsChunk.map(s => `${s}@ticker`).join("/")}`);

    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const symbol = data.data.s;
      const price = parseFloat(data.data.c);  // Son fiyat
      const high = parseFloat(data.data.h);   // En yüksek fiyat
      const low = parseFloat(data.data.l);    // En düşük fiyat
      const volume = parseFloat(data.data.v); // Hacim
      const priceChange = parseFloat(data.data.p); // Fiyat değişimi
      const priceChangePercent = parseFloat(data.data.P); // Yüzde değişim

      // WebSocket ile gelen veriye göre anlık fiyatları güncelle
      const priceElement = document.getElementById(symbol);
      if (priceElement) {
        priceElement.querySelector('.price').textContent = price.toFixed(4);

        const percentEl = priceElement.querySelector('.percent');
        if (percentEl) {
          percentEl.textContent = priceChangePercent.toFixed(2) + '%';
          percentEl.classList.remove('bg-success', 'bg-danger', 'bg-secondary');
          percentEl.classList.add(
            priceChangePercent > 0 ? 'bg-success' : priceChangePercent < 0 ? 'bg-danger' : 'bg-secondary'
          );
        }

        priceElement.querySelector('.high').textContent = high.toFixed(4);
        priceElement.querySelector('.low').textContent = low.toFixed(4);
        priceElement.querySelector('.volume').textContent = formatVolume(volume); // Hacim formatlama
      }
    };

    // WebSocket bağlantı hata yönetimi
    ws.onerror = function(error) {
      console.error(`WebSocket bağlantı hatası (grup ${i/maxCoinsPerConnection + 1}):`, error);
    };

    ws.onclose = function() {
      console.log(`WebSocket bağlantısı kapatıldı (grup ${i/maxCoinsPerConnection + 1}). Yeniden bağlanmaya çalışılıyor...`);
      // 5 saniye sonra yeniden bağlanmayı dene
      setTimeout(() => setupWebsocket(), 5000);
    };
  }
}

// Hacmi uygun bir birime dönüştürme
function formatVolume(volume) {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(2) + 'B';  // Milyar
  } else if (volume >= 1e6) {
    return (volume / 1e6).toFixed(2) + 'M';  // Milyon
  } else {
    return volume.toFixed(2);  // Normal değer
  }
}

// Geçmiş veri çekme ve işleme
function getHistoricalData(symbol, interval, limit = 100) {
  fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data && data.length > 1) { // En az 2 mum veri olmalı
        // Verileri işle
        const closes = data.map(candle => parseFloat(candle[4]));
        const opens = data.map(candle => parseFloat(candle[1]));
        const highs = data.map(candle => parseFloat(candle[2]));
        const lows = data.map(candle => parseFloat(candle[3]));
        const volumes = data.map(candle => parseFloat(candle[5]));
        const times = data.map(candle => parseInt(candle[0]));

        // Son iki mumu kullanarak yüzde değişimi hesapla
        const lastClose = closes[closes.length - 1];
        const previousClose = closes[closes.length - 2];
        const percentChange = ((lastClose - previousClose) / previousClose) * 100;

        // Verileri sakla
        historicalData[symbol] = {
          closes: closes,
          opens: opens,
          highs: highs,
          lows: lows,
          volumes: volumes,
          times: times,
          lastUpdate: new Date().getTime()
        };

        // Son fiyat, yüksek, düşük ve hacimleri UI'da güncelle
        updatePriceData(symbol, lastClose, percentChange, highs[highs.length - 1], lows[lows.length - 1], volumes[volumes.length - 1]);

        try {
          // İndikatörleri hesapla ve göster
          calculateIndicators(symbol);
        } catch (error) {
          console.error(`İndikatör hesaplama hatası (${symbol}):`, error);
          // Hata durumunda butonu güncelle
          updateIndicatorError(symbol, `Hesaplama hatası`);
        }
      } else {
        console.error(`${symbol} için yeterli veri bulunamadı - mum sayısı: ${data ? data.length : 0}`);
        updateIndicatorError(symbol, "Yetersiz veri");
      }
    })
    .catch(err => {
      console.error(`Veri çekme hatası: ${symbol}`, err);
      updateIndicatorError(symbol, "API hatası");
    });
}

// Hata durumunda indikatör butonunu güncelle
function updateIndicatorError(symbol, errorMsg) {
  const row = document.getElementById(symbol);
  if (!row) return;

  const indicatorButton = row.querySelector('.indicator-summary');
  if (!indicatorButton) return;

  indicatorButton.textContent = errorMsg || "Hata";
  indicatorButton.className = "btn btn-sm btn-outline-danger indicator-summary";
}

// Fiyat verilerini UI'da güncelleme
function updatePriceData(symbol, price, percentChange, high, low, volume) {
  const row = document.getElementById(symbol);
  if (row) {
    row.querySelector('.price').textContent = price.toFixed(4);
    const percentEl = row.querySelector('.percent');
    percentEl.textContent = percentChange.toFixed(2) + '%';
    percentEl.classList.remove('bg-success', 'bg-danger', 'bg-secondary');
    percentEl.classList.add(
      percentChange > 0 ? 'bg-success' : percentChange < 0 ? 'bg-danger' : 'bg-secondary'
    );
    row.querySelector('.high').textContent = high.toFixed(4);
    row.querySelector('.low').textContent = low.toFixed(4);
    row.querySelector('.volume').textContent = formatVolume(volume);
  }
}

// İndikatörleri hesaplama
function calculateIndicators(symbol) {
  if (!historicalData[symbol]) {
    console.error(`${symbol} için veri bulunamadı`);
    return;
  }

  const data = historicalData[symbol];
  const closes = data.closes;

  if (!closes || closes.length < 50) {
    console.error(`${symbol} için yeterli veri yok: ${closes ? closes.length : 0} adet fiyat verisi`);
    throw new Error("Yetersiz veri");
  }

  try {
    // SMA hesaplamaları
    const sma20 = simpleMovingAverage(closes, 20);
    const sma50 = simpleMovingAverage(closes, 50);

    // EMA hesaplamaları
    const ema12 = exponentialMovingAverage(closes, 12);
    const ema26 = exponentialMovingAverage(closes, 26);

    // RSI hesaplaması
    const rsi14 = relativeStrengthIndex(closes, 14);

    // MACD hesaplaması
    const macdData = macd(closes, 12, 26, 9);

    // Bollinger Bands hesaplaması
    const bbandsData = bollingerBands(closes, 20, 2);

    // Hesaplama sonuçlarını kontrol et
    if (!sma20.length || !sma50.length || !ema12.length || !ema26.length || !rsi14.length ||
      !macdData.macd.length || !macdData.signal.length || !bbandsData.length) {
      throw new Error("Gösterge hesaplaması eksik");
    }

    // İndikatör verilerini sakla
    historicalData[symbol].indicators = {
      sma20: sma20[sma20.length - 1],
      sma50: sma50[sma50.length - 1],
      ema12: ema12[ema12.length - 1],
      ema26: ema26[ema26.length - 1],
      rsi14: rsi14[rsi14.length - 1],
      macd: macdData.macd[macdData.macd.length - 1],
      signal: macdData.signal[macdData.signal.length - 1],
      histogram: macdData.histogram[macdData.histogram.length - 1],
      bbands: bbandsData[bbandsData.length - 1]
    };

    // İndikatör durumunu güncelle
    updateIndicatorSummary(symbol);
  } catch (err) {
    console.error(`${symbol} gösterge hesaplama hatası:`, err);
    throw err;
  }
}

// İndikatör özetini güncelleme
function updateIndicatorSummary(symbol) {
  const row = document.getElementById(symbol);
  if (!row) return;

  const indicatorButton = row.querySelector('.indicator-summary');
  if (!indicatorButton) return;

  if (!historicalData[symbol] || !historicalData[symbol].indicators) {
    indicatorButton.textContent = "Veri Yok";
    return;
  }

  const indicators = historicalData[symbol].indicators;
  const lastPrice = historicalData[symbol].closes[historicalData[symbol].closes.length - 1];

  // Genel durum tespiti
  let bullishSignals = 0;
  let bearishSignals = 0;

  // SMA sinyalleri
  if (lastPrice > indicators.sma20) bullishSignals++;
  else bearishSignals++;

  if (lastPrice > indicators.sma50) bullishSignals++;
  else bearishSignals++;

  // EMA sinyalleri
  if (indicators.ema12 > indicators.ema26) bullishSignals++;
  else bearishSignals++;

  // RSI sinyalleri
  if (indicators.rsi14 > 50) bullishSignals++;
  else bearishSignals++;

  // MACD sinyalleri
  if (indicators.macd > indicators.signal) bullishSignals++;
  else bearishSignals++;

  // Bollinger Bands sinyalleri
  if (lastPrice > indicators.bbands.middle) bullishSignals++;
  else bearishSignals++;

  // Toplam sonuç
  let signalClass = '';
  let signalText = '';

  if (bullishSignals > bearishSignals) {
    signalClass = 'indicator-bullish';
    signalText = `Pozitif (${bullishSignals}/${bullishSignals+bearishSignals})`;
  } else if (bearishSignals > bullishSignals) {
    signalClass = 'indicator-bearish';
    signalText = `Negatif (${bullishSignals}/${bullishSignals+bearishSignals})`;
  } else {
    signalClass = 'indicator-neutral';
    signalText = `Nötr (${bullishSignals}/${bullishSignals+bearishSignals})`;
  }

  indicatorButton.textContent = signalText;
  indicatorButton.className = `btn btn-sm btn-outline-primary indicator-summary ${signalClass}`;
}

// İndikatör detaylarını göster
function showIndicatorDetails(symbol) {
  const modalTitle = document.getElementById('indicatorModalLabel');
  const modalContent = document.getElementById('indicatorModalContent');

  if (!modalTitle || !modalContent) return;

  modalTitle.textContent = `${symbol} Teknik Göstergeleri`;

  if (!historicalData[symbol] || !historicalData[symbol].indicators) {
    modalContent.innerHTML = '<div class="alert alert-warning">Bu sembol için gösterge verisi bulunamadı.</div>';
    return;
  }

  const indicators = historicalData[symbol].indicators;
  const lastPrice = historicalData[symbol].closes[historicalData[symbol].closes.length - 1];

  modalContent.innerHTML = `
    <div class="container">
      <div class="row mb-3">
        <div class="col-md-12">
          <h5>Mevcut Fiyat: <span class="text-primary">${lastPrice.toFixed(4)}</span></h5>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Hareketli Ortalamalar</div>
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                SMA(20)
                <span class="${lastPrice > indicators.sma20 ? 'indicator-bullish' : 'indicator-bearish'}">${indicators.sma20.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                SMA(50)
                <span class="${lastPrice > indicators.sma50 ? 'indicator-bullish' : 'indicator-bearish'}">${indicators.sma50.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                EMA(12)
                <span>${indicators.ema12.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                EMA(26)
                <span>${indicators.ema26.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                EMA Kesişimi
                <span class="${indicators.ema12 > indicators.ema26 ? 'indicator-bullish' : 'indicator-bearish'}">
                  ${indicators.ema12 > indicators.ema26 ? 'AL (Altın Kesişim)' : 'SAT (Ölüm Kesişimi)'}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Momentum Göstergeleri</div>
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                RSI(14)
                <span class="${indicators.rsi14 > 70 ? 'indicator-bearish' : indicators.rsi14 < 30 ? 'indicator-bullish' : ''}">${indicators.rsi14.toFixed(2)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                MACD
                <span>${indicators.macd.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Sinyal
                <span>${indicators.signal.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Histogram
                <span class="${indicators.histogram > 0 ? 'indicator-bullish' : 'indicator-bearish'}">${indicators.histogram.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                MACD Sinyali
                <span class="${indicators.macd > indicators.signal ? 'indicator-bullish' : 'indicator-bearish'}">
                  ${indicators.macd > indicators.signal ? 'AL' : 'SAT'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Bollinger Bantları (20,2)</div>
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Üst Bant
                <span>${indicators.bbands.upper.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Orta Bant
                <span>${indicators.bbands.middle.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Alt Bant
                <span>${indicators.bbands.lower.toFixed(4)}</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Bollinger Sinyali
                <span class="${
    lastPrice > indicators.bbands.upper ? 'indicator-bearish' :
      lastPrice < indicators.bbands.lower ? 'indicator-bullish' : 'indicator-neutral'
  }">
                  ${
    lastPrice > indicators.bbands.upper ? 'Aşırı Alım' :
      lastPrice < indicators.bbands.lower ? 'Aşırı Satım' : 'Nötr'
  }
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-header">Özet</div>
            <div class="card-body">
              <h5 class="card-title ${
    lastPrice > indicators.sma20 && lastPrice > indicators.sma50 ? 'indicator-bullish' :
      lastPrice < indicators.sma20 && lastPrice < indicators.sma50 ? 'indicator-bearish' : 'indicator-neutral'
  }">
                ${
    lastPrice > indicators.sma20 && lastPrice > indicators.sma50 ? 'Güçlü Yükseliş Trendi' :
      lastPrice < indicators.sma20 && lastPrice < indicators.sma50 ? 'Güçlü Düşüş Trendi' : 'Kararsız Trend'
  }
              </h5>
              <p class="card-text">
                Son güncelleme: ${new Date(historicalData[symbol].lastUpdate).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
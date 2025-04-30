import { simpleMovingAverage, exponentialMovingAverage, relativeStrengthIndex, macd, bollingerBands } from './indicators.js';

const symbols = ["btcusdt", "ethusdt", "bnbusdt", "xrpusdt", "ltcusdt"];
let prices = {}; // Fiyatları sembole göre saklayacak bir obje
let historicalData = {}; // Her sembol için geçmiş fiyat verilerini saklayacak bir obje (indikatörler için)

// Tabloyu oluştur
const tbody = document.getElementById("prices");
symbols.forEach(s => {
  const base = s.replace("usdt", "").toLowerCase();
  const logoUrl = `https://cryptoicon-api.pages.dev/api/icon/${base}`;
  const tr = document.createElement("tr");
  tr.id = s.toUpperCase();
  tr.innerHTML = `
        <td><img src="${logoUrl}" alt="${base}" onerror="this.style.display='none'" width="20" height="20"> ${s.toUpperCase()}</td>
        <td class="price">-</td>
        <td><span class="percent badge bg-secondary">-</span></td>
        <td class="high">-</td>
        <td class="low">-</td>
        <td class="volume">-</td>
        <td class="sma">-</td>
        <td class="ema">-</td>
        <td class="rsi">-</td>
        <td class="macd">-</td>
        <td class="bollinger">-</td>
    `;
  tbody.appendChild(tr);
  prices[s] = []; // Her sembol için boş bir fiyat dizisi oluştur
  historicalData[s] = []; // Her sembol için boş bir geçmiş veri dizisi oluştur
});

// WebSocket ile canlı veri
const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${symbols.map(s => `${s}@ticker`).join("/")}`);

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  const symbol = data.data.s;
  const price = parseFloat(data.data.c);
  const high = parseFloat(data.data.h);
  const low = parseFloat(data.data.l);
  const volume = parseFloat(data.data.v);

  if (!prices[symbol]) {
    prices[symbol] = [];
  }
  if (prices[symbol].length >= 200) { // Örneğin, 200 geçmiş fiyat saklayalım
    prices[symbol].shift();
  }
  prices[symbol].push(price);

  const priceElement = document.getElementById(symbol);
  if (priceElement) {
    priceElement.querySelector('.price').textContent = price.toFixed(4);
    priceElement.querySelector('.high').textContent = high.toFixed(4);
    priceElement.querySelector('.low').textContent = low.toFixed(4);
    priceElement.querySelector('.volume').textContent = formatVolume(volume);

    // Yeterli veri varsa indikatörleri hesapla ve tabloya yazdır
    if (prices[symbol].length >= 14) {
      const smaValue = simpleMovingAverage(prices[symbol].slice(), 14);
      const emaValue = exponentialMovingAverage(prices[symbol].slice(), 14);
      const rsiValue = relativeStrengthIndex(prices[symbol].slice(), 14);
      const macdResult = macd(prices[symbol].slice());
      const bollinger = bollingerBands(prices[symbol].slice());

      console.log(`${symbol} - WebSocket - SMA:`, smaValue);
      console.log(`${symbol} - WebSocket - EMA:`, emaValue);
      console.log(`${symbol} - WebSocket - RSI:`, rsiValue);
      console.log(`${symbol} - WebSocket - MACD:`, macdResult);
      console.log(`${symbol} - WebSocket - Bollinger Bands:`, bollinger);

      priceElement.querySelector('.sma').textContent = smaValue ? smaValue.toFixed(4) : '-';
      priceElement.querySelector('.ema').textContent = emaValue ? emaValue.toFixed(4) : '-';
      priceElement.querySelector('.rsi').textContent = rsiValue ? rsiValue.toFixed(2) : '-';
      priceElement.querySelector('.macd').textContent = macdResult ? `${macdResult.macdLine.toFixed(4)} / ${macdResult.signalLine.toFixed(4)}` : '-';
      priceElement.querySelector('.bollinger').textContent = bollinger ? `${bollinger.lowerBand.toFixed(4)} / ${bollinger.upperBand.toFixed(4)}` : '-';
    }
  }
};

// Hacmi uygun bir birime dönüştürme
function formatVolume(volume) {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(2) + 'B';
  } else if (volume >= 1e6) {
    return (volume / 1e6).toFixed(2) + 'M';
  } else {
    return volume.toFixed(2);
  }
}

// Zaman dilimi değiştirildiğinde veriyi güncelle
document.getElementById('timeframe').addEventListener('change', function() {
  const selectedTimeframe = this.value;
  symbols.forEach(s => {
    getCandlestickData(s.toUpperCase(), selectedTimeframe);
  });
});

// Binance klines API'den veri al
function getCandlestickData(symbol, interval) {
  fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`) // Limit'i artırabiliriz
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        historicalData[symbol] = data.map(item => parseFloat(item[4])); // Sadece kapanış fiyatlarını al
        const lastClose = parseFloat(data[data.length - 1][4]);
        const previousClose = data.length > 1 ? parseFloat(data[data.length - 2][4]) : lastClose;
        const high = parseFloat(data[data.length - 1][2]);
        const low = parseFloat(data[data.length - 1][3]);
        const volume = parseFloat(data[data.length - 1][5]);

        const percentChange = ((lastClose - previousClose) / previousClose) * 100;

        const row = document.getElementById(symbol);
        if (row) {
          row.querySelector('.price').textContent = lastClose.toFixed(4);
          const percentEl = row.querySelector('.percent');
          percentEl.textContent = percentChange.toFixed(2) + '%';
          percentEl.classList.remove('bg-success', 'bg-danger', 'bg-secondary');
          percentEl.classList.add(
            percentChange > 0 ? 'bg-success' : percentChange < 0 ? 'bg-danger' : 'bg-secondary'
          );
          row.querySelector('.high').textContent = high.toFixed(4);
          row.querySelector('.low').textContent = low.toFixed(4);
          row.querySelector('.volume').textContent = formatVolume(volume);

          // Zaman dilimi değiştiğinde de indikatörleri hesapla (yeterli veri varsa)
          if (historicalData[symbol].length >= 14) {
            const smaValue = simpleMovingAverage(historicalData[symbol].slice(), 14);
            const emaValue = exponentialMovingAverage(historicalData[symbol].slice(), 14);
            const rsiValue = relativeStrengthIndex(historicalData[symbol].slice(), 14);
            const macdResult = macd(historicalData[symbol].slice());
            const bollinger = bollingerBands(historicalData[symbol].slice());

            console.log(`${symbol} - getCandlestickData - SMA:`, smaValue);
            console.log(`${symbol} - getCandlestickData - EMA:`, emaValue);
            console.log(`${symbol} - getCandlestickData - RSI:`, rsiValue);
            console.log(`${symbol} - getCandlestickData - MACD:`, macdResult);
            console.log(`${symbol} - getCandlestickData - Bollinger Bands:`, bollinger);

            row.querySelector('.sma').textContent = smaValue ? smaValue.toFixed(4) : '-';
            row.querySelector('.ema').textContent = emaValue ? emaValue.toFixed(4) : '-';
            row.querySelector('.rsi').textContent = rsiValue ? rsiValue.toFixed(2) : '-';
            row.querySelector('.macd').textContent = macdResult ? `${macdResult.macdLine.toFixed(4)} / ${macdResult.signalLine.toFixed(4)}` : '-';
            row.querySelector('.bollinger').textContent = bollinger ? `${bollinger.lowerBand.toFixed(4)} / ${bollinger.upperBand.toFixed(4)}` : '-';
          }
        }
      }
    })
    .catch(err => console.error(`Veri çekme hatası: ${symbol}`, err));
}

// Sayfa yüklendiğinde varsayılan zaman dilimi için verileri çek
document.addEventListener('DOMContentLoaded', () => {
  const defaultTimeframe = document.getElementById('timeframe').value;
  symbols.forEach(s => {
    getCandlestickData(s.toUpperCase(), defaultTimeframe);
  });
});
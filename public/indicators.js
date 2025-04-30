// Basit Hareketli Ortalama (SMA)
function simpleMovingAverage(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// Üssel Hareketli Ortalama (EMA)
function exponentialMovingAverage(data, period) {
  const k = 2 / (period + 1);
  const result = [data[0]];

  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }

  return result;
}

// Göreli Güç Endeksi (RSI)
function relativeStrengthIndex(data, period = 14) {
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }

  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

  // İlk ortalamalar
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsi = [100 - (100 / (1 + avgGain / (avgLoss === 0 ? 0.001 : avgLoss)))];

  // Kalan değerler için
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rsi.push(100 - (100 / (1 + avgGain / (avgLoss === 0 ? 0.001 : avgLoss))));
  }

  return rsi;
}

// MACD (Moving Average Convergence Divergence)
function macd(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = exponentialMovingAverage(data, fastPeriod);
  const emaSlow = exponentialMovingAverage(data, slowPeriod);

  // MACD çizgisi = Hızlı EMA - Yavaş EMA
  const macdLine = [];
  for (let i = 0; i < emaFast.length; i++) {
    if (i >= slowPeriod - fastPeriod) {
      macdLine.push(emaFast[i] - emaSlow[i - (slowPeriod - fastPeriod)]);
    }
  }

  // Sinyal çizgisi = MACD'nin EMA'sı
  const signalLine = exponentialMovingAverage(macdLine, signalPeriod);

  // Histogram = MACD - Sinyal
  const histogram = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + macdLine.length - signalLine.length] - signalLine[i]);
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

// Bollinger Bantları
function bollingerBands(data, period = 20, multiplier = 2) {
  const sma = simpleMovingAverage(data, period);
  const bands = [];

  for (let i = period - 1; i < data.length; i++) {
    const subset = data.slice(i - period + 1, i + 1);
    const mean = subset.reduce((a, b) => a + b, 0) / period;

    // Standart sapma hesapla
    const squareDiffs = subset.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / period);

    bands.push({
      middle: sma[i - (period - 1)],
      upper: sma[i - (period - 1)] + multiplier * stdDev,
      lower: sma[i - (period - 1)] - multiplier * stdDev
    });
  }

  return bands;
}

// Tarayıcı mı Node.js mi olduğunu kontrol et ve uygun şekilde fonksiyonları dışa aktar
if (typeof window !== 'undefined') {
  // Tarayıcı ortamında çalışıyoruz
  window.simpleMovingAverage = simpleMovingAverage;
  window.exponentialMovingAverage = exponentialMovingAverage;
  window.relativeStrengthIndex = relativeStrengthIndex;
  window.macd = macd;
  window.bollingerBands = bollingerBands;
} else {
  // Node.js ortamında çalışıyoruz
  module.exports = {
    simpleMovingAverage,
    exponentialMovingAverage,
    relativeStrengthIndex,
    macd,
    bollingerBands
  };
}
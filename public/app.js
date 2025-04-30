// DOM elementlerini seçme
const coinListBody = document.querySelector('#coinList tbody');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const lastUpdated = document.getElementById('lastUpdated');
const loadingSpinner = document.getElementById('loadingSpinner');
const analysisForm = document.getElementById('analysisForm');

// Form gönderildiğinde
analysisForm.addEventListener('submit', function(e) {
    e.preventDefault();
    performAnalysis();
});

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    performAnalysis();
});

// Teknik analiz yap
async function performAnalysis() {
    try {
        showLoading(true);
        hideError();
        
        // Form verilerini al
        const formData = new FormData(analysisForm);
        const config = {
            interval: formData.get('interval'),
            limit: 100
        };
        
        // API isteği yap
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP hata: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Son güncelleme zamanını göster
        updateLastUpdated(data.timestamp);
        
        // Tabloyu oluştur
        createCoinTable(data.results || []);
        
    } catch (error) {
        console.error('Analiz hatası:', error.message);
        showError(`Analiz yapılırken bir hata oluştu: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Sonuçlardan tablo oluştur
function createCoinTable(results) {
    // Tabloyu temizle
    coinListBody.innerHTML = '';
    
    if (!results || results.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" class="text-center">Veri bulunamadı.</td>';
        coinListBody.appendChild(row);
        return;
    }
    
    // Her sonuç için satır oluştur
    results.forEach(result => {
        const row = document.createElement('tr');
        
        // Uygunluk hücresi
        const opportunityStatus = result.opportunity?.status || 'Veri Yetersiz';
        const opportunityScore = result.opportunity?.score || 0;
        
        // Satırı oluştur
        row.innerHTML = `
            <td>${result.symbol}</td>
            <td>${result.price?.current.toFixed(2)}</td>
            <td>${opportunityStatus} (${opportunityScore.toFixed(0)}%)</td>
        `;
        
        coinListBody.appendChild(row);
    });
}

// Yükleme göstergesini güncelle
function showLoading(isLoading) {
    loadingSpinner.style.display = isLoading ? 'inline-block' : 'none';
}

// Son güncelleme zamanını göster
function updateLastUpdated(timestamp) {
    const date = new Date(timestamp);
    lastUpdated.textContent = `Son güncelleme: ${date.toLocaleTimeString()}`;
}

// Hata mesajını göster
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Hata mesajını gizle
function hideError() {
    errorMessage.style.display = 'none';
}
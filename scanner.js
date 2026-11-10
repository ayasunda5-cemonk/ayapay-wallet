let html5QrCode = null;

function openScanModal() {
    document.getElementById('scan-modal').classList.remove('hidden');
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, // Gunakan kamera belakang HP
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
            // Ketika QR Code berhasil terbaca (misal berisi nomor telepon tujuan: "081234567890")
            stopScanner();
            document.getElementById('scan-modal').classList.add('hidden');
            
            // Otomatis buka form transfer terisi nomor dari hasil scan QR
            openTransferModal();
            document.getElementById('target-phone').value = decodedText;
            alert(`QR Code berhasil dibaca! Nomor tujuan: ${decodedText}`);
        },
        (errorMessage) => {
            // Mengabaikan error kecil saat kamera mencari fokus QR
        }
    ).catch(err => {
        alert("Gagal membuka kamera: " + err);
    });
}

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.log(err));
    }
}

function closeScanModal() {
    stopScanner();
    document.getElementById('scan-modal').classList.add('hidden');
}

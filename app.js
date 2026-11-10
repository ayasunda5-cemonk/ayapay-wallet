// Konfigurasi Supabase Anda (Ganti dengan URL & Anon Key dari project Supabase Anda)
const SUPABASE_URL = 'https://URL-SUPABASE-ANDA.supabase.co';
const SUPABASE_ANON_KEY = 'ANON-KEY-ANDA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cek autentikasi di halaman login
const authForm = document.getElementById('auth-form');
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;
        const msg = document.getElementById('msg');

        msg.textContent = "Memproses...";
        
        // Buat email virtual unik dari nomor HP agar kompatibel dengan Supabase Auth standar
        const email = `${phone.replace(/[^0-9]/g, '')}@ayapay.local`;

        // Coba Login
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        // Jika gagal karena belum terdaftar, otomatis lakukan Sign Up (Daftar baru)
        if (error) {
            let signUpRes = await supabase.auth.signUp({ 
                email, 
                password,
                options: { data: { phone_number: phone } }
            });
            if (signUpRes.error) {
                msg.textContent = "Gagal: " + signUpRes.error.message;
                msg.className = "mt-4 text-center text-sm font-medium text-red-500";
                return;
            }
            // Buat baris profil awal dengan saldo bonus uji coba Rp 50.000
            await supabase.from('profiles').insert([
                { id: signUpRes.data.user.id, phone_number: phone, full_name: 'Pengguna AYAPay', balance: 50000 }
            ]);
            alert('Akun baru berhasil dibuat! Anda mendapat saldo uji coba Rp 50.000.');
        }

        window.location.href = 'dashboard.html';
    });
}

// Logika Dashboard
const userBalanceEl = document.getElementById('user-balance');
const userPhoneEl = document.getElementById('user-phone');
const txListEl = document.getElementById('tx-list');

async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Ambil data profil dari tabel profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        userBalanceEl.textContent = `Rp ${profile.balance.toLocaleString('id-ID')}`;
        userPhoneEl.textContent = `No. HP: ${profile.phone_number}`;
        loadTransactions(profile.phone_number);
    }
}

if (userBalanceEl) {
    loadUserData();
}

// Kirim Uang ke Nomor Telepon
const transferForm = document.getElementById('transfer-form');
if (transferForm) {
    transferForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetPhone = document.getElementById('target-phone').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value);

        const { data: { user } } = await supabase.auth.getUser();
        
        // Ambil profil pengirim
        const { data: sender } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        if (sender.balance < amount) {
            alert('Saldo Anda tidak mencukupi!');
            return;
        }

        // Cek apakah nomor tujuan terdaftar di database AYAPay
        const { data: receiver } = await supabase.from('profiles').select('*').eq('phone_number', targetPhone).single();

        if (!receiver) {
            alert('Nomor tujuan tidak terdaftar di AYAPay!');
            return;
        }

        if (sender.phone_number === receiver.phone_number) {
            alert('Tidak bisa mengirim uang ke nomor sendiri!');
            return;
        }

        // Eksekusi Mutasi Saldo secara Nyata di Database
        // 1. Kurangi saldo pengirim
        await supabase.from('profiles').update({ balance: sender.balance - amount }).eq('id', sender.id);
        // 2. Tambah saldo penerima
        await supabase.from('profiles').update({ balance: receiver.balance + amount }).eq('id', receiver.id);
        // 3. Catat transaksi
        await supabase.from('transactions').insert([
            { sender_phone: sender.phone_number, receiver_phone: receiver.phone_number, amount: amount, type: 'transfer', note: 'Kirim saldo antar nomor' }
        ]);

        alert('Transfer berhasil dikirim!');
        closeTransferModal();
        loadUserData();
    });
}

// Muat Riwayat Transaksi
async function loadTransactions(phone) {
    const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_phone.eq.${phone},receiver_phone.eq.${phone}`)
        .order('created_at', { ascending: false })
        .limit(5);

    if (!txs || txs.length === 0) {
        txListEl.innerHTML = `<p class="text-sm text-gray-400 text-center py-2">Belum ada transaksi</p>`;
        return;
    }

    txListEl.innerHTML = txs.map(tx => {
        const isSender = tx.sender_phone === phone;
        return `
            <div class="bg-white p-3 rounded-xl border flex justify-between items-center text-sm">
                <div>
                    <p class="font-bold text-gray-700">${isSender ? 'Kirim ke ' + tx.receiver_phone : 'Terima dari ' + tx.sender_phone}</p>
                    <p class="text-xs text-gray-400">${new Date(tx.created_at).toLocaleTimeString('id-ID')}</p>
                </div>
                <span class="font-bold ${isSender ? 'text-red-500' : 'text-green-500'}">
                    ${isSender ? '-' : '+'}Rp ${tx.amount.toLocaleString('id-ID')}
                </span>
            </div>
        `;
    }).join('');
}

function openTransferModal() { document.getElementById('transfer-modal').classList.remove('hidden'); }
function closeTransferModal() { document.getElementById('transfer-modal').classList.add('hidden'); }
async function logout() { await supabase.auth.signOut(); window.location.href = 'index.html'; }

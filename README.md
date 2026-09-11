# Game Pasangan

Kumpulan lima permainan untuk pasangan. Versi pertama menyelesaikan game **Ular Tangga** dengan dua level tantangan.

## Fitur Ular Tangga

- Papan 10×10 dengan 100 kotak, ular, tangga, dan pion 2–4 pemain.
- Tepat 30 kotak jebakan yang tersebar 3 pada setiap kelompok 10 angka.
- Level 1 romantis dan Level 2 khusus pasangan dewasa.
- Tantangan dapat dipilih, dinonaktifkan, dan ditambahkan sendiri.
- Tantangan timer mendukung 10, 20, 30, atau 60 detik.
- Animasi dadu, pergerakan pion, efek suara, tombol mute, dan aturan memantul jika melewati kotak 100.
- Pengaturan serta permainan aktif tersimpan di `localStorage` browser.

## Menjalankan

Buka `dist/index.html` melalui server statis lokal. Contoh dengan Python:

```bash
python -m http.server 8080 --directory dist
```

Kemudian buka `http://localhost:8080`.

## Cloudflare Pages

Hubungkan repository ini ke Cloudflare Pages. Tidak memerlukan perintah build; gunakan `dist` sebagai **Build output directory**.

## Mengubah tantangan bawaan

Semua tantangan bawaan berada di `dist/js/challenges.js`. Properti `timed: true` menampilkan pilihan timer, sedangkan `timed: false` menampilkan tantangan tanpa timer.

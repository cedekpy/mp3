class AutoMusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.baseURL = window.location.href.replace(/index\.html$/, '');
        
        // Cache w localStorage
        this.CACHE_KEY = 'music_player_cache';
        this.CACHE_TIME = 60 * 60 * 1000; // 1 godzina
        
        this.init();
    }

    async init() {
        console.log('🎵 Auto Music Player - Wersja bez songs.json');
        
        // 1. Spróbuj załadować z cache
        const cached = this.loadFromCache();
        if (cached && cached.playlist.length > 0) {
            console.log('✅ Załadowano z cache:', cached.playlist.length, 'utworów');
            this.playlist = cached.playlist;
            this.renderPlaylist();
            this.updateSongCount();
            if (this.playlist.length > 0) this.loadSong(0);
        } else {
            // 2. Brak cache - wyświetl instrukcję
            this.showScanPrompt();
        }
        
        this.setupEventListeners();
    }

    showScanPrompt() {
        const playlistElement = document.getElementById('playlist');
        if (!playlistElement) return;
        
        playlistElement.innerHTML = `
            <div class="scan-prompt">
                <div class="prompt-icon">
                    <i class="fas fa-music"></i>
                </div>
                <h3>Brak piosenek</h3>
                <p>Kliknij przycisk <strong>"Skanuj folder music"</strong> aby automatycznie wykryć pliki MP3.</p>
                <p>Lub dodaj plik <code>songs.json</code> z listą utworów.</p>
                <div class="tip">
                    <i class="fas fa-lightbulb"></i>
                    <strong>Wskazówka:</strong> Dodaj pliki .mp3 do folderu <code>music/</code>
                </div>
            </div>
        `;
        
        document.getElementById('songCount').textContent = '0';
    }

    setupEventListeners() {
        // Kontrolki
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevSong());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextSong());
        
        // Suwaki
        document.getElementById('progressBar').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.audio.volume = e.target.value / 100;
        });
        
        // Wyszukiwanie
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchSongs(e.target.value);
        });
        
        document.getElementById('searchBtn').addEventListener('click', () => {
            const query = document.getElementById('searchInput').value;
            this.searchSongs(query);
        });
        
        // Skanowanie
        document.getElementById('scanBtn').addEventListener('click', () => {
            this.scanMusicFolder();
        });
        
        // Audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.nextSong());
        this.audio.addEventListener('error', (e) => {
            console.error('❌ Błąd audio:', e);
        });
        
        // Refresh cache co godzinę
        setInterval(() => this.checkCacheValidity(), 60000);
    }

    async scanMusicFolder() {
        const statusElement = document.getElementById('scanStatus');
        const scanBtn = document.getElementById('scanBtn');
        
        try {
            statusElement.textContent = '🔍 Skanowanie...';
            scanBtn.disabled = true;
            scanBtn.classList.add('scanning');
            
            console.log('🔍 Rozpoczynam skanowanie folderu music/');
            
            // 1. Spróbuj wykryć pliki MP3
            const mp3Files = await this.detectMP3Files();
            
            if (mp3Files.length === 0) {
                throw new Error('Nie znaleziono plików MP3 w folderze music/');
            }
            
            console.log(`✅ Znaleziono ${mp3Files.length} plików MP3`);
            
            // 2. Stwórz playlistę
            this.playlist = await this.createPlaylistFromFiles(mp3Files);
            
            // 3. Pobierz okładki
            statusElement.textContent = '🖼️ Pobieram okładki...';
            await this.fetchCoversForPlaylist();
            
            // 4. Zapisz w cache
            this.saveToCache();
            
            // 5. Wyświetl playlistę
            this.renderPlaylist();
            this.updateSongCount();
            
            if (this.playlist.length > 0) {
                this.loadSong(0);
            }
            
            statusElement.textContent = `✅ Gotowe! ${this.playlist.length} utworów`;
            setTimeout(() => {
                statusElement.textContent = '';
            }, 3000);
            
        } catch (error) {
            console.error('❌ Błąd skanowania:', error);
            statusElement.textContent = '❌ ' + error.message;
            
            // Fallback: spróbuj ręcznie znaleźć typowe pliki
            this.tryFallbackScan();
            
        } finally {
            scanBtn.disabled = false;
            scanBtn.classList.remove('scanning');
        }
    }

    async detectMP3Files() {
        // Lista typowych nazw plików do przetestowania
        const commonNames = [
            'music.mp3', 'song.mp3', 'piosenka.mp3', 'muzyka.mp3',
            'track.mp3', 'audio.mp3', 'demo.mp3', 'test.mp3',
            'sample.mp3', 'music1.mp3', 'song1.mp3', 'track1.mp3'
        ];
        
        const foundFiles = [];
        
        // Testuj każdą nazwę
        for (const fileName of commonNames) {
            const filePath = `music/${fileName}`;
            try {
                const response = await fetch(filePath, { method: 'HEAD' });
                if (response.ok) {
                    foundFiles.push(filePath);
                    console.log(`✅ Znaleziono: ${filePath}`);
                }
            } catch (error) {
                // Kontynuuj
            }
        }
        
        // Dodatkowo: jeśli masz konkretne nazwy plików, dodaj je tutaj
        const customFiles = [
            // DODAJ TU SWOJE NAZWY PLIKÓW:
            // 'music/nazwa_twojej_piosenki.mp3',
            // 'music/ulubiona.mp3',
            // 'music/hit.mp3'
        ];
        
        for (const filePath of customFiles) {
            try {
                const response = await fetch(filePath, { method: 'HEAD' });
                if (response.ok) {
                    foundFiles.push(filePath);
                }
            } catch (error) {
                // Kontynuuj
            }
        }
        
        return [...new Set(foundFiles)]; // Usuń duplikaty
    }

    tryFallbackScan() {
        console.log('🔄 Próbuję fallback scan...');
        
        // Ręczna lista fallback
        const fallbackList = [
            {
                id: 1,
                title: "Twoja Muzyka",
                artist: "Nieznany artysta",
                file: "music/music.mp3",
                cover: this.getRandomGradient(),
                duration: "3:00"
            }
        ];
        
        this.playlist = fallbackList;
        this.renderPlaylist();
        this.updateSongCount();
        
        if (this.playlist.length > 0) {
            this.loadSong(0);
            document.getElementById('scanStatus').textContent = '⚠️ Używam domyślnej listy. Dodaj swoje MP3!';
        }
    }

    async createPlaylistFromFiles(filePaths) {
        const playlist = [];
        
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileName = filePath.split('/').pop().replace('.mp3', '');
            
            playlist.push({
                id: i + 1,
                title: this.formatTitle(fileName),
                artist: this.guessArtist(fileName),
                file: filePath,
                cover: "",
                duration: this.getRandomDuration()
            });
        }
        
        return playlist;
    }

    formatTitle(fileName) {
        // Formatowanie nazwy pliku na ładny tytuł
        return fileName
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .replace(/\.mp3$/i, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    guessArtist(fileName) {
        // Proste zgadywanie artysty po nazwie pliku
        const parts = fileName.split(/[_-]/);
        if (parts.length > 1) {
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        }
        return "Nieznany artysta";
    }

    async fetchCoversForPlaylist() {
        for (let i = 0; i < this.playlist.length; i++) {
            const song = this.playlist[i];
            if (!song.cover) {
                try {
                    song.cover = await this.fetchCover(song.title, song.artist);
                } catch (error) {
                    song.cover = this.getRandomGradient();
                }
                // Aktualizuj na żywo
                this.updatePlaylistItem(i);
            }
        }
    }

    async fetchCover(title, artist) {
        // Próbuj różnych API
        const apis = [
            `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=68d9b7ecca9a9c76c828411cffa8e6b3&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json&autocorrect=1`,
            `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + title)}&entity=song&limit=1`,
            `https://api.deezer.com/search?q=${encodeURIComponent(artist + ' ' + title)}&limit=1`
        ];
        
        for (const apiUrl of apis) {
            try {
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    
                    if (apiUrl.includes('last.fm')) {
                        if (data.track?.album?.image?.[2]?.["#text"]) {
                            const url = data.track.album.image[2]["#text"];
                            if (url && !url.includes('2a96cbd8b46e442fc41c2b86b821562f.png')) {
                                return url;
                            }
                        }
                    } else if (apiUrl.includes('itunes')) {
                        if (data.results?.[0]?.artworkUrl100) {
                            return data.results[0].artworkUrl100.replace('100x100', '300x300');
                        }
                    } else if (apiUrl.includes('deezer')) {
                        if (data.data?.[0]?.album?.cover_medium) {
                            return data.data[0].album.cover_medium;
                        }
                    }
                }
            } catch (error) {
                // Próbuj dalej
            }
        }
        
        // Fallback: Unsplash
        const themes = ['music', 'album', 'concert', 'vinyl'];
        const theme = themes[Math.floor(Math.random() * themes.length)];
        return `https://source.unsplash.com/300x300/?${theme},dark`;
    }

    getRandomGradient() {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    }

    getRandomDuration() {
        const mins = Math.floor(Math.random() * 4) + 2;
        const secs = Math.floor(Math.random() * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Cache system
    saveToCache() {
        const cacheData = {
            playlist: this.playlist,
            timestamp: Date.now()
        };
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
        console.log('💾 Zapisano w cache');
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            
            // Sprawdź czy cache jest aktualny
            if (Date.now() - data.timestamp > this.CACHE_TIME) {
                console.log('🕒 Cache wygasł');
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('❌ Błąd ładowania cache:', error);
            return null;
        }
    }

    checkCacheValidity() {
        const cached = this.loadFromCache();
        if (!cached) {
            // Cache wygasł - zaoferuj odświeżenie
            if (this.playlist.length > 0 && !document.getElementById('refreshOffer')) {
                this.showRefreshOffer();
            }
        }
    }

    showRefreshOffer() {
        const statusElement = document.getElementById('scanStatus');
        if (statusElement.textContent) return;
        
        statusElement.innerHTML = `
            <span style="color: #ffcc00">
                <i class="fas fa-sync-alt"></i>
                Kliknij "Skanuj" aby odświeżyć listę
            </span>
        `;
    }

    // Reszta metod (loadSong, play, pause, renderPlaylist, itd.)
    // ... (te same metody co wcześniej, tylko bez songs.json)

    loadSong(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentIndex = index;
        const song = this.playlist[index];
        
        this.audio.src = this.baseURL + song.file;
        document.getElementById('currentTitle').textContent = song.title;
        document.getElementById('currentArtist').textContent = song.artist;
        
        const coverImg = document.getElementById('currentCover');
        if (song.cover.startsWith('http')) {
            coverImg.src = song.cover;
            coverImg.style.background = 'none';
        } else {
            coverImg.style.background = song.cover;
            coverImg.src = '';
        }
        
        this.highlightCurrentSong();
        this.audio.load();
        this.play();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.audio.play().then(() => {
            this.isPlaying = true;
            document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';
        }).catch(error => {
            console.error('❌ Błąd odtwarzania:', error);
        });
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        document.getElementById('playBtn').innerHTML = '<i class="fas fa-play"></i>';
    }

    prevSong() {
        let newIndex = this.currentIndex - 1;
        if (newIndex < 0) newIndex = this.playlist.length - 1;
        this.loadSong(newIndex);
    }

    nextSong() {
        let newIndex = this.currentIndex + 1;
        if (newIndex >= this.playlist.length) newIndex = 0;
        this.loadSong(newIndex);
    }

    seek(value) {
        if (this.audio.duration) {
            this.audio.currentTime = (value / 100) * this.audio.duration;
        }
    }

    updateProgress() {
        if (!this.audio.duration) return;
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        document.getElementById('progressBar').value = progress;
        document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
    }

    updateDuration() {
        document.getElementById('duration').textContent = this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        if (!playlistElement) return;
        
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            songElement.dataset.index = index;
            
            let coverHTML = '';
            if (song.cover.startsWith('http')) {
                coverHTML = `<img class="song-cover" src="${song.cover}" alt="${song.title}">`;
            } else {
                coverHTML = `<div class="song-cover" style="background: ${song.cover}"></div>`;
            }
            
            songElement.innerHTML = `
                ${coverHTML}
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-duration">${song.duration}</div>
            `;
            
            songElement.addEventListener('click', () => this.loadSong(index));
            playlistElement.appendChild(songElement);
        });
        
        this.highlightCurrentSong();
    }

    updatePlaylistItem(index) {
        const song = this.playlist[index];
        const songElement = document.querySelector(`.song-item[data-index="${index}"]`);
        if (songElement && song.cover) {
            const coverElement = songElement.querySelector('.song-cover');
            if (coverElement) {
                if (song.cover.startsWith('http')) {
                    if (coverElement.tagName === 'IMG') {
                        coverElement.src = song.cover;
                    } else {
                        const img = document.createElement('img');
                        img.className = 'song-cover';
                        img.src = song.cover;
                        img.alt = song.title;
                        coverElement.replaceWith(img);
                    }
                } else {
                    if (coverElement.tagName === 'DIV') {
                        coverElement.style.background = song.cover;
                    }
                }
            }
        }
    }

    highlightCurrentSong() {
        document.querySelectorAll('.song-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const current = document.querySelector(`.song-item[data-index="${this.currentIndex}"]`);
        if (current) {
            current.classList.add('active');
        }
    }

    searchSongs(query) {
        const playlistElement = document.getElementById('playlist');
        if (!playlistElement) return;
        
        if (!query.trim()) {
            this.renderPlaylist();
            return;
        }
        
        const filtered = this.playlist.filter(song =>
            song.title.toLowerCase().includes(query.toLowerCase()) ||
            song.artist.toLowerCase().includes(query.toLowerCase())
        );
        
        playlistElement.innerHTML = '';
        
        filtered.forEach(song => {
            const originalIndex = this.playlist.findIndex(s => s.id === song.id);
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            songElement.dataset.index = originalIndex;
            
            let coverHTML = '';
            if (song.cover.startsWith('http')) {
                coverHTML = `<img class="song-cover" src="${song.cover}" alt="${song.title}">`;
            } else {
                coverHTML = `<div class="song-cover" style="background: ${song.cover}"></div>`;
            }
            
            songElement.innerHTML = `
                ${coverHTML}
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-duration">${song.duration}</div>
            `;
            
            songElement.addEventListener('click', () => this.loadSong(originalIndex));
            playlistElement.appendChild(songElement);
        });
    }

    updateSongCount() {
        const countElement = document.getElementById('songCount');
        if (countElement) {
            countElement.textContent = this.playlist.length;
        }
    }
}

// Dodaj style dla promptu
const style = document.createElement('style');
style.textContent = `
    .scan-prompt {
        text-align: center;
        padding: 40px 20px;
        background: rgba(0, 50, 100, 0.2);
        border-radius: 15px;
        border: 2px dashed #00aaff;
    }
    
    .prompt-icon {
        font-size: 3rem;
        color: #00ffcc;
        margin-bottom: 20px;
    }
    
    .scan-prompt h3 {
        color: #00ffcc;
        margin-bottom: 15px;
    }
    
    .scan-prompt p {
        margin: 10px 0;
        color: #aaa;
    }
    
    .scan-prompt code {
        background: rgba(0, 255, 204, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
        color: #00ffcc;
    }
    
    .tip {
        margin-top: 20px;
        padding: 15px;
        background: rgba(255, 204, 0, 0.1);
        border-radius: 10px;
        border-left: 4px solid #ffcc00;
        text-align: left;
    }
    
    .tip i {
        color: #ffcc00;
        margin-right: 10px;
    }
`;
document.head.appendChild(style);

// Start aplikacji
document.addEventListener('DOMContentLoaded', () => {
    window.player = new AutoMusicPlayer();
    console.log('🚀 Auto Music Player gotowy!');
});

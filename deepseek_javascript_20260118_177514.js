class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.apiKey = 'YOUR_LASTFM_API_KEY'; // Bezpłatny klucz API
        this.init();
    }

    async init() {
        // Wczytaj pliki MP3 z folderu music
        await this.loadMusicFiles();
        this.setupEventListeners();
        this.renderPlaylist();
        this.updateSongCount();
        
        if (this.playlist.length > 0) {
            this.loadSong(0);
        }
    }

    async loadMusicFiles() {
        // Tutaj symulujemy ładowanie plików - w rzeczywistości potrzebujesz backendu
        // Dla GitHub Pages możesz utworzyć plik JSON z listą utworów
        
        // Przykładowe dane - w praktyce pobierasz z serwera
        this.playlist = [
            {
                title: 'Blinding Lights',
                artist: 'The Weeknd',
                file: 'music/blinding_lights.mp3',
                cover: '' // Będzie pobrane automatycznie
            },
            {
                title: 'Shape of You',
                artist: 'Ed Sheeran',
                file: 'music/shape_of_you.mp3',
                cover: ''
            },
            {
                title: 'Bohemian Rhapsody',
                artist: 'Queen',
                file: 'music/bohemian_rhapsody.mp3',
                cover: ''
            }
        ];

        // Pobierz okładki dla każdej piosenki
        await this.fetchAllCovers();
    }

    async fetchAllCovers() {
        const loading = document.getElementById('loading');
        loading.classList.add('show');
        
        for (let i = 0; i < this.playlist.length; i++) {
            const song = this.playlist[i];
            try {
                song.cover = await this.fetchCoverFromAPI(song.title, song.artist);
                console.log(`Znaleziono okładkę dla: ${song.title}`);
            } catch (error) {
                console.warn(`Nie znaleziono okładki dla: ${song.title}`);
                song.cover = this.getDefaultCover();
            }
            
            // Aktualizuj widok po każdym znalezionym coverze
            this.updatePlaylistItem(i);
        }
        
        loading.classList.remove('show');
    }

    async fetchCoverFromAPI(title, artist) {
        try {
            // Próba 1: Last.fm API
            const lastfmResponse = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${this.apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json&autocorrect=1`
            );
            
            const lastfmData = await lastfmResponse.json();
            
            if (lastfmData.track && lastfmData.track.album && lastfmData.track.album.image[2]) {
                return lastfmData.track.album.image[2]['#text']; // Średnie zdjęcie
            }
            
            // Próba 2: iTunes API
            const itunesResponse = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + title)}&entity=song&limit=1`
            );
            
            const itunesData = await itunesResponse.json();
            
            if (itunesData.results && itunesData.results[0] && itunesData.results[0].artworkUrl100) {
                return itunesData.results[0].artworkUrl100.replace('100x100', '300x300');
            }
            
            // Próba 3: Deezer API
            const deezerResponse = await fetch(
                `https://api.deezer.com/search?q=${encodeURIComponent(artist + ' ' + title)}&limit=1`
            );
            
            const deezerData = await deezerResponse.json();
            
            if (deezerData.data && deezerData.data[0] && deezerData.data[0].album && deezerData.data[0].album.cover_medium) {
                return deezerData.data[0].album.cover_medium;
            }
            
            throw new Error('Nie znaleziono okładki');
            
        } catch (error) {
            console.error('Błąd pobierania okładki:', error);
            return this.getDefaultCover();
        }
    }

    getDefaultCover() {
        // Losowe tło gdy nie ma okładki
        const colors = [
            'linear-gradient(45deg, #FF0080, #00FFCC)',
            'linear-gradient(45deg, #667eea, #764ba2)',
            'linear-gradient(45deg, #f093fb, #f5576c)',
            'linear-gradient(45deg, #4facfe, #00f2fe)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    setupEventListeners() {
        // Przyciski kontrolne
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevSong());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextSong());
        
        // Suwaki
        document.getElementById('progressBar').addEventListener('input', (e) => this.seek(e.target.value));
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.audio.volume = e.target.value / 100;
        });
        
        // Wyszukiwanie
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchSongs(e.target.value));
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchSongs(document.getElementById('searchInput').value);
        });
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshCovers();
        });
        
        // Eventy audio
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.nextSong());
    }

    loadSong(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentIndex = index;
        const song = this.playlist[index];
        
        // Ustaw źródło audio
        this.audio.src = song.file;
        
        // Aktualizuj UI
        document.getElementById('currentTitle').textContent = song.title;
        document.getElementById('currentArtist').textContent = song.artist;
        
        // Ustaw okładkę
        const coverImg = document.getElementById('currentCover');
        if (song.cover.startsWith('http') || song.cover.startsWith('https')) {
            coverImg.src = song.cover;
        } else {
            coverImg.style.background = song.cover;
            coverImg.src = '';
        }
        
        // Podświetl aktualny utwór w playliście
        this.highlightCurrentSong();
        
        // Automatyczne odtwarzanie
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
        this.audio.play();
        this.isPlaying = true;
        document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';
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
        const duration = this.audio.duration;
        this.audio.currentTime = (value / 100) * duration;
    }

    updateProgress() {
        if (!this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        document.getElementById('progressBar').value = progress;
        
        // Formatuj czas
        document.getElementById('currentTime').textContent = 
            this.formatTime(this.audio.currentTime);
    }

    updateDuration() {
        document.getElementById('duration').textContent = 
            this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            songElement.dataset.index = index;
            
            songElement.innerHTML = `
                <img class="song-cover" src="${song.cover || this.getDefaultCover()}" 
                     alt="${song.title}" 
                     onerror="this.style.background='${this.getDefaultCover()}'">
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-duration">${this.getRandomDuration()}</div>
            `;
            
            songElement.addEventListener('click', () => this.loadSong(index));
            playlistElement.appendChild(songElement);
        });
    }

    updatePlaylistItem(index) {
        const song = this.playlist[index];
        const songElement = document.querySelector(`.song-item[data-index="${index}"]`);
        
        if (songElement) {
            const coverImg = songElement.querySelector('.song-cover');
            if (song.cover.startsWith('http') || song.cover.startsWith('https')) {
                coverImg.src = song.cover;
            } else {
                coverImg.style.background = song.cover;
                coverImg.src = '';
            }
        }
    }

    highlightCurrentSong() {
        document.querySelectorAll('.song-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const currentSong = document.querySelector(`.song-item[data-index="${this.currentIndex}"]`);
        if (currentSong) {
            currentSong.classList.add('active');
        }
    }

    searchSongs(query) {
        if (!query.trim()) {
            this.renderPlaylist();
            return;
        }
        
        const filtered = this.playlist.filter(song => 
            song.title.toLowerCase().includes(query.toLowerCase()) ||
            song.artist.toLowerCase().includes(query.toLowerCase())
        );
        
        const playlistElement = document.getElementById('playlist');
        playlistElement.innerHTML = '';
        
        filtered.forEach((song, index) => {
            const originalIndex = this.playlist.findIndex(s => 
                s.title === song.title && s.artist === song.artist
            );
            
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            songElement.dataset.index = originalIndex;
            
            songElement.innerHTML = `
                <img class="song-cover" src="${song.cover || this.getDefaultCover()}" 
                     alt="${song.title}">
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-duration">${this.getRandomDuration()}</div>
            `;
            
            songElement.addEventListener('click', () => this.loadSong(originalIndex));
            playlistElement.appendChild(songElement);
        });
    }

    async refreshCovers() {
        if (confirm('Czy na pewno chcesz ponownie pobrać wszystkie okładki?')) {
            await this.fetchAllCovers();
            alert('Okładki zostały zaktualizowane!');
        }
    }

    updateSongCount() {
        document.getElementById('songCount').textContent = this.playlist.length;
    }

    getRandomDuration() {
        // Dla przykładu - w rzeczywistości pobierz z metadata
        const mins = Math.floor(Math.random() * 4) + 2;
        const secs = Math.floor(Math.random() * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new MusicPlayer();
});

// Obsługa przeciągania i upuszczania plików
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.style.backgroundColor = '';
    
    // Tutaj można dodać obsługę dodawania własnych plików MP3
    alert('Funkcja dodawania plików wymaga backendu!');
});
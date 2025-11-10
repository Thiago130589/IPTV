// VARIÁVEIS GLOBAIS
let globalPlaylist = []; // Lista completa de canais
let currentPlayer = null;
const FAVORITES_KEY = 'm3u_player_favorites';

// --- FUNÇÕES DE UTILIDADE ---

// Função para extrair nome e URL do arquivo M3U (suporta formato EXTM3U)
function parseM3U(m3uContent) {
    const lines = m3uContent.split('\n');
    let channels = [];
    let currentChannel = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            // Linha que contém o nome e metadados do canal
            const nameMatch = line.match(/,(.*)$/);
            currentChannel.name = nameMatch ? nameMatch[1].trim() : 'Canal Desconhecido';
            
            // Tenta obter o link da próxima linha
            let nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
            if (nextLine.startsWith('http')) {
                currentChannel.url = nextLine;
                // Adiciona e reseta
                channels.push(currentChannel);
                currentChannel = {};
            }
        }
    }
    return channels;
}

// Carrega os favoritos do Local Storage
function getFavorites() {
    const favorites = localStorage.getItem(FAVORITES_KEY);
    return favorites ? JSON.parse(favorites) : [];
}

// Salva os favoritos no Local Storage
function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

// --- FUNÇÕES DE CARREGAMENTO E PLAYER ---

// 1. Carrega a lista M3U a partir do arquivo local
function carregarListaM3U(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    const reader = new FileReader();

    reader.onload = function(e) {
        const m3uContent = e.target.result;
        globalPlaylist = parseM3U(m3uContent);
        
        if (globalPlaylist.length > 0) {
            alert(`Lista carregada com sucesso! ${globalPlaylist.length} canais encontrados.`);
            renderChannelList(globalPlaylist, 'all');
        } else {
            alert("Não foi possível encontrar canais válidos no arquivo M3U fornecido.");
        }
    };
    
    reader.onerror = function(e) {
        console.error("Erro ao ler o arquivo:", e);
        alert("Erro ao ler o arquivo M3U.");
    };

    // Lê o arquivo como texto
    reader.readAsText(file);
}

// 2. Inicializa e reproduz o canal
function playChannel(channelUrl, channelName) {
    const videoElement = document.getElementById('media-player');
    const currentChannelNameElement = document.getElementById('current-channel-name');
    
    currentChannelNameElement.textContent = channelName;

    // Se já existe um player HLS, destrua-o para carregar um novo
    if (currentPlayer && currentPlayer.destroy) {
        currentPlayer.destroy();
    }
    
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(channelUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log(`Reproduzindo: ${channelName}`);
            videoElement.play().catch(e => {
                console.warn("Reprodução automática bloqueada. Usuário deve iniciar.");
            });
        });
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                alert(`Erro ao reproduzir o canal (${channelName}): ${data.type}`);
            }
        });
        currentPlayer = hls; // Salva a instância HLS
        
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Suporte nativo (Safari, iOS)
        videoElement.src = channelUrl;
        videoElement.play();
        currentPlayer = videoElement; // Salva o elemento de vídeo como 'player'
    } else {
        alert("Seu navegador não suporta a reprodução deste formato de stream (M3U8).");
        return;
    }

    // Atualiza o estado do botão de Favoritos e Cast
    updateFavoriteButton(channelName);
    document.getElementById('favorite-button').disabled = false;
    document.getElementById('cast-button').disabled = false;
}

// --- FUNÇÕES DE LISTA E UI ---

// Filtra e renderiza a lista de canais (chamada ao carregar e pesquisar)
function renderChannelList(channelsToRender, view) {
    const listElement = document.getElementById('channelList');
    listElement.innerHTML = '';
    
    const favorites = getFavorites();

    if (channelsToRender.length === 0) {
        listElement.innerHTML = `<li class="placeholder-channel">Nenhum canal encontrado na lista atual ou na pesquisa.</li>`;
        return;
    }

    channelsToRender.forEach(channel => {
        const isFavorite = favorites.includes(channel.name);
        
        // Se a view for 'favorites' e o canal não for favorito, pular
        if (view === 'favorites' && !isFavorite) {
            return;
        }

        const listItem = document.createElement('li');
        listItem.textContent = channel.name;
        listItem.dataset.url = channel.url;
        listItem.onclick = () => playChannel(channel.url, channel.name);
        
        // Adiciona classe de favorito para estilização se estiver na aba 'all'
        if (isFavorite && view === 'all') {
            listItem.classList.add('favorite-item');
        }

        listElement.appendChild(listItem);
    });
    
    if (listElement.innerHTML === '') {
         listElement.innerHTML = `<li class="placeholder-channel">Nenhum canal favorito. Adicione um canal na lista "Todos".</li>`;
    }
    
    // Marca a aba ativa
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${view}`).classList.add('active');
}

// Filtra os canais com base no input de pesquisa
function filterChannels() {
    const searchTerm = document.getElementById('channelSearch').value.toLowerCase();
    const activeTab = document.querySelector('.tab.active').id.replace('tab-', '');

    let listToFilter = activeTab === 'all' 
        ? globalPlaylist 
        : globalPlaylist.filter(c => getFavorites().includes(c.name));
        
    const filteredChannels = listToFilter.filter(channel => 
        channel.name.toLowerCase().includes(searchTerm)
    );
    
    // Renderiza o resultado da pesquisa, respeitando a aba ativa
    renderChannelList(filteredChannels, activeTab);
}

// Alterna entre as abas 'Todos' e 'Favoritos'
function showChannels(view) {
    if (view === 'favorites') {
        const favorites = getFavorites();
        const favoriteChannels = globalPlaylist.filter(c => favorites.includes(c.name));
        renderChannelList(favoriteChannels, 'favorites');
    } else {
        renderChannelList(globalPlaylist, 'all');
    }
}

// --- FUNÇÕES DE INTERAÇÃO (FAVORITO / CAST) ---

// Atualiza o botão de favorito visualmente
function updateFavoriteButton(channelName) {
    const favoriteBtn = document.getElementById('favorite-button');
    const favorites = getFavorites();
    
    if (favorites.includes(channelName)) {
        favoriteBtn.classList.add('active');
        favoriteBtn.textContent = '★ Remover Favorito';
    } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.textContent = '⭐ Favoritar';
    }
}

// Adiciona/Remove o canal atual dos favoritos
function toggleFavorite() {
    const channelName = document.getElementById('current-channel-name').textContent;
    if (channelName === 'Nenhum Canal Selecionado') return;

    let favorites = getFavorites();
    const index = favorites.indexOf(channelName);

    if (index > -1) {
        // Remover
        favorites.splice(index, 1);
    } else {
        // Adicionar
        favorites.push(channelName);
    }

    saveFavorites(favorites);
    updateFavoriteButton(channelName);
    
    // Atualiza a lista lateral se estiver na aba de favoritos
    const activeTab = document.querySelector('.tab.active').id.replace('tab-', '');
    if (activeTab === 'favorites' || activeTab === 'all') {
        showChannels(activeTab);
    }
}


// Tenta iniciar a transmissão usando a API de Media Session/Casting nativa
function requestCast() {
    const videoElement = document.getElementById('media-player');
    
    if (videoElement.paused) {
        alert("O vídeo deve estar em reprodução para iniciar a transmissão.");
        return;
    }

    if ('requestMediaKeySystemAccess' in navigator) {
        // Tenta acionar o pop-up de seleção de dispositivo (depende muito do navegador)
        videoElement.requestPictureInPicture()
            .catch(e => {
                console.warn("Falha ao entrar em Picture-in-Picture. Tentando botão nativo.");
            });
            
        alert("Tentando iniciar a transmissão... (Depende do suporte do seu navegador. Geralmente, o ícone de transmissão aparece DENTRO do player de vídeo.)");
        
    } else {
        alert("Seu navegador não suporta a API de transmissão (Casting) nativa para esta implementação simples.");
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    // Garante que a lista de canais está vazia e pronta
    showChannels('all');
});
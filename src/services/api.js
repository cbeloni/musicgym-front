import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
});

// Configura o token de autenticação padrão nas requisições do Axios
export function setAuthHeader(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

let onLogout = null;

export function setLogoutHandler(handler) {
  onLogout = typeof handler === "function" ? handler : null;
}

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// Inicializa o header caso já exista o token salvo no localStorage
const savedToken = localStorage.getItem("access_token");
if (savedToken) {
  setAuthHeader(savedToken);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Só tenta refresh se for 401
    if (error?.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Evita loop infinito: se já tentou refrescar (retry) ou se é a própria req de refresh
    if (originalRequest._retry) {
      return Promise.reject(error);
    }
    if (originalRequest.url && originalRequest.url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    // Se já está tentando renovar, fila esta requisição
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const savedRefreshToken = localStorage.getItem("refresh_token");
      // Se não há refresh token salvo (ex: sessão antiga anterior à correção),
      // apenas rejeita a requisição original sem deslogar abruptamente
      if (!savedRefreshToken) {
        return Promise.reject(error);
      }

      const { access_token, refresh_token } = await refreshToken(savedRefreshToken);

      // Atualiza o access token
      localStorage.setItem("access_token", access_token);
      setAuthHeader(access_token);

      // Atualiza o refresh token (rotação: o servidor revogou o antigo)
      localStorage.setItem("refresh_token", refresh_token);

      processQueue(null, access_token);
      originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Se o refresh endpoint retornou 401, o refresh token é inválido/expirado → desloga
      if (refreshError?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        setAuthHeader(null);
        if (onLogout) {
          onLogout();
        }
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

/* ==========================================
   AUTHENTICATION ENDPOINTS
   ========================================== */

export async function register(email, displayName, password) {
  const { data } = await api.post("/auth/register", {
    email,
    display_name: displayName,
    password
  });
  return data;
}

export async function login(email, password) {
  const { data } = await api.post("/auth/login", {
    email,
    password
  });
  return data;
}

export async function fetchGoogleAuthUrl() {
  const { data } = await api.get("/auth/google/url");
  return data.url;
}

export async function loginGoogleCallback(idToken) {
  const { data } = await api.post("/auth/google/callback", {
    id_token: idToken
  });
  return data;
}

export async function refreshToken(refresh_token) {
  const { data } = await api.post("/auth/refresh", {
    refresh_token
  });
  return data;
}

/* ==========================================
   SETLISTS ENDPOINTS
   ========================================== */

export async function fetchMainSetlists() {
  const { data } = await api.get("/setlists");
  return data;
}

export async function fetchSetlist(id) {
  const { data } = await api.get(`/setlists/${id}`);
  return data;
}

export async function fetchSetlistByToken(shareToken) {
  const { data } = await api.get(`/setlists/share/${shareToken}`);
  return data;
}

export async function fetchChordSheetByToken(shareToken) {
  const { data } = await api.get(`/chord-sheets/share/${shareToken}`);
  return data;
}

export async function createSetlist(name, description, isPrivate = false) {
  const { data } = await api.post("/setlists", {
    name,
    description,
    is_private: isPrivate
  });
  return data;
}

export async function deleteSetlist(id) {
  await api.delete(`/setlists/${id}`);
}

export async function reorderSetlist(id, orderedItemIds) {
  const { data } = await api.put(`/setlists/${id}/reorder`, {
    ordered_item_ids: orderedItemIds
  });
  return data;
}

export async function addSongToSetlist(setlistId, chordSheetId) {
  const { data } = await api.post(`/setlists/${setlistId}/items`, {
    chord_sheet_id: chordSheetId
  });
  return data;
}

export async function removeSongFromSetlist(setlistId, itemId) {
  const { data } = await api.delete(`/setlists/${setlistId}/items/${itemId}`);
  return data;
}

/* ==========================================
   CHORD SHEETS ENDPOINTS
   ========================================== */

export async function fetchChordSheets() {
  const { data } = await api.get("/chord-sheets");
  return data;
}

export async function fetchChordSheet(id) {
  const { data } = await api.get(`/chord-sheets/${id}`);
  return data;
}

/**
 * Resolve o src de um item de `image_data`.
 * - Se a cifra estiver armazenada no bucket (is_bucket_storage), o item é um
 *   caminho (chave) e deve ser montado com o bucket_base_url.
 * - Caso contrário, o item já é um data URI (legado) e é retornado como está.
 */
export function resolveChordSheetAsset(chordSheet, item) {
  if (
    chordSheet?.is_bucket_storage &&
    chordSheet?.bucket_base_url &&
    item &&
    !item.startsWith("data:")
  ) {
    return `${chordSheet.bucket_base_url.replace(/\/+$/, "")}/${item.replace(/^\/+/, "")}`;
  }
  return item;
}

/** Detecta se um item de image_data é um PDF (data URI de PDF ou caminho .pdf). */
export function isPdfAsset(item) {
  return !!item && (item.startsWith("data:application/pdf") || /\.pdf($|\?)/i.test(item));
}

export async function createChordSheet(
  title,
  artist,
  keySignature,
  content,
  imageData,
  youtubeUrl,
  scrollSpeed = 1,
  isPrivate = false
) {
  const { data } = await api.post("/chord-sheets", {
    title,
    artist,
    key_signature: keySignature || null,
    content,
    image_data: imageData && imageData.length ? imageData : null,
    youtube_url: youtubeUrl || null,
    scroll_speed: scrollSpeed,
    is_private: isPrivate
  });
  return data;
}

export async function updateChordSheet(
  id,
  title,
  artist,
  keySignature,
  content,
  imageData,
  youtubeUrl,
  scrollSpeed = 1,
  isPrivate = false
) {
  const { data } = await api.put(`/chord-sheets/${id}`, {
    title,
    artist,
    key_signature: keySignature || null,
    content,
    image_data: imageData && imageData.length ? imageData : null,
    youtube_url: youtubeUrl || null,
    scroll_speed: scrollSpeed,
    is_private: isPrivate
  });
  return data;
}

export async function updateChordSheetScrollSpeed(id, scrollSpeed) {
  const { data } = await api.put(`/chord-sheets/${id}/scroll-speed`, {
    scroll_speed: scrollSpeed
  });
  return data;
}

export async function deleteChordSheet(id) {
  await api.delete(`/chord-sheets/${id}`);
}

export async function recordChordSheetView(id) {
  await api.post(`/chord-sheets/${id}/view`);
}

export async function fetchRecentlyViewedChordSheets() {
  const { data } = await api.get("/chord-sheets/recently-viewed");
  return data;
}

export async function fetchTabVisibility(id) {
  const { data } = await api.get(`/chord-sheets/${id}/tab-visibility`);
  return data;
}

export async function setTabVisibility(id, tabHidden) {
  await api.put(`/chord-sheets/${id}/tab-visibility`, { tab_hidden: tabHidden });
}

/* ==========================================
   SHARING ENDPOINTS
   ========================================== */

export async function searchUsers(query) {
  const { data } = await api.get("/auth/users/search", { params: { q: query } });
  return data;
}

export async function shareChordSheet(id, email) {
  const { data } = await api.post(`/chord-sheets/${id}/share`, { email });
  return data;
}

export async function unshareChordSheet(id, userId) {
  await api.delete(`/chord-sheets/${id}/share/${userId}`);
}

export async function fetchChordSheetSharedUsers(id) {
  const { data } = await api.get(`/chord-sheets/${id}/shared-users`);
  return data;
}

export async function fetchSharedChordSheets() {
  const { data } = await api.get("/chord-sheets/shared-with-me");
  return data;
}

export async function shareSetlist(id, email) {
  const { data } = await api.post(`/setlists/${id}/share`, { email });
  return data;
}

export async function unshareSetlist(id, userId) {
  await api.delete(`/setlists/${id}/share/${userId}`);
}

export async function fetchSetlistSharedUsers(id) {
  const { data } = await api.get(`/setlists/${id}/shared-users`);
  return data;
}

export async function fetchSharedSetlists() {
  const { data } = await api.get("/setlists/shared-with-me");
  return data;
}

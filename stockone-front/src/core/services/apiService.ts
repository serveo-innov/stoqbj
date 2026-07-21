import { API_BASE_URL } from '../../environment';

const getToken = (): string | null => localStorage.getItem('stockone_token');

const getShopId = (): number | null => {
  const user = JSON.parse(localStorage.getItem('stockone_user') || 'null');

  if (user?.role === 'super_admin') {
    // Le Super Admin a acces a toutes les donnees mais doit agir dans le
    // contexte d'une boutique precise (voir activeShopSlice / "Entrer dans
    // la boutique" depuis Admin > Boutiques). Sans boutique active, aucune
    // donnee scopee n'est envoyee (comportement inchange : le backend
    // renverra "shop_id requis pour le Super Admin").
    const activeId = localStorage.getItem('stockone_active_shop_id');
    return activeId ? JSON.parse(activeId) : null;
  }

  return user?.shop?.id ?? null;
};

interface RequestOptions {
  method?: string;
  body?:   object;
  params?: Record<string, string | number | boolean | undefined>;
  shopId?: number | null;
}

const buildUrl = (
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  shopId?: number | null
): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  // Super Admin : injecter shop_id si fourni
  if (shopId !== undefined && shopId !== null) {
    url.searchParams.set('shop_id', String(shopId));
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

export const apiRequest = async <T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { method = 'GET', body, params, shopId } = options;

  const token  = getToken();
  const resolvedShopId = shopId ?? getShopId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = buildUrl(endpoint, params, resolvedShopId ?? undefined);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data?.message || `Erreur ${response.status}`;
    throw { status: response.status, message: error, errors: data?.errors };
  }

  return data as T;
};

// Helpers raccourcis
export const api = {
  get:    <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>, shopId?: number | null) =>
    apiRequest<T>(endpoint, { method: 'GET', params, shopId }),

  post:   <T>(endpoint: string, body?: object, shopId?: number | null) =>
    apiRequest<T>(endpoint, { method: 'POST', body, shopId }),

  put:    <T>(endpoint: string, body?: object, shopId?: number | null) =>
    apiRequest<T>(endpoint, { method: 'PUT', body, shopId }),

  delete: <T>(endpoint: string, shopId?: number | null) =>
    apiRequest<T>(endpoint, { method: 'DELETE', shopId }),
};

export default api;

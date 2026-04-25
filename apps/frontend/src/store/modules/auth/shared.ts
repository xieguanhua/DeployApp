import { localStg, sessionStg } from '@/utils/storage';

type AuthStorageType = 'local' | 'session';

function getAuthStorage(type: AuthStorageType) {
  return type === 'local' ? localStg : sessionStg;
}

/** Get token */
export function getToken() {
  return localStg.get('token') || sessionStg.get('token') || '';
}

/** Get refresh token */
export function getRefreshToken() {
  return localStg.get('refreshToken') || sessionStg.get('refreshToken') || '';
}

/** Set auth storage */
export function setAuthStorage(loginToken: Api.Auth.LoginToken, rememberMe = true) {
  clearAuthStorage();

  const storageType: AuthStorageType = rememberMe ? 'local' : 'session';
  const storage = getAuthStorage(storageType);

  storage.set('token', loginToken.token);
  storage.set('refreshToken', loginToken.refreshToken);
}

/** Get remember me */
export function getRememberMe() {
  return localStg.get('rememberMe') ?? true;
}

/** Set remember me */
export function setRememberMe(rememberMe: boolean) {
  localStg.set('rememberMe', rememberMe);
}

/** Get auth storage type by current token location */
export function getCurrentAuthStorageType(): AuthStorageType {
  const hasSessionToken = Boolean(sessionStg.get('token'));
  return hasSessionToken ? 'session' : 'local';
}

/** Clear auth storage */
export function clearAuthStorage() {
  localStg.remove('token');
  localStg.remove('refreshToken');
  sessionStg.remove('token');
  sessionStg.remove('refreshToken');
}

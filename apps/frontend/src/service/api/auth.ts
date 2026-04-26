import { request } from '../request';

/**
 * Login
 *
 * @param account Account
 * @param password Password
 */
export function fetchLogin(account: string, password: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/login',
    method: 'post',
    data: {
      account,
      password
    }
  });
}

/** Get user info */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/auth/getUserInfo' });
}

/**
 * Refresh token
 *
 * @param refreshToken Refresh token
 */
export function fetchRefreshToken(refreshToken: string) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/refreshToken',
    method: 'post',
    data: {
      refreshToken
    }
  });
}

/** Send verification code */
export function fetchSendCode(data: Api.Auth.SendCodeParams) {
  return request<{ ok: boolean }>({
    url: '/auth/send-code',
    method: 'post',
    data
  });
}

/** Login by verification code */
export function fetchLoginByCode(data: Api.Auth.LoginByCodeParams) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/login-by-code',
    method: 'post',
    data
  });
}

/** Register by verification code */
export function fetchRegisterByCode(data: Api.Auth.RegisterByCodeParams) {
  return request<Api.Auth.LoginToken>({
    url: '/auth/register-by-code',
    method: 'post',
    data
  });
}

/** Reset password by verification code */
export function fetchResetPasswordByCode(data: Api.Auth.ResetPasswordByCodeParams) {
  return request<{ ok: boolean }>({
    url: '/auth/reset-password-by-code',
    method: 'post',
    data
  });
}

/**
 * return custom backend error
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: '/auth/error', params: { code, msg } });
}

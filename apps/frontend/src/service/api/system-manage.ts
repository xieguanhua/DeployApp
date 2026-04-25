import { request } from '../request';

/** get role list */
export function fetchGetRoleList(params?: Api.SystemManage.RoleSearchParams) {
  return request<Api.SystemManage.RoleList>({
    url: '/admin/system/roles',
    method: 'get',
    params
  });
}

/**
 * get all roles
 *
 * these roles are all enabled
 */
export function fetchGetAllRoles() {
  return request<Api.SystemManage.AllRole[] | { items: Api.SystemManage.AllRole[] }>({
    url: '/admin/system/roles/all',
    method: 'get'
  }).then(res => {
    if (Array.isArray(res.data)) {
      return res as any;
    }
    return {
      ...res,
      data: (res.data as any)?.items || []
    } as any;
  });
}

/** get user list */
export function fetchGetUserList(params?: Api.SystemManage.UserSearchParams) {
  return request<Api.SystemManage.UserList>({
    url: '/admin/system/users',
    method: 'get',
    params
  });
}

/** get user detail by id */
export function fetchGetUserDetail(id: number) {
  return request<{ item: Api.SystemManage.User }>({
    url: '/admin/system/users/detail',
    method: 'get',
    params: { id }
  });
}

/** get menu list */
export function fetchGetMenuList() {
  return request<Api.SystemManage.MenuList>({
    url: '/admin/system/menus',
    method: 'get'
  });
}

/** get all pages */
export function fetchGetAllPages() {
  return request<string[] | { items: string[] }>({
    url: '/admin/system/pages',
    method: 'get'
  }).then(res => {
    if (Array.isArray(res.data)) {
      return res as any;
    }
    return {
      ...res,
      data: (res.data as any)?.items || []
    } as any;
  });
}

/** get menu tree */
export function fetchGetMenuTree() {
  return request<Api.SystemManage.MenuTree[] | { items: Api.SystemManage.MenuTree[] }>({
    url: '/admin/system/menu-tree',
    method: 'get'
  }).then(res => {
    if (Array.isArray(res.data)) {
      return res as any;
    }
    return {
      ...res,
      data: (res.data as any)?.items || []
    } as any;
  });
}

export function fetchUpsertUser(data: Partial<Api.SystemManage.User>) {
  return request({
    url: '/admin/system/users/upsert',
    method: 'post',
    data
  });
}

export function fetchDeleteUser(id: number) {
  return request({
    url: '/admin/system/users/delete',
    method: 'post',
    data: { id }
  });
}

export function fetchUpsertRole(data: Partial<Api.SystemManage.Role>) {
  return request({
    url: '/admin/system/roles/upsert',
    method: 'post',
    data
  });
}

export function fetchDeleteRole(id: number) {
  return request({
    url: '/admin/system/roles/delete',
    method: 'post',
    data: { id }
  });
}

export function fetchUpsertMenu(data: Partial<Api.SystemManage.Menu>) {
  return request({
    url: '/admin/system/menus/upsert',
    method: 'post',
    data
  });
}

export function fetchDeleteMenu(id: number) {
  return request({
    url: '/admin/system/menus/delete',
    method: 'post',
    data: { id }
  });
}

export function fetchGetRoleMenuAuth(roleId: number) {
  return request<{ item: { home: string; menuIds: number[] } | { home: string; menuIds: number[]; buttonCodes?: string[] } }>({
    url: '/admin/system/roles/menu-auth',
    method: 'get',
    params: { roleId }
  });
}

export function fetchSaveRoleMenuAuth(data: { roleId: number; home: string; menuIds: number[] }) {
  return request({
    url: '/admin/system/roles/menu-auth',
    method: 'post',
    data
  });
}

export function fetchGetSystemButtons() {
  return request<Array<{ code: string; desc: string }> | { items: Array<{ code: string; desc: string }> }>({
    url: '/admin/system/buttons',
    method: 'get'
  }).then(res => {
    if (Array.isArray(res.data)) return res as any;
    return { ...res, data: (res.data as any)?.items || [] } as any;
  });
}

export function fetchGetRoleButtonAuth(roleId: number) {
  return request<string[] | { items: string[] }>({
    url: '/admin/system/roles/button-auth',
    method: 'get',
    params: { roleId }
  }).then(res => {
    if (Array.isArray(res.data)) return res as any;
    return { ...res, data: (res.data as any)?.items || [] } as any;
  });
}

export function fetchSaveRoleButtonAuth(data: { roleId: number; buttonCodes: string[] }) {
  return request({
    url: '/admin/system/roles/button-auth',
    method: 'post',
    data
  });
}

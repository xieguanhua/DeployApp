import { request } from '../request';

/** Get sellable products for user home */
export function fetchPublicProducts() {
  return request<{ items: Api.Mall.Product[] }>({
    url: '/public/products/list'
  });
}

/** Get products for admin operations */
export function fetchAdminProducts() {
  return request<{ items: Api.Mall.Product[] }>({
    url: '/admin/products/list'
  });
}

/** Upsert product by admin */
export function fetchAdminUpsertProduct(data: Api.Mall.ProductUpsertParams) {
  return request<{ product: Api.Mall.Product }>({
    url: '/admin/products/upsert',
    method: 'post',
    data
  });
}

/** Delete product by admin */
export function fetchAdminDeleteProduct(data: { productCode: string }) {
  return request<{ ok: boolean }>({
    url: '/admin/products/delete',
    method: 'post',
    data
  });
}

/** Upload file for product assets */
export function fetchAdminUploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ file: Api.Mall.AdminUploadFileResult }>({
    url: '/admin/uploads/file',
    method: 'post',
    data: formData
  });
}

/** Create purchase order */
export function fetchCreateOrder(data: Api.Mall.CreateOrderParams) {
  return request<Api.Mall.CreateOrderResult>({
    url: '/user/orders/create',
    method: 'post',
    data
  });
}

/** Get current user orders */
export function fetchUserOrders() {
  return request<{ items: Api.Mall.Order[] }>({
    url: '/user/orders/list'
  });
}

/** Get purchased products with activation status */
export function fetchUserPurchasedProducts() {
  return request<{ items: Api.Mall.UserPurchasedProduct[] }>({
    url: '/user/products/purchased'
  });
}

/** Get user activation keys */
export function fetchUserCodes() {
  return request<{ items: any[] }>({
    url: '/user/codes/list'
  });
}

/** Get all orders for super admin */
export function fetchAdminOrders(params?: Api.Mall.AdminOrderListParams) {
  return request<{ items: Api.Mall.Order[] }>({
    url: '/admin/orders/list',
    params
  });
}

/** Create activation keys manually */
export function fetchAdminCreateKeys(data: Api.Mall.AdminCreateKeysParams) {
  return request<{ keys: string[] }>({
    url: '/admin/keys/create',
    method: 'post',
    data
  });
}

/** Change current user password */
export function fetchChangePassword(data: Api.Mall.ChangePasswordParams) {
  return request<{ ok: boolean }>({
    url: '/auth/change-password',
    method: 'post',
    data
  });
}

/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  namespace Common {
    /** common params of paginating */
    interface PaginatingCommonParams {
      /** current page number */
      current: number;
      /** page size */
      size: number;
      /** total count */
      total: number;
    }

    /** common params of paginating query list data */
    interface PaginatingQueryRecord<T = any> extends PaginatingCommonParams {
      records: T[];
    }

    /** common search params of table */
    type CommonSearchParams = Pick<Common.PaginatingCommonParams, 'current' | 'size'>;

    /**
     * enable status
     *
     * - "1": enabled
     * - "2": disabled
     */
    type EnableStatus = '1' | '2';

    /** common record */
    type CommonRecord<T = any> = {
      /** record id */
      id: number;
      /** record creator */
      createBy: string;
      /** record create time */
      createTime: string;
      /** record updater */
      updateBy: string;
      /** record update time */
      updateTime: string;
      /** record status */
      status: EnableStatus;
    } & T;
  }

  /**
   * Namespace Auth
   *
   * Backend api module: "auth"
   */
  namespace Auth {
    type VerificationChannel = 'sms' | 'email';
    type VerificationBizType = 'login' | 'register' | 'reset_password';

    interface LoginToken {
      token: string;
      refreshToken: string;
      user?: {
        id: string | number;
        username: string;
        role: 'admin' | 'user';
      };
    }

    interface UserInfo {
      userId: string;
      userName: string;
      roles: string[];
      buttons: string[];
    }

    interface SendCodeParams {
      channel?: VerificationChannel;
      bizType: VerificationBizType;
      target: string;
    }

    interface LoginByCodeParams {
      channel?: VerificationChannel;
      target: string;
      code: string;
    }

    interface RegisterByCodeParams extends LoginByCodeParams {
      username?: string;
      password: string;
    }

    interface ResetPasswordByCodeParams extends LoginByCodeParams {
      newPassword: string;
    }
  }

  namespace Mall {
    type PaymentChannel = 'alipay' | 'wechat';
    type ClientType = 'windows' | 'mac' | 'ios' | 'android' | 'linux' | 'web';

    interface InstallPackage {
      platform: ClientType;
      packageName: string;
      packageUrl: string;
    }

    interface Product {
      id: number | string;
      product_code: string;
      product_name: string;
      client_type: ClientType;
      price_cents: number;
      is_active?: boolean;
      cover_image_url?: string | null;
      promo_image_urls?: string[];
      install_packages?: InstallPackage[];
    }

    interface CreateOrderParams {
      productCode: string;
      paymentChannel: PaymentChannel;
    }

    interface Order {
      id: number | string;
      order_no?: string | null;
      user_id?: number | string | null;
      username?: string;
      product_code: string;
      amount_cents: number;
      payment_channel: PaymentChannel | 'manual';
      payment_status: string;
      assigned_key_code?: string | null;
      paid_at?: string | null;
      created_at: string;
      updated_at?: string;
      record_type?: 'order' | 'manual';
    }

    interface AdminCreateKeysParams {
      productCode: string;
      count: number;
      prefix?: string;
    }

    interface AdminOrderListParams {
      productCode?: string;
      paymentStatus?: string;
      source?: 'order' | 'manual' | 'all';
      keyword?: string;
    }

    interface ChangePasswordParams {
      oldPassword: string;
      newPassword: string;
    }

    interface UserPurchasedProduct {
      product_code: string;
      product_name: string;
      client_type: ClientType;
      price_cents: number;
      is_active: boolean;
      cover_image_url?: string | null;
      promo_image_urls?: string[];
      install_packages?: InstallPackage[];
      activated_flag: number;
      device_ids: string[];
    }

    interface AdminUploadFileResult {
      fileName: string;
      filePath: string;
      url: string;
      size: number;
    }

    interface ProductUpsertParams {
      productCode: string;
      productName: string;
      clientType?: ClientType;
      priceCents: number;
      isActive?: boolean;
      coverImageUrl: string;
      promoImageUrls: string[];
      installPackages: InstallPackage[];
    }

    interface CreateOrderResult {
      order: Order;
      payInfo: {
        channel: PaymentChannel;
        bizContent?: string;
        signature?: string;
        message?: string;
      };
    }
  }

  /**
   * Namespace Route
   *
   * Backend api module: "route"
   */
  namespace Route {
    type ElegantConstRoute = import('@elegant-router/types').ElegantConstRoute;

    interface MenuRoute extends ElegantConstRoute {
      id: string;
    }

    interface UserRoute {
      routes: MenuRoute[];
      home: import('@elegant-router/types').LastLevelRouteKey;
    }
  }

  /**
   * namespace SystemManage
   *
   * backend api module: "systemManage"
   */
  namespace SystemManage {
    /** role */
    type Role = Common.CommonRecord<{
      /** role name */
      roleName: string;
      /** role code */
      roleCode: string;
      /** role description */
      roleDesc: string;
    }>;

    /** role search params */
    type RoleSearchParams = Partial<
      Pick<Api.SystemManage.Role, 'roleName' | 'roleCode' | 'status'> & Common.CommonSearchParams
    >;

    /** role list */
    type RoleList = Common.PaginatingQueryRecord<Role>;

    /** all role */
    type AllRole = Pick<Role, 'id' | 'roleName' | 'roleCode'>;

    /**
     * user gender
     *
     * - "1": "male"
     * - "2": "female"
     */
    type UserGender = '1' | '2';

    /** user */
    type User = Common.CommonRecord<{
      /** user name */
      userName: string;
      /** user gender */
      userGender: UserGender;
      /** user nick name */
      nickName: string;
      /** user phone */
      userPhone: string;
      /** user email */
      userEmail: string;
      /** user role code collection */
      userRoles: string[];
    }>;

    /** user search params */
    type UserSearchParams = Partial<
      Pick<Api.SystemManage.User, 'userName' | 'userGender' | 'nickName' | 'userPhone' | 'userEmail' | 'status'> &
        Common.CommonSearchParams
    >;

    /** user list */
    type UserList = Common.PaginatingQueryRecord<User>;

    /**
     * menu type
     *
     * - "1": directory
     * - "2": menu
     */
    type MenuType = '1' | '2';

    type MenuButton = {
      /**
       * button code
       *
       * it can be used to control the button permission
       */
      code: string;
      /** button description */
      desc: string;
    };

    /**
     * icon type
     *
     * - "1": iconify icon
     * - "2": local icon
     */
    type IconType = '1' | '2';

    type MenuPropsOfRoute = Pick<
      import('vue-router').RouteMeta,
      | 'i18nKey'
      | 'keepAlive'
      | 'constant'
      | 'order'
      | 'href'
      | 'hideInMenu'
      | 'activeMenu'
      | 'multiTab'
      | 'fixedIndexInTab'
      | 'query'
    >;

    type Menu = Common.CommonRecord<{
      /** parent menu id */
      parentId: number;
      /** menu type */
      menuType: MenuType;
      /** menu name */
      menuName: string;
      /** route name */
      routeName: string;
      /** route path */
      routePath: string;
      /** component */
      component?: string;
      /** iconify icon name or local icon name */
      icon: string;
      /** icon type */
      iconType: IconType;
      /** buttons */
      buttons?: MenuButton[] | null;
      /** children menu */
      children?: Menu[];
    }> &
      MenuPropsOfRoute;

    /** menu list */
    type MenuList = Common.PaginatingQueryRecord<Menu>;

    type MenuTree = {
      id: number;
      label: string;
      pId: number;
      children?: MenuTree[];
    };
  }
}

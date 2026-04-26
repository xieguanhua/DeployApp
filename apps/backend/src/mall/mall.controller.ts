import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { MallService } from './mall.service';
import { VerificationService } from '../auth-verification/verification.service';
import type { VerificationChannel } from '../auth-verification/types';

type JwtPayload = {
  uid: number;
  role: 'admin' | 'user';
  username: string;
};
const platformEnum = z.enum(['windows', 'mac', 'ios', 'android', 'linux', 'web']);

@Controller('api')
export class MallController {
  constructor(
    private readonly mallService: MallService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly verificationService: VerificationService
  ) {}

  private signToken(payload: JwtPayload) {
    const secret = this.configService.get<string>('AUTH_JWT_SECRET') || this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-secret';
    return this.jwtService.sign(payload, { secret, expiresIn: '12h' });
  }

  private buildAuthTokens(payload: JwtPayload) {
    const token = this.signToken(payload);
    // 当前前端约定必须包含 refreshToken 字段；后端先返回同值，后续可切分独立刷新令牌。
    const refreshToken = this.signToken(payload);
    return { token, refreshToken };
  }

  private msg(lang: string | undefined, zh: string, en: string) {
    return lang?.toLowerCase().startsWith('en') ? en : zh;
  }

  private err(lang: string | undefined, zh: string, en: string, status: HttpStatus) {
    return new HttpException(this.msg(lang, zh, en), status);
  }

  private mapVerificationReason(lang: string | undefined, reason: string) {
    const dict: Record<string, { zh: string; en: string; status: HttpStatus }> = {
      channel_disabled: {
        zh: '验证码通道未启用',
        en: 'Verification channel is disabled',
        status: HttpStatus.BAD_REQUEST
      },
      channel_not_configured: {
        zh: '验证码通道未配置',
        en: 'Verification channel is not configured',
        status: HttpStatus.BAD_REQUEST
      },
      send_too_frequent: {
        zh: '发送过于频繁，请稍后重试',
        en: 'Too many requests, please try again later',
        status: HttpStatus.TOO_MANY_REQUESTS
      },
      ip_rate_limited: {
        zh: '请求频率过高，请稍后重试',
        en: 'Request rate is too high, please try again later',
        status: HttpStatus.TOO_MANY_REQUESTS
      },
      code_not_found: {
        zh: '验证码不存在',
        en: 'Verification code not found',
        status: HttpStatus.BAD_REQUEST
      },
      code_used: {
        zh: '验证码已使用',
        en: 'Verification code already used',
        status: HttpStatus.BAD_REQUEST
      },
      code_expired: {
        zh: '验证码已过期',
        en: 'Verification code expired',
        status: HttpStatus.BAD_REQUEST
      },
      code_locked: {
        zh: '验证码校验失败次数过多，请重新获取',
        en: 'Too many failed attempts, please request a new code',
        status: HttpStatus.BAD_REQUEST
      },
      code_invalid: {
        zh: '验证码错误',
        en: 'Invalid verification code',
        status: HttpStatus.BAD_REQUEST
      }
    };

    const fallback = {
      zh: '验证码校验失败',
      en: 'Verification failed',
      status: HttpStatus.BAD_REQUEST
    };
    const item = dict[reason] || fallback;
    return this.err(lang, item.zh, item.en, item.status);
  }

  private createUsernameByTarget(channel: VerificationChannel, target: string) {
    if (channel === 'email') {
      return `mail_${target.split('@')[0]}`.slice(0, 64);
    }
    const normalized = target.replace(/[^\d+]/g, '');
    return `phone_${normalized}`.slice(0, 64);
  }

  private inferChannelByTarget(target: string, lang?: string): VerificationChannel {
    const text = target.trim();
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneReg = /^\+?\d{6,20}$/;
    if (emailReg.test(text)) return 'email';
    if (phoneReg.test(text)) return 'sms';
    throw this.err(lang, '账号格式错误，请输入手机号或邮箱', 'Invalid account format, please input phone or email', HttpStatus.BAD_REQUEST);
  }

  private resolveRoleCode(role: JwtPayload['role']) {
    return role === 'admin' ? 'R_SUPER' : 'R_USER';
  }

  @Post('auth/register')
  async register(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z.object({ username: z.string().min(3).max(64), password: z.string().min(8).max(128) }).parse(body);
    const user = await this.mallService.createUser(dto.username, dto.password, 'user');
    if (!user) throw this.err(lang, '用户名已存在', 'Username already exists', HttpStatus.CONFLICT);
    const token = this.signToken({ uid: Number(user.id), role: 'user', username: user.username });
    return { ok: true, token, user: { id: Number(user.id), username: user.username, role: 'user' } };
  }

  @Post('auth/login')
  async login(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z
      .object({
        account: z.string().min(1).optional(),
        username: z.string().min(1).optional(),
        userName: z.string().min(1).optional(),
        email: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        password: z.string().min(8)
      })
      .parse(body);
    const account = dto.account || dto.username || dto.userName || dto.email || dto.phone || '';
    const user = await this.mallService.findUserByAccount(account);
    if (!user || !user.is_active) throw this.err(lang, '账号或密码错误', 'Invalid account or password', HttpStatus.UNAUTHORIZED);
    const ok = await this.mallService.verifyUserPassword(user, dto.password);
    if (!ok) throw this.err(lang, '账号或密码错误', 'Invalid account or password', HttpStatus.UNAUTHORIZED);
    const tokens = this.buildAuthTokens({ uid: Number(user.id), role: user.role, username: user.username });
    return { ok: true, ...tokens, user: { id: Number(user.id), username: user.username, role: user.role } };
  }

  @Post('auth/send-code')
  async sendCode(
    @Body() body: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('x-device-id') deviceId?: string,
    @Headers('accept-language') lang?: string
  ) {
    const dto = z
      .object({
        channel: z.enum(['sms', 'email']).optional(),
        bizType: z.enum(['login', 'register', 'reset_password']),
        target: z.string().min(3).max(256)
      })
      .parse(body);
    const channel = dto.channel || this.inferChannelByTarget(dto.target, lang);

    const existingUser = channel === 'email' ? await this.mallService.findUserByEmail(dto.target) : await this.mallService.findUserByPhone(dto.target);
    if (dto.bizType === 'register' && existingUser) {
      throw this.err(lang, '该账号已注册', 'Account already registered', HttpStatus.CONFLICT);
    }
    if ((dto.bizType === 'login' || dto.bizType === 'reset_password') && !existingUser) {
      throw this.err(lang, '账号不存在', 'Account does not exist', HttpStatus.NOT_FOUND);
    }

    const ip = forwardedFor?.split(',')?.[0]?.trim() || '';
    const result = await this.verificationService.sendCode({
      channel,
      bizType: dto.bizType,
      target: dto.target,
      ip,
      deviceId,
      lang
    });
    if (!result.ok) {
      throw this.mapVerificationReason(lang, result.reason);
    }

    return { ok: true };
  }

  @Post('auth/login-by-code')
  async loginByCode(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z
      .object({
        channel: z.enum(['sms', 'email']).optional(),
        target: z.string().min(3).max(256),
        code: z.string().min(4).max(16)
      })
      .parse(body);
    const channel = dto.channel || this.inferChannelByTarget(dto.target, lang);

    const verifyResult = await this.verificationService.verifyCode({
      channel,
      bizType: 'login',
      target: dto.target,
      code: dto.code,
      lang
    });
    if (!verifyResult.ok) throw this.mapVerificationReason(lang, verifyResult.reason);

    const user = channel === 'email' ? await this.mallService.findUserByEmail(dto.target) : await this.mallService.findUserByPhone(dto.target);
    if (!user || !user.is_active) {
      throw this.err(lang, '账号不存在或已禁用', 'Account does not exist or is disabled', HttpStatus.NOT_FOUND);
    }

    const tokens = this.buildAuthTokens({ uid: Number(user.id), role: user.role, username: user.username });
    return { ok: true, ...tokens, user: { id: Number(user.id), username: user.username, role: user.role } };
  }

  @Post('auth/register-by-code')
  async registerByCode(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z
      .object({
        channel: z.enum(['sms', 'email']).optional(),
        target: z.string().min(3).max(256),
        code: z.string().min(4).max(16),
        username: z.string().min(3).max(64).optional(),
        password: z.string().min(8).max(128)
      })
      .parse(body);
    const channel = dto.channel || this.inferChannelByTarget(dto.target, lang);

    const verifyResult = await this.verificationService.verifyCode({
      channel,
      bizType: 'register',
      target: dto.target,
      code: dto.code,
      lang
    });
    if (!verifyResult.ok) throw this.mapVerificationReason(lang, verifyResult.reason);

    const existed = channel === 'email' ? await this.mallService.findUserByEmail(dto.target) : await this.mallService.findUserByPhone(dto.target);
    if (existed) {
      throw this.err(lang, '该账号已注册', 'Account already registered', HttpStatus.CONFLICT);
    }

    const username = dto.username || this.createUsernameByTarget(channel, dto.target);
    const created = await this.mallService.createUserWithProfile({
      username,
      password: dto.password,
      role: 'user',
      email: channel === 'email' ? dto.target : null,
      phone: channel === 'sms' ? dto.target : null
    });
    if (!created) {
      throw this.err(lang, '用户名已存在', 'Username already exists', HttpStatus.CONFLICT);
    }

    const tokens = this.buildAuthTokens({ uid: Number(created.id), role: created.role, username: created.username });
    return { ok: true, ...tokens, user: { id: Number(created.id), username: created.username, role: created.role } };
  }

  @Post('auth/reset-password-by-code')
  async resetPasswordByCode(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z
      .object({
        channel: z.enum(['sms', 'email']).optional(),
        target: z.string().min(3).max(256),
        code: z.string().min(4).max(16),
        newPassword: z.string().min(8).max(128)
      })
      .parse(body);
    const channel = dto.channel || this.inferChannelByTarget(dto.target, lang);

    const verifyResult = await this.verificationService.verifyCode({
      channel,
      bizType: 'reset_password',
      target: dto.target,
      code: dto.code,
      lang
    });
    if (!verifyResult.ok) throw this.mapVerificationReason(lang, verifyResult.reason);

    const user = channel === 'email' ? await this.mallService.findUserByEmail(dto.target) : await this.mallService.findUserByPhone(dto.target);
    if (!user || !user.is_active) {
      throw this.err(lang, '账号不存在或已禁用', 'Account does not exist or is disabled', HttpStatus.NOT_FOUND);
    }

    await this.mallService.updatePasswordByUserId(Number(user.id), dto.newPassword);
    return { ok: true };
  }

  @Get('auth/getUserInfo')
  async getUserInfo(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRoleAny(auth, lang);
    const roleCode = this.resolveRoleCode(payload.role);
    const roleAuth = await this.mallService.getRoleAuthByCode(roleCode);
    return {
      ok: true,
      userId: String(payload.uid),
      userName: payload.username,
      roles: [roleCode],
      buttons: roleAuth.buttonCodes || []
    };
  }

  @Get('route/getConstantRoutes')
  async getConstantRoutes() {
    return { ok: true, data: await this.mallService.getConstantRoutes() };
  }

  @Get('route/getUserRoutes')
  async getUserRoutes(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRoleAny(auth, lang);
    const roleCode = this.resolveRoleCode(payload.role);
    return { ok: true, ...(await this.mallService.getUserRoutesByRoleCode(roleCode)) };
  }

  @Get('route/isRouteExist')
  async isRouteExist(
    @Query('routeName') routeName = '',
    @Headers('authorization') auth?: string,
    @Headers('accept-language') lang?: string
  ) {
    const payload = this.assertRoleAny(auth, lang);
    if (!routeName) {
      throw this.err(lang, '缺少路由名称', 'Missing route name', HttpStatus.BAD_REQUEST);
    }
    const roleCode = this.resolveRoleCode(payload.role);
    const exists = await this.mallService.isRouteExistByRoleCode(roleCode, routeName);
    return { ok: true, data: exists };
  }

  @Post('auth/refreshToken')
  async refreshToken(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z.object({ refreshToken: z.string().min(1) }).parse(body);
    const secret = this.configService.get<string>('AUTH_JWT_SECRET') || this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-secret';
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, { secret });
    } catch {
      throw this.err(lang, '刷新令牌无效', 'Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const tokens = this.buildAuthTokens({ uid: payload.uid, role: payload.role, username: payload.username });
    return { ok: true, ...tokens };
  }

  @Post('auth/change-password')
  async changePassword(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRoleAny(auth, lang);
    const dto = z
      .object({
        oldPassword: z.string().min(8).max(128),
        newPassword: z.string().min(8).max(128)
      })
      .parse(body);

    if (payload.uid <= 0) {
      throw this.err(
        lang,
        '当前账户不支持在线修改密码，请使用数据库管理员账号登录',
        'Current account cannot change password online. Please login with a database admin account.',
        HttpStatus.BAD_REQUEST
      );
    }

    const result = await this.mallService.changePassword({
      userId: payload.uid,
      oldPassword: dto.oldPassword,
      newPassword: dto.newPassword
    });
    if (!result.ok && result.reason === 'not_found') {
      throw this.err(lang, '用户不存在', 'User not found', HttpStatus.NOT_FOUND);
    }
    if (!result.ok && result.reason === 'old_password_error') {
      throw this.err(lang, '旧密码错误', 'Old password is incorrect', HttpStatus.BAD_REQUEST);
    }
    return { ok: true };
  }

  @Post('admin/login')
  async adminLogin(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z.object({ username: z.string().min(1), password: z.string().min(8) }).parse(body);
    const user = await this.mallService.findUserByUsername(dto.username);
    if (user && user.role === 'admin') {
      const ok = await this.mallService.verifyUserPassword(user, dto.password);
      if (!ok) throw this.err(lang, '账号或密码错误', 'Invalid username or password', HttpStatus.UNAUTHORIZED);
      const token = this.signToken({ uid: Number(user.id), role: 'admin', username: user.username });
      return { ok: true, token };
    }
    const envAdmin = this.configService.get<string>('ADMIN_USERNAME') || 'admin';
    const envHash = this.configService.get<string>('ADMIN_PASSWORD_HASH') || '';
    if (dto.username !== envAdmin || !envHash) throw this.err(lang, '账号或密码错误', 'Invalid username or password', HttpStatus.UNAUTHORIZED);
    const ok = await bcrypt.compare(dto.password, envHash);
    if (!ok) throw this.err(lang, '账号或密码错误', 'Invalid username or password', HttpStatus.UNAUTHORIZED);
    const token = this.signToken({ uid: 0, role: 'admin', username: dto.username });
    return { ok: true, token };
  }

  @Get('public/products/list')
  async publicProducts() {
    return { ok: true, items: await this.mallService.products() };
  }

  @Get('admin/products/list')
  async products(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.products() };
  }

  @Get('admin/system/users')
  async systemUsers(
    @Query('current') current = '1',
    @Query('size') size = '10',
    @Query('userName') userName?: string,
    @Query('userPhone') userPhone?: string,
    @Query('userEmail') userEmail?: string,
    @Query('status') status?: '1' | '2',
    @Headers('authorization') auth?: string,
    @Headers('accept-language') lang?: string
  ) {
    this.assertRole(auth, 'admin', lang);
    return {
      ok: true,
      ...(await this.mallService.listSystemUsers({
        current: Number(current),
        size: Number(size),
        userName,
        userPhone,
        userEmail,
        status
      }))
    };
  }

  @Get('admin/system/users/detail')
  async systemUserDetail(
    @Query('id') id: string,
    @Headers('authorization') auth?: string,
    @Headers('accept-language') lang?: string
  ) {
    this.assertRole(auth, 'admin', lang);
    const userId = Number(id || 0);
    if (!userId) throw this.err(lang, '缺少用户ID', 'Missing user id', HttpStatus.BAD_REQUEST);
    const item = await this.mallService.getSystemUserDetail(userId);
    if (!item) throw this.err(lang, '用户不存在', 'User not found', HttpStatus.NOT_FOUND);
    return { ok: true, item };
  }

  @Get('admin/system/roles')
  async systemRoles(
    @Query('current') current = '1',
    @Query('size') size = '10',
    @Query('roleName') roleName?: string,
    @Query('roleCode') roleCode?: string,
    @Query('status') status?: '1' | '2',
    @Headers('authorization') auth?: string,
    @Headers('accept-language') lang?: string
  ) {
    this.assertRole(auth, 'admin', lang);
    return {
      ok: true,
      ...(await this.mallService.listSystemRoles({
        current: Number(current),
        size: Number(size),
        roleName,
        roleCode,
        status
      }))
    };
  }

  @Get('admin/system/roles/all')
  async systemAllRoles(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.getAllSystemRoles() };
  }

  @Get('admin/system/menus')
  async systemMenus(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, ...(await this.mallService.listSystemMenus()) };
  }

  @Get('admin/system/menu-tree')
  async systemMenuTree(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.getSystemMenuTree() };
  }

  @Get('admin/system/pages')
  async systemPages(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.getSystemAllPages() };
  }

  @Post('admin/system/users/upsert')
  async upsertSystemUser(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z
      .object({
        id: z.number().int().optional(),
        userName: z.string().min(1),
        userGender: z.enum(['1', '2']).optional(),
        nickName: z.string().optional(),
        userPhone: z.string().optional(),
        userEmail: z.string().optional(),
        userRoles: z.array(z.string()).optional(),
        status: z.enum(['1', '2'])
      })
      .parse(body);
    const item = await this.mallService.upsertSystemUser(dto);
    return { ok: true, item };
  }

  @Post('admin/system/users/delete')
  async deleteSystemUser(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ id: z.number().int() }).parse(body);
    const ok = await this.mallService.deleteSystemUser(dto.id);
    if (!ok) throw this.err(lang, '用户不存在', 'User not found', HttpStatus.NOT_FOUND);
    return { ok: true };
  }

  @Post('admin/system/roles/upsert')
  async upsertSystemRole(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z
      .object({
        id: z.number().int().optional(),
        roleName: z.string().min(1),
        roleCode: z.string().min(1),
        roleDesc: z.string().optional().default(''),
        status: z.enum(['1', '2'])
      })
      .parse(body);
    const item = await this.mallService.upsertSystemRole(dto);
    return { ok: true, item };
  }

  @Post('admin/system/roles/delete')
  async deleteSystemRole(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ id: z.number().int() }).parse(body);
    const ok = await this.mallService.deleteSystemRole(dto.id);
    if (!ok) throw this.err(lang, '角色不存在', 'Role not found', HttpStatus.NOT_FOUND);
    return { ok: true };
  }

  @Post('admin/system/menus/upsert')
  async upsertSystemMenu(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z
      .object({
        id: z.number().int().optional(),
        parentId: z.number().int(),
        menuType: z.enum(['1', '2']),
        menuName: z.string().min(1),
        routeName: z.string().min(1),
        routePath: z.string().min(1),
        component: z.string().optional().nullable(),
        icon: z.string().optional().default(''),
        iconType: z.enum(['1', '2']).default('1'),
        i18nKey: z.string().optional().nullable(),
        order: z.number().int().optional().default(0),
        keepAlive: z.boolean().optional().default(false),
        constant: z.boolean().optional().default(false),
        href: z.string().optional().nullable(),
        hideInMenu: z.boolean().optional().default(false),
        activeMenu: z.string().optional().nullable(),
        multiTab: z.boolean().optional().default(false),
        fixedIndexInTab: z.number().int().nullable().optional(),
        query: z.array(z.object({ key: z.string().default(''), value: z.string().default('') })).optional().default([]),
        buttons: z.array(z.object({ code: z.string().default(''), desc: z.string().default('') })).optional().default([]),
        status: z.enum(['1', '2']).default('1')
      })
      .parse(body);
    const item = await this.mallService.upsertSystemMenu(dto);
    return { ok: true, item };
  }

  @Post('admin/system/menus/delete')
  async deleteSystemMenu(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ id: z.number().int() }).parse(body);
    const ok = await this.mallService.deleteSystemMenu(dto.id);
    if (!ok) throw this.err(lang, '菜单不存在', 'Menu not found', HttpStatus.NOT_FOUND);
    return { ok: true };
  }

  @Get('admin/system/roles/menu-auth')
  async getRoleMenuAuth(@Query('roleId') roleId: string, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, item: await this.mallService.getRoleMenuAuth(Number(roleId || 0)) };
  }

  @Post('admin/system/roles/menu-auth')
  async saveRoleMenuAuth(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ roleId: z.number().int(), home: z.string().min(1), menuIds: z.array(z.number().int()) }).parse(body);
    return { ok: true, item: await this.mallService.saveRoleMenuAuth(dto.roleId, { home: dto.home, menuIds: dto.menuIds }) };
  }

  @Get('admin/system/buttons')
  async getSystemButtons(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.getAllButtons() };
  }

  @Get('admin/system/roles/button-auth')
  async getRoleButtonAuth(@Query('roleId') roleId: string, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    return { ok: true, items: await this.mallService.getRoleButtonAuth(Number(roleId || 0)) };
  }

  @Post('admin/system/roles/button-auth')
  async saveRoleButtonAuth(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ roleId: z.number().int(), buttonCodes: z.array(z.string()) }).parse(body);
    return { ok: true, item: await this.mallService.saveRoleButtonAuth(dto.roleId, { buttonCodes: dto.buttonCodes }) };
  }

  @Post('admin/products/upsert')
  async upsertProduct(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z
      .object({
        productCode: z.string().min(2).max(64),
        productName: z.string().min(1).max(128),
        clientType: platformEnum.optional(),
        priceCents: z.number().int().min(0),
        isActive: z.boolean().optional(),
        coverImageUrl: z.string().url().or(z.literal('')).optional(),
        promoImageUrls: z.array(z.string().url()).optional(),
        installPackages: z
          .array(
            z.object({
              platform: platformEnum,
              packageName: z.string().min(1).max(128),
              packageUrl: z.string().url()
            })
          )
          .optional()
      })
      .parse(body);
    if (!dto.coverImageUrl) throw this.err(lang, '请上传封面图', 'Please upload a cover image', HttpStatus.BAD_REQUEST);
    if (!dto.promoImageUrls?.length) {
      throw this.err(lang, '请至少上传一张宣传图', 'Please upload at least one promo image', HttpStatus.BAD_REQUEST);
    }
    if (!dto.installPackages?.length) {
      throw this.err(lang, '请至少上传一个安装包', 'Please upload at least one install package', HttpStatus.BAD_REQUEST);
    }
    const clientType = dto.clientType || dto.installPackages[0]?.platform || 'windows';
    return { ok: true, product: await this.mallService.upsertProduct({ ...dto, clientType }) };
  }

  @Post('admin/uploads/file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
          cb(null, `${suffix}${extname(file.originalname || '')}`);
        }
      }),
      limits: { fileSize: 100 * 1024 * 1024 }
    })
  )
  async uploadFile(@UploadedFile() file: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    if (!file) throw this.err(lang, '缺少上传文件', 'Missing upload file', HttpStatus.BAD_REQUEST);
    const base = (this.configService.get<string>('PUBLIC_FILE_BASE_URL') || '').replace(/\/$/, '');
    const filePath = `/uploads/${file.filename}`;
    const url = base ? `${base}${filePath}` : filePath;
    return { ok: true, file: { fileName: file.originalname, filePath, url, size: file.size } };
  }

  @Post('admin/products/delete')
  async deleteProduct(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ productCode: z.string().min(2).max(64) }).parse(body);
    const ok = await this.mallService.deleteProduct(dto.productCode);
    if (!ok) throw this.err(lang, '该产品下存在渠道码，不能删除或产品不存在', 'Cannot delete product: keys exist under this product or product not found', HttpStatus.CONFLICT);
    return { ok: true };
  }

  @Post('admin/keys/create')
  async createKeys(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ productCode: z.string().min(2).max(64), count: z.number().int().min(1).max(200), prefix: z.string().min(2).max(12).optional() }).parse(body);
    const keys = await this.mallService.createKeys(dto);
    if (!keys) throw this.err(lang, '产品类型不存在或已停用', 'Product does not exist or has been disabled', HttpStatus.NOT_FOUND);
    return { ok: true, keys };
  }

  @Post('admin/keys/revoke')
  async revoke(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    const dto = z.object({ keyCode: z.string().min(8).max(64) }).parse(body);
    const row = await this.mallService.revokeKey(dto.keyCode);
    if (!row) throw this.err(lang, '渠道码不存在、已使用或不可作废', 'Key not found, already used, or cannot be revoked', HttpStatus.NOT_FOUND);
    return { ok: true, item: row };
  }

  @Get('admin/keys/by-product')
  async byProduct(@Query('productCode') productCode: string, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    this.assertRole(auth, 'admin', lang);
    if (!productCode) throw this.err(lang, '缺少 productCode', 'Missing productCode', HttpStatus.BAD_REQUEST);
    return { ok: true, items: await this.mallService.listCodesByProduct(productCode) };
  }

  @Post('user/orders/create')
  async createOrder(@Body() body: any, @Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRole(auth, 'user', lang);
    const dto = z.object({ productCode: z.string().min(2).max(64), paymentChannel: z.enum(['alipay', 'wechat']) }).parse(body);
    const result = await this.mallService.createOrder(payload.uid, dto);
    if (!result) throw this.err(lang, '产品不存在或已下架', 'Product does not exist or is offline', HttpStatus.NOT_FOUND);
    if (dto.paymentChannel === 'alipay') {
      const bizContent = JSON.stringify({
        outTradeNo: result.order.order_no,
        totalAmount: (Number(result.order.amount_cents) / 100).toFixed(2),
        subject: `${result.product.product_name} 渠道码`,
        productCode: 'FAST_INSTANT_TRADE_PAY'
      });
      const privateKey = this.configService.get<string>('ALIPAY_PRIVATE_KEY') || '';
      const signature = privateKey ? this.mallService.signAlipayPayload(bizContent, privateKey) : '';
      return { ok: true, order: result.order, payInfo: { channel: 'alipay', bizContent, signature } };
    }
    return { ok: true, order: result.order, payInfo: { channel: 'wechat', message: this.msg(lang, '请使用订单号调用微信支付下单', 'Please use order number to create a WeChat payment order') } };
  }

  @Get('user/orders/list')
  async userOrders(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRole(auth, 'user', lang);
    return { ok: true, items: await this.mallService.listUserOrders(payload.uid) };
  }

  @Get('admin/orders/list')
  async adminOrders(
    @Query('productCode') productCode?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('source') source?: 'order' | 'manual' | 'all',
    @Query('keyword') keyword?: string,
    @Headers('authorization') auth?: string,
    @Headers('accept-language') lang?: string
  ) {
    this.assertRole(auth, 'admin', lang);
    return {
      ok: true,
      items: await this.mallService.listAllOrders({
        productCode,
        paymentStatus,
        source,
        keyword
      })
    };
  }

  @Get('user/codes/list')
  async userCodes(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRole(auth, 'user', lang);
    return { ok: true, items: await this.mallService.listUserCodes(payload.uid) };
  }

  @Get('user/products/purchased')
  async userPurchasedProducts(@Headers('authorization') auth?: string, @Headers('accept-language') lang?: string) {
    const payload = this.assertRole(auth, 'user', lang);
    return { ok: true, items: await this.mallService.listPurchasedProductsStatus(payload.uid) };
  }

  @Post('pay/alipay/notify')
  async alipayNotify(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z.object({
      out_trade_no: z.string().min(1),
      trade_no: z.string().min(1),
      trade_status: z.string().min(1),
      sign: z.string().min(1)
    }).parse(body);
    const publicKey = this.configService.get<string>('ALIPAY_PUBLIC_KEY') || '';
    const source = JSON.stringify({
      out_trade_no: dto.out_trade_no,
      trade_no: dto.trade_no,
      trade_status: dto.trade_status
    });
    if (publicKey && !this.mallService.verifyAlipaySignature(source, dto.sign, publicKey)) {
      throw this.err(lang, '支付宝回调验签失败', 'Alipay callback signature verification failed', HttpStatus.UNAUTHORIZED);
    }
    const keyCode = dto.trade_status === 'TRADE_SUCCESS' ? await this.mallService.markOrderPaidAndAssign(dto.out_trade_no, dto.trade_no) : null;
    return { ok: true, keyCode };
  }

  @Post('pay/wechat/notify')
  async wechatNotify(@Body() body: any, @Headers('accept-language') lang?: string) {
    const outTradeNo = body?.resource?.out_trade_no || body?.out_trade_no;
    const tradeNo = body?.resource?.transaction_id || body?.transaction_id;
    const tradeState = body?.trade_state || 'SUCCESS';
    if (!outTradeNo || !tradeNo) throw this.err(lang, '回调参数不完整', 'Incomplete callback parameters', HttpStatus.BAD_REQUEST);
    const keyCode = tradeState === 'SUCCESS' ? await this.mallService.markOrderPaidAndAssign(outTradeNo, tradeNo) : null;
    return { code: 'SUCCESS', message: this.msg(lang, '成功', 'Success'), keyCode };
  }

  @Post('public/keys/create')
  async aiCreateKeys(@Body() body: any, @Headers('x-api-key') apiKey?: string, @Headers('x-signature') signature?: string, @Headers('x-timestamp') timestamp?: string, @Headers('x-nonce') nonce?: string, @Headers('accept-language') lang?: string) {
    const confApiKey = this.configService.get<string>('AI_API_KEY') || '';
    const confSecret = this.configService.get<string>('AI_API_HMAC_SECRET') || '';
    if (!apiKey || !signature || !timestamp || !nonce) throw this.err(lang, '缺少 AI 接口鉴权头', 'Missing AI API authentication headers', HttpStatus.UNAUTHORIZED);
    if (apiKey !== confApiKey) throw this.err(lang, 'AI_API_KEY 无效', 'Invalid AI_API_KEY', HttpStatus.UNAUTHORIZED);
    const raw = JSON.stringify(body || {});
    if (!this.mallService.verifyAiSignature(raw, timestamp, nonce, signature, confSecret)) {
      throw this.err(lang, 'HMAC 签名验证失败', 'HMAC signature verification failed', HttpStatus.UNAUTHORIZED);
    }
    const dto = z.object({ count: z.number().int().min(1).max(100).default(1), prefix: z.string().min(2).max(12).optional(), productCode: z.string().min(2).max(64) }).parse(body);
    const keys = await this.mallService.createKeys(dto);
    if (!keys) throw this.err(lang, '产品类型不存在', 'Product does not exist', HttpStatus.NOT_FOUND);
    return { ok: true, keys };
  }

  @Post('activate')
  async activate(@Body() body: any, @Headers('accept-language') lang?: string) {
    const dto = z.object({
      activationKey: z.string().min(8).max(128),
      deviceId: z.string().min(8).max(256),
      nonce: z.string().min(8).max(128),
      requestId: z.string().min(8).max(128),
      timestamp: z.number().int(),
      productCode: z.string().min(2).max(64).optional(),
      clientType: platformEnum.optional()
    }).parse(body);
    const result = await this.mallService.activate(dto);
    if (result.error === 'not_found') throw this.err(lang, '激活码不存在', 'Activation key not found', HttpStatus.NOT_FOUND);
    if (result.error === 'revoked') throw this.err(lang, '渠道码已作废', 'Activation key has been revoked', HttpStatus.FORBIDDEN);
    if (result.error === 'product_mismatch') throw this.err(lang, '激活码产品类型不匹配', 'Activation key product type mismatch', HttpStatus.FORBIDDEN);
    if (result.error === 'client_mismatch') throw this.err(lang, '激活码端类型不匹配', 'Activation key client type mismatch', HttpStatus.FORBIDDEN);
    if (result.error === 'device_mismatch') throw this.err(lang, '激活码已绑定其他设备', 'Activation key is already bound to another device', HttpStatus.FORBIDDEN);

    return {
      ok: true,
      licenseToken: `LICENSE-${dto.activationKey}-${dto.deviceId}`,
      algorithm: 'RS256',
      productCode: result.data!.productCode,
      clientType: result.data!.clientType,
      priceCents: result.data!.priceCents
    };
  }

  private assertRole(auth: string | undefined, role: 'admin' | 'user', lang?: string) {
    if (!auth?.startsWith('Bearer ')) throw this.err(lang, '缺少认证令牌', 'Missing authorization token', HttpStatus.UNAUTHORIZED);
    const token = auth.slice('Bearer '.length);
    const secret = this.configService.get<string>('AUTH_JWT_SECRET') || this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-secret';
    const payload = this.jwtService.verify<JwtPayload>(token, { secret });
    if (payload.role !== role) throw this.err(lang, '权限不足', 'Permission denied', HttpStatus.FORBIDDEN);
    return payload;
  }

  private assertRoleAny(auth: string | undefined, lang?: string) {
    if (!auth?.startsWith('Bearer ')) {
      throw this.err(lang, '缺少认证令牌', 'Missing authorization token', HttpStatus.UNAUTHORIZED);
    }
    const token = auth.slice('Bearer '.length);
    const secret = this.configService.get<string>('AUTH_JWT_SECRET') || this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-secret';
    try {
      return this.jwtService.verify<JwtPayload>(token, { secret });
    } catch (error) {
      throw error;
    }
  }
}

# TradingAgents-CN Electron 客户端

用于非技术用户交付流程：
- 安装 EXE 阶段输入激活码并联网验证（未通过直接中止安装）
- 安装完成后打开客户端只做 `.env` 配置修改
- 配置字段自动读取 `TradingAgents-CN/.env.example`

## 1. 安装

```bash
cd electron-client
npm config set registry https://registry.npmmirror.com
npm install
```

## 2. 运行（开发）

```bash
npm run dev
```

## 3. 构建安装包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac
```

Windows 安装包中已注入 NSIS 安装钩子：
- `build/installer/installer-hooks.nsh`
- `build/installer/verify-activation.ps1`

安装时会弹窗要求输入激活码并请求后端 `/api/activate`。

## 4. 关键环境变量

- `ACTIVATION_API_URL`：安装器激活接口地址（默认 `http://127.0.0.1:3000/api/activate`）
- `ACTIVATION_PRODUCT_CODE`：安装器提交的产品类型（默认 `TRADING_AGENTS`）
- `ACTIVATION_CLIENT_TYPE`：安装器提交的端类型（默认 `frontend`）

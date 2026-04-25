<template>
  <NuxtRouteAnnouncer />
  <div v-if="!isLoggedIn" class="auth-layout">
    <div class="auth-card">
      <h1>渠道码商城</h1>
      <p class="auth-sub">登录后进入控制台，侧边栏仅在登录后显示。</p>
      <div class="tab-row">
        <button :class="{ active: authTab === 'login' }" @click="authTab = 'login'">登录</button>
        <button :class="{ active: authTab === 'register' }" @click="authTab = 'register'">注册用户</button>
      </div>
      <form class="form-grid" @submit.prevent="authTab === 'login' ? login() : registerUser()">
        <label>
          用户名
          <input v-model.trim="authForm.username" required />
        </label>
        <label>
          密码
          <input v-model="authForm.password" type="password" minlength="8" required />
        </label>
        <label v-if="authTab === 'login'">
          登录角色
          <select v-model="authForm.role">
            <option value="user">用户</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <button :disabled="loading.auth">{{ loading.auth ? "提交中..." : authTab === "login" ? "进入系统" : "注册并进入" }}</button>
      </form>
      <p v-if="message" :class="['notice', messageType]">{{ message }}</p>
    </div>
  </div>

  <div v-else class="admin-layout">
    <aside class="sider">
      <div class="logo-wrap">
        <div class="logo-mark">S</div>
        <div>
          <div class="logo-title">Soybean Style</div>
          <div class="logo-sub">Channel Mall Console</div>
        </div>
      </div>

      <template v-if="session.role === 'admin'">
        <div class="menu-group-title">管理菜单</div>
        <button class="menu-item" :class="{ active: adminTab === 'products' }" @click="adminTab = 'products'">产品管理</button>
        <button class="menu-item" :class="{ active: adminTab === 'keys' }" @click="adminTab = 'keys'">渠道码管理</button>
        <label class="side-filter">
          <span>按产品筛选</span>
          <select v-model="adminSelectedProduct" @change="loadAdminProductCodes">
            <option v-for="item in products" :key="item.product_code" :value="item.product_code">{{ item.product_code }}</option>
          </select>
        </label>
      </template>

      <template v-else>
        <div class="menu-group-title">用户菜单</div>
        <button class="menu-item" :class="{ active: userTab === 'buy' }" @click="userTab = 'buy'">产品购买</button>
        <button class="menu-item" :class="{ active: userTab === 'orders' }" @click="userTab = 'orders'">购买记录</button>
        <button class="menu-item" :class="{ active: userTab === 'codes' }" @click="userTab = 'codes'">我的渠道码</button>
      </template>
    </aside>

    <main class="main">
      <header class="header">
        <div>
          <h2 class="header-title">渠道码商城与管理后台</h2>
          <div class="header-breadcrumb">{{ session.role === "admin" ? "管理员工作台" : "用户中心" }}</div>
        </div>
        <div class="auth-actions">
          <span class="user-chip">{{ session.username }} / {{ session.role }}</span>
          <button @click="logout">退出</button>
        </div>
      </header>

      <template v-if="session.role === 'user'">
        <section v-if="userTab === 'buy'" class="panel">
          <h2>购买产品</h2>
          <form class="form-grid two" @submit.prevent="createOrder">
            <label>
              产品
              <select v-model="orderForm.productCode">
                <option v-for="item in products.filter((p) => p.is_active)" :key="item.product_code" :value="item.product_code">
                  {{ item.product_name }} ({{ item.price_cents }} 分)
                </option>
              </select>
            </label>
            <label>
              支付方式
              <select v-model="orderForm.paymentChannel">
                <option value="alipay">支付宝</option>
                <option value="wechat">微信</option>
              </select>
            </label>
            <button :disabled="loading.order">{{ loading.order ? "创建中..." : "创建订单并获取支付参数" }}</button>
          </form>
          <pre class="codebox">{{ paymentInfo || "创建订单后会显示支付参数（用于前端拉起支付）" }}</pre>
        </section>

        <section v-if="userTab === 'orders'" class="panel">
          <div class="panel-head">
            <h2>购买记录</h2>
            <button @click="loadUserOrders">刷新</button>
          </div>
          <table>
            <thead><tr><th>订单号</th><th>产品</th><th>渠道</th><th>状态</th><th>渠道码</th><th>时间</th></tr></thead>
            <tbody>
              <tr v-for="item in userOrders" :key="item.order_no">
                <td>{{ item.order_no }}</td>
                <td>{{ item.product_code }}</td>
                <td>{{ item.payment_channel }}</td>
                <td>{{ item.payment_status }}</td>
                <td>{{ item.assigned_key_code || '-' }}</td>
                <td>{{ item.created_at }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="userTab === 'codes'" class="panel">
          <div class="panel-head">
            <h2>我的渠道码</h2>
            <button @click="loadUserCodes">刷新</button>
          </div>
          <table>
            <thead><tr><th>渠道码</th><th>产品</th><th>状态</th><th>设备号列表</th></tr></thead>
            <tbody>
              <tr v-for="item in userCodes" :key="item.key_code">
                <td>{{ item.key_code }}</td>
                <td>{{ item.product_code }}</td>
                <td>{{ item.status === 'unused' ? '未使用' : item.status === 'used' ? '已使用' : '已作废' }}</td>
                <td>{{ (item.device_ids || []).join(', ') || item.assigned_device_id || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <template v-if="session.role === 'admin'">
        <section v-if="adminTab === 'products'" class="panel">
          <div class="panel-head">
            <h2>产品管理</h2>
            <button @click="loadProducts">刷新</button>
          </div>
          <form class="form-grid two" @submit.prevent="upsertProduct">
            <label><span>产品代码</span><input v-model.trim="productForm.productCode" required /></label>
            <label><span>产品名称</span><input v-model.trim="productForm.productName" required /></label>
            <label>
              <span>端类型</span>
              <select v-model="productForm.clientType">
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="fullstack">fullstack</option>
              </select>
            </label>
            <label><span>价格(分)</span><input v-model.number="productForm.priceCents" type="number" min="0" required /></label>
            <label><input v-model="productForm.isActive" type="checkbox" /> 启用</label>
            <button :disabled="loading.product">{{ loading.product ? "处理中..." : "创建/更新产品" }}</button>
          </form>
          <table>
            <thead><tr><th>代码</th><th>名称</th><th>端类型</th><th>价格</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in products" :key="item.product_code">
                <td>{{ item.product_code }}</td><td>{{ item.product_name }}</td><td>{{ item.client_type }}</td><td>{{ item.price_cents }}</td><td>{{ item.is_active ? '启用' : '停用' }}</td>
                <td><button class="danger" @click="deleteProduct(item.product_code)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="adminTab === 'keys'" class="panel">
          <h2>渠道码管理</h2>
          <form class="form-grid two" @submit.prevent="createKeys">
            <label><span>产品代码</span><input v-model.trim="keyForm.productCode" required /></label>
            <label><span>数量</span><input v-model.number="keyForm.count" type="number" min="1" max="200" required /></label>
            <label><span>前缀</span><input v-model.trim="keyForm.prefix" /></label>
            <button :disabled="loading.keyCreate">{{ loading.keyCreate ? "创建中..." : "创建渠道码" }}</button>
          </form>
          <textarea class="codebox" rows="6" :value="generatedKeys.join('\n')" readonly />
          <div class="panel-head">
            <h3>产品已购渠道码列表</h3>
            <button @click="loadAdminProductCodes">刷新</button>
          </div>
          <table>
            <thead><tr><th>渠道码</th><th>状态</th><th>购买用户</th><th>订单</th><th>设备号列表</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in adminCodes" :key="item.key_code">
                <td>{{ item.key_code }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.username || '-' }}</td>
                <td>{{ item.order_no || '-' }}</td>
                <td>{{ (item.device_ids || []).join(', ') || '-' }}</td>
                <td><button class="danger" :disabled="item.status !== 'unused'" @click="revokeKey(item.key_code)">作废</button></td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <p v-if="message" :class="['notice', messageType]">{{ message }}</p>
    </main>
  </div>
</template>

<script setup lang="ts">
type ProductItem = {
  product_code: string;
  product_name: string;
  client_type: "frontend" | "backend" | "fullstack";
  price_cents: number;
  is_active: boolean;
};

type CodeItem = Record<string, any>;
type OrderItem = Record<string, any>;

const message = ref("");
const messageType = ref<"ok" | "err">("ok");
const products = ref<ProductItem[]>([]);
const generatedKeys = ref<string[]>([]);
const adminCodes = ref<CodeItem[]>([]);
const userOrders = ref<OrderItem[]>([]);
const userCodes = ref<CodeItem[]>([]);
const paymentInfo = ref("");

const loading = reactive({
  auth: false,
  product: false,
  keyCreate: false,
  order: false
});

const session = reactive({
  token: "",
  role: "" as "" | "admin" | "user",
  username: ""
});
const isLoggedIn = computed(() => !!session.token);

const authTab = ref<"login" | "register">("login");
const adminTab = ref<"products" | "keys">("products");
const userTab = ref<"buy" | "orders" | "codes">("buy");
const adminSelectedProduct = ref("TRADING_AGENTS");

const authForm = reactive({
  username: "admin",
  password: "",
  role: "admin" as "admin" | "user"
});

const productForm = reactive({
  productCode: "TRADING_AGENTS",
  productName: "Trading Agents",
  clientType: "frontend" as const,
  priceCents: 0,
  isActive: true
});

const keyForm = reactive({
  productCode: "TRADING_AGENTS",
  count: 1,
  prefix: "TA"
});
const orderForm = reactive({
  productCode: "TRADING_AGENTS",
  paymentChannel: "alipay" as "alipay" | "wechat"
});

function setMessage(text: string, type: "ok" | "err" = "ok") {
  message.value = text;
  messageType.value = type;
}

function authHeaders() {
  return { Authorization: `Bearer ${session.token}` };
}

function logout() {
  session.token = "";
  session.role = "";
  session.username = "";
  setMessage("已退出登录");
}

async function login() {
  loading.auth = true;
  try {
    const endpoint = authForm.role === "admin" ? "/api/admin/login" : "/api/auth/login";
    const res = await $fetch<{ ok: true; token: string; user?: any }>(endpoint, {
      method: "POST",
      body: { username: authForm.username, password: authForm.password }
    });
    session.token = res.token;
    session.role = authForm.role;
    session.username = authForm.username;
    setMessage("登录成功。");
    await loadProducts();
    if (session.role === "user") {
      await loadUserOrders();
      await loadUserCodes();
    } else {
      await loadAdminProductCodes();
    }
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "登录失败", "err");
  } finally {
    loading.auth = false;
  }
}

async function registerUser() {
  loading.auth = true;
  try {
    const res = await $fetch<{ ok: true; token: string; user: { username: string } }>("/api/auth/register", {
      method: "POST",
      body: { username: authForm.username, password: authForm.password }
    });
    session.token = res.token;
    session.role = "user";
    session.username = res.user.username;
    setMessage("注册成功并已登录。");
    await loadProducts();
    await loadUserOrders();
    await loadUserCodes();
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "注册失败", "err");
  } finally {
    loading.auth = false;
  }
}

async function loadProducts() {
  try {
    const endpoint = session.role === "admin" && session.token ? "/api/admin/products/list" : "/api/public/products/list";
    const headers = session.role === "admin" && session.token ? authHeaders() : undefined;
    const res = await $fetch<{ ok: true; items: ProductItem[] }>(endpoint, headers ? { headers } : {});
    products.value = res.items || [];
    if (products.value.length && !adminSelectedProduct.value) {
      adminSelectedProduct.value = products.value[0].product_code;
    }
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "产品列表获取失败", "err");
  }
}

async function upsertProduct() {
  loading.product = true;
  try {
    await $fetch("/api/admin/products/upsert", {
      method: "POST",
      headers: authHeaders(),
      body: { ...productForm }
    });
    keyForm.productCode = productForm.productCode;
    await loadProducts();
    setMessage("产品类型已保存。");
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "保存产品失败", "err");
  } finally {
    loading.product = false;
  }
}

async function createKeys() {
  loading.keyCreate = true;
  try {
    const payload = {
      productCode: keyForm.productCode,
      count: keyForm.count,
      prefix: keyForm.prefix || undefined
    };
    const res = await $fetch<{ ok: true; keys: string[] }>("/api/admin/keys/create", {
      method: "POST",
      headers: authHeaders(),
      body: payload
    });
    generatedKeys.value = res.keys || [];
    setMessage(`已生成 ${generatedKeys.value.length} 个授权码。`);
    await loadAdminProductCodes();
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "创建授权码失败", "err");
  } finally {
    loading.keyCreate = false;
  }
}

async function deleteProduct(productCode: string) {
  try {
    await $fetch("/api/admin/products/delete", {
      method: "POST",
      headers: authHeaders(),
      body: { productCode }
    });
    setMessage("产品已删除。");
    await loadProducts();
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "删除失败", "err");
  }
}

async function loadAdminProductCodes() {
  if (!adminSelectedProduct.value || session.role !== "admin") return;
  try {
    const res = await $fetch<{ ok: true; items: CodeItem[] }>("/api/admin/keys/by-product", {
      headers: authHeaders(),
      query: { productCode: adminSelectedProduct.value }
    });
    adminCodes.value = res.items || [];
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "渠道码列表获取失败", "err");
  }
}

async function revokeKey(keyCode: string) {
  try {
    await $fetch("/api/admin/keys/revoke", {
      method: "POST",
      headers: authHeaders(),
      body: { keyCode }
    });
    setMessage("渠道码已作废。");
    await loadAdminProductCodes();
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "作废失败", "err");
  }
}

async function createOrder() {
  loading.order = true;
  try {
    const res = await $fetch<{ ok: true; payInfo: any }>("/api/user/orders/create", {
      method: "POST",
      headers: authHeaders(),
      body: orderForm
    });
    paymentInfo.value = JSON.stringify(res.payInfo, null, 2);
    setMessage("订单已创建，请按返回参数拉起支付。");
    await loadUserOrders();
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "创建订单失败", "err");
  } finally {
    loading.order = false;
  }
}

async function loadUserOrders() {
  try {
    const res = await $fetch<{ ok: true; items: OrderItem[] }>("/api/user/orders/list", {
      headers: authHeaders()
    });
    userOrders.value = res.items || [];
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "获取订单失败", "err");
  }
}

async function loadUserCodes() {
  try {
    const res = await $fetch<{ ok: true; items: CodeItem[] }>("/api/user/codes/list", {
      headers: authHeaders()
    });
    userCodes.value = res.items || [];
  } catch (error: any) {
    setMessage(error?.data?.statusMessage || error?.message || "获取渠道码失败", "err");
  }
}
</script>

<style scoped>
.layout {
  font-family: Inter, "PingFang SC", "Microsoft Yahei", sans-serif;
}

.auth-layout {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, #f7faff 0%, #eef3ff 100%);
  padding: 16px;
}

.auth-card {
  width: min(480px, 100%);
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 14px 40px rgba(31, 35, 41, 0.12);
}

.auth-card h1 {
  margin: 0 0 4px;
  font-size: 26px;
}

.auth-sub {
  color: #6b7280;
  margin: 0 0 14px;
}

.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px 1fr;
  background: #f3f6fc;
}

.sider {
  background: #001529;
  color: #d9e3f0;
  padding: 14px;
}

.logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 12px;
}

.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #4f7cff, #6aa4ff);
  font-weight: 700;
  color: #fff;
}

.logo-title {
  font-weight: 700;
}

.logo-sub {
  font-size: 12px;
  color: #9cb7d7;
}

.menu-group-title {
  color: #87a1c0;
  font-size: 12px;
  margin: 8px 0;
}

.menu-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  color: #c9d5e6;
  margin-bottom: 8px;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.menu-item.active {
  background: #1677ff;
  border-color: #1677ff;
  color: #fff;
}

.side-filter {
  margin-top: 10px;
}

.side-filter span {
  display: block;
  font-size: 12px;
  color: #93adca;
  margin-bottom: 6px;
}

.main {
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.header-title {
  margin: 0 0 4px;
  font-size: 18px;
}

.header-breadcrumb {
  color: #7e8ba3;
  font-size: 12px;
}

.auth-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-chip {
  background: #edf3ff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
}

.panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tab-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-row button.active {
  background: #1456f0;
  color: #fff;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

input,
select,
textarea,
button {
  border: 1px solid #d6deeb;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
}

button {
  background: #1456f0;
  border: 1px solid #1456f0;
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.65;
  cursor: default;
}

button.danger {
  background: #e03131;
  border-color: #e03131;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 8px;
}

th,
td {
  border: 1px solid #edf1f7;
  padding: 8px;
  text-align: left;
  font-size: 13px;
}

.codebox {
  width: 100%;
  background: #0f172a;
  color: #c9d2f0;
  border-radius: 8px;
  margin-top: 10px;
  white-space: pre-wrap;
}

.notice {
  border-radius: 8px;
  padding: 10px;
}

.notice.ok {
  background: #e8f8ee;
  color: #1c7c45;
}

.notice.err {
  background: #fff0f0;
  color: #b42318;
}

@media (max-width: 980px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
  .sider {
    order: 2;
  }
  .form-grid.two {
    grid-template-columns: 1fr;
  }
}
</style>

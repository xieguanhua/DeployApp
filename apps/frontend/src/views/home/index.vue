<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchCreateOrder, fetchPublicProducts, fetchUserPurchasedProducts } from '@/service/api';
import { $t } from '@/locales';
import { useAuthStore } from '@/store/modules/auth';

const loading = ref(false);
const creatingOrder = ref(false);
const products = ref<Api.Mall.Product[]>([]);
const selectedProduct = ref<Api.Mall.Product | null>(null);
const selectedChannel = ref<Api.Mall.PaymentChannel>('wechat');
const payModalVisible = ref(false);
const latestOrder = ref<Api.Mall.CreateOrderResult | null>(null);
const purchasedProducts = ref<Record<string, Api.Mall.UserPurchasedProduct>>({});
const packagePickerVisible = ref(false);
const packagePickerTitle = ref('');
const packagePickerOptions = ref<Api.Mall.InstallPackage[]>([]);
const authStore = useAuthStore();

const activeProducts = computed(() => products.value.filter(item => item.is_active !== false));

function formatPrice(priceCents: number) {
  return (priceCents / 100).toFixed(2);
}

function clientTypeLabel(clientType: Api.Mall.Product['client_type']) {
  const map = {
    windows: $t('page.mall.clientType.windows'),
    mac: $t('page.mall.clientType.macos'),
    ios: $t('page.mall.clientType.ios'),
    android: $t('page.mall.clientType.android'),
    linux: $t('page.mall.clientType.linux'),
    web: $t('page.mall.clientType.web')
  };
  return map[clientType] || clientType;
}

function isSuperRole() {
  return authStore.userInfo.roles.includes('R_SUPER');
}

function isPurchased(productCode: string) {
  return !!purchasedProducts.value[productCode];
}

function isActivated(productCode: string) {
  return Number(purchasedProducts.value[productCode]?.activated_flag || 0) > 0;
}

function activationText(productCode: string) {
  if (!isPurchased(productCode)) return '';
  return isActivated(productCode) ? $t('page.mall.activated') : $t('page.mall.notActivated');
}

function getDownloadUrl(productCode: string) {
  const base = import.meta.env.VITE_PRODUCT_DOWNLOAD_BASE_URL || '/downloads';
  return `${base.replace(/\/$/, '')}/${productCode}`;
}

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchPublicProducts();
  if (!error) {
    products.value = data.items || [];
  } else {
    window.$message?.error($t('page.mall.loadProductsFailed'));
  }
  loading.value = false;
}

async function loadPurchasedProducts() {
  if (isSuperRole()) {
    purchasedProducts.value = {};
    return;
  }
  const { data, error } = await fetchUserPurchasedProducts();
  if (!error) {
    const map: Record<string, Api.Mall.UserPurchasedProduct> = {};
    for (const item of data.items || []) {
      map[item.product_code] = item;
    }
    purchasedProducts.value = map;
  }
}

function openBuyModal(product: Api.Mall.Product) {
  selectedProduct.value = product;
  selectedChannel.value = 'wechat';
  latestOrder.value = null;
  payModalVisible.value = true;
}

async function createOrder() {
  if (!selectedProduct.value) return;
  creatingOrder.value = true;
  const { data, error } = await fetchCreateOrder({
    productCode: selectedProduct.value.product_code,
    paymentChannel: selectedChannel.value
  });
  if (!error) {
    latestOrder.value = data;
    window.$message?.success($t('page.mall.createOrderSuccess'));
  } else {
    window.$message?.error($t('page.mall.createOrderFailed'));
  }
  creatingOrder.value = false;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success($t('page.mall.copied'));
  } catch {
    window.$message?.error($t('page.mall.copyFailed'));
  }
}

function downloadProduct(product: Api.Mall.Product) {
  const purchased = purchasedProducts.value[product.product_code];
  const packages = (purchased?.install_packages || product.install_packages || []).filter(item => item.packageUrl);
  if (packages.length <= 1) {
    const targetUrl = packages[0]?.packageUrl || getDownloadUrl(product.product_code);
    window.open(targetUrl, '_blank');
    return;
  }
  packagePickerTitle.value = `${$t('page.mall.downloadNow')} - ${product.product_name}`;
  packagePickerOptions.value = packages;
  packagePickerVisible.value = true;
}

function downloadPackage(pkg: Api.Mall.InstallPackage) {
  window.open(pkg.packageUrl, '_blank');
  packagePickerVisible.value = false;
}

onMounted(() => {
  loadProducts();
  loadPurchasedProducts();
});
</script>

<template>
  <div class="w-full">
    <ASpace direction="vertical" :size="16" class="w-full">
      <ARow v-if="activeProducts.length" :gutter="[16, 16]">
        <ACol v-for="item in activeProducts" :key="item.product_code" :xs="24" :md="12" :xl="8">
          <ACard :title="item.product_name" :bordered="false" class="h-full">
            <div class="flex flex-col gap-10px">
              <div class="text-13px text-secondary">
                {{ $t('page.mall.productCode') }}: {{ item.product_code }}
              </div>
              <div class="text-13px text-secondary">
                {{ $t('page.mall.clientTypeLabel') }}: {{ clientTypeLabel(item.client_type) }}
              </div>
              <div class="text-22px font-600 text-primary">
                {{ $t('page.mall.priceWithCurrency', { price: formatPrice(item.price_cents) }) }}
              </div>
              <ATag v-if="isPurchased(item.product_code)" :color="isActivated(item.product_code) ? 'success' : 'warning'">
                {{ activationText(item.product_code) }}
              </ATag>
              <AButton v-if="isPurchased(item.product_code)" @click="downloadProduct(item)">
                {{ $t('page.mall.downloadNow') }}
              </AButton>
              <AButton v-else type="primary" @click="openBuyModal(item)">
                {{ $t('page.mall.buyNow') }}
              </AButton>
            </div>
          </ACard>
        </ACol>
      </ARow>

      <AEmpty v-else :description="$t('page.mall.noProducts')" />
    </ASpace>

    <AModal
      v-model:open="payModalVisible"
      :title="$t('page.mall.createOrderTitle')"
      :confirm-loading="creatingOrder"
      :ok-text="$t('page.mall.confirmPay')"
      :cancel-text="$t('common.cancel')"
      @ok="createOrder"
    >
      <template v-if="selectedProduct">
        <div class="mb-12px text-14px">
          {{ selectedProduct.product_name }}
          ({{ $t('page.mall.priceWithCurrency', { price: formatPrice(selectedProduct.price_cents) }) }})
        </div>
        <ARadioGroup v-model:value="selectedChannel">
          <ARadio value="wechat">{{ $t('page.mall.wechatPay') }}</ARadio>
          <ARadio value="alipay">{{ $t('page.mall.alipayPay') }}</ARadio>
        </ARadioGroup>
      </template>

      <ADivider />

      <template v-if="latestOrder">
        <div class="text-13px leading-6">
          <div>
            {{ $t('page.mall.orderNo') }}: {{ latestOrder.order.order_no }}
            <AButton type="link" size="small" @click="copyText(latestOrder.order.order_no)">
              {{ $t('page.mall.copyOrderNo') }}
            </AButton>
          </div>
          <div>{{ $t('page.mall.paymentChannel') }}: {{ latestOrder.payInfo.channel }}</div>
          <div v-if="latestOrder.payInfo.message">{{ latestOrder.payInfo.message }}</div>
          <div v-if="latestOrder.payInfo.bizContent" class="break-all">
            {{ $t('page.mall.alipayPayload') }}: {{ latestOrder.payInfo.bizContent }}
          </div>
        </div>
      </template>
      <template v-else>
        <div class="text-13px text-secondary">{{ $t('page.mall.createOrderHint') }}</div>
      </template>
    </AModal>

    <AModal v-model:open="packagePickerVisible" :title="packagePickerTitle" :footer="null">
      <ASpace direction="vertical" class="w-full">
        <AButton
          v-for="pkg in packagePickerOptions"
          :key="`${pkg.platform}-${pkg.packageUrl}`"
          block
          @click="downloadPackage(pkg)"
        >
          {{ clientTypeLabel(pkg.platform) }} - {{ pkg.packageName }}
        </AButton>
      </ASpace>
    </AModal>
  </div>
</template>

<style scoped></style>

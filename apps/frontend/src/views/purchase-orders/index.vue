<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  fetchAdminCreateKeys,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchPublicProducts,
  fetchUserOrders,
  fetchUserPurchasedProducts
} from '@/service/api';
import { useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import { useAuthStore } from '@/store/modules/auth';
import OrderSearch from './modules/order-search.vue';

const loading = ref(false);
const orders = ref<Api.Mall.Order[]>([]);
const creatingKeys = ref(false);
const products = ref<Api.Mall.Product[]>([]);
const createdKeys = ref<string[]>([]);
const createKeyModalVisible = ref(false);
const purchasedProducts = ref<Record<string, Api.Mall.UserPurchasedProduct>>({});
const packagePickerVisible = ref(false);
const packagePickerTitle = ref('');
const packagePickerOptions = ref<Api.Mall.InstallPackage[]>([]);
const authStore = useAuthStore();
const { tableWrapperRef, scrollConfig } = useTableScroll(1100);
const adminFilters = ref<Api.Mall.AdminOrderListParams>({
  source: 'all',
  productCode: undefined,
  paymentStatus: undefined,
  keyword: ''
});

const keyForm = ref<Api.Mall.AdminCreateKeysParams>({
  productCode: '',
  count: 1,
  prefix: ''
});

const isSuper = computed(() => authStore.userInfo.roles.includes('R_SUPER'));
const columnChecks = ref<AntDesign.TableColumnCheck[]>([]);

function orderStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    pending: $t('page.mall.orderStatusMap.pending'),
    paid: $t('page.mall.orderStatusMap.paid'),
    failed: $t('page.mall.orderStatusMap.failed'),
    closed: $t('page.mall.orderStatusMap.closed'),
    revoked: $t('page.mall.orderStatusMap.revoked'),
    activated: $t('page.mall.orderStatusMap.activated'),
    manual_unallocated: $t('page.mall.orderStatusMap.manualUnallocated'),
    manual_allocated: $t('page.mall.orderStatusMap.manualAllocated')
  };
  if (!status) return '-';
  return map[status] || status;
}

const columns = computed(() => [
  { title: $t('page.mall.orderNo'), dataIndex: 'order_no', key: 'order_no', minWidth: 220, ellipsis: true },
  ...(isSuper.value ? [{ title: $t('page.mall.userName'), dataIndex: 'username', key: 'username', width: 140, ellipsis: true }] : []),
  { title: $t('page.mall.productCode'), dataIndex: 'product_code', key: 'product_code', minWidth: 160, ellipsis: true },
  {
    title: $t('page.mall.amount'),
    dataIndex: 'amount_cents',
    key: 'amount_cents',
    width: 120,
    customRender: ({ text }: { text: number }) => $t('page.mall.priceWithCurrency', { price: (Number(text) / 100).toFixed(2) })
  },
  { title: $t('page.mall.paymentChannel'), dataIndex: 'payment_channel', key: 'payment_channel', width: 120, ellipsis: true },
  {
    title: $t('page.mall.orderStatus'),
    dataIndex: 'payment_status',
    key: 'payment_status',
    minWidth: 180,
    ellipsis: true,
    customRender: ({ text }: { text: string }) => orderStatusLabel(text)
  },
  { title: $t('page.mall.assignedKeyCode'), dataIndex: 'assigned_key_code', key: 'assigned_key_code', minWidth: 260, ellipsis: true },
  { title: $t('page.mall.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 180, ellipsis: true },
  { title: $t('page.mall.paidAt'), dataIndex: 'paid_at', key: 'paid_at', width: 180, ellipsis: true }
]);

const userColumns = computed(() => [
  { title: $t('page.mall.orderNo'), dataIndex: 'order_no', key: 'order_no', minWidth: 220, ellipsis: true },
  { title: $t('page.mall.productCode'), dataIndex: 'product_code', key: 'product_code', minWidth: 160, ellipsis: true },
  {
    title: $t('page.mall.amount'),
    dataIndex: 'amount_cents',
    key: 'amount_cents',
    width: 120,
    customRender: ({ text }: { text: number }) => $t('page.mall.priceWithCurrency', { price: (Number(text) / 100).toFixed(2) })
  },
  {
    title: $t('page.mall.orderStatus'),
    dataIndex: 'payment_status',
    key: 'payment_status',
    minWidth: 180,
    ellipsis: true,
    customRender: ({ text }: { text: string }) => orderStatusLabel(text)
  },
  {
    title: $t('page.mall.activationStatus'),
    key: 'activationStatus',
    customRender: ({ record }: { record: Api.Mall.Order }) =>
      Number(purchasedProducts.value[record.product_code]?.activated_flag || 0) > 0
        ? $t('page.mall.activated')
        : $t('page.mall.notActivated')
  },
  {
    title: $t('page.mall.activatedDevices'),
    key: 'devices',
    minWidth: 220,
    ellipsis: true,
    customRender: ({ record }: { record: Api.Mall.Order }) =>
      (purchasedProducts.value[record.product_code]?.device_ids || []).join(', ') || '-'
  },
  {
    title: $t('common.operation'),
    key: 'operation',
    width: 120
  }
]);

const tableColumns = computed(() => (isSuper.value ? columns.value : userColumns.value));

const visibleColumns = computed(() => {
  if (!columnChecks.value.length) return tableColumns.value;
  const enabledKeys = new Set(columnChecks.value.filter(item => item.checked).map(item => item.key));
  return tableColumns.value.filter((column: any) => !column.key || enabledKeys.has(String(column.key)));
});

watch(
  tableColumns,
  value => {
    const checkedMap = new Map(columnChecks.value.map(item => [item.key, item.checked]));
    columnChecks.value = value
      .filter((column: any) => column.key)
      .map((column: any) => ({
        key: String(column.key),
        title: String(column.title ?? column.key),
        checked: checkedMap.get(String(column.key)) ?? true
      }));
  },
  { immediate: true }
);

async function loadOrders() {
  loading.value = true;
  const { data, error } = isSuper.value
    ? await fetchAdminOrders({
        ...adminFilters.value,
        keyword: adminFilters.value.keyword?.trim() || undefined
      })
    : await fetchUserOrders();
  if (!error) {
    const allOrders = data.items || [];
    orders.value = isSuper.value ? allOrders : allOrders.filter(item => item.payment_status === 'paid');
  } else {
    window.$message?.error($t('page.mall.loadOrdersFailed'));
  }
  loading.value = false;
}

function resetAdminFilters() {
  adminFilters.value = {
    source: 'all',
    productCode: undefined,
    paymentStatus: undefined,
    keyword: ''
  };
  loadOrders();
}

async function loadProducts() {
  const { data, error } = isSuper.value ? await fetchAdminProducts() : await fetchPublicProducts();
  if (!error) {
    products.value = data.items || [];
    if (!keyForm.value.productCode && products.value.length) {
      keyForm.value.productCode = products.value[0].product_code;
    }
  }
}

async function loadPurchasedProducts() {
  if (isSuper.value) return;
  const { data, error } = await fetchUserPurchasedProducts();
  if (!error) {
    const map: Record<string, Api.Mall.UserPurchasedProduct> = {};
    for (const item of data.items || []) {
      map[item.product_code] = item;
    }
    purchasedProducts.value = map;
  }
}

async function createKeys() {
  if (!keyForm.value.productCode) {
    window.$message?.error($t('page.mall.selectProductFirst'));
    return;
  }
  creatingKeys.value = true;
  const payload: Api.Mall.AdminCreateKeysParams = {
    productCode: keyForm.value.productCode,
    count: Number(keyForm.value.count) || 1
  };
  if (keyForm.value.prefix) {
    payload.prefix = keyForm.value.prefix;
  }
  const { data, error } = await fetchAdminCreateKeys(payload);
  if (!error) {
    createdKeys.value = data.keys || [];
    await loadOrders();
    window.$message?.success($t('page.mall.createKeysSuccess'));
    createKeyModalVisible.value = true;
  } else {
    window.$message?.error($t('page.mall.createKeysFailed'));
  }
  creatingKeys.value = false;
}

function clientTypeLabel(clientType: Api.Mall.ClientType) {
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

function onDownload(productCode: string) {
  const product = purchasedProducts.value[productCode];
  const packages = (product?.install_packages || []).filter(item => item.packageUrl);
  if (packages.length <= 1) {
    const url = packages[0]?.packageUrl || `${(import.meta.env.VITE_PRODUCT_DOWNLOAD_BASE_URL || '/downloads').replace(/\/$/, '')}/${productCode}`;
    window.open(url, '_blank');
    return;
  }
  packagePickerTitle.value = `${$t('page.mall.downloadNow')} - ${product?.product_name || productCode}`;
  packagePickerOptions.value = packages;
  packagePickerVisible.value = true;
}

function onDownloadPackage(pkg: Api.Mall.InstallPackage) {
  window.open(pkg.packageUrl, '_blank');
  packagePickerVisible.value = false;
}

onMounted(() => {
  loadOrders();
  loadProducts();
  loadPurchasedProducts();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <OrderSearch
      v-if="isSuper"
      v-model:model="adminFilters"
      :products="products"
      @reset="resetAdminFilters"
      @search="loadOrders"
    />

    <ACard
      :title="$t('page.mall.orderListTitle')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <TableHeaderOperation v-model:columns="columnChecks" :loading="loading" @refresh="loadOrders">
          <template #default>
            <AButton v-if="isSuper" size="small" ghost type="primary" @click="createKeyModalVisible = true">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('page.mall.createKeys') }}</span>
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :loading="loading"
        :columns="visibleColumns"
        :data-source="orders"
        size="small"
        :scroll="scrollConfig"
        :row-key="(record: Api.Mall.Order) => record.order_no || record.assigned_key_code || String(record.id)"
        :pagination="{ pageSize: 10 }"
        class="h-full"
      >
        <template v-if="!isSuper" #bodyCell="{ column, record }">
          <template v-if="column.key === 'operation'">
            <AButton type="link" @click="onDownload(record.product_code)">{{ $t('page.mall.downloadNow') }}</AButton>
          </template>
        </template>
      </ATable>
    </ACard>

    <AModal v-model:open="createKeyModalVisible" :title="$t('page.mall.createKeysTitle')" :footer="null">
      <AForm layout="vertical">
        <AFormItem :label="$t('page.mall.productCode')">
          <ASelect
            v-model:value="keyForm.productCode"
            :options="products.map(item => ({ label: `${item.product_name} (${item.product_code})`, value: item.product_code }))"
          />
        </AFormItem>
        <AFormItem :label="$t('page.mall.keyCount')">
          <AInputNumber v-model:value="keyForm.count" :min="1" :max="200" class="w-full" />
        </AFormItem>
        <AFormItem :label="$t('page.mall.keyPrefix')">
          <AInput v-model:value="keyForm.prefix" />
        </AFormItem>
        <AButton type="primary" :loading="creatingKeys" @click="createKeys">{{ $t('page.mall.createKeys') }}</AButton>
      </AForm>
      <div v-if="createdKeys.length" class="mt-12px">
        <div class="mb-8px text-13px text-secondary">{{ $t('page.mall.createdKeys') }}</div>
        <ATag v-for="key in createdKeys" :key="key" class="mb-8px mr-8px">{{ key }}</ATag>
      </div>
    </AModal>

    <AModal v-model:open="packagePickerVisible" :title="packagePickerTitle" :footer="null">
      <ASpace direction="vertical" class="w-full">
        <AButton
          v-for="pkg in packagePickerOptions"
          :key="`${pkg.platform}-${pkg.packageUrl}`"
          block
          @click="onDownloadPackage(pkg)"
        >
          {{ clientTypeLabel(pkg.platform) }} - {{ pkg.packageName }}
        </AButton>
      </ASpace>
    </AModal>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  fetchAdminDeleteProduct,
  fetchAdminProducts,
  fetchAdminUploadFile,
  fetchAdminUpsertProduct
} from '@/service/api';
import { useAuth } from '@/hooks/business/auth';
import { useTableScroll } from '@/hooks/common/table';
import { $t } from '@/locales';
import { useAuthStore } from '@/store/modules/auth';

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const visible = ref(false);
const items = ref<Api.Mall.Product[]>([]);
const { hasAuth } = useAuth();
const authStore = useAuthStore();
const { tableWrapperRef, scrollConfig } = useTableScroll(980);
const canManageProducts = computed(() => authStore.userInfo.buttons.length === 0 || hasAuth('product:edit'));
const columnChecks = ref<AntDesign.TableColumnCheck[]>([]);
const searchModel = reactive({
  productCode: '',
  productName: '',
  clientType: undefined as Api.Mall.ClientType | undefined,
  status: undefined as 'active' | 'inactive' | undefined
});
const searchApplied = ref({
  productCode: '',
  productName: '',
  clientType: undefined as Api.Mall.ClientType | undefined,
  status: undefined as 'active' | 'inactive' | undefined
});

const formModel = reactive<Api.Mall.ProductUpsertParams>({
  productCode: '',
  productName: '',
  clientType: 'windows',
  priceCents: 0,
  isActive: true,
  coverImageUrl: '',
  promoImageUrls: [],
  installPackages: []
});

const packageDraft = reactive<Api.Mall.InstallPackage>({
  platform: 'windows',
  packageName: '',
  packageUrl: ''
});

const clientTypeOptions = computed(() => [
  { label: $t('page.mall.clientType.windows'), value: 'windows' },
  { label: $t('page.mall.clientType.macos'), value: 'mac' },
  { label: $t('page.mall.clientType.ios'), value: 'ios' },
  { label: $t('page.mall.clientType.android'), value: 'android' },
  { label: $t('page.mall.clientType.linux'), value: 'linux' },
  { label: $t('page.mall.clientType.web'), value: 'web' }
]);

const columns = computed(() => [
  { title: $t('page.mall.productCode'), dataIndex: 'product_code', key: 'product_code', minWidth: 180, ellipsis: true },
  { title: $t('page.mall.productName'), dataIndex: 'product_name', key: 'product_name', minWidth: 180, ellipsis: true },
  {
    title: $t('page.mall.clientTypeLabel'),
    dataIndex: 'client_type',
    key: 'client_type',
    width: 120,
    ellipsis: true,
    customRender: ({ text }: { text: Api.Mall.ClientType }) =>
      clientTypeOptions.value.find(item => item.value === text)?.label || text
  },
  {
    title: $t('page.mall.amount'),
    dataIndex: 'price_cents',
    key: 'price_cents',
    width: 120,
    customRender: ({ text }: { text: number }) => $t('page.mall.priceWithCurrency', { price: (Number(text) / 100).toFixed(2) })
  },
  {
    title: $t('page.mall.installPackageCount'),
    key: 'installPackageCount',
    width: 130,
    customRender: ({ record }: { record: Api.Mall.Product }) => record.install_packages?.length || 0
  },
  {
    title: $t('page.mall.productStatus'),
    key: 'status',
    width: 120,
    customRender: ({ record }: { record: Api.Mall.Product }) =>
      record.is_active ? $t('page.mall.productActive') : $t('page.mall.productInactive')
  },
  { title: $t('common.operation'), key: 'operation', width: 160 }
]);

const visibleColumns = computed(() => {
  if (!columnChecks.value.length) return columns.value;
  const enabledKeys = new Set(columnChecks.value.filter(item => item.checked).map(item => item.key));
  return columns.value.filter((column: any) => !column.key || enabledKeys.has(String(column.key)));
});

const filteredItems = computed(() => {
  return items.value.filter(item => {
    if (
      searchApplied.value.productCode &&
      !item.product_code.toLowerCase().includes(searchApplied.value.productCode.toLowerCase())
    ) {
      return false;
    }
    if (
      searchApplied.value.productName &&
      !item.product_name.toLowerCase().includes(searchApplied.value.productName.toLowerCase())
    ) {
      return false;
    }
    if (searchApplied.value.clientType && item.client_type !== searchApplied.value.clientType) {
      return false;
    }
    if (searchApplied.value.status === 'active' && !item.is_active) {
      return false;
    }
    if (searchApplied.value.status === 'inactive' && item.is_active) {
      return false;
    }
    return true;
  });
});

function search() {
  searchApplied.value = {
    productCode: searchModel.productCode.trim(),
    productName: searchModel.productName.trim(),
    clientType: searchModel.clientType,
    status: searchModel.status
  };
}

function resetSearch() {
  searchModel.productCode = '';
  searchModel.productName = '';
  searchModel.clientType = undefined;
  searchModel.status = undefined;
  searchApplied.value = {
    productCode: '',
    productName: '',
    clientType: undefined,
    status: undefined
  };
}

watch(
  columns,
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

async function loadProducts() {
  loading.value = true;
  const { data, error } = await fetchAdminProducts();
  if (!error) {
    items.value = data.items || [];
  } else {
    window.$message?.error(error.message || $t('page.mall.loadProductsFailed'));
  }
  loading.value = false;
}

function resetForm() {
  formModel.productCode = '';
  formModel.productName = '';
  formModel.clientType = 'windows';
  formModel.priceCents = 0;
  formModel.isActive = true;
  formModel.coverImageUrl = '';
  formModel.promoImageUrls = [];
  formModel.installPackages = [];
}

function openCreate() {
  resetForm();
  visible.value = true;
}

function openEdit(item: Api.Mall.Product) {
  formModel.productCode = item.product_code;
  formModel.productName = item.product_name;
  formModel.clientType = item.client_type;
  formModel.priceCents = item.price_cents;
  formModel.isActive = item.is_active !== false;
  formModel.coverImageUrl = item.cover_image_url || '';
  formModel.promoImageUrls = [...(item.promo_image_urls || [])];
  formModel.installPackages = [...(item.install_packages || [])];
  visible.value = true;
}

async function uploadSingleFile(file: File) {
  const { data, error } = await fetchAdminUploadFile(file);
  if (error) {
    window.$message?.error(error.message || $t('common.error'));
    return '';
  }
  return data.file.url;
}

async function onUploadCover(e: Event) {
  const file = (e.target as HTMLInputElement)?.files?.[0];
  if (!file) return;
  const url = await uploadSingleFile(file);
  if (url) formModel.coverImageUrl = url;
}

async function onUploadPromos(e: Event) {
  const files = Array.from((e.target as HTMLInputElement)?.files || []);
  if (!files.length) return;
  for (const file of files) {
    const url = await uploadSingleFile(file);
    if (url) formModel.promoImageUrls.push(url);
  }
}

async function onUploadPackage(e: Event) {
  const file = (e.target as HTMLInputElement)?.files?.[0];
  if (!file) return;
  const url = await uploadSingleFile(file);
  if (!url) return;
  packageDraft.packageName = file.name;
  packageDraft.packageUrl = url;
}

function addPackage() {
  if (!packageDraft.packageName || !packageDraft.packageUrl) {
    window.$message?.warning($t('form.required'));
    return;
  }
  formModel.installPackages.push({
    platform: packageDraft.platform,
    packageName: packageDraft.packageName,
    packageUrl: packageDraft.packageUrl
  });
  packageDraft.packageName = '';
  packageDraft.packageUrl = '';
}

function removePromo(index: number) {
  formModel.promoImageUrls.splice(index, 1);
}

function removePackage(index: number) {
  formModel.installPackages.splice(index, 1);
}

function inferClientTypeFromPackages(packages: Api.Mall.InstallPackage[], fallback: Api.Mall.ClientType = 'windows') {
  return packages[0]?.platform || fallback;
}

async function saveProduct() {
  if (!formModel.coverImageUrl || !formModel.promoImageUrls.length || !formModel.installPackages.length) {
    window.$message?.warning($t('page.mall.productAssetsRequired'));
    return;
  }

  saving.value = true;
  const payload: Api.Mall.ProductUpsertParams = {
    ...formModel,
    clientType: inferClientTypeFromPackages(formModel.installPackages, formModel.clientType)
  };
  const { error } = await fetchAdminUpsertProduct(payload);
  saving.value = false;
  if (error) {
    window.$message?.error(error.message || $t('common.error'));
    return;
  }
  window.$message?.success($t('common.updateSuccess'));
  visible.value = false;
  loadProducts();
}

async function deleteProduct(productCode: string) {
  deleting.value = true;
  const { error } = await fetchAdminDeleteProduct({ productCode });
  deleting.value = false;
  if (error) {
    window.$message?.error(error.message || $t('common.error'));
    return;
  }
  window.$message?.success($t('common.deleteSuccess'));
  loadProducts();
}

onMounted(() => {
  loadProducts();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
      <AForm :model="searchModel">
        <ARow :gutter="[16, 16]" wrap>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.mall.productCode')" class="m-0">
              <AInput v-model:value="searchModel.productCode" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.mall.productName')" class="m-0">
              <AInput v-model:value="searchModel.productName" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.mall.clientTypeLabel')" class="m-0">
              <ASelect v-model:value="searchModel.clientType" allow-clear :options="clientTypeOptions" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.mall.productStatus')" class="m-0">
              <ASelect
                v-model:value="searchModel.status"
                allow-clear
                :options="[
                  { label: $t('page.mall.productActive'), value: 'active' },
                  { label: $t('page.mall.productInactive'), value: 'inactive' }
                ]"
              />
            </AFormItem>
          </ACol>
          <div class="w-full flex-y-center justify-start gap-12px sm:justify-end">
            <AButton @click="resetSearch">
              <template #icon>
                <icon-ic-round-refresh class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('common.reset') }}</span>
            </AButton>
            <AButton type="primary" ghost @click="search">
              <template #icon>
                <icon-ic-round-search class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('common.search') }}</span>
            </AButton>
          </div>
        </ARow>
      </AForm>
    </ACard>

    <ACard
      :title="$t('page.mall.productManageTitle')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <TableHeaderOperation v-model:columns="columnChecks" :loading="loading" @refresh="loadProducts">
          <template #default>
            <AButton v-if="canManageProducts" size="small" ghost type="primary" @click="openCreate">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('common.add') }}</span>
            </AButton>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :loading="loading"
        :columns="visibleColumns"
        :data-source="filteredItems"
        :scroll="scrollConfig"
        size="small"
        class="h-full"
        :row-key="(record: Api.Mall.Product) => record.product_code"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <ATag :color="record.is_active ? 'success' : 'default'">
              {{ record.is_active ? $t('page.mall.productActive') : $t('page.mall.productInactive') }}
            </ATag>
          </template>
          <template v-else-if="column.key === 'installPackageCount'">
            {{ record.install_packages?.length || 0 }}
          </template>
          <template v-else-if="column.key === 'operation'">
            <template v-if="canManageProducts">
              <AButton type="link" @click="openEdit(record)">{{ $t('common.edit') }}</AButton>
              <APopconfirm :title="$t('common.confirmDelete')" @confirm="deleteProduct(record.product_code)">
                <AButton type="link" danger :loading="deleting">{{ $t('common.delete') }}</AButton>
              </APopconfirm>
            </template>
          </template>
        </template>
      </ATable>
    </ACard>

    <AModal v-model:open="visible" :title="$t('page.mall.productManageTitle')" :confirm-loading="saving" @ok="saveProduct">
      <AForm layout="vertical">
        <AFormItem :label="$t('page.mall.productCode')">
          <AInput v-model:value="formModel.productCode" />
        </AFormItem>
        <AFormItem :label="$t('page.mall.productName')">
          <AInput v-model:value="formModel.productName" />
        </AFormItem>
        <AFormItem :label="$t('page.mall.amountInCents')">
          <AInputNumber v-model:value="formModel.priceCents" class="w-full" />
        </AFormItem>
        <AFormItem :label="$t('page.mall.productStatus')">
          <ASwitch
            v-model:checked="formModel.isActive"
            :checked-children="$t('page.mall.productActive')"
            :un-checked-children="$t('page.mall.productInactive')"
          />
        </AFormItem>
        <AFormItem :label="$t('page.mall.coverImage')">
          <input type="file" accept="image/*" @change="onUploadCover" />
          <div class="mt-6px text-xs text-secondary break-all">{{ formModel.coverImageUrl || '-' }}</div>
        </AFormItem>
        <AFormItem :label="$t('page.mall.promoImages')">
          <input type="file" accept="image/*" multiple @change="onUploadPromos" />
          <div class="mt-8px flex flex-col gap-4px">
            <div v-for="(url, index) in formModel.promoImageUrls" :key="url" class="flex items-center justify-between gap-8px">
              <span class="text-xs break-all">{{ url }}</span>
              <AButton size="small" danger @click="removePromo(index)">{{ $t('common.delete') }}</AButton>
            </div>
          </div>
        </AFormItem>
        <AFormItem :label="$t('page.mall.installPackages')">
          <ASpace direction="vertical" class="w-full">
            <ASelect v-model:value="packageDraft.platform" :options="clientTypeOptions" />
            <input type="file" @change="onUploadPackage" />
            <AInput v-model:value="packageDraft.packageName" :placeholder="$t('page.mall.packageName')" />
            <AInput v-model:value="packageDraft.packageUrl" :placeholder="$t('page.mall.packageUrl')" />
            <AButton @click="addPackage">{{ $t('common.add') }}</AButton>
            <div v-for="(pkg, index) in formModel.installPackages" :key="`${pkg.platform}-${pkg.packageUrl}`" class="flex items-center justify-between gap-8px">
              <span class="text-xs break-all">{{ pkg.platform }} / {{ pkg.packageName }}</span>
              <AButton size="small" danger @click="removePackage(index)">{{ $t('common.delete') }}</AButton>
            </div>
          </ASpace>
        </AFormItem>
      </AForm>
    </AModal>
  </div>
</template>

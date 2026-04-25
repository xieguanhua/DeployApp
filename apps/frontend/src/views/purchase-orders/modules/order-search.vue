<script setup lang="ts">
import { $t } from '@/locales';

defineOptions({
  name: 'OrderSearch'
});

interface Props {
  products: Api.Mall.Product[];
}

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
const model = defineModel<Api.Mall.AdminOrderListParams>('model', { required: true });

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm
      :model="model"
      :label-col="{
        span: 5,
        md: 7
      }"
    >
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.mall.filterSource')" class="m-0">
            <ASelect
              v-model:value="model.source"
              :options="[
                { label: $t('page.mall.filterSourceAll'), value: 'all' },
                { label: $t('page.mall.filterSourceOrder'), value: 'order' },
                { label: $t('page.mall.filterSourceManual'), value: 'manual' }
              ]"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.mall.productCode')" class="m-0">
            <ASelect
              v-model:value="model.productCode"
              allow-clear
              :options="products.map(item => ({ label: `${item.product_name} (${item.product_code})`, value: item.product_code }))"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.mall.orderStatus')" class="m-0">
            <ASelect
              v-model:value="model.paymentStatus"
              allow-clear
              :options="[
                { label: $t('page.mall.orderStatusMap.paid'), value: 'paid' },
                { label: $t('page.mall.orderStatusMap.pending'), value: 'pending' },
                { label: $t('page.mall.orderStatusMap.manualUnallocated'), value: 'manual_unallocated' },
                { label: $t('page.mall.orderStatusMap.manualAllocated'), value: 'manual_allocated' },
                { label: $t('page.mall.orderStatusMap.activated'), value: 'activated' },
                { label: $t('page.mall.orderStatusMap.revoked'), value: 'revoked' }
              ]"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.mall.filterKeyword')" class="m-0">
            <AInput v-model:value="model.keyword" :placeholder="$t('page.mall.filterKeywordPlaceholder')" />
          </AFormItem>
        </ACol>
        <div class="w-full flex-1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-start gap-12px sm:justify-end">
              <AButton @click="reset">
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
          </AFormItem>
        </div>
      </ARow>
    </AForm>
  </ACard>
</template>

<style scoped></style>

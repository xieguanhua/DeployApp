<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { $t } from '@/locales';
import { fetchGetRoleButtonAuth, fetchGetSystemButtons, fetchSaveRoleButtonAuth } from '@/service/api';

defineOptions({
  name: 'ButtonAuthModal'
});

interface Props {
  /** the roleId */
  roleId: number;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

function closeModal() {
  visible.value = false;
}

const title = computed(() => $t('common.edit') + $t('page.manage.role.buttonAuth'));

const tree = shallowRef<DataNode[]>([]);

async function getAllButtons() {
  const { error, data } = await fetchGetSystemButtons();
  if (!error) {
    tree.value = (data || []).map((item, idx) => ({
      key: idx + 1,
      title: item.desc || item.code,
      code: item.code
    }));
  }
}

const checks = shallowRef<number[]>([]);

async function getChecks() {
  const { error, data } = await fetchGetRoleButtonAuth(props.roleId);
  if (!error) {
    const selectedCodes = new Set((data || []) as string[]);
    checks.value = tree.value
      .filter(item => selectedCodes.has((item as any).code))
      .map(item => Number(item.key));
  }
}

async function handleSubmit() {
  const selectedCodeSet = new Set(checks.value);
  const buttonCodes = tree.value.filter(item => selectedCodeSet.has(Number(item.key))).map(item => String((item as any).code || ''));
  await fetchSaveRoleButtonAuth({ roleId: props.roleId, buttonCodes });

  window.$message?.success?.($t('common.modifySuccess'));

  closeModal();
}

async function init() {
  await getAllButtons();
  await getChecks();
}

watch(visible, val => {
  if (val) {
    init();
  }
});
</script>

<template>
  <AModal v-model:open="visible" :title="title" class="w-480px">
    <ATree v-model:checked-keys="checks" :tree-data="tree" checkable :height="280" class="h-280px" />
    <template #footer>
      <AButton size="small" class="mt-16px" @click="closeModal">
        {{ $t('common.cancel') }}
      </AButton>
      <AButton type="primary" size="small" class="mt-16px" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </AButton>
    </template>
  </AModal>
</template>

<style scoped></style>

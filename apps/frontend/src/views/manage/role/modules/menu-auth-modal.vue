<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import type { SelectProps } from 'ant-design-vue';
import type { DataNode } from 'ant-design-vue/es/tree';
import { $t } from '@/locales';
import { fetchGetAllPages, fetchGetMenuTree, fetchGetRoleMenuAuth, fetchSaveRoleMenuAuth } from '@/service/api';

defineOptions({
  name: 'MenuAuthModal'
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

const title = computed(() => $t('common.edit') + $t('page.manage.role.menuAuth'));

const home = shallowRef('');

async function getHome() {
  const { error, data } = await fetchGetRoleMenuAuth(props.roleId);
  if (!error) {
    home.value = (data as any)?.item?.home || 'home';
  } else {
    window.$message?.error(error.message || $t('common.error'));
  }
}

async function updateHome(val: SelectProps['value']) {
  home.value = val as string;
}

const pages = shallowRef<string[]>([]);

async function getPages() {
  const { error, data } = await fetchGetAllPages();

  if (!error) {
    pages.value = data;
  } else {
    window.$message?.error(error.message || $t('common.error'));
  }
}

const pageSelectOptions = computed(() => {
  const opts: CommonType.Option[] = pages.value.map(page => ({
    label: page,
    value: page
  }));

  return opts;
});

const tree = shallowRef<DataNode[]>([]);

async function getTree() {
  const { error, data } = await fetchGetMenuTree();

  if (!error) {
    tree.value = recursiveTransform(data);
  } else {
    window.$message?.error(error.message || $t('common.error'));
  }
}

function recursiveTransform(data: Api.SystemManage.MenuTree[]): DataNode[] {
  return data.map(item => {
    const { id: key, label } = item;

    if (item.children) {
      return {
        key,
        title: label,
        children: recursiveTransform(item.children)
      };
    }

    return {
      key,
      title: label
    };
  });
}

const checks = shallowRef<number[]>([]);

async function getChecks() {
  const { error, data } = await fetchGetRoleMenuAuth(props.roleId);
  if (!error) {
    checks.value = ((data as any)?.item?.menuIds || []) as number[];
  } else {
    window.$message?.error(error.message || $t('common.error'));
  }
}

async function handleSubmit() {
  const targetHome = home.value || 'home';
  if (pages.value.length && !pages.value.includes(targetHome)) {
    window.$message?.warning($t('page.manage.role.menuAuthInvalidHome'));
    return;
  }

  const { error } = await fetchSaveRoleMenuAuth({
    roleId: props.roleId,
    home: targetHome,
    menuIds: checks.value
  });
  if (error) {
    window.$message?.error(error.message || $t('common.error'));
    return;
  }

  window.$message?.success?.($t('common.modifySuccess'));

  closeModal();
}

async function init() {
  getHome();
  getPages();
  await getTree();
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
    <div class="flex-y-center gap-16px pb-12px">
      <div>{{ $t('page.manage.menu.home') }}</div>
      <ASelect :value="home" :options="pageSelectOptions" class="w-240px" @update:value="updateHome" />
    </div>
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

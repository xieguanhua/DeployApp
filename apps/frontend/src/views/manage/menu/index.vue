<script setup lang="tsx">
import { computed, reactive, ref } from 'vue';
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import type { Ref } from 'vue';
import { useBoolean } from '@sa/hooks';
import { fetchDeleteMenu, fetchGetAllPages, fetchGetMenuList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { yesOrNoRecord } from '@/constants/common';
import { enableStatusRecord, menuTypeRecord } from '@/constants/business';
import { useAuthStore } from '@/store/modules/auth';
import SvgIcon from '@/components/custom/svg-icon.vue';
import MenuOperateModal, { type OperateType } from './modules/menu-operate-modal.vue';

const { bool: visible, setTrue: openModal } = useBoolean();
const { tableWrapperRef, scrollConfig } = useTableScroll(1480);
const { hasAuth } = useAuth();
const authStore = useAuthStore();

function canAccess(code: string) {
  return authStore.userInfo.buttons.length === 0 || hasAuth(code);
}

const { columns, columnChecks, data, loading, pagination, getData, getDataByPage } = useTable({
  apiFn: fetchGetMenuList,
  columns: () => [
    {
      key: 'id',
      title: $t('page.manage.menu.id'),
      align: 'center',
      dataIndex: 'id',
      width: 80,
      ellipsis: true
    },
    {
      key: 'menuType',
      title: $t('page.manage.menu.menuType'),
      align: 'center',
      width: 80,
      ellipsis: true,
      customRender: ({ record }) => {
        const tagMap: Record<Api.SystemManage.MenuType, string> = {
          1: 'default',
          2: 'processing'
        };

        const label = $t(menuTypeRecord[record.menuType]);

        return <Tag color={tagMap[record.menuType]} class="whitespace-nowrap">{label}</Tag>;
      }
    },
    {
      key: 'menuName',
      title: $t('page.manage.menu.menuName'),
      align: 'center',
      minWidth: 120,
      ellipsis: true,
      customRender: ({ record }) => {
        const { i18nKey, menuName } = record;

        const label = i18nKey ? $t(i18nKey) : menuName;

        return <span class="inline-block max-w-full truncate whitespace-nowrap">{label}</span>;
      }
    },
    {
      key: 'icon',
      title: $t('page.manage.menu.icon'),
      align: 'center',
      width: 60,
      customRender: ({ record }) => {
        const icon = record.iconType === '1' ? record.icon : undefined;

        const localIcon = record.iconType === '2' ? record.icon : undefined;

        return (
          <div class="flex-center">
            <SvgIcon icon={icon} localIcon={localIcon} class="text-icon" />
          </div>
        );
      }
    },
    {
      key: 'routeName',
      title: $t('page.manage.menu.routeName'),
      align: 'center',
      dataIndex: 'routeName',
      minWidth: 160,
      ellipsis: true
    },
    {
      key: 'routePath',
      title: $t('page.manage.menu.routePath'),
      align: 'center',
      dataIndex: 'routePath',
      minWidth: 180,
      ellipsis: true
    },
    {
      key: 'status',
      title: $t('page.manage.menu.menuStatus'),
      align: 'center',
      width: 80,
      ellipsis: true,
      customRender: ({ record }) => {
        if (record.status === null) {
          return null;
        }

        const tagMap: Record<Api.Common.EnableStatus, string> = {
          1: 'success',
          2: 'warning'
        };

        const label = $t(enableStatusRecord[record.status]);

        return <Tag color={tagMap[record.status]} class="whitespace-nowrap">{label}</Tag>;
      }
    },
    {
      key: 'hideInMenu',
      title: $t('page.manage.menu.hideInMenu'),
      dataIndex: 'hideInMenu',
      align: 'center',
      width: 80,
      ellipsis: true,
      customRender: ({ record }) => {
        const hide: CommonType.YesOrNo = record.hideInMenu ? 'Y' : 'N';

        const tagMap: Record<CommonType.YesOrNo, string> = {
          Y: 'error',
          N: 'default'
        };

        const label = $t(yesOrNoRecord[hide]);

        return <Tag color={tagMap[hide]} class="whitespace-nowrap">{label}</Tag>;
      }
    },
    {
      key: 'parentId',
      dataIndex: 'parentId',
      title: $t('page.manage.menu.parentId'),
      width: 110,
      align: 'center',
      ellipsis: true
    },
    {
      key: 'order',
      dataIndex: 'order',
      title: $t('page.manage.menu.order'),
      align: 'center',
      width: 60,
      ellipsis: true
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 230,
      ellipsis: true,
      customRender: ({ record }) => (
        <div class="flex-center justify-end gap-8px whitespace-nowrap">
          {record.menuType === '1' && canAccess('menu:add') && (
            <Button type="primary" ghost size="small" onClick={() => handleAddChildMenu(record)}>
              {$t('page.manage.menu.addChildMenu')}
            </Button>
          )}
          {canAccess('menu:edit') && (
            <Button type="primary" ghost size="small" onClick={() => handleEdit(record)}>
              {$t('common.edit')}
            </Button>
          )}
          {canAccess('menu:delete') && (
            <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
              <Button danger ghost size="small">
                {$t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]
});

const { checkedRowKeys, rowSelection, onBatchDeleted, onDeleted } = useTableOperate(data, getData);
const searchModel = reactive({
  menuName: '',
  routeName: '',
  status: undefined as Api.Common.EnableStatus | undefined
});
const searchApplied = ref({
  menuName: '',
  routeName: '',
  status: undefined as Api.Common.EnableStatus | undefined
});

const filteredData = computed(() => {
  return data.value.filter(item => {
    const menuName = String((item as any).menuName || '').toLowerCase();
    const routeName = String((item as any).routeName || '').toLowerCase();
    if (searchApplied.value.menuName && !menuName.includes(searchApplied.value.menuName.toLowerCase())) return false;
    if (searchApplied.value.routeName && !routeName.includes(searchApplied.value.routeName.toLowerCase())) return false;
    if (searchApplied.value.status && (item as any).status !== searchApplied.value.status) return false;
    return true;
  });
});

function search() {
  searchApplied.value = {
    menuName: searchModel.menuName.trim(),
    routeName: searchModel.routeName.trim(),
    status: searchModel.status
  };
}

function resetSearch() {
  searchModel.menuName = '';
  searchModel.routeName = '';
  searchModel.status = undefined;
  searchApplied.value = {
    menuName: '',
    routeName: '',
    status: undefined
  };
}

const operateType = ref<OperateType>('add');

function handleAdd() {
  operateType.value = 'add';
  openModal();
}

async function handleBatchDelete() {
  await Promise.all(checkedRowKeys.value.map(id => fetchDeleteMenu(id as number)));
  onBatchDeleted();
}

async function handleDelete(id: number) {
  await fetchDeleteMenu(id);
  onDeleted();
}
/** the edit menu data or the parent menu data when adding a child menu */
const editingData: Ref<Api.SystemManage.Menu | null> = ref(null);

function handleEdit(item: Api.SystemManage.Menu) {
  operateType.value = 'edit';
  editingData.value = { ...item };

  openModal();
}

function handleAddChildMenu(item: Api.SystemManage.Menu) {
  operateType.value = 'addChild';

  editingData.value = { ...item };

  openModal();
}

const allPages = ref<string[]>([]);

async function getAllPages() {
  const { data: pages } = await fetchGetAllPages();
  allPages.value = pages || [];
}

function init() {
  getAllPages();
}

// init
init();
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
      <AForm :model="searchModel">
        <ARow :gutter="[16, 16]" wrap>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.manage.menu.menuName')" class="m-0">
              <AInput v-model:value="searchModel.menuName" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.manage.menu.routeName')" class="m-0">
              <AInput v-model:value="searchModel.routeName" />
            </AFormItem>
          </ACol>
          <ACol :span="24" :md="12" :lg="6">
            <AFormItem :label="$t('page.manage.menu.menuStatus')" class="m-0">
              <ASelect
                v-model:value="searchModel.status"
                allow-clear
                :options="[
                  { label: $t(enableStatusRecord['1']), value: '1' },
                  { label: $t(enableStatusRecord['2']), value: '2' }
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
      :title="$t('page.manage.menu.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || !canAccess('menu:delete')"
          :loading="loading"
          @refresh="getData"
        >
          <template #default>
            <AButton v-if="canAccess('menu:add')" size="small" ghost type="primary" @click="handleAdd">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('common.add') }}</span>
            </AButton>
            <APopconfirm
              v-if="canAccess('menu:delete')"
              :title="$t('common.confirmDelete')"
              :disabled="checkedRowKeys.length === 0"
              @confirm="handleBatchDelete"
            >
              <AButton size="small" danger :disabled="checkedRowKeys.length === 0">
                <template #icon>
                  <icon-ic-round-delete class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.batchDelete') }}</span>
              </AButton>
            </APopconfirm>
          </template>
        </TableHeaderOperation>
      </template>
      <ATable
        ref="tableWrapperRef"
        :columns="columns"
        :data-source="filteredData"
        :row-selection="rowSelection"
        size="small"
        :loading="loading"
        row-key="id"
        :scroll="scrollConfig"
        :pagination="pagination"
        class="h-full"
      />
      <MenuOperateModal
        v-model:visible="visible"
        :operate-type="operateType"
        :row-data="editingData"
        :all-pages="allPages"
        @submitted="getDataByPage"
      />
    </ACard>
  </div>
</template>

<style scoped>
:deep(.ant-table-thead > tr > th),
:deep(.ant-table-tbody > tr > td) {
  white-space: nowrap;
}
</style>

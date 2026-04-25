<script setup lang="tsx">
import { Button, Popconfirm, Tag } from 'ant-design-vue';
import { fetchDeleteUser, fetchGetUserList } from '@/service/api';
import { useTable, useTableOperate, useTableScroll } from '@/hooks/common/table';
import { useRouterPush } from '@/hooks/common/router';
import { useAuth } from '@/hooks/business/auth';
import { $t } from '@/locales';
import { enableStatusRecord, userGenderRecord } from '@/constants/business';
import { useAuthStore } from '@/store/modules/auth';
import UserOperateDrawer from './modules/user-operate-drawer.vue';
import UserSearch from './modules/user-search.vue';

const { tableWrapperRef, scrollConfig } = useTableScroll(1080);
const { routerPushByKey } = useRouterPush();
const { hasAuth } = useAuth();
const authStore = useAuthStore();

function canAccess(code: string) {
  return authStore.userInfo.buttons.length === 0 || hasAuth(code);
}

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  searchParams,
  resetSearchParams
} = useTable({
  apiFn: fetchGetUserList,
  apiParams: {
    current: 1,
    size: 10,
    // if you want to use the searchParams in Form, you need to define the following properties, and the value is null
    // the value can not be undefined, otherwise the property in Form will not be reactive
    status: undefined,
    userName: undefined,
    userGender: undefined,
    nickName: undefined,
    userPhone: undefined,
    userEmail: undefined
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      dataIndex: 'index',
      align: 'center',
      width: 64
    },
    {
      key: 'userName',
      dataIndex: 'userName',
      title: $t('page.manage.user.userName'),
      align: 'center',
      minWidth: 140,
      ellipsis: true
    },
    {
      key: 'userGender',
      title: $t('page.manage.user.userGender'),
      align: 'center',
      dataIndex: 'userGender',
      width: 100,
      customRender: ({ record }) => {
        if (record.userGender === null) {
          return null;
        }

        const tagMap: Record<Api.SystemManage.UserGender, string> = {
          1: 'processing',
          2: 'error'
        };

        const label = $t(userGenderRecord[record.userGender]);

        return <Tag color={tagMap[record.userGender]}>{label}</Tag>;
      }
    },
    {
      key: 'nickName',
      dataIndex: 'nickName',
      title: $t('page.manage.user.nickName'),
      align: 'center',
      minWidth: 140,
      ellipsis: true
    },
    {
      key: 'userPhone',
      dataIndex: 'userPhone',
      title: $t('page.manage.user.userPhone'),
      align: 'center',
      width: 140,
      ellipsis: true
    },
    {
      key: 'userEmail',
      dataIndex: 'userEmail',
      title: $t('page.manage.user.userEmail'),
      align: 'center',
      minWidth: 240,
      ellipsis: true
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: $t('page.manage.user.userStatus'),
      align: 'center',
      width: 100,
      customRender: ({ record }) => {
        if (record.status === null) {
          return null;
        }

        const tagMap: Record<Api.Common.EnableStatus, string> = {
          1: 'success',
          2: 'warning'
        };

        const label = $t(enableStatusRecord[record.status]);

        return <Tag color={tagMap[record.status]}>{label}</Tag>;
      }
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 220,
      customRender: ({ record }) => (
        <div class="flex-center gap-8px">
          {canAccess('user:view') && (
            <Button size="small" onClick={() => viewDetail(record.id)}>
              {$t('common.detail')}
            </Button>
          )}
          {canAccess('user:edit') && (
            <Button type="primary" ghost size="small" onClick={() => edit(record.id)}>
              {$t('common.edit')}
            </Button>
          )}
          {canAccess('user:delete') && (
            <Popconfirm title={$t('common.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
              <Button danger size="small">
                {$t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ]
});

const {
  drawerVisible,
  operateType,
  editingData,
  handleAdd,
  handleEdit,
  checkedRowKeys,
  rowSelection,
  onBatchDeleted,
  onDeleted
  // closeDrawer
} = useTableOperate(data, getData);

async function handleBatchDelete() {
  await Promise.all(checkedRowKeys.value.map(id => fetchDeleteUser(id as number)));
  onBatchDeleted();
}

async function handleDelete(id: number) {
  await fetchDeleteUser(id);
  onDeleted();
}

function edit(id: number) {
  handleEdit(id);
}

function viewDetail(id: number) {
  routerPushByKey('manage_user-detail', { params: { id: String(id) } });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <UserSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <ACard
      :title="$t('page.manage.user.title')"
      :bordered="false"
      :body-style="{ flex: 1, overflow: 'hidden' }"
      class="flex-col-stretch sm:flex-1-hidden card-wrapper"
    >
      <template #extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :disabled-delete="checkedRowKeys.length === 0 || !canAccess('user:delete')"
          :loading="loading"
          @refresh="getData"
        >
          <template #default>
            <AButton v-if="canAccess('user:add')" size="small" ghost type="primary" @click="handleAdd">
              <template #icon>
                <icon-ic-round-plus class="align-sub text-icon" />
              </template>
              <span class="ml-8px">{{ $t('common.add') }}</span>
            </AButton>
            <APopconfirm
              v-if="canAccess('user:delete')"
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
        :data-source="data"
        size="small"
        :row-selection="rowSelection"
        :scroll="scrollConfig"
        :loading="loading"
        row-key="id"
        :pagination="mobilePagination"
        class="h-full"
      />

      <UserOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
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

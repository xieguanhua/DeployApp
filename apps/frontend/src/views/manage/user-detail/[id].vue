<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchGetUserDetail } from '@/service/api';
import { $t } from '@/locales';
import { enableStatusRecord, userGenderRecord } from '@/constants/business';

interface Props {
  id: string;
}

const props = defineProps<Props>();
const loading = ref(false);
const detail = ref<Api.SystemManage.User | null>(null);

const statusText = computed(() => {
  if (!detail.value?.status) return '-';
  return $t(enableStatusRecord[detail.value.status]);
});

const genderText = computed(() => {
  if (!detail.value?.userGender) return '-';
  return $t(userGenderRecord[detail.value.userGender]);
});

async function loadDetail() {
  const userId = Number(props.id);
  if (!userId) {
    window.$message?.error($t('common.error'));
    return;
  }

  loading.value = true;
  const { data, error } = await fetchGetUserDetail(userId);
  loading.value = false;
  if (error) {
    window.$message?.error(error.message || $t('common.error'));
    return;
  }
  detail.value = data.item;
}

onMounted(loadDetail);
</script>

<template>
  <ACard :title="$t('page.manage.user.detailTitle')">
    <ASpin :spinning="loading">
      <ADescriptions v-if="detail" bordered :column="2">
        <ADescriptionsItem :label="$t('page.manage.user.userName')">{{ detail.userName }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.nickName')">{{ detail.nickName }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userGender')">{{ genderText }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userPhone')">{{ detail.userPhone || '-' }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userEmail')">{{ detail.userEmail || '-' }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userStatus')">{{ statusText }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userRole')">{{ detail.userRoles.join(', ') || '-' }}</ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.manage.user.userId')">{{ detail.id }}</ADescriptionsItem>
      </ADescriptions>
      <AEmpty v-else />
    </ASpin>
  </ACard>
</template>

<style scoped></style>

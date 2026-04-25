<script setup lang="ts">
import { reactive, ref } from 'vue';
import { fetchChangePassword } from '@/service/api';
import { $t } from '@/locales';

const loading = ref(false);
const formModel = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

async function submitChangePassword() {
  if (!formModel.oldPassword || !formModel.newPassword || !formModel.confirmPassword) {
    window.$message?.error($t('form.required'));
    return;
  }
  if (formModel.newPassword !== formModel.confirmPassword) {
    window.$message?.error($t('form.confirmPwd.invalid'));
    return;
  }
  loading.value = true;
  const { error } = await fetchChangePassword({
    oldPassword: formModel.oldPassword,
    newPassword: formModel.newPassword
  });
  loading.value = false;
  if (error) {
    window.$message?.error($t('common.error'));
    return;
  }
  window.$message?.success($t('common.modifySuccess'));
  formModel.oldPassword = '';
  formModel.newPassword = '';
  formModel.confirmPassword = '';
}
</script>

<template>
  <ACard :title="$t('route.user-center')">
    <AForm layout="vertical">
      <AFormItem :label="$t('page.userCenter.changePassword.currentPasswordLabel')">
        <AInputPassword
          v-model:value="formModel.oldPassword"
          :placeholder="$t('page.userCenter.changePassword.currentPasswordPlaceholder')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.userCenter.changePassword.newPasswordLabel')">
        <AInputPassword
          v-model:value="formModel.newPassword"
          :placeholder="$t('page.userCenter.changePassword.newPasswordPlaceholder')"
        />
      </AFormItem>
      <AFormItem :label="$t('page.userCenter.changePassword.confirmNewPasswordLabel')">
        <AInputPassword
          v-model:value="formModel.confirmPassword"
          :placeholder="$t('page.userCenter.changePassword.confirmNewPasswordPlaceholder')"
        />
      </AFormItem>
      <AButton type="primary" :loading="loading" @click="submitChangePassword">
        {{ $t('page.userCenter.changePassword.submit') }}
      </AButton>
    </AForm>
  </ACard>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { $t } from '@/locales';
import { loginModuleRecord } from '@/constants/app';
import { useRouterPush } from '@/hooks/common/router';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useAuthStore } from '@/store/modules/auth';
import { getRememberMe } from '@/store/modules/auth/shared';

defineOptions({
  name: 'PwdLogin'
});

const authStore = useAuthStore();
const { toggleLoginModule } = useRouterPush();
const { formRef } = useAntdForm();

interface FormModel {
  account: string;
  password: string;
  rememberMe: boolean;
}

const model: FormModel = reactive({
  account: '',
  password: '',
  rememberMe: getRememberMe()
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  // inside computed to make locale reactive, if not apply i18n, you can define it without computed
  const { formRules, defaultRequiredRule } = useFormRules();

  return {
    account: [defaultRequiredRule],
    password: formRules.pwd
  };
});

async function handleSubmit() {
  await authStore.login(model.account.trim(), model.password, model.rememberMe);
}
</script>

<template>
  <AForm ref="formRef" :model="model" :rules="rules" autocomplete="on" @finish="handleSubmit">
    <AFormItem name="account">
      <AInput
        v-model:value="model.account"
        name="account"
        autocomplete="username"
        size="large"
        :placeholder="$t('page.login.common.accountPlaceholder')"
      />
    </AFormItem>
    <AFormItem name="password">
      <AInputPassword
        v-model:value="model.password"
        name="password"
        autocomplete="current-password"
        size="large"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
      />
    </AFormItem>
    <ASpace direction="vertical" size="large" class="w-full">
      <div class="flex-y-center justify-between">
        <ACheckbox v-model:checked="model.rememberMe">{{ $t('page.login.pwdLogin.rememberMe') }}</ACheckbox>
        <AButton type="text" @click="toggleLoginModule('reset-pwd')">
          {{ $t('page.login.pwdLogin.forgetPassword') }}
        </AButton>
      </div>
      <AButton type="primary" html-type="submit" block size="large" shape="round" :loading="authStore.loginLoading">
        {{ $t('common.confirm') }}
      </AButton>
      <div class="flex-y-center justify-between">
        <AButton class="h-34px flex-1" block @click="toggleLoginModule('code-login')">
          {{ $t(loginModuleRecord['code-login']) }}
        </AButton>
        <div class="w-12px"></div>
        <AButton class="h-34px flex-1" block @click="toggleLoginModule('register')">
          {{ $t(loginModuleRecord.register) }}
        </AButton>
      </div>
    </ASpace>
  </AForm>
</template>

<style scoped></style>

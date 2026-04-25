<script setup lang="ts">
import { computed, reactive } from 'vue';
import { $t } from '@/locales';
import { useRouterPush } from '@/hooks/common/router';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useCaptcha } from '@/hooks/business/captcha';
import { fetchRegisterByCode } from '@/service/api';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({
  name: 'Register'
});

const authStore = useAuthStore();
const { toggleLoginModule, redirectFromLogin } = useRouterPush();
const { formRef, validate } = useAntdForm();
const { label, isCounting, loading, getCaptcha } = useCaptcha();
const smsEnabled = import.meta.env.VITE_AUTH_SMS_CODE_ENABLED !== 'N';
const emailEnabled = import.meta.env.VITE_AUTH_EMAIL_CODE_ENABLED !== 'N';
const channelDisabled = !smsEnabled && !emailEnabled;

interface FormModel {
  account: string;
  userName: string;
  code: string;
  password: string;
  confirmPassword: string;
}

const model: FormModel = reactive({
  account: '',
  userName: '',
  code: '',
  password: '',
  confirmPassword: ''
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules, createConfirmPwdRule } = useFormRules();
  const accountRules = channelDisabled
    ? formRules.phoneOrEmail
    : smsEnabled && emailEnabled
      ? formRules.phoneOrEmail
      : smsEnabled
        ? formRules.phone
        : formRules.email;

  return {
    account: [...accountRules],
    userName: formRules.userName,
    code: formRules.code,
    password: formRules.pwd,
    confirmPassword: createConfirmPwdRule(model.password)
  };
});

const accountPlaceholder = computed(() => {
  if (channelDisabled) return $t('page.login.common.codeChannelDisabled');
  if (smsEnabled && emailEnabled) return $t('page.login.common.phoneOrEmailPlaceholder');
  if (smsEnabled) return $t('page.login.common.phonePlaceholder');
  return $t('page.login.common.emailPlaceholder');
});

async function handleSubmit() {
  if (channelDisabled) {
    window.$message?.error($t('page.login.common.codeChannelDisabled'));
    return;
  }
   await validate();
  const { data: loginToken, error } = await fetchRegisterByCode({
    target: model.account.trim(),
    code: model.code.trim(),
    username: model.userName.trim(),
    password: model.password
  });
  if (!error && loginToken) {
    const pass = await authStore.loginByToken(loginToken);
    if (pass) {
      await redirectFromLogin(true);
      window.$notification?.success({
        message: $t('page.login.common.registerSuccess'),
        description: $t('page.login.common.welcomeBack', { userName: authStore.userInfo.userName })
      });
      return;
    }
  }
  toggleLoginModule('pwd-login');
}
</script>

<template>
  <AForm ref="formRef" :model="model" :rules="rules" @keyup.enter="handleSubmit">
    <AFormItem name="account">
      <AInput
        v-model:value="model.account"
        size="large"
        :placeholder="accountPlaceholder"
      />
    </AFormItem>
    <AFormItem name="userName">
      <AInput v-model:value="model.userName" size="large" :placeholder="$t('page.login.common.userNamePlaceholder')" />
    </AFormItem>
    <AFormItem name="code">
      <div class="w-full flex-y-center gap-16px">
        <AInput v-model:value="model.code" size="large" :placeholder="$t('page.login.common.codePlaceholder')" />
        <AButton
          class="shrink-0"
          :style="{ width: '140px' }"
          size="large"
          :disabled="isCounting"
          :loading="loading"
          @click="getCaptcha(model.account, 'register')"
        >
          {{ label }}
        </AButton>
      </div>
    </AFormItem>
    <AFormItem name="password">
      <AInputPassword
        v-model:value="model.password"
        size="large"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
      />
    </AFormItem>
    <AFormItem name="confirmPassword">
      <AInputPassword
        v-model:value="model.confirmPassword"
        size="large"
        :placeholder="$t('page.login.common.confirmPasswordPlaceholder')"
      />
    </AFormItem>
    <ASpace direction="vertical" size="large" class="w-full">
      <AButton type="primary" block size="large" shape="round" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </AButton>
      <AButton block size="large" shape="round" @click="toggleLoginModule('pwd-login')">
        {{ $t('page.login.common.back') }}
      </AButton>
    </ASpace>
  </AForm>
</template>

<style scoped></style>

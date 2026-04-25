<script setup lang="ts">
import { computed, reactive } from 'vue';
import { $t } from '@/locales';
import { useRouterPush } from '@/hooks/common/router';
import { useAntdForm, useFormRules } from '@/hooks/common/form';
import { useCaptcha } from '@/hooks/business/captcha';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({
  name: 'CodeLogin'
});

const authStore = useAuthStore();
const { toggleLoginModule } = useRouterPush();
const { formRef, validate } = useAntdForm();
const { label, isCounting, loading, getCaptcha } = useCaptcha();
const smsEnabled = import.meta.env.VITE_AUTH_SMS_CODE_ENABLED !== 'N';
const emailEnabled = import.meta.env.VITE_AUTH_EMAIL_CODE_ENABLED !== 'N';
const channelDisabled = !smsEnabled && !emailEnabled;

interface FormModel {
  account: string;
  code: string;
}

const model: FormModel = reactive({
  account: '',
  code: ''
});

const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules } = useFormRules();
  const accountRules = channelDisabled
    ? formRules.phoneOrEmail
    : smsEnabled && emailEnabled
      ? formRules.phoneOrEmail
      : smsEnabled
        ? formRules.phone
        : formRules.email;

  return {
    account: [...accountRules],
    code: formRules.code
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
  await authStore.loginWithCode({
    target: model.account.trim(),
    code: model.code.trim()
  });
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
    <AFormItem name="code">
      <div class="w-full flex-y-center gap-16px">
        <AInput v-model:value="model.code" size="large" :placeholder="$t('page.login.common.codePlaceholder')" />
        <AButton
          class="shrink-0"
          :style="{ width: '140px' }"
          size="large"
          :disabled="isCounting"
          :loading="loading"
          @click="getCaptcha(model.account, 'login')"
        >
          {{ label }}
        </AButton>
      </div>
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

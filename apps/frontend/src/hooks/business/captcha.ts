import { computed } from 'vue';
import { useCountDown, useLoading } from '@sa/hooks';
import { $t } from '@/locales';
import { REG_EMAIL, REG_PHONE } from '@/constants/reg';
import { fetchSendCode } from '@/service/api';

export function useCaptcha() {
  const { loading, startLoading, endLoading } = useLoading();
  const { count, start, stop, isCounting } = useCountDown(10);
  const smsEnabled = import.meta.env.VITE_AUTH_SMS_CODE_ENABLED !== 'N';
  const emailEnabled = import.meta.env.VITE_AUTH_EMAIL_CODE_ENABLED !== 'N';

  const label = computed(() => {
    let text = $t('page.login.codeLogin.getCode');

    const countingLabel = $t('page.login.codeLogin.reGetCode', { time: count.value });

    if (loading.value) {
      text = '';
    }

    if (isCounting.value) {
      text = countingLabel;
    }

    return text;
  });

  function isTargetValid(target: string) {
    const value = target.trim();
    if (value === '') {
      window.$message?.error?.($t('form.phoneOrEmail.required'));
      return false;
    }

    const isPhone = REG_PHONE.test(value);
    const isEmail = REG_EMAIL.test(value);

    if (smsEnabled && !emailEnabled && !isPhone) {
      window.$message?.error?.($t('form.phone.invalid'));
      return false;
    }

    if (!smsEnabled && emailEnabled && !isEmail) {
      window.$message?.error?.($t('form.email.invalid'));
      return false;
    }

    if (smsEnabled && emailEnabled && !isPhone && !isEmail) {
      window.$message?.error?.($t('form.phoneOrEmail.invalid'));
      return false;
    }

    if (!smsEnabled && !emailEnabled) {
      window.$message?.error?.($t('page.login.common.codeChannelDisabled'));
      return false;
    }

    return true;
  }

  async function getCaptcha(
    target: string,
    bizType: Api.Auth.VerificationBizType
  ) {
    if (!smsEnabled && !emailEnabled) {
      window.$message?.error?.($t('page.login.common.codeChannelDisabled'));
      return;
    }

    const valid = isTargetValid(target);

    if (!valid || loading.value) {
      return;
    }

    startLoading();

    const { error } = await fetchSendCode({
      target: target.trim(),
      bizType
    });

    if (!error) {
      window.$message?.success?.($t('page.login.codeLogin.sendCodeSuccess'));
      start();
    }

    endLoading();
  }

  return {
    label,
    start,
    stop,
    isCounting,
    loading,
    getCaptcha
  };
}

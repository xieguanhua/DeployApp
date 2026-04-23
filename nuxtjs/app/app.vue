<template>
  <a-config-provider :theme="theme">
    <NuxtRouteAnnouncer />
    <div class="page">
      <a-typography-title :level="2">激活管理服务控制台</a-typography-title>
      <a-typography-paragraph>
        当前 UI 使用 Ant Design Vue。激活码创建必须选择产品类型，以支持后续多产品、多价格策略。
      </a-typography-paragraph>

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :md="12">
          <a-card title="默认类型说明" size="small">
            <a-space direction="vertical">
              <a-tag color="blue">产品类型: TRADING_AGENTS</a-tag>
              <a-tag color="gold">端类型: frontend</a-tag>
              <a-tag color="green">价格: 0 分（示例）</a-tag>
            </a-space>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-card title="接口分层" size="small">
            <a-typography-paragraph>
              后台接口：`/api/admin/*`<br />
              AI接口：`/api/public/*`<br />
              激活接口：`/api/activate`
            </a-typography-paragraph>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
const theme = {
  token: {
    colorPrimary: "#1677ff",
  },
};
</script>

<style scoped>
.page {
  max-width: 980px;
  margin: 40px auto;
  padding: 0 16px;
}
</style>

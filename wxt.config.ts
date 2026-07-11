import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'IP Veil',
    description: 'Keeps your public IP address hidden on web pages until you intentionally reveal it.',
    permissions: ['storage'],
    host_permissions: ['https://api.ipify.org/*'],
  },
});

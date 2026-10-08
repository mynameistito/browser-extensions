import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    description:
      "Keeps your public IP address hidden on web pages until you intentionally reveal it.",
    host_permissions: ["https://api.ipify.org/*"],
    name: "IP Veil",
    permissions: ["storage"],
  },
});

// Minimal preload — exposes only what we need.
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("cockpit", {
  platform: process.platform,
  versions: process.versions,
});

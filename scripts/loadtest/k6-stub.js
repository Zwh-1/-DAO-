/**
 * 阶段九：k6 压测占位（安装 k6 后：k6 run scripts/loadtest/k6-stub.js）
 * https://k6.io/docs/
 */
import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s"
};

export default function () {
  http.get("http://localhost:3010/v1/health");
  sleep(1);
}

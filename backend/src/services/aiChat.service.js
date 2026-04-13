/**
 * AI 智能客服服务
 * 优先调用 DeepSeek API；失败时降级为静态知识库回答
 * 安全约束：任何涉及私钥/助记词的问题强制返回安全拒绝消息
 */

import { config } from "../config.js";

// ── 静态知识库（降级备用，也用于快速关键字匹配）──
const STATIC_KB = [
  // 通用问候
  {
    keywords: ["你好", "hello", "hi", "嗨", "哈喽", "您好", "hey"],
    answer:
      "你好！我是 TrustAid AI 助手 👋\n" +
      "可以帮你解答：\n" +
      "• 如何连接钱包/登录\n" +
      "• 零知识证明（ZKP）是什么\n" +
      "• 如何申领空投\n" +
      "• SBT 等级规则\n" +
      "• DAO 治理投票\n" +
      "• 申领失败排查\n\n" +
      "请直接描述你的问题！",
  },
  // 登录 / 连接钱包
  {
    keywords: ["登录", "登入", "登陆", "连接钱包", "sign in", "siwe", "如何登", "怎么登", "怎么连", "怎么连接", "连接"],
    answer:
      "登录步骤：\n" +
      "① 点击页面右上角「连接钱包」按钮\n" +
      "② 在弹窗中选择钱包类型：\n" +
      "   • MetaMask（需安装浏览器插件）\n" +
      "   • 本地内置钱包（输入密码解锁或导入助记词）\n" +
      "③ 钱包就绪后点击「Sign In（SIWE）」完成签名\n" +
      "④ 签名成功后右上角显示地址缩写即为登录状态\n\n" +
      "⚠️ SIWE 签名需要后端服务在线（端口 3010）。",
  },
  // 钱包相关
  {
    keywords: ["钱包", "metamask", "内置钱包", "embedded", "助记词导入", "导入钱包", "创建钱包", "wallet"],
    answer:
      "本平台支持两种钱包：\n\n" +
      "🦊 MetaMask\n" +
      "安装浏览器插件后直接连接，无需额外设置。\n\n" +
      "🔐 本地内置钱包\n" +
      "• 新建：自动生成助记词，用密码加密保存本地\n" +
      "• 导入：粘贴 12/24 位助记词 + 设置密码（支持从旧钱包迁移）\n" +
      "• 解锁：用创建时的密码解锁\n\n" +
      "私钥/助记词仅在本地加密存储，明文绝不发送至服务器。",
  },
  // 注册 / 新手入门
  {
    keywords: ["注册", "怎么用", "怎么开始", "如何使用", "新手", "第一次", "开始", "入门"],
    answer:
      "新用户快速入门：\n" +
      "① 点击右上角「连接钱包」→ 选择 MetaMask 或本地内置钱包\n" +
      "② 完成 SIWE 签名登录\n" +
      "③ 访问「成员中心」查看 SBT 信用等级\n" +
      "④ 在「理赔申请」页面生成 ZK 证明并提交申领\n" +
      "⑤ 等待 DAO 投票或预言机快速审批",
  },
  // 平台介绍
  {
    keywords: ["这是什么", "平台介绍", "trustaid", "什么平台", "功能", "有哪些功能", "介绍"],
    answer:
      "TrustAid 是基于零知识证明（ZKP）与 DAO 治理的去中心化互助平台。\n\n" +
      "核心特性：\n" +
      "• 🔒 隐私保护：身份通过 ZK 证明验证，原始信息不上链\n" +
      "• 🛡️ 抗女巫：Nullifier + SBT 防止重复申领\n" +
      "• 🗳️ DAO 治理：社区加权投票审批\n" +
      "• ⚡ 极速通道：高信用账户通过预言机快速审批\n" +
      "• 🤖 AI 审计：自动扫描合约漏洞",
  },
  // 申领
  {
    keywords: ["申领", "claim", "空投", "airdrop", "如何申领", "怎么申领", "提交申请"],
    answer:
      "申领空投步骤：\n" +
      "① 登录后进入「理赔申请」页面\n" +
      "② 填写申领金额和理由（链下证据 CID 需以 ipfs:// 开头）\n" +
      "③ 点击「生成 ZK 证明」——在本地浏览器 Worker 内计算，隐私数据不离端\n" +
      "④ 证明生成后点击「提交申领」，调用 ClaimVaultZK 合约\n" +
      "⑤ DAO 投票通过或预言机审批后，资金自动释放",
  },
  // Nullifier
  {
    keywords: ["nullifier", "空投重放", "重复申领", "唯一标识"],
    answer:
      "Nullifier 是由秘密种子（secret）与空投项目 ID 通过 Poseidon 哈希生成的唯一标识。\n" +
      "每次申领后记录到链上，确保「一人一次」不可重放。\n\n" +
      "特点：\n" +
      "• 不可逆：无法从 Nullifier 反推身份\n" +
      "• 全局唯一：同一身份对同一空投只能生成一个\n" +
      "• 跨设备一致：secret 相同则任何设备结果一致",
  },
  // SBT
  {
    keywords: ["sbt", "灵魂绑定", "等级", "积分", "信用"],
    answer:
      "SBT（灵魂绑定代币）是链上信用凭证，不可转让。\n\n" +
      "等级规则（0–1000 分）：\n" +
      "• Bronze（0–299）/ Silver（300–599）/ Gold（600–799）/ Platinum（800+）\n" +
      "• 等级越高：申领上限越高，等待期越短\n" +
      "• 评分来源：入网时长、申领记录、社区贡献\n\n" +
      "在「成员中心」可查看当前等级和积分。",
  },
  // ZK 证明
  {
    keywords: ["zk", "零知识", "证明", "隐私", "witness", "circom", "snarkjs"],
    answer:
      "零知识证明（ZKP）允许证明「我满足条件」而无需暴露原始数据。\n\n" +
      "本平台技术栈：Circom 2.1 + Groth16\n" +
      "• Secret / Trapdoor 仅在本地浏览器 Web Worker 内计算\n" +
      "• 生成的 proof + publicSignals 提交链上\n" +
      "• 合约调用 Groth16Verifier 验证，无需信任中间方\n" +
      "• 哈希算法：电路内用 Poseidon，链上用 keccak256",
  },
  // DAO
  {
    keywords: ["dao", "治理", "投票", "提案", "时间锁"],
    answer:
      "DAO 治理规则：\n\n" +
      "• 投票权重：由 SBT 信用评分决定\n" +
      "• 提案流程：创建 → 投票期 3 天 → 2 天时间锁 → 执行\n" +
      "• 法定人数：需达总权重 10%\n" +
      "• 通过阈值：赞成票 > 50%\n\n" +
      "在「DAO 治理」页面可查看活跃提案并投票。",
  },
  // 预言机
  {
    keywords: ["预言机", "oracle", "报告", "极速", "多签"],
    answer:
      "预言机负责将链下证明提交到链上：\n\n" +
      "• 普通申领：需 3 个节点签名\n" +
      "• 极速通道：需 5 个签名，可绕过 DAO 等待期\n" +
      "• 报告内容：事故/收入证明（IPFS CID 引用）",
  },
  // 挑战 / 仲裁
  {
    keywords: ["挑战", "challenge", "质押", "仲裁", "女巫"],
    answer:
      "抗女巫挑战机制：\n\n" +
      "• 任何人可发起挑战，需质押 ETH\n" +
      "• 仲裁员使用 Commit-Reveal 两阶段投票\n" +
      "• 挑战成立：申领无效，质押退回；挑战失败：质押进奖励池",
  },
  // 申领失败
  {
    keywords: ["申领失败", "claim failed", "提交错误", "失败原因", "报错", "错误", "失败"],
    answer:
      "申领失败排查：\n" +
      "① Nullifier 已使用 — 每个身份只能申领一次\n" +
      "② ZK 证明验证失败 — 检查 publicSignals 格式\n" +
      "③ 申领金额超出 SBT 等级上限\n" +
      "④ 账户处于 90 天等待期内\n" +
      "⑤ 证据 CID 格式错误（须以 ipfs:// 开头）\n" +
      "⑥ 后端服务离线（确认端口 3010 正常运行）",
  },
  // Gas / 费用
  {
    keywords: ["gas", "手续费", "费用", "花费", "多少钱", "收费"],
    answer:
      "Gas 费用参考：\n\n" +
      "• 生成 ZK 证明：免费（本地计算）\n" +
      "• 提交申领：约 200,000–350,000 Gas\n" +
      "• DAO 投票：约 50,000–80,000 Gas\n" +
      "• 发起挑战：约 100,000 Gas + 质押\n\n" +
      "本地测试网 Gas 费接近 0，主网按实时 ETH 价格计算。",
  },
];

const SECURITY_KEYWORDS = ["私钥", "助记词", "seed phrase", "private key", "mnemonic", "keystore"];

function staticAnswer(message) {
  const lower = message.toLowerCase().trim();

  // 安全拒绝：涉及私钥类问题
  if (SECURITY_KEYWORDS.some(k => lower.includes(k))) {
    return (
      "⚠️ 安全提示：TrustAid AI 助手永远不会询问或处理您的私钥、助记词或任何敏感密钥信息。\n" +
      "如有人以「TrustAid 客服」为由索取您的私钥，请立即举报。"
    );
  }

  for (const item of STATIC_KB) {
    if (item.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return item.answer;
    }
  }

  return (
    "感谢提问！我暂时没有找到精准匹配的答案。\n\n" +
    "你可以尝试这些关键词提问：\n" +
    "「怎么登录」「如何申领」「什么是 Nullifier」「SBT 等级」「DAO 投票」「申领失败」\n\n" +
    "或者描述具体操作步骤和遇到的错误信息，我会尽力帮你排查。"
  );
}

export async function chatWithAI(message) {
  // 安全过滤先于 LLM
  const lower = message.toLowerCase();
  if (SECURITY_KEYWORDS.some(k => lower.includes(k))) {
    return staticAnswer(message);
  }

  const apiKey = config.deepseekApiKey || config.openaiApiKey;
  if (!apiKey) {
    return staticAnswer(message);
  }

  try {
    const isDeepSeek = Boolean(config.deepseekApiKey);
    const endpoint = isDeepSeek
      ? "https://api.deepseek.com/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = isDeepSeek ? "deepseek-chat" : "gpt-3.5-turbo";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是 TrustAid 去中心化互助平台的 AI 客服助手。" +
              "专注于：零知识证明、SBT 等级规则、DAO 治理、钱包连接（MetaMask/内置钱包）、申领故障排查。" +
              "你绝不询问或处理用户的私钥、助记词等敏感信息。" +
              "回答请简洁专业，使用中文，字数控制在 200 字以内。" +
              "如果问题超出平台范围，友好提示用户描述具体问题。",
          },
          { role: "user", content: message },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`LLM API error: ${res.status}`);

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? staticAnswer(message);
  } catch {
    return staticAnswer(message);
  }
}

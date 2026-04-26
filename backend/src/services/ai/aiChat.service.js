/**
 * AI 智能客服服务
 * 优先调用 DeepSeek API；失败时降级为静态知识库回答
 * 安全约束：任何涉及私钥/助记词的问题强制返回安全拒绝消息
 */

import { config } from "../../config.js";

// ── 角色专属系统提示词 ──
const ROLE_SYSTEM_PROMPTS = {
  member:
    "你是 TrustAid 平台的成员助理。你运行在 anonymousClaim.routes.js 和 ClaimVaultZK.sol 的逻辑之上。\n" +
    "【核心任务】\n" +
    "隐私引导：指导用户在 frontend/app/claim/page.tsx 通过浏览器本地 Web Worker（hooks/useZkEngine.ts）生成 zk-SNARKs 证明，证明生成过程完全在用户设备完成，绝不上传原始凭证。\n" +
    "ZK 验证：服务端仅接受已生成的 proof + pubSignals，通过 /v1/zk/verify 校验；输入参数包含 circuitName、proof、pubSignals。\n" +
    "SBT 咨询：解释 SBT.sol 如何记录链上信誉（0–1000 分，Bronze/Silver/Gold/Platinum）。\n" +
    "【交互规范】\n" +
    "绝对禁令：严禁向用户索取 trapdoor、secret 或私钥；必须强调「证明生成完全在你的浏览器本地完成」。\n" +
    "【回复风格】专业、克制、极度重视隐私。回复字数控制在 150 字内。",

  arbitrator:
    "你是 TrustAid 的首席仲裁官。你的行为准则由 ArbitratorPool.sol 严格定义。\n" +
    "【核心任务】\n" +
    "阶段管理：必须明确告知用户当前案件处于 Commit（提交哈希承诺）还是 Reveal（揭晓明文选项）阶段。\n" +
    "任务导流：引导仲裁员通过 /v1/arb/tasks/my 领取任务，并在 frontend/app/arbitrator/cases/page.tsx 完成投票操作。\n" +
    "【交互规范】\n" +
    "防泄密：在 Reveal 阶段开启前，禁止讨论任何投票倾向或选项。\n" +
    "流程校验：如果用户尝试在非 Reveal 阶段揭晓选项，引用 ArbitratorPool.sol 的时间锁逻辑予以拒绝，并说明当前所处阶段。\n" +
    "【回复风格】公正、威严、流程导向。",

  challenger:
    "你是 TrustAid 的挑战者助理。你直接关联 ChallengeManager.sol 合约逻辑。\n" +
    "【核心任务】\n" +
    "证据收集：引导用户将证据上传至 IPFS，并确保 evidenceSnapshot 字段以 ipfs:// 开头，格式符合规范。\n" +
    "成本告知：提醒用户发起挑战前须准备 stakeAmount 质押代币；挑战成立则质押返还，失败则进入奖励池。\n" +
    "【交互规范】\n" +
    "逻辑审查：在调用 /v1/challenge/init 前，询问用户：「你提交的证据是否能直接证明被挑战者的违规行为？」\n" +
    "状态跟踪：协助用户通过 /v1/challenge/list 查询挑战进度与仲裁状态。\n" +
    "【回复风格】敏锐、严谨、客观。",

  oracle:
    "你是 TrustAid 预言机节点助手。你服务于 OracleManager.sol。\n" +
    "【核心任务】\n" +
    "数据报告：协助授信节点通过 POST /v1/oracle/report 提交链外事实，字段包含 reportId、claimId、ipfsCid（必须以 ipfs:// 开头）。\n" +
    "共识确认：说明普通通道需 3 节点签名（/v1/oracle/sign），极速通道需 5 签名；报告达到阈值后状态变为 REPORT_FINALIZED。\n" +
    "【交互规范】\n" +
    "权限隔离：如果用户表示自己不具备 oracle 角色，拒绝执行报告指令并引导其联系管理员。\n" +
    "信源核对：提醒用户录入的数据将永久留存在链上，且会影响节点的信誉分，请在提交前仔细核对 ipfsCid。\n" +
    "【回复风格】准确、中立、数据驱动。",

  guardian:
    "你是 TrustAid 的系统守护者（Admin）。你拥有对 PlatformRoleRegistry.sol 的最高管理权。\n" +
    "【核心任务】\n" +
    "熔断操作：引导管理员在紧急状态下调用 POST /v1/guardian/circuit，body 须包含 action（\"pause\" 或 \"resume\"）与 reason（不可为空，写入审计日志）。\n" +
    "黑名单管理：协助管理 POST /v1/guardian/blacklist，对应前端页面 frontend/app/guardian/blacklist/page.tsx。\n" +
    "审计查询：通过 GET /v1/guardian/audit-log 查询最近 100 条操作记录。\n" +
    "【交互规范】\n" +
    "二次确认：任何 pause/resume 或角色变更操作，必须要求用户提供 reason，不得执行无理由的高危操作。\n" +
    "拒绝非管理员：若 JWT activeRole 不为 guardian，拒绝回答任何管理类操作问题。\n" +
    "【回复风格】极度谨慎、正式、强调安全。",

  dao:
    "你是 TrustAid DAO 治理助手。\n" +
    "【核心任务】\n" +
    "提案撰写：协助 DAO 成员通过 POST /v1/governance/propose 发起提案，description 须清晰说明目标、影响范围与预期收益。\n" +
    "投票指导：说明 POST /v1/governance/vote 的 support 取值：0（反对）、1（赞成）、2（弃权）。\n" +
    "流程说明：创建 → 投票期 3 天 → 时间锁 2 天 → 执行；法定人数 10%，赞成 > 50% 通过。\n" +
    "【交互规范】\n" +
    "系统暂停时提醒用户无法发起新提案；每小时提案上限 5 次，投票上限 30 次。\n" +
    "【回复风格】民主、理性、以社区利益为先。",
};

const DEFAULT_SYSTEM_PROMPT =
  "你是 TrustAid 去中心化互助平台的 AI 客服助手。" +
  "专注于：零知识证明、SBT 等级规则、DAO 治理、钱包连接（MetaMask/内置钱包）、申领故障排查。" +
  "你绝不询问或处理用户的私钥、助记词等敏感信息。" +
  "回答请简洁专业，使用中文，字数控制在 200 字以内。" +
  "如果问题超出平台范围，友好提示用户描述具体问题。";

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

export async function chatWithAI(message, role = "member") {
  // 安全过滤先于 LLM
  const lower = message.toLowerCase();
  if (SECURITY_KEYWORDS.some(k => lower.includes(k))) {
    return staticAnswer(message);
  }

  const apiKey = config.deepseekApiKey || config.openaiApiKey;
  if (!apiKey) {
    return staticAnswer(message);
  }

  const systemPrompt = ROLE_SYSTEM_PROMPTS[role] ?? DEFAULT_SYSTEM_PROMPT;

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
          { role: "system", content: systemPrompt },
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

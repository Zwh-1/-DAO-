pragma circom 2.1.6;

// 使用 circomlib 标准比较器组件
include "../../node_modules/circomlib/circuits/comparators.circom";

// ═══════════════════════════════════════════════════════════════════════════════
// TimestampValidator — 时间戳范围验证工具电路
//
// 核心职责：
//   - 验证事件时间戳是否在有效时间窗口内
//   - 约束：ts_start ≤ claim_ts ≤ ts_end
//   - 所有时间戳为 Unix 秒级整数（< 2^63）
//
// 隐私承诺：
//   claim_ts 为私有见证人，绝不离端，禁止在日志中暴露明文
//   公开输出仅为验证通过/失败（布尔值）
//
// 业务场景：
//   - 空投申领时间窗口验证
//   - 理赔时效性检查
//   - 身份凭证过期验证
//
// 使用示例：
//   component tsValidator = TimestampValidator();
//   tsValidator.claim_ts <== user_claim_timestamp;      // 私有
//   tsValidator.ts_start <== public_start_time;         // 公开
//   tsValidator.ts_end <== public_end_time;             // 公开
//   // tsValidator.valid === 1 表示验证通过
// ═══════════════════════════════════════════════════════════════════════════════

template TimestampValidator() {
    // ── 私有输入 (Witness — 绝不离端，禁止日志记录) ─────────────────────────
    signal input claim_ts;        // 用户申领时间戳（私有，零知识保护）
    
    // ── 公开输入 (Public Inputs — 链上可验证) ───────────────────────────────
    signal input ts_start;        // 时间窗口开始时间戳（公开）
    signal input ts_end;          // 时间窗口结束时间戳（公开）
    
    // ── 输出信号 ─────────────────────────────────────────────────────────────
    signal output valid;          // 验证结果：1=通过，0=失败
    
    // ── 域安全约束（防止溢出攻击）───────────────────────────────────────────
    // Unix 时间戳使用 63-bit（避免符号位），最大值 ~2^63 ≈ 9.22×10^18
    // 对应年份：292,277,026,596 年，远超当前时间（2026 年）
    // 强制 claim_ts < 2^63，防止负数或溢出攻击
    component rangeCheck = Num2Bits(63);
    rangeCheck.in <== claim_ts;
    
    // ── 时间窗口下界约束：claim_ts >= ts_start ──────────────────────────────
    // 使用 GreaterEqThan 确保包含边界（等号有效）
    // 若 claim_ts = ts_start 整，验证通过
    component ge = GreaterEqThan(64);
    ge.in[0] <== claim_ts;
    ge.in[1] <== ts_start;
    signal lower_bound_ok <== ge.out;
    
    // ── 时间窗口上界约束：claim_ts <= ts_end ────────────────────────────────
    // 使用 LessEqThan 确保包含边界（等号有效）
    // 若 claim_ts = ts_end 整，验证通过
    component le = LessEqThan(64);
    le.in[0] <== claim_ts;
    le.in[1] <== ts_end;
    signal upper_bound_ok <== le.out;
    
    // ── 最终验证：必须同时满足上下界约束 ────────────────────────────────────
    // valid = lower_bound_ok AND upper_bound_ok
    // 使用乘法实现逻辑与（两者都为 1 时结果才为 1）
    valid <== lower_bound_ok * upper_bound_ok;
    
    // ── 强制约束：验证必须通过 ─────────────────────────────────────────────
    // 若 valid !== 1，电路编译失败，证明无法生成
    valid === 1;
}

// ── 导出模板供其他电路引用 ─────────────────────────────────────────────────
// 使用方式：
//   include "./utils/timestamp_validator.circom";
//   component tsValidator = TimestampValidator();
//   tsValidator.claim_ts <== private_timestamp;
//   tsValidator.ts_start <== public_start;
//   tsValidator.ts_end <== public_end;

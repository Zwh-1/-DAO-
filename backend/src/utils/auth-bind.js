/**
 * 钱包身份绑定校验：请求体/query 中的地址必须与 JWT（req.auth）一致，
 * 或通道场景下必须为参与者。
 */

export function authedAddressLower(req) {
    return String(req.auth?.address ?? "").toLowerCase();
}

/**
 * @returns {boolean} false 时已写入 403 响应
 */
export function assertSameWallet(bodyAddr, req, res, label = "address") {
    const authed = authedAddressLower(req);
    const b = String(bodyAddr ?? "").toLowerCase();
    if (!authed || !b || authed !== b) {
        res.status(403).json({
            code: 9003,
            error: `${label} 必须与当前登录钱包一致`,
        });
        return false;
    }
    return true;
}

/**
 * channel 记录须含 participant1 / participant2（小写存储）
 * @returns {boolean} false 时已写入 403 响应
 */
export function assertChannelParticipant(channelRecord, req, res) {
    const me = authedAddressLower(req);
    const p1 = String(channelRecord.participant1 ?? "").toLowerCase();
    const p2 = String(channelRecord.participant2 ?? "").toLowerCase();
    if (me && (me === p1 || me === p2)) return true;
    res.status(403).json({
        code: 9004,
        error: "调用方必须是该支付通道的参与方之一",
    });
    return false;
}

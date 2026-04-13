"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import clsx from "clsx"; // 需要安装: npm install clsx

// ==================== 类型定义 ====================

/** 消息角色 */
type MessageRole = "user" | "assistant";

/** 单条消息结构 */
interface Message {
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** API 响应结构（根据实际后端调整） */
interface ChatResponse {
  reply: string;
  // 可选扩展字段
  error?: string;
}

// ==================== 常量 ====================

/** API 端点（支持环境变量覆盖） */
const CHAT_API_ENDPOINT = process.env.NEXT_PUBLIC_AI_CHAT_API || "/v1/ai/chat";

/** 欢迎消息 */
const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "你好！我是 TrustAid AI 助手，可以帮你解答零知识证明、SBT 等级规则及申领故障排查问题。",
  timestamp: Date.now(),
};

/** 快捷问题列表 */
const QUICK_QUESTIONS = [
  "什么是 Nullifier？",
  "如何查询 SBT 等级？",
  "申领失败怎么办？",
] as const;

/** 网络错误时的回退消息 */
const FALLBACK_ERROR_MESSAGE = "网络异常，请检查后端服务后重试。";
const API_ERROR_MESSAGE = "抱歉，AI 助手暂时无法回答，请稍后再试。";

// ==================== 组件 ====================

export default function AIChatbot() {
  // 状态
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // DOM 引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // ========== 副作用 ==========

  // 打开聊天窗口时添加欢迎消息（仅第一次）
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([WELCOME_MESSAGE]);
    }
  }, [isOpen, messages.length]);

  // 消息更新时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 打开窗口时自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      // 延迟确保 DOM 渲染完成
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 按 ESC 键关闭窗口
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // ========== 业务逻辑 ==========

  /** 发送消息 */
  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    // 添加用户消息
    const userMessage: Message = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        // 处理 HTTP 错误状态
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      const replyText = data.reply?.trim() || API_ERROR_MESSAGE;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: replyText,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error("AI 聊天请求失败:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: FALLBACK_ERROR_MESSAGE,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      // 发送后重新聚焦输入框
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading]);

  /** 处理输入框键盘事件 */
  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  /** 处理输入框内容变化 */
  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  /** 快捷问题点击：填充输入框并发送 */
  const handleQuickQuestion = useCallback((question: string) => {
    setInputValue(question);
    // 延迟一下让输入框更新后再发送，避免状态异步问题
    setTimeout(() => sendMessage(), 0);
  }, [sendMessage]);

  /** 切换窗口开关 */
  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /** 关闭窗口 */
  const closeWindow = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ========== 派生状态 ==========
  const isSendDisabled = isLoading || !inputValue.trim();

  // 缓存快捷问题列表，避免每次渲染重建
  const quickQuestionsList = useMemo(
    () => QUICK_QUESTIONS.map((q) => ({ text: q, onClick: () => handleQuickQuestion(q) })),
    [handleQuickQuestion]
  );

  // ========== 渲染辅助 ==========
  const renderMessage = (msg: Message, idx: number) => {
    const isUser = msg.role === "user";
    return (
      <div
        key={idx}
        className={clsx("flex", isUser ? "justify-end" : "justify-start")}
      >
        <div
          className={clsx(
            "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-white rounded-br-sm"
              : "bg-gray-100 text-primary rounded-bl-sm"
          )}
        >
          {msg.content}
        </div>
      </div>
    );
  };

  // ========== JSX ==========
  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? "关闭 AI 客服" : "打开 AI 客服"}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      {/* 聊天窗口 */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-gray-100/60 bg-white shadow-2xl sm:w-96"
          role="dialog"
          aria-label="AI 客服聊天窗口"
        >
          <div className="flex items-center justify-between bg-primary px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">TrustAid AI 助手</div>
              <div className="text-xs text-white/70">
                零知识证明 · SBT 规则 · 申领帮助
              </div>
            </div>
            <button
              onClick={closeWindow}
              className="text-white/70 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label="关闭聊天窗口"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-alert/20 bg-alert/10 px-4 py-2 text-xs text-alert">
            🔒 AI 助手永远不会询问您的私钥或助记词
          </div>

          {/* 消息列表区域，使用 aria-live 区域让屏幕阅读器自动读取新消息 */}
          <div
            className="flex-1 overflow-y-auto px-3 py-4"
            style={{ maxHeight: "320px" }}
            aria-live="polite"
          >
            <div className="space-y-3">
              {messages.map(renderMessage)}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-steel">
                    <span className="animate-pulse">AI 助手思考中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 快捷问题（仅在消息很少时显示） */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {quickQuestionsList.map(({ text, onClick }) => (
                <button
                  key={text}
                  onClick={onClick}
                  className="rounded-full border border-gray-300 px-2 py-1 text-xs text-steel transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          {/* 输入区域 */}
          <div className="flex gap-2 border-t border-gray-100/60 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              disabled={isLoading}
              placeholder="输入问题..."
              className="flex-1 rounded-xl border border-gray-100/60 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100"
              aria-label="输入您的问题"
            />
            <button
              onClick={sendMessage}
              disabled={isSendDisabled}
              className="rounded-xl bg-primary px-3 py-1.5 text-sm text-white transition hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="发送消息"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
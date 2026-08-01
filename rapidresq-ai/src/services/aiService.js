const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 5000;

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const KEYWORD_RULES = [
  { pattern: /(unconscious|not breathing|cardiac|heart attack|fire|explosion)/i, priority: "CRITICAL" },
  { pattern: /(accident|injur|bleeding|collapsed|trapped)/i, priority: "HIGH" },
  { pattern: /(minor|sprain|small|slight)/i, priority: "MEDIUM" },
];

function classifyByRules(description) {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(description)) return rule.priority;
  }
  return "LOW";
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), ms)),
  ]);
}

async function classifyPriority(description) {
  if (!genAI) {
    const priority = classifyByRules(description);
    logger.warn("GEMINI_API_KEY not set, using rule-based fallback");
    return { priority, source: "fallback" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const prompt = `Classify this emergency into exactly one word: LOW, MEDIUM, HIGH, or CRITICAL.\nDescription: "${description}"\nRespond with only the single word, nothing else.`;

    const result = await withTimeout(model.generateContent(prompt), AI_TIMEOUT_MS);
    const text = result.response.text().trim().toUpperCase();

    if (VALID_PRIORITIES.includes(text)) {
      logger.info(`Gemini classified priority: ${text}`);
      return { priority: text, source: "gemini" };
    }
    throw new Error(`Unexpected AI response: ${text}`);
  } catch (err) {
    logger.error(`AI classification failed (${err.message}), using rule fallback`);
    const priority = classifyByRules(description);
    return { priority, source: "fallback" };
  }
}

module.exports = { classifyPriority, classifyByRules };

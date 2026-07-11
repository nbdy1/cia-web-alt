export const MODEL_OPTIONS = [
    { id: 'google/gemini-3-flash-preview',   label: 'Gemini 3.0 Flash', desc: 'Our original baseline model' },

  { id: 'openai/gpt-5-mini',                 label: 'GPT-5 Mini', desc: 'Fast and cheap with strong instruction following' },
  { id: 'anthropic/claude-haiku-4.5',        label: 'Claude Haiku 4.5', desc: 'Fast Anthropic model, good balance of speed and reasoning quality' },
  { id: 'deepseek/deepseek-v4-flash',        label: 'DeepSeek V4 Flash', desc: 'Low-latency DeepSeek variant for quick turnaround' },
  { id: 'deepseek/deepseek-v4-pro',          label: 'DeepSeek V4 Pro', desc: 'Higher-capacity DeepSeek variant for deeper reasoning' },


  { id: 'qwen/qwen-2.5-7b-instruct',         label: 'Qwen 2.5 7B',  desc: 'Extremely strong at structured report logic' },

  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', desc: 'General fallback, great multilingual' },
   {
    id: 'qwen/qwen-2.5-14b-instruct',
    label: 'Qwen 2.5 14B',
    desc: 'A lighter compromise if 72B models prove too resource-heavy for local server deployment later.'
  },
  {
    id: 'google/gemma-4-31b',
    label: 'Gemma 4 31B',
    desc: 'Google DeepMind\'s latest open model; naturally shares architectural DNA and multilingual strengths with Gemini.'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    desc: 'Massive upgrade over Llama 3.1 8B. Highly analytical with great instruction following.'
  },
{
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B',
    desc: 'Top-tier open model; exceptional at complex Bahasa Indonesia reasoning and RAG extraction.'
  },

  
] as const;

export type ModelOptionId = typeof MODEL_OPTIONS[number]['id'];

export function getModelLabel(id: string | null | undefined): string {
  if (!id) return "Gemini 3.0 Flash";
  const option = MODEL_OPTIONS.find(m => m.id === id);
  return option ? option.label : id;
}

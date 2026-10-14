CREATE TABLE IF NOT EXISTS public.words (
  id         bigserial    PRIMARY KEY,
  word       varchar(64)  NOT NULL UNIQUE,
  meaning    varchar(255) NOT NULL,
  pack_id    varchar(32)  NOT NULL,
  status     varchar(16)  NOT NULL DEFAULT 'todo'
             CHECK (status IN ('todo', 'doing', 'done')),
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.answer_logs (
  id            bigserial   PRIMARY KEY,
  word_id       bigint      NOT NULL REFERENCES public.words (id) ON DELETE RESTRICT,
  correct       boolean     NOT NULL,
  energy_gained integer     NOT NULL DEFAULT 0 CHECK (energy_gained >= 0),
  answered_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answer_logs_word_id ON public.answer_logs (word_id);
CREATE INDEX IF NOT EXISTS idx_answer_logs_answered_at ON public.answer_logs (answered_at);

COMMENT ON TABLE  public.words IS '单词主表：存要学的单词本身（Day 16 建）';
COMMENT ON COLUMN public.words.id         IS '自增主键，bigserial';
COMMENT ON COLUMN public.words.word       IS '单词拼写，唯一：种子脚本靠它做幂等';
COMMENT ON COLUMN public.words.meaning    IS '中文释义';
COMMENT ON COLUMN public.words.pack_id    IS '词包标识，对应 words.js 里 WORD_PACKS 的 id';
COMMENT ON COLUMN public.words.status     IS '掌握状态：todo 未开始 / doing 学习中 / done 已掌握';
COMMENT ON COLUMN public.words.created_at IS '入库时间，timestamptz 带时区避免 8 小时偏差';

COMMENT ON TABLE  public.answer_logs IS '答题记录表：每答一题一行，随使用时间累积（Day 16 建）';
COMMENT ON COLUMN public.answer_logs.id            IS '自增主键，bigserial';
COMMENT ON COLUMN public.answer_logs.word_id       IS '关联字段：指向 words.id，一个单词对应多条记录';
COMMENT ON COLUMN public.answer_logs.correct       IS '本次是否答对';
COMMENT ON COLUMN public.answer_logs.energy_gained IS '本次答题获得的体力，答错为 0';
COMMENT ON COLUMN public.answer_logs.answered_at   IS '答题时间，Day 19 周榜按它所在周聚合';

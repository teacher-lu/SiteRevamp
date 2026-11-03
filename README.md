# SiteRevamp

用于生成 SEO / AEO 页面诊断报告的 Next.js 前端与 FastAPI 后端。

## 本地启动

1. 安装前端依赖：`npm install`
2. 在 `backend` 中创建虚拟环境并安装依赖：`pip install -r backend/requirements.txt`
3. 复制 `backend/.env.example` 为 `backend/.env`，填入所有 `SITE_REVAMP_` 变量。
4. 启动后端：`uvicorn backend.main:app --reload --port 8000`
5. 另开终端启动前端：`npm run dev`

首次启动后端会在已连接的 PostgreSQL / Supabase 数据库中创建 `users` 与 `reports` 表；不会删除或修改已有数据。

## 从 Supabase 获取数据库 URL

打开目标 Supabase 项目，依次进入 **Connect → ORMs → SQLAlchemy**，复制连接字符串后填入 `SITE_REVAMP_SQLALCHEMY_DATABASE_URL`。

本项目的 Python 驱动是 `psycopg2-binary`，因此连接串应以 `postgresql+psycopg2://` 开头。部署到 Vercel 时，选择 **Transaction pooler**（通常端口 `6543`），并保留 `?sslmode=require`。不要把数据库密码、JWT 密钥或 AI API Key 放到 `NEXT_PUBLIC_` 变量中。

已有的根目录 `.env.local` 中两个 `NEXT_PUBLIC_SUPABASE_*` 变量目前没有被项目代码读取；它们不是后端 SQLAlchemy 连接配置，可在确认没有其他服务依赖后删除。

## Vercel

在 Vercel Project Settings → Environment Variables 中设置与 `backend/.env` 相同的 `SITE_REVAMP_` 变量。Vercel 会识别 `api/index.py` 为 Python Function，根目录 `requirements.txt` 会安装后端依赖，`vercel.json` 将 `/api/*` 路由交给 FastAPI；本地开发时，前端会直接调用 `http://127.0.0.1:8000`。

`SITE_REVAMP_AI_MODEL` 当前设置为 `gemini-4-argon`。AI 报告通过格式校验并成功保存后才会扣除一次积分；AI 网关异常、非 JSON 响应或数据库保存失败都不会扣积分。

为避免已有 Vercel 部署在迁移期间无法启动，后端会临时兼容旧变量名 `SQLALCHEMY_DATABASE_URL`、`SECRET_KEY`、`OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `AI_MODEL`。新建或更新配置时仍应优先使用 `SITE_REVAMP_*` 名称。

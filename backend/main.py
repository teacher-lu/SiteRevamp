import os
import uuid
import json
import re
import logging
import asyncio
import httpx
import html2text
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup
from fastapi import FastAPI, Depends, HTTPException, status
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from openai import AsyncOpenAI
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

# 从 backend/.env 加载后端专用配置；不要依赖启动命令所在的目录。
load_dotenv(Path(__file__).with_name(".env"))


def require_env(name: str, legacy_name: Optional[str] = None) -> str:
    """Return a required setting, preferring the SiteRevamp-specific name."""
    value = os.getenv(name)
    if not value and legacy_name:
        # Keeps existing Vercel deployments working during the environment-variable
        # migration. The SITE_REVAMP_* name always wins when both are present.
        value = os.getenv(legacy_name)
    if not value:
        accepted_names = f"{name} 或 {legacy_name}" if legacy_name else name
        raise RuntimeError(
            f"缺少必填环境变量 {accepted_names}。请复制 backend/.env.example 为 backend/.env 并填写。"
        )
    return value


logger = logging.getLogger(__name__)

# ----------------- 0. 鉴权与加密核心配置（使用环境变量） -----------------
# 这些名称都带 SITE_REVAMP 前缀，便于与同一机器上的其他项目区分。
SECRET_KEY = require_env("SITE_REVAMP_JWT_SECRET_KEY", "SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 初始化 AI 客户端（直接从环境变量读取 API Key 和 Base URL）
client = AsyncOpenAI(
    api_key=require_env("SITE_REVAMP_OPENAI_API_KEY", "OPENAI_API_KEY"),
    base_url=os.getenv(
        "SITE_REVAMP_OPENAI_BASE_URL",
        os.getenv("OPENAI_BASE_URL", "https://api.openlux.ai/v1"),
    ),
)
AI_MODEL = os.getenv("SITE_REVAMP_AI_MODEL", os.getenv("AI_MODEL", "gemini-4-argon"))

# ----------------- 1. PostgreSQL 数据库连接配置 -----------------
# 在 Supabase Dashboard 的 Connect > ORMs > SQLAlchemy 中复制连接串。
# Serverless 环境建议使用 Transaction pooler 的 6543 端口，并保留 sslmode=require。
SQLALCHEMY_DATABASE_URL = require_env(
    "SITE_REVAMP_SQLALCHEMY_DATABASE_URL", "SQLALCHEMY_DATABASE_URL"
)

# 【重要修改】: 针对 Serverless 环境添加了 pool_pre_ping=True
# 这会在每次查询前自动检测连接是否有效，防止 Supabase 断开空闲连接导致报错
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserModel(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(191), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    credits = Column(Integer, default=3)

class ReportModel(Base):
    __tablename__ = "reports"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    target_url = Column(Text, nullable=False)
    keyword = Column(String(191), nullable=False)
    page_type = Column(String(100))
    report_data = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 新 Supabase 项目首次启动时创建应用所需的两张表；已有表不会被删除或覆盖。
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)

# 带凭据的 CORS 不能搭配通配符来源；同域部署无需额外来源。
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "SITE_REVAMP_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------- 2. 鉴权模型与依赖 -----------------
class UserAuthRequest(BaseModel):
    email: str
    password: str

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证或未登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# ----------------- 3. 注册与登录 API -----------------
@app.post("/api/register")
def register(user_data: UserAuthRequest, db: Session = Depends(get_db)):
    existing_user = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")
    
    hashed_pwd = get_password_hash(user_data.password)
    new_user = UserModel(
        id=str(uuid.uuid4()),
        email=user_data.email,
        hashed_password=hashed_pwd,
        credits=3
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer", "credits": new_user.credits}

@app.post("/api/login")
def login(user_data: UserAuthRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="邮箱或密码错误")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "credits": user.credits}

@app.get("/api/me")
def get_user_profile(current_user: UserModel = Depends(get_current_user)):
    return {"email": current_user.email, "credits": current_user.credits}

# ----------------- 4. AI 分析与积分扣除接口 -----------------
class ScrapeRequest(BaseModel):
    url: str
    keyword: str
    page_type: str


def parse_ai_report(raw_content: Optional[str]) -> dict:
    """Normalize either a structured JSON report or a plain-text AI report."""
    if not raw_content or not raw_content.strip():
        raise ValueError("AI returned an empty response")

    content = raw_content.strip()
    normalized_content = content.lower()
    gateway_errors = (
        "internal server error",
        "bad gateway",
        "service unavailable",
        "gateway timeout",
    )
    if any(marker in normalized_content for marker in gateway_errors):
        raise ValueError("AI provider returned a gateway error")

    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]

    # Prefer the structured format whenever it is available.
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end >= start:
        try:
            report_data = json.loads(content[start : end + 1])
            scores = report_data.get("scores") if isinstance(report_data, dict) else None
            if isinstance(scores, dict) and all(
                isinstance(scores.get(key), (int, float))
                for key in ("overall", "google", "ai")
            ) and isinstance(report_data.get("summary"), str):
                return report_data
        except json.JSONDecodeError:
            pass

    # Some compatible-model gateways return a useful text report rather than the
    # requested JSON. Preserve it instead of treating useful analysis as a failure.
    return {
        "report_format": "text",
        "scores": {"overall": 0, "google": 0, "ai": 0},
        "summary": content,
        "good_points": [],
        "priority_actions": [],
        "title_suggestions": [],
        "meta_suggestions": [],
        "h1_suggestions": [],
        "h2_suggestions": [],
        "faq_suggestions": [],
        "internal_links": [],
        "backlink_opportunities": [],
    }


async def generate_ai_report(system_prompt: str) -> dict:
    """Request an AI report, retrying transient gateway and malformed-output failures."""
    last_error: Optional[Exception] = None

    for attempt in range(3):
        try:
            completion = await client.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "请生成结构化的深度优化诊断报告。只需返回 JSON。"},
                ],
                temperature=0.7,
            )
            return parse_ai_report(completion.choices[0].message.content)
        except Exception as exc:
            last_error = exc
            logger.warning(
                "AI attempt %s/3 failed for model %s: %s",
                attempt + 1,
                AI_MODEL,
                exc,
            )
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    raise RuntimeError("AI did not produce a valid report after retries") from last_error

@app.post("/api/analyze")
async def analyze_page(
    request: ScrapeRequest, 
    current_user: UserModel = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if current_user.credits <= 0:
        raise HTTPException(status_code=403, detail="您的积分已用完，请充值后继续")

    # End the authentication read transaction before network and AI calls. The
    # credit is rechecked under a row lock immediately before it is charged.
    current_user_id = current_user.id
    db.rollback()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1"
    }
    
    try:
        async with httpx.AsyncClient(verify=False, follow_redirects=True) as http_client:
            response = await http_client.get(request.url, headers=headers, timeout=20.0)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"抓取失败: {str(e)}")

    title = soup.title.string.strip() if soup.title and soup.title.string else "缺失"
    meta_desc_tag = soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)})
    meta_desc = meta_desc_tag['content'].strip() if meta_desc_tag and meta_desc_tag.get('content') else "缺失"
    h1_tags = [h1.get_text(strip=True) for h1 in soup.find_all('h1')]

    for element in soup(["script", "style", "noscript", "svg", "header", "footer"]):
        element.decompose()
    
    h2t = html2text.HTML2Text()
    h2t.ignore_images = True
    markdown_content = h2t.handle(str(soup.body))[:4000] 

    system_prompt = f"""
    你是一个顶级的 Google SEO 和 AI AEO 可见性诊断引擎。
    请深度分析这个 {request.page_type}，目标关键词是: '{request.keyword}'。
    
    当前 Title: {title}
    当前 Meta: {meta_desc}
    当前 H1: {h1_tags}
    页面正文: {markdown_content}

    优先以纯 JSON 格式返回结果，严格遵循以下结构（不要任何 markdown 标记）。
    如果当前模型或渠道不支持 JSON 模式，请直接输出完整、可读的中文文本诊断报告；不要输出 API 错误、状态码或解释说明：
    {{
        "scores": {{"overall": 72, "google": 75, "ai": 68}},
        "summary": "这是一个典型的垂直电商独立站首页，产品分类非常清晰，但目前严重缺乏基础 SEO 优化...",
        "good_points": [
            "首页已明确覆盖相关配件主题，搜索意图匹配度较高。",
            "已展示具体商品、价格、评分和促销信息，有利于电商页转化。",
            "页面中多处重复出现目标词，有助于核心词语义聚焦。"
        ],
        "priority_actions": [
            {{
                "title": "优化标题标签，直接对准核心关键词",
                "description": "当前标题仅为域名，不包含核心关键词或品牌价值点。建议改为包含主词、品牌名和核心卖点的可点击标题。",
                "category": "Metadata",
                "google_benefit": "显著提升相关性与点击率，帮助 Google 更快识别首页主题。",
                "ai_benefit": "增强 AI 抽取页面主题时的实体一致性与主词清晰度。"
            }}
        ],
        "title_suggestions": ["建议1", "建议2", "建议3"],
        "meta_suggestions": ["建议1", "建议2", "建议3"],
        "h1_suggestions": ["建议1", "建议2", "建议3"],
        "h2_suggestions": ["H2建议1", "H2建议2", "H2建议3", "H2建议4"],
        "faq_suggestions": [
            {{"question": "用户常见问题1?", "answer": "对应的简短专业回答。"}}
        ],
        "internal_links": [
            {{"target": "https://zealviz.com/category", "anchor": "精准锚文本", "position": "在新增的首页品牌介绍段落中"}}
        ],
        "backlink_opportunities": [
            {{"type": "户外露营博客或科技媒体", "description": "争取来自博主的评测或装备清单链接..."}}
        ]
    }}
    """

    try:
        report_data = await generate_ai_report(system_prompt)
    except Exception as exc:
        logger.exception("AI analysis request failed")
        raise HTTPException(
            status_code=502,
            detail="AI 服务暂时不可用，请稍后重试；本次不会扣除积分。",
        ) from exc

    try:
        # Lock and recheck immediately before charging. Report insertion and the
        # credit decrement are committed together, so either both persist or neither does.
        locked_user = (
            db.query(UserModel)
            .filter(UserModel.id == current_user_id)
            .with_for_update()
            .first()
        )
        if locked_user is None:
            raise HTTPException(status_code=401, detail="用户不存在或登录已失效")
        if locked_user.credits <= 0:
            raise HTTPException(status_code=403, detail="您的积分已用完，请充值后继续")

        new_report = ReportModel(
            id=str(uuid.uuid4()),
            user_id=locked_user.id,
            target_url=request.url,
            keyword=request.keyword,
            page_type=request.page_type,
            report_data=report_data,
            created_at=datetime.now()
        )
        db.add(new_report)
        locked_user.credits -= 1
        remaining_credits = locked_user.credits
        db.commit()

        return {
            "status": "success", 
            "remaining_credits": remaining_credits,
            "report": report_data
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Saving completed AI report failed")
        raise HTTPException(
            status_code=500,
            detail="报告保存失败，请稍后重试；本次不会扣除积分。",
        ) from e

# ----------------- 5. 获取当前用户的历史报告列表 API -----------------
@app.get("/api/reports")
def get_user_reports(
    current_user: UserModel = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    reports = db.query(ReportModel).filter(ReportModel.user_id == current_user.id).all()
    
    result = []
    for r in reports:
        time_str = "暂无数据"
        if r.created_at:
            try:
                time_str = r.created_at.strftime("%Y-%m-%d %H:%M")
            except Exception:
                time_str = str(r.created_at)[:16]

        result.append({
            "id": r.id,
            "target_url": r.target_url,
            "keyword": r.keyword,
            "page_type": r.page_type,
            "report_data": r.report_data,
            "created_at": time_str
        })
    return {"status": "success", "reports": result}

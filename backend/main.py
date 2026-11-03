import os
import uuid
import json
import re
import httpx
import html2text
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
from fastapi import FastAPI, Depends, HTTPException, status
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

# 1. 在文件最顶部加载 .env 文件
load_dotenv()

# ----------------- 0. 鉴权与加密核心配置（使用环境变量） -----------------
# 如果 .env 里没有配置 SECRET_KEY，则提供一个默认的降级方案
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key_here")
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
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL", "https://api.openlux.ai/v1") 
)

app = FastAPI()

# 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 部署到 Vercel 后，前端和后端在同域，但为了兼容本地开发，可保持开放或配置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- 1. PostgreSQL 数据库连接配置 -----------------
# 这里会自动读取你在 Vercel 或 .env 中配置的 Supabase 连接字符串
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

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

@app.post("/api/analyze")
async def analyze_page(
    request: ScrapeRequest, 
    current_user: UserModel = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if current_user.credits <= 0:
        raise HTTPException(status_code=403, detail="您的积分已用完，请充值后继续")

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

    请必须以纯 JSON 格式返回结果，严格遵循以下结构（不要任何 markdown 标记）：
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
        completion = await client.chat.completions.create(
            model="gemini-3.1-pro-preview", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "请生成结构化的深度优化诊断报告。只需返回 JSON。"}
            ],
            temperature=0.7
        )
        
        raw_content = completion.choices[0].message.content
        clean_content = raw_content.strip()
        if clean_content.startswith("```json"): clean_content = clean_content[7:]
        elif clean_content.startswith("```"): clean_content = clean_content[3:]
        if clean_content.endswith("```"): clean_content = clean_content[:-3]
            
        report_data = json.loads(clean_content.strip())
        
        current_user.credits -= 1
        db.commit()

        new_report = ReportModel(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            target_url=request.url,
            keyword=request.keyword,
            page_type=request.page_type,
            report_data=report_data,
            created_at=datetime.now()
        )
        db.add(new_report)
        db.commit()

        return {
            "status": "success", 
            "remaining_credits": current_user.credits,
            "report": report_data
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI 分析失败: {str(e)}")

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